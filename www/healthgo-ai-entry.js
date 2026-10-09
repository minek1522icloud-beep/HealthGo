import { initializeApp, getApps } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken } from 'firebase/app-check';

(async function(){
  try{
    const firebaseConfig = {
      apiKey: "AIzaSyC841XoWIJ1AANTuIJ88s_mUIPa0MgrJZM",
      authDomain: "healthgo-e45be.firebaseapp.com",
      projectId: "healthgo-e45be",
      storageBucket: "healthgo-e45be.firebasestorage.app",
      messagingSenderId: "924242915977",
      appId: "1:924242915977:web:bed648007802203cf28c58"
    };

    // Repeated bundle loading must not initialize App Check twice for one Firebase app.
    const aiApp=getApps().find(app=>app.name==='healthgo-mobile-ai')
      ||initializeApp(firebaseConfig,'healthgo-mobile-ai');
    const desktopLocal=/^(127\.0\.0\.1|localhost)$/.test(location.hostname);
    let appCheck=null;
    if(!desktopLocal){
      const existing=window.__healthGoAppCheckInstance;
      appCheck=existing&&existing.app===aiApp?existing:null;
      if(!appCheck){
        appCheck=initializeAppCheck(aiApp,{
          provider:new ReCaptchaEnterpriseProvider('6LejMdktAAAAAH1fKJ0wcrsG_WLjImYUHyNjpXMR'),
          isTokenAutoRefreshEnabled:true
        });
        window.__healthGoAppCheckInstance=appCheck;
      }
    }
    const ai=getAI(aiApp,{backend:new GoogleAIBackend()});

    function systemInstruction(accountType){
      const common=[
        'Jesteś HealthGo AI, pomocnym asystentem aplikacji HealthGo.',
        'Odpowiadaj po polsku, jasno, życzliwie i konkretnie.',
        'Nie udawaj, że HealthGo ma dane, których nie otrzymał.',
        'Jeżeli pytanie dotyczy zdrowia, nie stawiaj diagnozy i zachęć do rozmowy z zaufanym dorosłym lub lekarzem, gdy objawy są poważne.',
        'Nie podawaj niebezpiecznych instrukcji, nie promuj ryzykownych zachowań ani szkodliwych porad dotyczących jedzenia, ciała lub ćwiczeń.',
        'Nie ujawniaj prywatnych danych użytkownika.'
      ];
      if(accountType==='child'){
        common.push('To konto dziecka: używaj prostego, bezpiecznego i przyjaznego języka oraz szczególnie chroń prywatność użytkownika.');
      }
      return common.join(' ');
    }

    function buildPrompt(message,mode,history,responseMode){
      const modeNames={assistant:'Asystent',plan:'Plan dnia',food:'Jedzenie',activity:'Aktywność',explore:'Odkrywanie'};
      const responseNames={
        average:'Przeciętny — odpowiedź krótka i szybka, zwykle 2–5 zdań.',
        medium:'Średni — umiarkowana ilość szczegółów.',
        high:'Wysoki — odpowiedź dokładniejsza i bardziej szczegółowa.'
      };
      const recent=(Array.isArray(history)?history:[]).slice(-10).map(x=>{
        const role=x&&x.role==='assistant'?'HealthGo AI':'Użytkownik';
        return role+': '+String((x&&x.content)||'').slice(0,1200);
      }).join('\n');
      return [
        'Tryb: '+(modeNames[mode]||'Asystent')+'.',
        'Poziom odpowiedzi: '+(responseNames[responseMode]||responseNames.average),
        recent?'Ostatnia część rozmowy:\n'+recent:'',
        'Nowa wiadomość użytkownika:\n'+message
      ].filter(Boolean).join('\n\n');
    }

    function imagePart(dataUrl){
      if(!dataUrl||typeof dataUrl!=='string'||!dataUrl.startsWith('data:'))return null;
      const comma=dataUrl.indexOf(',');
      if(comma<0)return null;
      const meta=dataUrl.slice(5,comma);
      const mime=(meta.split(';')[0]||'image/jpeg').toLowerCase();
      if(!['image/png','image/jpeg','image/webp'].includes(mime))return null;
      return {inlineData:{data:dataUrl.slice(comma+1),mimeType:mime}};
    }

    function notifyStage(onStatus,stage){
      if(typeof onStatus==='function'){
        try{onStatus(stage)}catch(_){}
      }
    }
    async function boundedAppCheck(promise,signal,limitMs){
      if(signal?.aborted)throw new Error('AI_CANCELLED');
      let timer=null,abortHandler=null;
      try{
        return await Promise.race([
          promise,
          new Promise((_,reject)=>{
            timer=setTimeout(()=>reject(new Error('APP_CHECK_TIMEOUT')),limitMs);
            if(signal){
              abortHandler=()=>reject(new Error('AI_CANCELLED'));
              signal.addEventListener('abort',abortHandler,{once:true});
            }
          })
        ]);
      }finally{
        if(timer)clearTimeout(timer);
        if(signal&&abortHandler)signal.removeEventListener('abort',abortHandler);
      }
    }
    async function requireAppCheck(signal,onStatus){
      if(!appCheck)return;
      notifyStage(onStatus,'Sprawdzam zabezpieczenie App Check…');
      for(let attempt=0;attempt<2;attempt++){
        try{
          const result=await boundedAppCheck(getToken(appCheck,attempt===1),signal,11000);
          // Firebase can return a placeholder token alongside an attestation
          // error. Never treat that response as a verified App Check session.
          if(result?.error)throw result.error;
          if(!result||!result.token)throw new Error('APP_CHECK_EMPTY_TOKEN');
          notifyStage(onStatus,'Zabezpieczenie gotowe. Łączę z Gemini…');
          return;
        }catch(error){
          if(signal?.aborted)throw new Error('AI_CANCELLED');
          if(attempt===1){
            const code=String(error?.code||'app-check/token-error');
            const msg=String(error?.message||'Brak tokenu App Check');
            throw new Error('APP_CHECK_ERROR '+code+' '+msg.slice(0,220));
          }
        }
      }
    }
    async function requestGemini(model,parts,limitMs,outerSignal){
      if(outerSignal?.aborted)throw new Error('AI_CANCELLED');
      const controller=new AbortController();
      let rejectWatchdog;
      const watchdog=new Promise((_,reject)=>{rejectWatchdog=reject});
      const onOuterAbort=()=>{
        controller.abort();
        rejectWatchdog(new Error('AI_CANCELLED'));
      };
      if(outerSignal)outerSignal.addEventListener('abort',onOuterAbort,{once:true});
      const timeout=setTimeout(()=>{
        controller.abort();
        rejectWatchdog(new Error('AI_PROVIDER_TIMEOUT'));
      },limitMs);
      try{
        // The timeout rejects the Promise even on a device where aborting a
        // pending Firebase fetch does not immediately settle that fetch.
        return await Promise.race([
          model.generateContent(parts,{signal:controller.signal,timeout:limitMs}),
          watchdog
        ]);
      }finally{
        clearTimeout(timeout);
        controller.abort();
        if(outerSignal)outerSignal.removeEventListener('abort',onOuterAbort);
      }
    }
    window.healthGoMobileAI={
      async diagnose(){
        await requireAppCheck(null,null);
        return {appCheck:'ready',firebaseApp:aiApp.name};
      },
      async ask({message,mode,history,imageData,accountType,responseMode,signal,onStatus}){
        await requireAppCheck(signal,onStatus);

        const level=['average','medium','high'].includes(responseMode)?responseMode:'average';
        const prompt=buildPrompt(String(message||''),mode,history,level);
        // Gemini 3.x may use part of the token budget for reasoning.
        // Keep enough room for a final user-visible answer in every mode.
        const maxOutputTokens=level==='average'?1536:level==='medium'?3072:4096;
        const parts=[prompt];
        const img=imagePart(imageData);
        if(img)parts.push(img);

        // Only officially supported, stable Firebase AI Logic model identifiers.
        // Keep quick mode economical; high mode prefers the higher-quality Flash.
        const models=level==='average'
          ? ['gemini-3.5-flash-lite','gemini-3.5-flash']
          : level==='medium'
          ? ['gemini-3.5-flash','gemini-3.8-flash']
          : ['gemini-3.8-flash','gemini-3.5-flash'];
        let lastError=null;
        for(const modelName of models){
          if(signal?.aborted)throw new Error('AI_CANCELLED');
          notifyStage(onStatus,'Generuję odpowiedź w Gemini…');
          try{
            const model=getGenerativeModel(ai,{
              model:modelName,
              systemInstruction:systemInstruction(accountType),
              generationConfig:{maxOutputTokens}
            });
            // SDK defaults to 180s. Use a real AbortSignal and per-request
            // timeout so an unresponsive Gemini request cannot hang on mobile.
            const limit=level==='average'?18000:level==='medium'?26000:36000;
            const result=await requestGemini(model,parts,limit,signal);
            const answer=String(result?.response?.text?.()||'').trim();
            if(!answer)throw new Error('EMPTY_AI_RESPONSE');
            notifyStage(onStatus,'Odpowiedź gotowa.');
            return answer;
          }catch(error){
            if(signal?.aborted||/AI_CANCELLED/.test(String(error?.message||'')))throw new Error('AI_CANCELLED');
            lastError=error;
            const msg=String(error?.message||error||'');
            const code=String(error?.code||'');
            const details=msg+' '+code;
            if(/permission-denied|unauthenticated|api-key-not-valid|invalid-api-key|403|401|app.check|recaptcha|billing/i.test(details))
              throw new Error('AI_AUTH_ERROR '+details.slice(0,280));
            if(/429|resource-exhausted|quota/i.test(details))
              throw new Error('AI_RATE_LIMIT '+details.slice(0,280));
            const unavailable=/404|not.?found|unsupported|failed-precondition|500|502|503|504|unavailable|AI_PROVIDER_TIMEOUT|network|fetch|timeout/i.test(details);
            if(!unavailable)break;
            // One fallback to a compatible stable model, never an unbounded
            // retry storm or another request after a real cancellation.
            notifyStage(onStatus,'Ten model nie odpowiedział. Próbuję modelu zapasowego…');
          }
        }

        const code=String(lastError?.code||'ai/request-failed');
        const err=String(lastError?.message||lastError||'AI request failed');
        throw new Error('AI_REQUEST_ERROR '+code+' '+err.slice(0,280));
      }
    };

    window.healthGoMobileAIInitError='';
    window.dispatchEvent(new Event('healthgo-mobile-ai-ready'));
  }catch(error){
    console.error('HealthGo Mobile AI init:',error);
    const code=String((error&&error.code)||'');
    const text=String((error&&error.message)||error||'AI_INIT_ERROR');
    window.healthGoMobileAIInitError=(code?code+' ':'')+text;
  }
})();
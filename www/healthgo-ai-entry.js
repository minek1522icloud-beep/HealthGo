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

    async function requireAppCheck(){
      if(!appCheck)return;
      let firstError;
      for(let attempt=0;attempt<2;attempt++){
        try{
          let timer=null;
          let result;
          try{
            result=await Promise.race([
              getToken(appCheck,attempt===1),
              new Promise((_,reject)=>{
                timer=setTimeout(()=>reject(new Error('APP_CHECK_TIMEOUT')),14000);
              })
            ]);
          }finally{
            if(timer)clearTimeout(timer);
          }
          if(!result||!result.token)throw new Error('APP_CHECK_EMPTY_TOKEN');
          return;
        }catch(error){
          firstError=error;
          if(attempt===1){
            const code=String((error&&error.code)||(firstError&&firstError.code)||'app-check/token-error');
            const message=String((error&&error.message)||error||'token-error');
            // Never weaken App Check or switch to an unauthenticated AI endpoint.
            throw new Error('APP_CHECK_ERROR '+code+' '+message.slice(0,300));
          }
        }
      }
    }
    window.healthGoMobileAI={
      async diagnose(){
        await requireAppCheck();
        return {appCheck:'ready',firebaseApp:aiApp.name};
      },
      async ask({message,mode,history,imageData,accountType,responseMode}){
        await requireAppCheck();

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
          for(let attempt=0;attempt<2;attempt++){
            try{
              const model=getGenerativeModel(ai,{
                model:modelName,
                systemInstruction:systemInstruction(accountType),
                generationConfig:{maxOutputTokens}
              });
              const result=await model.generateContent(parts);
              const answer=result&&result.response&&result.response.text?result.response.text():'';
              if(!answer)throw new Error('EMPTY_AI_RESPONSE');
              return answer;
            }catch(error){
              lastError=error;
              const msg=String((error&&error.message)||error||'');
              const code=String((error&&error.code)||'');
              const details=msg+' '+code;
              const permissionIssue=/permission-denied|unauthenticated|api-key-not-valid|invalid-api-key|403|401|app.check|recaptcha|billing/i.test(details);
              const transient=/429|resource-exhausted|quota|500|502|503|504|unavailable|network|fetch|timeout/i.test(details);
              const modelIssue=/404|not.?found|model|unsupported|failed-precondition/i.test(details);
              if(permissionIssue)throw new Error('AI_AUTH_ERROR '+details);
              // On rate limiting, trying several models immediately multiplies
              // unsuccessful requests. Report the limit instead.
              if(/429|resource-exhausted|quota/i.test(details))throw new Error('AI_RATE_LIMIT '+details);
              if(attempt===0&&transient){
                await new Promise(r=>setTimeout(r,level==='average'?500:1000));
                continue;
              }
              if(modelIssue||transient)break;
              attempt=2;
              break;
            }
          }
        }

        const code=String((lastError&&lastError.code)||'ai/request-failed');
        const text=String((lastError&&lastError.message)||lastError||'AI request failed');
        throw new Error('AI_REQUEST_ERROR '+code+' '+text);
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
import { initializeApp } from 'firebase/app';
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

    const aiApp=initializeApp(firebaseConfig,'healthgo-mobile-ai');
    const appCheck=initializeAppCheck(aiApp,{
      provider:new ReCaptchaEnterpriseProvider('6LejMdktAAAAAH1fKJ0wcrsG_WLjImYUHyNjpXMR'),
      isTokenAutoRefreshEnabled:true
    });
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

    window.healthGoMobileAI={
      async ask({message,mode,history,imageData,accountType,responseMode}){
        try{
          await getToken(appCheck,false);
        }catch(error){
          const code=String((error&&error.code)||'app-check/token-error');
          const text=String((error&&error.message)||error||'App Check error');
          throw new Error('APP_CHECK_ERROR '+code+' '+text);
        }

        const level=['average','medium','high'].includes(responseMode)?responseMode:'average';
        const prompt=buildPrompt(String(message||''),mode,history,level);
        const maxOutputTokens=level==='average'?280:level==='medium'?520:900;
        const parts=[prompt];
        const img=imagePart(imageData);
        if(img)parts.push(img);

        const models=['gemini-3.8-flash','gemini-3.5-flash-lite'];
        let lastError=null;
        for(const modelName of models){
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
            if(!/404|not.?found|model|unavailable|unsupported|failed-precondition/i.test(msg+' '+code))break;
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
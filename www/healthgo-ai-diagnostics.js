(function(root){
'use strict';
function errorText(error){
 if(!error)return '';
 return (String(error.message||error.error||error)+' '+String(error.code||'')).slice(0,800);
}
function classify(error,kind){
 const text=errorText(error).toLowerCase();
 const status=Number(error&&error.status)||0;
 if(!text&&!status)return{code:kind+'_UNKNOWN',label:'Nie otrzymano szczegółów błędu.'};
 if(kind==='CLOUD'){
  if(/app_check|app.check|recaptcha/.test(text))return{code:'CLOUD_APP_CHECK',label:'Usługa zabezpieczeń AI nie potwierdziła dostępu.'};
  if(/ai_auth_error|permission-denied|api.key|invalid-api-key|unauthenticated|403|401/.test(text)||status===401||status===403)
   return{code:'CLOUD_ACCESS',label:'Usługa AI w chmurze odrzuciła dostęp. Wymagana jest weryfikacja konfiguracji usługi.'};
  if(/429|ai_rate_limit|quota|resource-exhausted/.test(text)||status===429)
   return{code:'CLOUD_LIMIT',label:'Usługa AI zgłosiła limit zapytań.'};
  if(/404|not.found|unsupported|model/.test(text)||status===404)
   return{code:'CLOUD_MODEL',label:'Serwer chmurowy nie obsługuje wybranego modelu.'};
  if(/mobile_ai_init_error|sdk_not_ready|bundle_load_error/.test(text))
   return{code:'CLOUD_STARTUP',label:'Nie udało się załadować modułu AI.'};
  if(/timeout|abort/.test(text))return{code:'CLOUD_TIMEOUT',label:'Odpowiedź z chmury trwała zbyt długo.'};
  if(/network|offline|fetch|failed to fetch/.test(text))return{code:'CLOUD_NETWORK',label:'Nie udało się połączyć z usługą AI w internecie.'};
  return{code:'CLOUD_ERROR',label:'Usługa chmurowa nie odpowiedziała poprawnie.'};
 }
 if(/ollama_no_models|ollama_model_missing|wybrany model|nie ma zainstalowanego modelu/i.test(text)||status===404)
  return{code:'LOCAL_MODEL',label:'Lokalna Ollama nie ma pobranego zgodnego modelu AI.'};
 if(/ollama_empty_response/i.test(text))
  return{code:'LOCAL_EMPTY_RESPONSE',label:'Model zakończył generowanie, ale nie zwrócił odpowiedzi.'};
 if(/ollama_draft_response/i.test(text))
  return{code:'LOCAL_DRAFT_RESPONSE',label:'Model nie zwrócił gotowej odpowiedzi. Spróbuj ponownie.'};
 if(/ollama_server_error/i.test(text))
  return{code:'LOCAL_SERVER',label:'Silnik lokalnego modelu zwrócił błąd. Sprawdź dostępne zasoby komputera.'};
 if(/ollama_not_running|ollama_not_installed|ollama nie jest|program ollama/.test(text))
  return{code:'LOCAL_OLLAMA',label:'Lokalna usługa Ollama nie jest uruchomiona lub zainstalowana.'};
 if(/timeout|abort|nie odpowiedział na czas/.test(text))
  return{code:'LOCAL_TIMEOUT',label:'Lokalny model nie odpowiedział w wymaganym czasie.'};
 if(/network|fetch|refused|failed to fetch/.test(text))
  return{code:'LOCAL_NETWORK',label:'Nie udało się połączyć z lokalnym serwerem HealthGo.'};
 return{code:'LOCAL_ERROR',label:'Lokalny model nie mógł przygotować odpowiedzi.'};
}
function summarize(cloudError,localError){
 const cloud=classify(cloudError,'CLOUD');
 const local=classify(localError,'LOCAL');
 return{cloud,local,code:cloud.code+' / '+local.code};
}
const api={classify,summarize};
root.HealthGoAIDiagnostics=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

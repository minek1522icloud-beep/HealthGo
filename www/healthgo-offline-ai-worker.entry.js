import {pipeline,env} from '@huggingface/transformers';

// Quantized compact model runs on Safari's WebAssembly backend without WebGPU.
const MODEL='onnx-community/SmolLM2-135M-Instruct-ONNX-MHA';
const MODEL_SIZE_MB=182;
env.useBrowserCache=true;
env.allowLocalModels=false;
env.allowRemoteModels=true;
let generator=null;
let preparing=null;
let generating=false;

function report(kind,data={}){
  self.postMessage({type:kind,...data});
}
function parseResult(value){
  const message=value?.[0]?.generated_text;
  if(Array.isArray(message)){
    const reply=[...message].reverse().find(x=>x&&x.role==='assistant');
    return String(reply?.content||'').trim();
  }
  if(typeof message==='string')return message.trim();
  return '';
}
async function setup(){
  if(generator)return generator;
  if(preparing)return preparing;
  preparing=(async()=>{
    report('stage',{label:'Uruchamiam lekki silnik AI dla telefonu…'});
    generator=await pipeline('text-generation',MODEL,{
      dtype:'q4',
      device:'wasm',
      progress_callback: progress => {
        if(progress?.status==='progress'){
          report('progress',{
            percent:Number.isFinite(progress.progress)?Math.max(0,Math.min(100,Math.floor(progress.progress))):null,
            file:String(progress.file||'model').slice(0,120)
          });
        }else if(progress?.status==='initiate'||progress?.status==='download'){
          report('stage',{label:'Pobieram rzeczywiste pliki modelu…'});
        }else if(progress?.status==='done'){
          report('stage',{label:'Weryfikuję pobrane pliki…'});
        }
      }
    });
    report('stage',{label:'Sprawdzam, czy model potrafi odpowiedzieć…'});
    const proof=await generator([
      {role:'system',content:'Odpowiedz jednym słowem po polsku.'},
      {role:'user',content:'Napisz: OK'}
    ],{max_new_tokens:16,do_sample:false});
    if(!parseResult(proof)){
      generator=null;
      throw new Error('LOCAL_MODEL_NO_REPLY');
    }
    report('ready',{model:MODEL,modelSizeMB:MODEL_SIZE_MB});
    return generator;
  })();
  try{return await preparing;}
  catch(error){generator=null;throw error;}
  finally{preparing=null;}
}

const names={
  assistant:'asystent',plan:'plan dnia',food:'jedzenie',activity:'aktywność',explore:'odkrywanie'
};
self.addEventListener('message',event=>{
  const input=event.data||{};
  const id=input.id;
  if(!Number.isSafeInteger(id)||id<1)return;
  if(input.type==='install'){
    setup().catch(error=>report('error',{id,code:String(error.message||'LOCAL_INSTALL_ERROR').slice(0,160)}));
    return;
  }
  if(input.type!=='ask')return;
  if(generating){
    report('error',{id,code:'LOCAL_BUSY'});
    return;
  }
  generating=true;
  (async()=>{
    const model=await setup();
    const question=String(input.message||'').slice(0,1700);
    if(!question)throw new Error('LOCAL_EMPTY_QUESTION');
    const history=Array.isArray(input.history)?input.history.slice(-8):[];
    const messages=[
      {role:'system',content:
        'Jesteś HealthGo AI, pomocnym asystentem. Zawsze odpowiadaj po polsku, krótko, jasno i uprzejmie. '+
        'Nie wymyślaj wyników pomiarów ani informacji medycznych. Nie stawiaj diagnozy i nie podawaj niebezpiecznych porad. '+
        'Jeśli sprawa zdrowotna jest ważna, zasugeruj pomoc zaufanego dorosłego lub lekarza. '+
        'Teraz odpowiadasz w trybie: '+(names[input.mode]||'asystent')+'.'
      }
    ];
    for(const entry of history){
      if(!entry||!['user','assistant'].includes(entry.role))continue;
      const content=String(entry.content||'').trim().slice(0,900);
      if(content)messages.push({role:entry.role,content});
    }
    messages.push({role:'user',content:question});
    report('stage',{label:'Lokalne AI tworzy odpowiedź…'});
    // Keep memory and inference latency bounded on mobile Safari.
    const tokenBudget=input.responseMode==='high'?120:input.responseMode==='medium'?90:64;
    const output=await model(messages,{max_new_tokens:tokenBudget,do_sample:false});
    const answer=parseResult(output);
    if(!answer)throw new Error('LOCAL_EMPTY_ANSWER');
    report('answer',{id,answer:answer.slice(0,4000)});
  })().catch(error=>{
    report('error',{id,code:String(error?.message||'LOCAL_ERROR').slice(0,160)});
  }).finally(()=>{generating=false;});
});

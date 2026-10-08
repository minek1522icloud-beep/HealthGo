'use strict';

const RECOMMENDED_MODEL='qwen3:4b-instruct';
const DOWNLOAD_SIZE_BYTES=2500000000;

// Qwen3:4b and qwen3:4b-thinking are thinking-only, so think:false does not
// give direct answers. Never quietly fall back to those variants.
function isThinkingOnlyModel(name){
  return /^qwen3:(?:4b(?:-thinking(?:-|$))?|\d+b-thinking(?:-|$))/i.test(String(name||''));
}
function isConversationModel(name){
  const model=String(name||'');
  if(!model||isThinkingOnlyModel(model))return false;
  return /^(qwen3:4b-instruct(?:-|$)|qwen2\.5:|qwen2:|llama3\.?[0-9]*:|gemma[2-9]?:|mistral:|phi[3-9]?:|qwen3:8b(?:-|$))/i.test(model);
}
function chooseConversationModel(models,requestedModel=RECOMMENDED_MODEL){
  const names=(Array.isArray(models)?models:[]).filter(x=>typeof x==='string'&&x.trim());
  if(!names.length)return null;
  if(names.includes(requestedModel)&&isConversationModel(requestedModel))return requestedModel;
  if(names.includes(RECOMMENDED_MODEL))return RECOMMENDED_MODEL;
  return names.find(isConversationModel)||null;
}
module.exports={RECOMMENDED_MODEL,DOWNLOAD_SIZE_BYTES,isThinkingOnlyModel,isConversationModel,chooseConversationModel};

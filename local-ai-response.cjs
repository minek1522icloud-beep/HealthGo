'use strict';

// Only final, user-facing model messages may enter the chat or its history.
// The separate Ollama thinking field is intentionally never shown here.
function normalizeLocalAIResponse(content) {
  if (typeof content !== 'string') return '';
  let result=content.replace(/\r\n?/g,'\n').trim();
  if (!result) return '';

  // Ollama/Qwen may put reasoning into content, even with think:false.
  // Remove only explicitly marked sections without inventing an answer.
  result=result
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi,'')
    .trim();

  if (/<think\b|<\/think>|<\|channel\|>analysis|<\|im_start\|>assistant\s*<\|meta_sep\|>analysis/i.test(result)) {
    return '';
  }

  // If there is a clearly labeled final answer, prefer it to earlier draft.
  const finalMarker=/(?:^|\n)\s*(?:#{1,3}\s*)?(?:final answer|final response|odpowiedź końcowa)\s*:\s*/gim;
  const found=[...result.matchAll(finalMarker)];
  if (found.length) {
    const last=found[found.length-1];
    result=result.slice(last.index+last[0].length).trim();
  }

  // Detect unmarked drafting text seen in older Qwen responses. Never insert
  // such material into conversation history or display it as a final answer.
  const reasoningSignals=[
    /(?:^|\n)\s*(?:okay|ok|alright)[,.:!]?\s+the user\b/i,
    /(?:^|\n)\s*the user (?:said|says|asked|wants|expects|probably)\b/i,
    /(?:^|\n)\s*let me (?:break|think|work|consider|pick|reason|figure)\b/i,
    /(?:^|\n)\s*i (?:need|should|must|have) to (?:respond|answer|decide|make sure|follow)\b/i,
    /(?:^|\n)\s*wait[,.:!]?\s+(?:the user|i need|the instruction)\b/i,
    /(?:^|\n)\s*(?:first|now)[,.:]?\s+(?:i need|the user|i should)\b/i,
    /\b(?:the response should be|the instruction says|the system says|the user probably wants)\b/i
  ];
  if (reasoningSignals.some(pattern=>pattern.test(result))) return '';

  result=result
    .replace(/^(?:\/no_think|\/think)\s*\n?/i,'')
    .replace(/^(?:final answer|final response|odpowiedź końcowa)\s*:\s*/i,'')
    .trim();

  return result.slice(0,12000);
}

module.exports={normalizeLocalAIResponse};

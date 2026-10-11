/* HealthGo minigames + local contests: no fake opponents, no client-side XP grants. */
(function(host){
'use strict';
if(typeof document==='undefined')return;
var games=document.getElementById('games'),contests=document.getElementById('contests');
if(!games||!contests)return;
var memoryRoot=games.querySelector('[data-hg-game="memory"]');
var quizRoot=games.querySelector('[data-hg-game="quiz"]');
var contestRoot=contests.querySelector('[data-hg-contests]');
if(!memoryRoot||!quizRoot||!contestRoot)return;
var icons=['🍀','🌻','🌈','🐢','🎈','⭐'];
var questions=[
 {q:'Co pomaga zadbać o sen?',a:['Stałe pory zasypiania','Hałas przez całą noc','Jasny ekran przez całą noc'],correct:0,why:'Regularność zwykle pomaga utrzymać dobry rytm snu.'},
 {q:'Co jest dobrym sposobem na odpoczynek od ekranu?',a:['Krótka przerwa i spojrzenie w dal','Korzystanie z dwóch ekranów','Ignorowanie zmęczenia'],correct:0,why:'Przerwy pomagają odpocząć oczom i zmienić pozycję.'},
 {q:'Co warto zabrać na spokojny spacer?',a:['Butelkę wody','Niepotrzebne ciężkie przedmioty','Zbyt wiele rzeczy'],correct:0,why:'Woda przydaje się podczas codziennej aktywności.'},
 {q:'Jak najlepiej planować zadania?',a:['Podzielić je na mniejsze kroki','Robić wszystko naraz','Nie robić przerw'],correct:0,why:'Mniejsze kroki ułatwiają organizację dnia.'},
 {q:'Która czynność pomaga się zrelaksować?',a:['Spokojny oddech i odpoczynek','Pośpiech bez przerwy','Ciągły hałas'],correct:0,why:'Krótka spokojna przerwa może poprawić samopoczucie.'}
];
var memory=null,quiz=null,session=0;
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
function shuffle(a){var out=a.slice();for(var i=out.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),temp=out[i];out[i]=out[j];out[j]=temp;}return out;}
function storageKey(){
 var uid=host.HealthGoServices&&host.HealthGoServices.state&&host.HealthGoServices.state.uid;
 return 'healthgo-minigames-v1-'+(uid?String(uid):'guest');
}
function scores(){
 try{var d=JSON.parse(localStorage.getItem(storageKey())||'{}');return d&&typeof d==='object'?d:{};}catch(_){return {};}
}
function saveScore(type,value){
 if(!Number.isFinite(value))return;
 var s=scores(),old=Number(s[type]);
 if(!Number.isFinite(old)||old<=0||(type==='memory'?value<old:value>old)){
  s[type]=value;try{localStorage.setItem(storageKey(),JSON.stringify(s));}catch(_){}
 }
 paintContests();
}
function resetMemory(){
 session++;memory={deck:shuffle(icons.concat(icons)),up:[],found:new Set(),moves:0,busy:false,finished:false};paintMemory();
}
function paintMemory(){
 if(!memory)return;
 var m=memory,save=scores(),best=Number(save.memory);
 memoryRoot.innerHTML='<div class="hggame-head"><h3>Odkryj pary</h3><span class="hggame-stat">Ruchy: '+m.moves+'</span></div>'+
 '<p>Odkryj sześć par kart. Im mniej prób, tym lepszy wynik.</p>'+
 '<div class="hggame-memory" role="group" aria-label="Karty gry w pamięć">'+m.deck.map(function(symbol,index){
  var shown=m.up.indexOf(index)>=0||m.found.has(index);
  return '<button type="button" data-memory-index="'+index+'" class="hggame-tile'+(shown?' revealed':'')+(m.found.has(index)?' matched':'')+'" aria-label="'+(shown?'Karta '+escapeHtml(symbol):'Zakryta karta '+(index+1))+'" '+(m.found.has(index)?'disabled':'')+'>'+(shown?escapeHtml(symbol):'<span aria-hidden="true">?</span>')+'</button>';
 }).join('')+'</div>'+
 '<div class="hggame-bottom"><span role="status" aria-live="polite">'+(m.finished?'Brawo! Wszystkie pary odnalezione.':('Rekord: '+(best>0?best+' ruchów':'jeszcze brak')))+'</span>'+
 '<button type="button" class="hggame-btn" data-hg-reset="memory">Nowa gra</button></div>';
}
function flip(index){
 var m=memory;if(!m||m.busy||m.finished||!Number.isInteger(index)||index<0||index>=m.deck.length||m.found.has(index)||m.up.includes(index))return;
 m.up.push(index);
 if(m.up.length===2){
  m.moves++;
  if(m.deck[m.up[0]]===m.deck[m.up[1]]){
   m.found.add(m.up[0]);m.found.add(m.up[1]);m.up=[];
   if(m.found.size===12){m.finished=true;saveScore('memory',m.moves);}
  }else{
   m.busy=true;var current=session;
   host.setTimeout(function(){if(current!==session)return;memory.up=[];memory.busy=false;paintMemory();},760);
  }
 }
 paintMemory();
}
function resetQuiz(){quiz={index:0,correct:0,answer:null,done:false};paintQuiz();}
function paintQuiz(){
 var q=quiz;if(!q)return;
 var best=Number(scores().quiz);
 if(q.done){
  quizRoot.innerHTML='<div class="hggame-head"><h3>Quiz dobrych nawyków</h3><span class="hggame-stat">5 / 5</span></div>'+
   '<div class="hggame-result" role="status">Twój wynik: <strong>'+q.correct+' / '+questions.length+'</strong></div>'+
   '<p>Twój rekord: '+(Number.isFinite(best)?best:0)+' / '+questions.length+'. Wyniki zapisują się tylko na tym urządzeniu.</p>'+
   '<button type="button" class="hggame-btn" data-hg-reset="quiz">Zagraj ponownie</button>';return;
 }
 var item=questions[q.index];
 quizRoot.innerHTML='<div class="hggame-head"><h3>Quiz dobrych nawyków</h3><span class="hggame-stat">'+(q.index+1)+' / '+questions.length+'</span></div>'+
 '<p class="hggame-question">'+escapeHtml(item.q)+'</p>'+
 '<div class="hggame-answers">'+item.a.map(function(answer,i){
  var chosen=q.answer===i,marked=q.answer!==null&&i===item.correct;
  return '<button type="button" data-hg-answer="'+i+'" '+(q.answer!==null?'disabled':'')+' class="'+(marked?'correct':chosen?'incorrect':'')+'">'+escapeHtml(answer)+'</button>';
 }).join('')+'</div>'+
 (q.answer===null?'<p class="hggame-hint">Wybierz odpowiedź.</p>':'<p class="hggame-explanation" role="status">'+escapeHtml(item.why)+'</p><button type="button" class="hggame-btn" data-hg-next="quiz">'+(q.index===questions.length-1?'Zobacz wynik':'Następne pytanie')+'</button>');
}
function answer(i){
 var q=quiz;if(!q||q.done||q.answer!==null||!Number.isInteger(i)||i<0||i>=questions[q.index].a.length)return;
 q.answer=i;if(i===questions[q.index].correct)q.correct++;paintQuiz();
}
function next(){
 if(!quiz||quiz.answer===null||quiz.done)return;
 quiz.index++;quiz.answer=null;
 if(quiz.index>=questions.length){quiz.done=true;saveScore('quiz',quiz.correct);}
 paintQuiz();
}
function paintContests(){
 var score=scores(),m=Number(score.memory),q=Number(score.quiz);
 contestRoot.innerHTML='<div class="hgcontest-intro"><strong>Wyzwania treningowe</strong><p>Spróbuj pobić własne rekordy w minigrach. To konkursy lokalne — bez internetowej tabeli wyników innych graczy i bez automatycznego dodawania XP.</p></div>'+
 '<div class="hgcontest-list">'+
 '<article class="hgcontest-card"><span class="hgcontest-label">PAMIĘĆ</span><h3>Mistrz par</h3><p>Odkryj sześć par w jak najmniejszej liczbie ruchów.</p><div class="hgcontest-record">Twój rekord: <strong>'+(m>0?m+' ruchów':'Brak wyniku')+'</strong></div><button class="hggame-btn" type="button" data-hg-contest-play="memory">Zagraj</button></article>'+
 '<article class="hgcontest-card"><span class="hgcontest-label">QUIZ</span><h3>Znawca nawyków</h3><p>Odpowiedz na pięć pytań o codzienne nawyki.</p><div class="hgcontest-record">Twój rekord: <strong>'+(Number.isFinite(q)&&q>=0&&Object.prototype.hasOwnProperty.call(score,'quiz')?q+' / 5':'Brak wyniku')+'</strong></div><button class="hggame-btn" type="button" data-hg-contest-play="quiz">Zagraj</button></article>'+
 '</div>';
}
games.addEventListener('click',function(e){
 var b=e.target.closest('button');if(!b||!games.contains(b))return;
 if(b.hasAttribute('data-memory-index'))flip(Number(b.getAttribute('data-memory-index')));
 else if(b.dataset.hgReset==='memory')resetMemory();
 else if(b.dataset.hgReset==='quiz')resetQuiz();
 else if(b.hasAttribute('data-hg-answer'))answer(Number(b.getAttribute('data-hg-answer')));
 else if(b.dataset.hgNext==='quiz')next();
});
contests.addEventListener('click',function(e){
 var b=e.target.closest('[data-hg-contest-play]');if(!b||!contests.contains(b))return;
 var type=b.getAttribute('data-hg-contest-play');
 if(typeof host.mobileGo==='function')host.mobileGo('games');
 else if(typeof host.go==='function')host.go('games');
 var target=games.querySelector('[data-hg-game="'+type+'"]');
 if(target&&typeof target.scrollIntoView==='function')target.scrollIntoView({block:'center',behavior:'smooth'});
});
resetMemory();resetQuiz();paintContests();
host.HealthGoMiniGames=Object.freeze({resetMemory:resetMemory,resetQuiz:resetQuiz,refresh:paintContests});
})(window);

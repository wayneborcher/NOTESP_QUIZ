// NOT.ESP QUIZ — v19 (dev-friendly, updated words + persistence + shuffle-bag + fuzzy typing)
const DEFAULT_DATA = {
  // ESP
  "🔴":"wonderful","➕":"towards","🌊":"free","🔺":"fair choice","🟨":"fantastic","⭐":"finally",
  // DRAWINGS
  "🧍‍♂️":"human","🧍":"person","😀":"zoomed","☹️":"upset","❤️":"affectionate","🚤":"serene",
  "🏠":"wholesome","🚴‍♂️":"movement","🚗":"speed","🚂":"momentum","✈️":"take flight","🚀":"outer space",
  "⛩":"surface","📺":"visual","🎵":"audio","☎️":"communicate","💡":"bright","📖":"literature",
  // Right column
  "🎈":"floating","🥊":"sporty","🍏":"tasty","🍷":"drink from","✏️":"artistic","🔐":"security",
  "⏰":"keeping time","🗡️":"sharp","🔫":"lethal","🌳":"natural","🌻":"organic","☀️":"painting",
  "🌙":"night sky","🌧️":"weather","⚡":"powerful","🐶":"loyal","🐱":"living","🐟":"underwater",
  "🦅":"in the sky","👽":"weirdly","👻":"spooky","💀":"morbid",
  // Hecklers
  "📝":"nothing","🖕":"offensive","👍":"positive","🚫":"negative","🍆":"strangely"
};
const LS_DATA='notesp-quiz';
const LS_STATE='notesp-quiz-state-v5';
const LS_MODE='notesp-quiz-mode-v5';
const MODES={E2W_TYPE:0,W2E_MCQ:1,E2W_MCQ:2};

function loadData(){try{return JSON.parse(localStorage.getItem(LS_DATA))||{...DEFAULT_DATA}}catch{return {...DEFAULT_DATA}}}
function loadState(d){
  const base=Object.keys(d).map(k=>({emoji:k,word:d[k],box:1,seen:0,correctStreak:0,lastSeen:-1}));
  try{const s=JSON.parse(localStorage.getItem(LS_STATE)); if(!s) return base;
      const m=new Map(base.map(i=>[i.emoji,i])); for(const it of s) if(m.has(it.emoji)) Object.assign(m.get(it.emoji),it);
      return [...m.values()];}catch{return base}
}
function saveState(){localStorage.setItem(LS_STATE,JSON.stringify(items))}

const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const el={prompt:$('#prompt'),choices:$('#choices'),overlay:$('#overlay'),preGuessRow:$('#preGuessRow'),preGuessInput:$('#preGuessInput'),ok:$('#ok'),ko:$('#ko'),acc:$('#acc'),streak:$('#streak'),modeLabel:$('#modeLabel'),toast:$('#toast'),resultBanner:$('#resultBanner'),editorModal:$('#editorModal'),editorList:$('#editorList'),editorSearch:$('#editorSearch'),emojiPicker:$('#emojiPicker'),pickerGrid:$('#pickerGrid')};

let data=loadData(), items=loadState(data), mode=Number(localStorage.getItem(LS_MODE)??0);
let correct=0, wrong=0, streak=0, qn=0;
let cur=-1, rightEmoji=null, rightWord=null, lastIndex=-1;
let awaitingNext=false, nextBtnEl=null, nextKeyHandler=null;

// Shuffle-bag for coverage
let bag=[];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function refillBag(){bag=shuffle([...Array(items.length).keys()]); if(bag.length>1 && bag[0]===lastIndex){[bag[0],bag[1]]=[bag[1],bag[0]]}}
function nextIndex(){if(!bag.length) refillBag(); return bag.shift()}

function normalize(s){return(s||'').toLowerCase().trim().replace(/[^a-z0-9 ]/g,'').replace(/ +/g,' ')}
function soundex(s){s=normalize(s).replace(/[^a-z]/g,''); if(!s) return ''; const f=s[0]; const map={'bfpv':1,'cgjkqsxz':2,'dt':3,'l':4,'mn':5,'r':6}; const code=[f.toUpperCase()]; let prev=''; for(let i=1;i<s.length;i++){const ch=s[i]; let d=''; for(const k in map){ if(k.includes(ch)){ d=String(map[k]); break; } } if(d && d!==prev) code.push(d); prev=d; } return (code.join('')+'000').slice(0,4);}
function lev(a,b){a=normalize(a); b=normalize(b); const m=a.length,n=b.length; if(!m) return n; if(!n) return m; const dp=Array.from({length:m+1},()=>Array(n+1).fill(0)); for(let i=1;i<=m;i++){ dp[i][0]=i } for(let j=1;j<=n;j++){ dp[0][j]=j } for(let i=1;i<=m;i++){for(let j=1;j<=n;j++){const cost=a[i-1]===b[j-1]?0:1; dp[i][j]=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);} } return dp[m][n];}
function fuzzyEqual(a,b){a=normalize(a); b=normalize(b); if(a===b) return true; if(soundex(a)===soundex(b)) return true; const d=lev(a,b); const tol=Math.max(1, Math.floor(Math.max(a.length,b.length)/5)); return d<=tol;}

function isSmall(){return window.matchMedia('(max-width: 480px)').matches}
function choiceCountEmoji(){return Math.min(isSmall()?6:10, items.length)}
function choiceCountWords(){return Math.min(isSmall()?4:8, items.length)}

function overlayVisible(){return mode===MODES.E2W_TYPE && !el.overlay.classList.contains('hidden')}
function modeLabelText(){return mode===0?'Mode: Emoji → Word (Type)':mode===1?'Mode: Word → Emoji (Icons)':'Mode: Emoji → Word (Words)'}
function hud(){const t=correct+wrong; $('#ok').textContent=correct; $('#ko').textContent=wrong; $('#acc').textContent=t?Math.round((correct/t)*100)+'%':'0%'; $('#streak').textContent=streak}
function toast(msg){el.toast.textContent=msg; el.toast.classList.add('show'); setTimeout(()=>el.toast.classList.remove('show'),900)}

function hideResult(){if(nextKeyHandler){document.removeEventListener('keydown',nextKeyHandler);nextKeyHandler=null} if(nextBtnEl&&nextBtnEl.parentNode){nextBtnEl.parentNode.removeChild(nextBtnEl);nextBtnEl=null} awaitingNext=false; el.resultBanner.className='result-banner'; el.resultBanner.textContent=''}
function showResult(ok,typed,correctWord){el.resultBanner.className='result-banner show '+(ok?'ok':'no'); el.resultBanner.innerHTML=ok?`✅ <strong>${correctWord}</strong>`:`❌ <em>${typed||'—'}</em> → <strong>${correctWord}</strong>`}
function enableNextAdvance(){if(awaitingNext)return;awaitingNext=true; nextBtnEl=document.createElement('button'); nextBtnEl.className='btn next-btn'; nextBtnEl.textContent='Next'; const go=()=>{if(!awaitingNext)return; awaitingNext=false; if(nextKeyHandler){document.removeEventListener('keydown',nextKeyHandler);nextKeyHandler=null} render()}; nextBtnEl.addEventListener('click',go); nextKeyHandler=(e)=>{if(e.key==='Enter'){e.preventDefault();go()}}; document.addEventListener('keydown',nextKeyHandler); el.resultBanner.appendChild(nextBtnEl)}

// Render
function render(){
  hideResult(); el.choices.innerHTML='';
  cur=nextIndex(); const it=items[cur]; rightEmoji=it.emoji; rightWord=it.word;
  el.prompt.textContent=(mode===MODES.W2E_MCQ)?it.word:it.emoji; el.modeLabel.textContent=modeLabelText();

  if(mode===MODES.W2E_MCQ){
    const pool=items.map(x=>x.emoji), count=choiceCountEmoji(); const set=new Set([rightEmoji]); while(set.size<count)set.add(pool[Math.floor(Math.random()*pool.length)]);
    for(const option of shuffle([...set])){const b=document.createElement('button'); b.className='choice emoji'; b.textContent=option; b.addEventListener('click',()=>answer(option)); el.choices.appendChild(b)}
    el.preGuessRow.style.display='none'; el.overlay.classList.add('hidden');
  }else if(mode===MODES.E2W_MCQ){
    const pool=items.map(x=>x.word), count=choiceCountWords(); const set=new Set([rightWord]); while(set.size<count)set.add(pool[Math.floor(Math.random()*pool.length)]);
    for(const option of shuffle([...set])){const b=document.createElement('button'); b.className='choice'; b.textContent=option; b.addEventListener('click',()=>answer(option)); el.choices.appendChild(b)}
    el.preGuessRow.style.display='none'; el.overlay.classList.add('hidden');
  }else{
    el.preGuessRow.style.display='flex'; el.preGuessInput.value=''; el.overlay.classList.remove('hidden'); setTimeout(()=>el.preGuessInput.focus(),20);
  }
  lastIndex = cur;
}

function answer(sel){
  let ok=false; if(mode===MODES.W2E_MCQ) ok=(sel===rightEmoji); else if(mode===MODES.E2W_MCQ) ok=(normalize(sel)===normalize(rightWord));
  const it=items[cur]; it.seen++; it.lastSeen=qn++; if(ok){correct++;streak++;it.correctStreak++; if(it.box<5 && it.correctStreak>=2){it.box++;it.correctStreak=0} toast('Correct')} else {wrong++;streak=0;it.correctStreak=0;it.box=1; toast('Wrong')}
  const buttons=[...document.querySelectorAll('.choice')]; for(const b of buttons) b.classList.remove('correct','wrong');
  const rightVal=(mode===MODES.W2E_MCQ)?rightEmoji:rightWord; const match=(mode===MODES.W2E_MCQ)?(t=>t===rightVal):(t=>normalize(t)===normalize(rightVal));
  const chosen=buttons.find(b=>(mode===MODES.W2E_MCQ)?(b.textContent===sel):(normalize(b.textContent)===normalize(sel))); const correctBtn=buttons.find(b=>match(b.textContent));
  if(chosen) chosen.classList.add(ok?'correct':'wrong'); if(!ok && correctBtn) correctBtn.classList.add('correct');
  saveState(); hud(); setTimeout(render,700);
}

function onReveal(){
  if(mode!==MODES.E2W_TYPE){ el.overlay.classList.add('hidden'); return; }
  const typedRaw=el.preGuessInput.value; const typed=normalize(typedRaw); const it=items[cur]; it.seen++; it.lastSeen=qn++;
  const ok=fuzzyEqual(typed, rightWord);
  if(ok){ correct++; streak++; it.correctStreak++; if(it.box<5 && it.correctStreak>=2){it.box++; it.correctStreak=0} showResult(true,typedRaw,rightWord); saveState(); hud(); el.overlay.classList.add('hidden'); setTimeout(render,800);
  } else { wrong++; streak=0; it.correctStreak=0; it.box=1; showResult(false,typedRaw,rightWord); saveState(); hud(); el.overlay.classList.add('hidden'); enableNextAdvance(); }
}

// ---- Persistence helpers for editor
function saveEditorDataObject(obj){
  localStorage.setItem(LS_DATA, JSON.stringify(obj));
  localStorage.setItem(LS_STATE, JSON.stringify([])); // clear SR state
  data=loadData(); items=loadState(data); bag=[]; // reconstruct deck
  toast('Saved'); hud(); render();
}

// Editor & Picker (dev-friendly)
const editor={root:$('#editorModal'), list:$('#editorList'), search:$('#editorSearch')};
const picker={root:$('#emojiPicker'), grid:$('#pickerGrid'), target:null, isAdd:false};
const EMOJI_PALETTE=[ "🔴","🟠","🟡","🟢","🔵","🟣","🟤","⚫","⚪","🔺","🔻","⬜","⬛","🟥","🟧","🟨","🟩","🟦","🟪","🟫","⭐","✨","🔥","⚡","❄️","💧","☔","🌪️","🌈","☀️","🌙","🌧️","⛄","😀","😃","😄","😁","😆","😊","🙂","😉","😍","😎","🤔","😴","🤯","🥳","🧍‍♂️","🧍","🚶‍♂️","🏃‍♂️","🚴‍♂️","🚴‍♀️","🧗‍♂️","🏊‍♂️","❤️","💛","💚","💙","💜","🖤","🤍","🤎","🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🚚","🚛","🚜","🚂","🚆","✈️","🚀","🚤","🛶","🚁","🛸","🏠","🏢","🏫","🏛️","⛩","🏯","🏰","📺","☎️","📱","💻","⌚","⏰","🔐","🔒","🔑","✏️","📖","🍎","🍏","🍇","🍔","🍕","🍷","🍺","☕","🍩","🌳","🌲","🌴","🌻","🌸","🍀","🐶","🐱","🐟","🦜","🦅","🐘","🦁","👽","👻","💀","🎈","🥊","📝","🚫","🖕","👍","🍆","💡","🎵","☹️","🗡️" ];
function buildEmojiSet(){const set=new Set(EMOJI_PALETTE); items.forEach(i=>set.add(i.emoji)); return[...set]}
function emojiExists(em, exceptRow=null){const rows=[...editor.list.querySelectorAll('.editor-item')]; for(const r of rows){ if(r===exceptRow) continue; const t=r.querySelector('.editor-emoji')?.textContent.trim(); if(t===em) return true } return false }
function openEditor(){editor.root.classList.remove('hidden'); renderEditorList(); setTimeout(()=>editor.search.focus(),20)}
function closeEditor(){editor.root.classList.add('hidden')}
function openPicker(target,isAdd=false){picker.target=target; picker.isAdd=isAdd; picker.grid.innerHTML=''; for(const ch of buildEmojiSet()){const cell=document.createElement('div'); cell.className='picker-item'; cell.textContent=ch; cell.addEventListener('click',()=>selectEmoji(ch)); picker.grid.appendChild(cell)}; picker.root.classList.remove('hidden')}
function closePicker(){picker.root.classList.add('hidden'); picker.target=null; picker.isAdd=false}
function selectEmoji(ch){const row=picker.target; if(!row)return; if(emojiExists(ch,row)){alert('That icon is already in use.'); return} const display=row.querySelector('.editor-emoji'); if(display) display.textContent=ch; closePicker()}
function renderEditorList(){const q=(editor.search.value||'').toLowerCase().trim(); editor.list.innerHTML=''; const src=[...items].sort((a,b)=>a.word.localeCompare(b.word)); const view=q?src.filter(x=>x.word.toLowerCase().includes(q)||x.emoji.includes(q)):src; for(const it of view){const row=document.createElement('div'); row.className='editor-item readonly'; row.innerHTML=`<div class="editor-emoji" title="Change icon" role="button" tabindex="0">${it.emoji}</div><div class="editor-word"><input type="text" value="${it.word}" aria-label="Word"/></div><div class="editor-actions"><button class="btn ghost" title="Delete">Delete</button></div>`; editor.list.appendChild(row)} const help=document.createElement('div'); help.className='help'; help.textContent='Tip: Tap an icon to change it.'; editor.list.appendChild(help)}
function collectEditorData(){const rows=[...editor.list.querySelectorAll('.editor-item')]; const out=[]; const seen=new Set(); let ok=true; for(const r of rows){const em=(r.querySelector('.editor-emoji')?.textContent||'').trim(); const w=(r.querySelector('.editor-word input')?.value||'').trim(); const wIn=r.querySelector('.editor-word input'); if(!em || !w){ if(wIn && !w) wIn.classList.add('err'); ok=false } if(em && seen.has(em)){ ok=false } if(em) { out.push([em,w]); seen.add(em); } } return ok?out:null}
function saveEditor(){const pairs=collectEditorData(); if(!pairs){alert('Please fix highlighted fields and duplicates.'); return} const obj=Object.fromEntries(pairs); saveEditorDataObject(obj); closeEditor()}
function addPanel(){ if(document.querySelector('.add-panel')) return; const panel=document.createElement('div'); panel.className='add-panel'; panel.innerHTML=`<div class="editor-emoji" title="Pick icon" role="button" tabindex="0">＋</div><input class="add-word" placeholder="meaning…" aria-label="New word"/><button class="add-do">Add</button>`; const emojiBtn=panel.querySelector('.editor-emoji'); const wIn=panel.querySelector('.add-word'); const go=()=>{const e=(emojiBtn.textContent||'').trim(); const w=(wIn.value||'').trim(); if(!e || e==='＋' || !w){panel.classList.add('shake'); setTimeout(()=>panel.classList.remove('shake'),300); return} if(emojiExists(e,null)){alert('That icon is already in use.'); return} const row=document.createElement('div'); row.className='editor-item readonly'; row.innerHTML=`<div class="editor-emoji" title="Change icon" role="button" tabindex="0">${e}</div><div class="editor-word"><input type="text" value="${w}"/></div><div class="editor-actions"><button class="btn ghost">Delete</button></div>`; editor.list.insertBefore(row, editor.list.firstChild); panel.remove()}; emojiBtn.addEventListener('click',()=>openPicker(panel,true)); panel.querySelector('.add-do').addEventListener('click',go); panel.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); go()}}); editor.list.parentNode.appendChild(panel)}
function resetDefaults(){ if(!confirm('Reset to defaults?')) return; saveEditorDataObject({...DEFAULT_DATA}); renderEditorList();}

// Events
document.addEventListener('click',(e)=>{
  const t=e.target;
  const tab=t.closest('.tab'); if(tab){ mode=Number(tab.dataset.mode); localStorage.setItem(LS_MODE,String(mode)); $$('.tab').forEach(x=>{const on=Number(x.dataset.mode)===mode; x.classList.toggle('active',on); x.setAttribute('aria-selected', on ? 'true':'false');}); render(); return; }
  if(t.closest('#settingsBtn')){ openEditor(); return; }
  if(t.closest('#editorList .editor-emoji')){ const row=t.closest('.editor-item'); if(row) openPicker(row,false); return; }
  if(t.closest('#editorClose')){ closeEditor(); return; }
  if(t.closest('#editorSave')){ saveEditor(); return; }
  if(t.closest('#editorAdd')){ addPanel(); return; }
  if(t.closest('#editorExport')){ const pairs=collectEditorData()||items.map(i=>[i.emoji,i.word]); const obj=Object.fromEntries(pairs); const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`notesp-words-${new Date().toISOString().slice(0,10)}.json`; a.click(); return; }
  if(t.closest('#editorImport')){ $('#editorImportFile').click(); return; }
  if(t.closest('#editorReset')){ resetDefaults(); return; }
  if(t.closest('.editor-actions .btn')){ const row=t.closest('.editor-item'); if(row) row.remove(); return; }
  if(t.closest('#pickerClose')){ document.getElementById('emojiPicker').classList.add('hidden'); return; }
  if(t.id==='revealBtn'){ onReveal(); return; }
});
document.addEventListener('input',(e)=>{ if(e.target && e.target.id==='editorSearch'){ e.stopPropagation(); renderEditorList(); } });
document.addEventListener('keydown',(e)=>{
  if(!el.editorModal.classList.contains('hidden')){
    if(e.key==='Enter'){ e.stopPropagation(); }
    if(e.key==='Escape'){ e.preventDefault(); closeEditor(); }
  } else {
    if(e.key==='Escape'){ if(!el.overlay.classList.contains('hidden')) el.overlay.classList.add('hidden'); }
    if(e.key==='Enter'){ if(awaitingNext){ const btn=document.querySelector('.next-btn'); if(btn){ e.preventDefault(); btn.click(); return; } } if(overlayVisible()){ e.preventDefault(); onReveal(); } }
  }
});
document.addEventListener('change',(e)=>{
  if(e.target && e.target.id==='editorImportFile'){ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const obj=JSON.parse(r.result); saveEditorDataObject(obj); renderEditorList(); } catch{ alert('Invalid JSON'); } }; r.readAsText(f); e.target.value=''; }
});

(function init(){
  $$('.tab').forEach(tab=>{ const on=Number(tab.dataset.mode)===mode; tab.classList.toggle('active',on); tab.setAttribute('aria-selected', on ? 'true':'false'); });
  hud(); refillBag(); render();
})();
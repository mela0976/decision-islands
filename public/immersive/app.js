import { buildData } from './data.js';
import { createProgress } from './progress.js';
import { initOfflineCache } from './cache.js';

const $ = id => document.getElementById(id);
const text = (tag, value, parent) => { const el = document.createElement(tag); el.textContent = value; parent?.append(el); return el; };
const button = (label, action, parent) => { const el = text('button', label, parent); el.type = 'button'; el.addEventListener('click', action); return el; };
let canPersist=()=>true;
const status = message => { $('status').textContent = !canPersist()&&!message.includes('備份')?`${message} · 僅本次暫存，請下載備份。`:message; };
let storage;
try { storage = localStorage; } catch { storage = { getItem() { throw Error('unavailable'); }, setItem() { throw Error('unavailable'); } }; }
const progress = createProgress(storage, status);
canPersist=()=>progress.persistent!==false;
initOfflineCache({ onStatus: ({ state }) => {
  if (state === 'failed') status('離線快取未能啟用；目前仍可正常閱讀。');
  else if (state === 'unavailable') status('此環境不支援離線快取；目前仍可正常閱讀。');
} });
let DATA, world, current, travelOrigin, depth = 'guide', noteTimer, gameState, soundContext, soundNodes = [], contextFailed=false;
let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('motion').checked = reducedMotion;
document.body.classList.toggle('reduce-motion', reducedMotion);
const article = id => DATA?.articles.find(a => a.id === id);
const scene = id => DATA?.scenes.find(s => s.articleId === id);
const island = id => DATA?.islands.find(s => s.articleId === id);
const contentControls=['read','interact','bookmark','previous','next','mark-read','game-read'];
contentControls.forEach(id=>{$(id).disabled=true;});
const chapterNames = { intro: 'INTRO / 序章群島', people: 'PEOPLE / 人本群島', model: 'MODEL / 洞察群島', ai: 'AI / 行動群島' };
const safeSource = path => /^sources\/2026-\d{2}\.pdf$/.test(path) ? `../${path}` : '../read/2026/index.html';
const offSceneDialogue = {
  achi: '等一下，我想先把這件事放回工作的情境裡，看看它會影響哪個決定。',
  yue: '先等等，這個答案跟我現在要做的選擇有什麼關係？',
  yingzhen: '我想先看這個說法有哪些依據，還有它沒回答什麼。',
  fenjie: '先不用急著往下，我想知道你現在最需要處理哪一步。',
};
function dialogueForCharacter(characterId, sceneData) {
  return sceneData?.dialogue?.find(line => line.characterId === characterId)?.text || offSceneDialogue[characterId] || '我們先停一下，看看眼前這件事還需要哪些線索。';
}

function renderCatalog() {
  if(!DATA)return;
  const query = $('search').value.trim().toLocaleLowerCase();
  $('article-list').replaceChildren();
  for (const a of DATA.articles) {
    if ($('only-bookmarks').checked && !progress.state.bookmarks.includes(a.id)) continue;
    if (query && ![a.title, a.authors, ...(a.paragraphs || [])].join(' ').toLocaleLowerCase().includes(query)) continue;
    const b = button(`${progress.state.read.includes(a.id) ? '✓ ' : ''}${island(a.id).id} · ${a.title}`, () => { $('catalog').hidden = true; $('map-toggle').setAttribute('aria-expanded', 'false'); visit(a.id); }, $('article-list'));
    text('small', chapterNames[a.chapter], b);
    b.addEventListener('mouseenter', () => world?.preview?.(a.id));
    b.addEventListener('focus', () => world?.preview?.(a.id));
    b.addEventListener('mouseleave', () => world?.preview?.(null));
    b.addEventListener('blur', () => world?.preview?.(null));
  }
  $('progress').textContent = `${canPersist()?'':'僅本次暫存 · '}已讀 ${progress.state.read.filter(id => article(id)).length} / 22 · 洞察印記 ${progress.state.stamps.length} · 筆記 ${Object.values(progress.state.notes).filter(Boolean).length} 篇`;
  if(!canPersist()&&$('reader').open)$('note-status').textContent='瀏覽器無法保存本次紀錄，請下載備份。';
  let stamps=$('stamp-list');if(!stamps){stamps=document.createElement('div');stamps.id='stamp-list';stamps.setAttribute('aria-label','我的閱讀足跡');$('progress').after(stamps);}stamps.replaceChildren();
  DATA.progressConfig.insightStamps.forEach(stamp=>{const item=text('span',stamp.label,stamps),collected=progress.state.stamps.includes(stamp.id);item.className=collected?'collected':'';item.setAttribute('aria-label',`${stamp.label}：${collected?'已留下閱讀足跡':'尚未探索'}`);});
}

function visit(id, relation = null, animate = true) {
  const a = article(id); if (!a) return;
  if(current!==id&&$('game').open){$('game').close();gameState=null;}
  if(current!==id){travelOrigin=current;relation ||= DATA.articleGraph.find(edge=>edge.sourceArticleId===current&&edge.targetArticleId===id);}
  flushNote(); current = id; progress.visit(id);
  $('island-title').textContent = a.title;
  $('chapter-label').textContent = `${chapterNames[a.chapter]} · ${island(id).id}`;
  const s = scene(id), line = s?.dialogue?.[0];
  const name = DATA.characters.find(c => c.id === (line?.characterId || s?.protagonistId))?.name || '阿綺';
  $('dialogue').textContent = line ? `${name}：「${line.text}」` : s?.lifeEvent || '答案很多，可是我到底該相信哪一個？';
  $('bookmark').textContent = progress.state.bookmarks.includes(id) ? '已收藏' : '收藏';
  world?.focus(id, { animate: animate && !reducedMotion, relation });
  renderCatalog();
}

function recommend(id) {
  const edges = DATA.articleGraph.filter(e => e.sourceArticleId === id && article(e.targetArticleId));
  const mainId = DATA.articles[(DATA.articles.findIndex(a => a.id === id) + 1) % 22].id;
  const ranked = [...edges].sort((a, b) => {
    const penalty = e => (progress.state.read.includes(e.targetArticleId) ? 30 : 0) + (progress.state.routes.slice(-5).some(r => r.endsWith(`>${e.targetArticleId}`)) ? 50 : 0);
    return penalty(a) - penalty(b) || (a.priority || 0) - (b.priority || 0);
  });
  const next = edges.find(e => e.targetArticleId === mainId) || ranked[0];
  return [next, ...ranked.filter(e => e.targetArticleId !== next?.targetArticleId)].filter((e, i, all) => e && all.findIndex(x => x?.targetArticleId === e.targetArticleId) === i).slice(0, 3);
}

function syncWorldState() {
  if (!world || !DATA) return;
  world.setPopulation(Number($('population').value));
  world.setReducedMotion(reducedMotion);
  world.setSeason($('season').value);
  world.setMode(progress.state.mode);
  if (current) world.focus(current, { animate: false });
  if ($('game').open && gameState) {
    world.setEncounter(gameState.characterId, gameState.npcIndex);
    world.setSpeech(gameState.speech);
    if (gameState.result !== null) {
      world.applyInteraction(gameState.articleId, { kind: gameState.kind, choices: gameState.choices, scenarioChoice: gameState.scenarioChoice, result: gameState.result, before: gameState.before });
      world.setRecommendations(recommend(gameState.articleId));
    }
  }
  if ($('reader').open) world.setActive(false);
}

function renderReading() {
  const a = article(current), s = scene(current); $('reading-content').replaceChildren();
  $('reader-title').textContent = a.title; $('byline').textContent = `${a.authors} · 原刊第 ${a.printedStart}–${a.printedEnd} 頁`;
  const paragraphs = depth === 'full' ? a.paragraphs : depth === 'summary' ? a.highlights : [a.summary];
  for (const p of paragraphs || []) text('p', p, $('reading-content'));
  if (depth !== 'full') text('small', '以上為閱讀導引；完整論述與圖表請對照原文及 PDF。', $('reading-content'));
  $('source').href = safeSource(a.sourcePdf);
  $('mark-read').textContent = progress.state.read.includes(current) ? '已讀完 ✓' : '標記讀完';
  $('note').value = progress.state.notes[current] || ''; $('note').dataset.articleId = current;
  $('note-status').textContent = canPersist()?'筆記只儲存在這個瀏覽器，可下載備份。':'瀏覽器無法保存本次紀錄，編輯後請下載備份。';
  document.querySelectorAll('[data-depth]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.depth === depth)));
  const rec = $('recommendations'); rec.replaceChildren();
  world?.setRecommendations?.(recommend(current));
  text('h2', '帶著這個問題，航向下一座島', rec);
  text('p', s?.interaction?.prompt || a.summary, rec);
  recommend(current).forEach((edge, i) => {
    const b = button(`${i === 0 ? '故事主線' : '延伸探索'} · ${article(edge.targetArticleId).title}`, () => { $('reader').close(); visit(edge.targetArticleId, edge); }, rec);
    text('small', edge.transitionQuestion, b); text('small', edge.editorialReason, b);
    b.addEventListener('mouseenter', () => world?.preview?.(edge.targetArticleId));
    b.addEventListener('focus', () => world?.preview?.(edge.targetArticleId));
    b.addEventListener('mouseleave', () => world?.preview?.(null));
    b.addEventListener('blur', () => world?.preview?.(null));
  });
}
function read() { if(!article(current))return;if($('game').open)$('game').close();flushNote(); renderReading(); $('reader').showModal();world?.setActive?.(false); }
function flushNote() {
  clearTimeout(noteTimer);
  const id = $('note').dataset.articleId;
  if (!id) return;
  progress.state.notes[id] = $('note').value.slice(0, 8000);
  $('note-status').textContent = progress.save() ? '已儲存在這個瀏覽器' : '未儲存，請下載備份。';
}

function openGame(object = null) {
  if(!article(current))return;
  const s = scene(current), id = current, kind = s.interactionType;
  if(world&&world.getState().current!==id)world.focus(id,{animate:false});
  const previousInteraction=world?.getState().interaction;
  if(previousInteraction&&!previousInteraction.before)world.applyInteraction(id,{...previousInteraction,before:true});
  gameState = { articleId: id, kind, choices: [], result: null, before: false, characterId: object?.characterId || s?.protagonistId, npcIndex: object?.npcIndex ?? null, speech: dialogueForCharacter(object?.characterId || s?.protagonistId, s), token: Symbol(), started: performance.now() };
  $('game-title').textContent = object?.characterId ? '和島上的朋友一起想一想' : s?.setting || article(id).title;
  $('game-intro').textContent = s?.lifeEvent || s?.interaction?.prompt;
  world?.setEncounter?.(gameState.characterId,gameState.npcIndex);
  world?.setSpeech?.(gameState.speech);
  $('game-controls').replaceChildren(); $('game-result').textContent = ''; $('game-after').hidden = true;
  $('game-evidence')?.remove();
  $('story-ending')?.remove();
  $('game-visual').className = ''; $('game-visual').replaceChildren();
  const icons = { sourceverification:['▧','⌕','✓'],purchase:['◒','▣','♡'],attention:['▤','◉','✦'],memory:['▥','◷','♫'],persona:['◉','▤','?'],judgment:['▤','⚖','?'],journey:['◉','⌁','▣'],delegation:['◉','⚙','☑'] };
  icons[kind].forEach(icon => text('span', icon, $('game-visual')));
  const root = $('game-controls');
  const choose = (label, choices, done) => {
    const group = text('fieldset', '', root); text('legend', label, group);
    choices.forEach(([value, title]) => button(title, () => done(value), group)); return group;
  };
  const select = (label, options) => { const l = text('label', label, root), el = document.createElement('select'); for (const [value, title] of options) { const o = text('option', title, el); o.value = value; } l.append(el); return el; };
  if (s?.interaction?.control?.options?.length) {
    const contextChoice = select(s.interaction.prompt, s.interaction.control.options.map(option=>[option.id,option.label]));
    contextChoice.id='scene-choice';
    gameState.scenarioChoice=contextChoice.value;
    contextChoice.onchange=()=>{gameState.scenarioChoice=contextChoice.value;};
  }
  if (kind === 'sourceverification') {
    const evidence = new Set();
    text('p', '先打開來源與脈絡，再決定這項線索能不能支持結論。', root);
    const clues=s.interaction.control.options.map(option=>[option.id,option.label]);
    clues.forEach(([key, label]) => button(`核對：${label}`, () => { evidence.add(key); const finding=s.interaction.outcomes.find(outcome=>outcome.choiceId===key); $('game-result').textContent = finding?.text||label; }, root));
    choose('目前可以下結論嗎？', [['use','先當成已確認'],['hold','保留待查，補足依據']], choice => finishGame([choice,...evidence], choice === 'hold' ? '映蓁把線索移到「待查」區，阿綺暫停引用。線索不足時，先保留不確定性。' : '阿綺先引用了線索，但仍需檢查它能回答的範圍。看起來可信，還不能代替查證。'));
  } else if (kind === 'purchase') {
    const need = select('今天最在意什麼？', [['price','預算有限'],['familiar','熟悉、有共同回憶'],['service','出問題時有人協助']]);
    const preference = select('偏好程度', [['low','只比較規格'],['high','我對熟悉品牌有感情']]);
    button('依照我的條件比較', () => { const selected = preference.value === 'high' ? '熟悉品牌' : need.value === 'price' ? '低價選項' : '服務較完整的選項'; finishGame([need.value, preference.value], `小岳把${selected}拿到面前，另外兩項留在架上。這是你設定條件下的情境比較，並非真實購買預測。`); }, root);
  } else if (kind === 'attention') {
    text('p', '同樣的街頭訊息，你要略看，還是親手參與？接著試著回想。', root);
    choose('選一種接觸方式', [['passive','路過看一眼'],['active','停下來排出「先問人，再問 AI」']], value => {
      gameState.choices = [value]; root.replaceChildren();
      text('p', value === 'active' ? '你親手完成了訊息：先問人，再問 AI。' : '招牌一閃而過：先問人，再問 AI。', root);
      button('轉身後回想', () => { root.replaceChildren(); choose('剛才招牌說了什麼？', [['human','先問人，再問 AI'],['speed','越快越好'],['unknown','我沒留意']], answer => finishGame([value,answer], answer === 'human' ? '小岳回頭指向招牌，辨認出剛才的訊息。這只記錄你這一次的回想，不推估一般人的記憶效果。' : '小岳停下腳步再看一次。一次曝光不保證記得；你可以重玩參與版本比較自己的感受。')); }, root);
    });
  } else if (kind === 'memory') {
    const found = new Set(); text('p', '找找劇場裡的生活線索，再選一個讓你想起自己經驗的物件。', root);
    const items = [['ticket','舊票根：曾和朋友一起看表演'],['radio','收音機：家裡熟悉的聲音'],['cup','杯上的刻痕：某次一起加班']];
    items.forEach(([id, label]) => button(`翻看${label.split('：')[0]}`, () => { found.add(id); $('game-result').textContent = label; }, root));
    button('把這段回憶留在廣場', () => finishGame([...found], found.size ? `小岳把你找到的${[...found].map(id=>({ticket:'舊票根',radio:'收音機',cup:'杯子'}[id])).join('、')}放到共看廣場。記憶的意義來自個人與共同經驗，不能只由道具推定。` : '小岳還沒找到有感的線索。你可以繼續找，也可以直接讀原文。'), root);
  } else if (kind === 'persona') {
    const setting = select('改變人物所處情境', [['commute','通勤中，只有三分鐘'],['home','在家，有時間比較']]);
    const sample = select('可用研究資料', [['narrow','只有單一族群訪談'],['mixed','有多種情境訪談']]);
    button('查看條件與推論邊界', () => finishGame([setting.value,sample.value], `映蓁把觀察室切到${setting.value === 'commute' ? '通勤' : '居家'}場景。${sample.value === 'narrow' ? '資料只涵蓋單一族群，她蓋上「不可外推」標記。' : '她保留不同情境的線索，仍把模型推論和真人訪談分開。'}這不是對真實族群的預測。`), root);
  } else if (kind === 'judgment') {
    const examples = s.islandId==='I01'?[['紀錄','這份分析的產出時間有紀錄。','data'],['估算','團隊預估下次會議可以省時。','estimate'],['解釋','客戶可能因此更願意採用提案。','inference'],['空白','是否改善使用者的問題？尚未驗證。','unknown']]:s.islandId==='A04'?[['紀錄','這批生成素材的數量已記錄。','data'],['估算','下一批預估可以縮短製作時間。','estimate'],['解釋','圖片看起來可能更符合品牌語氣。','inference'],['空白','來源和最終核准人？尚未確認。','unknown']]:[['紀錄','這場虛構測試有 8 人到場。','data'],['估算','下一場可能需要 12 張椅子。','estimate'],['解釋','有人提早離開，可能因為交通。','inference'],['空白','離開的人是否滿意？尚未詢問。','unknown']];
    const selects = examples.map(([label, claim]) => select(claim, [['unknown','未知'],['data','已記錄資料'],['estimate','估計'],['inference','推論']]));
    button('把資訊放上證據桌', () => { const matches = selects.filter((el,i) => el.value === examples[i][2]).length; finishGame(selects.map(el=>el.value), `映蓁把卡片分到證據桌的四格。${matches === 4 ? '這次每張卡都保留了它的證據性質。' : '有些卡還需要重新分類：記錄對應資料、預計對應估計、可能的解釋屬於推論，尚未確認的部分仍未知。'}分類練習不是能力評分。`); }, root);
  } else if (kind === 'journey') {
    const stage = select('觀察顧客停在哪裡', [['find','找不到需要的資訊'],['compare','比較選項時怕選錯'],['confirm','下單前不知道能否退換']]);
    const support = select('提供哪一種支援？', [['ad','再推一則廣告'],['explain','說清楚條件與限制'],['human','讓現場人員協助確認']]);
    button('修復這一段旅程', () => finishGame([stage.value,support.value], support.value === 'ad' ? '芬姐看見顧客仍停在原地。增加訊息沒有回答剛才的疑問。這段旅程還有待處理的阻礙。' : `芬姐${support.value === 'human' ? '走到顧客身旁，先聽完疑問' : '把限制與退換條件移到顧客看得到的位置'}。原先擋住動線的資訊牌移開，顧客有了下一步可確認的依據。`), root);
  } else {
    const task = select('交辦哪個任務？', [['draft','整理公開資料草稿'],['buy','替顧客付款下單'],['health','根據健康狀況提出建議']]);
    const authority = select('給 Agent 的權限', [['suggest','只整理建議'],['confirm','執行前請人確認'],['auto','自行執行']]);
    button('啟動協作', () => finishGame([task.value,authority.value], authority.value === 'auto' && task.value !== 'draft' ? '阿綺按下暫停，芬姐接手確認。付款或健康相關情境需要先界定資料、權限與責任，不能把方便當成授權。' : `Agent 將${task.value === 'draft' ? '公開資料草稿' : '待處理事項'}放到工作桌。${authority.value === 'suggest' ? '阿綺保留行動決定權。' : authority.value === 'confirm' ? '確認鈴響起，等阿綺核對再往下做。' : '阿綺仍檢查草稿依據，沒有把產出當成事實。'}`), root);
  }
  $('game').show();
}
function finishGame(choices, result) {
  const s = scene(gameState.articleId);
  const physicalReaction=result.split('。')[0]+'。';
  const choiceId=$('scene-choice')?.value||gameState.scenarioChoice;
  const outcome=s?.interaction?.outcomes?.find(item=>item.choiceId===choiceId);
  if(outcome)result=`${outcome.title}。${outcome.text}\n${result}`;
  gameState.choices = choices; gameState.result = result; gameState.before = false;
  gameState.speech = physicalReaction;
  $('game-result').textContent = result;
  world?.setSpeech?.(physicalReaction);
  $('game-visual').classList.add('changed'); $('game-after').hidden = false; $('compare').textContent = '查看選擇前';
  $('game-result').scrollIntoView({block:'nearest',behavior:reducedMotion?'instant':'smooth'});
  progress.stamp(s.insightStampId);
  world?.applyInteraction?.(gameState.articleId, { kind: gameState.kind, choices, scenarioChoice:choiceId, result, before: false });
  world?.setRecommendations?.(recommend(gameState.articleId));
  let source=$('game-evidence');if(!source){source=document.createElement('details');source.id='game-evidence';$('game-result').after(source);}source.replaceChildren();text('summary','這跟原文有什麼關係？',source);text('p',outcome?.sourceEvidence||s?.interaction?.sourceEvidence||article(gameState.articleId).summary,source);text('small',`觀點來源：${article(gameState.articleId).title}。人物與遊戲結果為虛構情境，並非原刊作者發言。`,source);renderCatalog();
  $('story-ending')?.remove();
  const ending=DATA.storyRoutes[0]?.ending;
  if(ending?.articleId===gameState.articleId){const closing=text('section','',$('game-after'));closing.id='story-ending';text('p',ending.text,closing);button('帶著我的判斷回到阿綺的工作室',()=>{$('game').close();visit(ending.returnToArticleId);},closing);}
}

async function intro() {
  if (progress.state.introSeen || reducedMotion) return;
  $('intro').hidden = false;
  $('intro-book').hidden=true;
  let sequence,finished=false,resolveSkip;
  const skipped=new Promise(resolve=>{resolveSkip=resolve;});
  $('skip-intro').onclick=()=>{finished=true;sequence?.skip();resolveSkip();};
  const animation=import('./intro.js').then(async module=>{
    if(finished)return;
    sequence=await module.createBookIntro({host:$('intro'),reducedMotion,onCaption:caption=>{$('intro-caption').textContent=caption;}});
    if(finished){sequence.dispose();return;}
    await sequence.play();
  });
  try{await Promise.race([animation,skipped]);}
  catch{status('開場動畫未能載入，直接進入閱讀群島。');}
  finally{finished=true;sequence?.dispose();$('intro').hidden=true;$('intro-book').replaceChildren();progress.state.introSeen=true;progress.save();}
}

$('read').onclick = read; $('interact').onclick = () => openGame();
$('skip-travel').onclick=()=>{world?.focus(current,{animate:false});$('travel-controls').hidden=true;};
$('return-travel').onclick=()=>{if(travelOrigin)visit(travelOrigin,null,false);$('travel-controls').hidden=true;};
$('bookmark').onclick = () => { progress.toggle('bookmarks', current); $('bookmark').textContent = progress.state.bookmarks.includes(current) ? '已收藏' : '收藏'; renderCatalog(); };
$('mark-read').onclick = () => { if (!progress.state.read.includes(current)) progress.toggle('read', current); $('mark-read').textContent = '已讀完 ✓'; renderCatalog(); };
$('note').addEventListener('input', () => { clearTimeout(noteTimer); $('note-status').textContent = '儲存中…'; noteTimer = setTimeout(flushNote, 200); });
$('reader').addEventListener('close',()=>{flushNote();world?.setActive?.(true);}); addEventListener('pagehide', flushNote);
document.querySelectorAll('[data-depth]').forEach(b => b.onclick = () => { flushNote(); depth = b.dataset.depth; renderReading(); });
for (const [id, offset] of [['previous',-1],['next',1]]) $(id).onclick = () => visit(DATA.articles[(DATA.articles.findIndex(a=>a.id===current)+22+offset)%22].id);
function setMode(mode){progress.state.mode=mode==='explore'?'explore':'story';progress.save();$('mode').textContent=progress.state.mode==='story'?'故事探索':'自由閱讀';world?.setMode(progress.state.mode);}
$('overview').onclick = () => { setMode('explore'); $('catalog').hidden = false; $('map-toggle').setAttribute('aria-expanded','true'); };
$('map-toggle').onclick = () => { $('catalog').hidden = !$('catalog').hidden; $('settings').hidden = true; $('map-toggle').setAttribute('aria-expanded', String(!$('catalog').hidden)); };
$('settings-toggle').onclick = () => { $('settings').hidden = !$('settings').hidden; $('catalog').hidden = true; };
$('search').oninput = renderCatalog; $('only-bookmarks').onchange = renderCatalog;
$('mode').onclick = () => setMode(progress.state.mode === 'story' ? 'explore' : 'story');
$('population').oninput = () => { $('population-value').value = $('population').value; world?.setPopulation(Number($('population').value)); };
$('motion').onchange = () => { reducedMotion = $('motion').checked; document.body.classList.toggle('reduce-motion',reducedMotion); world?.setReducedMotion(reducedMotion); };
$('season').onchange = () => { document.body.dataset.season = $('season').value; world?.setSeason?.($('season').value); };
$('sound').onchange = async () => {
  if (!$('sound').checked) { for (const n of soundNodes) { try { n.stop(); } catch {} } soundNodes = []; world?.setSound(false); return; }
  try { soundContext ||= new (window.AudioContext || window.webkitAudioContext)(); await soundContext.resume(); const gain = soundContext.createGain(); gain.gain.value=.013; gain.connect(soundContext.destination); for (const frequency of [130.81,196,261.63]) { const oscillator=soundContext.createOscillator(); oscillator.frequency.value=frequency; oscillator.connect(gain); oscillator.start(); soundNodes.push(oscillator); } world?.setSound(true); } catch { $('sound').checked=false; status('此瀏覽器未能啟用音效，仍可繼續探索。'); }
};
$('compare').onclick = () => { gameState.before=!gameState.before; $('compare').textContent=gameState.before?'查看選擇後':'查看選擇前'; $('game-visual').classList.toggle('changed',!gameState.before); $('game-result').textContent=gameState.before?`選擇前：${scene(gameState.articleId).lifeEvent}`:gameState.result; world?.applyInteraction?.(gameState.articleId,{...gameState,before:gameState.before}); };
$('replay').onclick=()=>{$('game').close();openGame();}; $('game-read').onclick=()=>{$('game').close();read();};
$('game').addEventListener('close',()=>{if(!$('game').open){world?.setEncounter?.(null);world?.setSpeech?.('');}});
addEventListener('keydown',event=>{if(event.key==='Escape'&&$('game').open)$('game').close();});
$('export-progress').onclick=()=>{flushNote();const url=URL.createObjectURL(new Blob([JSON.stringify(progress.state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='decision-wisdom-reading-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import-progress').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>2_000_000)throw Error('備份檔案過大');const saved=progress.restore(JSON.parse(await file.text()));renderCatalog();status(saved?'已合併閱讀紀錄，既有非空白筆記優先保留。':'已讀入本次畫面，但瀏覽器儲存失敗；請下載備份保存。');}catch(error){status(`無法匯入：${error.message}`);}finally{e.target.value='';}};
$('world').addEventListener('webglcontextlost',event=>{event.preventDefault();contextFailed=true;world?.dispose();world=null;document.body.classList.add('fallback');$('catalog').hidden=false;status('3D 連線中斷，已切換閱讀模式。閱讀紀錄與筆記仍可使用。');});

async function boot() {
  try {
    // Download the fixed Three.js module graph alongside the article edition;
    // createWorld still waits for data and a mounted canvas before touching GPU.
    const worldModulePromise=import('./world.js').then(module=>({module}),error=>({error}));
    const response=await fetch('../data/2026.json'); if(!response.ok)throw Error('文章資料暫時無法載入');
    DATA=buildData(await response.json()); if(DATA.articles.length!==22||DATA.islands.length!==22)throw Error('文章與島嶼資料不完整');
    contentControls.forEach(id=>{$(id).disabled=false;});
    current=article(progress.state.last)?.id||'2026-01'; renderCatalog(); visit(current,null,false);
    $('mode').textContent=progress.state.mode==='story'?'故事探索':'自由閱讀';
    let expired=false,worldTimeout;
    const worldReady=Promise.race([worldModulePromise.then(async ({module,error})=>{
      if(error)throw error;
      const m=module;
      const created=await m.createWorld({
        canvas:$('world'),data:DATA,reducedMotion,onIslandSelect:id=>visit(id),
        onObjectSelect:object=>{
          if(object.articleId!==current)visit(object.articleId,null,false);
          if(object.kind==='exit'){const edge=DATA.articleGraph.find(item=>item.sourceArticleId===current&&item.priority===1);if(edge)visit(edge.targetArticleId,edge);}
          else if(object.kind==='note')read();
          else openGame(object);
        },
        onTransitionStage:(stage,detail)=>{
          $('travel-controls').hidden=stage==='arrival'||reducedMotion;
          $('story').dataset.traveling=String(stage!=='arrival'&&!reducedMotion);
          if(stage!=='arrival'&&detail?.question)$('dialogue').textContent=detail.question;
          if(stage==='arrival'&&detail?.arrivalLine)$('dialogue').textContent=detail.arrivalLine;
          status(detail?.question||({settle:'故事暫停一下，帶著剛才的問題出發。',question:'下一個線索在海的另一邊。',carry:'帶上剛才的線索。',sail:'沿著知識航線前進。',arrival:'已抵達，點選人物或道具開始探索。'}[stage])||'正在航行');
        },
      });
      if(expired){created.dispose();throw Error('3D 載入逾時');}return created;
    }),new Promise((_,reject)=>{worldTimeout=setTimeout(()=>{expired=true;reject(Error('3D 載入逾時'));},15000);})]).then(value=>({value}),error=>({error}));
    await intro();
    try { const loaded=await worldReady;clearTimeout(worldTimeout);if(loaded.error)throw loaded.error;if(contextFailed){loaded.value.dispose();throw Error('3D 連線中斷');}world=loaded.value; syncWorldState();status('拖曳探索・滾輪縮放・點選人物或道具。'); }
    catch(error){document.body.classList.add('fallback');$('catalog').hidden=false;status(`${error.message}。已切換可閱讀全部文章的 2D 模式。`);}
    window.immersive={get data(){return DATA;},get world(){return world;},get progress(){return progress.state;},visit,openGame};
  } catch(error) { document.body.classList.add('fallback');status(error.message);$('dialogue').replaceChildren();const a=text('a','開啟完整原文目錄',$('dialogue'));a.href='../read/2026/index.html'; }
}
boot();

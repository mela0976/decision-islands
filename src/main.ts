import './style.css';
import './publication-fonts.css';
import { mountReadingNotes } from './reading-notes';
import { initializeBrowserCache } from './browser-cache';
import type { createWorld } from './world';
import { createExplorerUI } from './explorer-ui';
import type { createReadingJourneyUI } from './reading-journey-ui';
import { buildReadingJourneys } from './reading-journeys';
import type { JourneyDefinition } from './journey-types';
import { DATA, buildExplorerData, initialExplorerState, isExplorerCurated } from './explorer-data';
import { clampNpcPopulation, createNpcRoster } from './explorer-npcs';
import { applySeason, HOLIDAYS, readSeason, saveSeason } from './season';
import type { Season } from './season';
import type { ExplorerCommand, ExplorerData, ExplorerSelection, ExplorerUI, ExplorerUICallbacks, NpcSpeechCue } from './explorer-types';
import { chapters, paths, findArticles, readState, saveState, escapeHtml as h } from './library';
import type { Catalog, Chapter, Edition, ReadingPath } from './types';

const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh';
const en = language === 'en';
const t = (zh: string, english: string) => en ? english : zh;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const explorerState = initialExplorerState(language, motionPreference.matches);
explorerState.season = readSeason();
applySeason(explorerState.season);
document.documentElement.lang = en ? 'en' : 'zh-Hant';
document.body.dataset.language = language;
const base = import.meta.env.BASE_URL;
const asset = (url: string) => base + url.replace(/^\//, '');
const root = document.querySelector<HTMLDivElement>('#app')!;
let edition: Edition;
let catalog: Catalog;
let chapter: Chapter | null = null;
let query = '';
let tab: 'articles' | 'paths' | 'saved' = 'articles';
let entered = false;
let activePath: ReadingPath | null = null;
let state = readState();
let motion = !motionPreference.matches;
let explorerData: ExplorerData | undefined;
let explorerUI: ExplorerUI | undefined;
let journeyUI: ReturnType<typeof createReadingJourneyUI> | undefined;
let guidedReading = false;
let hasCuratedJourneys = false;
let editionRequest = 0;
let world: ReturnType<typeof createWorld> | undefined;
let npcSpeech: NpcSpeechCue | null = null;
let journeyReady: Promise<void> = Promise.resolve();
let journeyFailure: unknown;
let worldStarting = false;
let lastFocus: HTMLElement | null = null;
let cleanupReadingNotes: (() => void) | undefined;

root.innerHTML = `
  <a class="skip-link" href="#library">跳到文章目錄</a>
  <div class="experience">
    <div id="world" aria-label="決策群島互動場景"></div>
    <header class="masthead">
      <a class="brand" href="#" aria-label="決策群島首頁"><span class="brand-mark">決策<br>群島<span class="brand-dot">.</span></span><span class="brand-meta">決策智慧<br><b>2026</b></span></a>
      <div class="top-actions"><button id="my-reading" class="icon-button">${t('我的任務', 'My tasks')}</button><label class="season-picker"><span>${t('節慶', 'Season')}</span><select id="season" aria-label="${t('選擇節慶', 'Choose a season')}">${(Object.keys(HOLIDAYS) as Season[]).map(value => `<option value="${value}" ${value === explorerState.season ? 'selected' : ''}>${HOLIDAYS[value].title[language]}</option>`).join('')}</select></label><button id="motion" class="icon-button" aria-pressed="${motion}">${motion ? '◌ 動態開啟' : '◌ 動態暫停'}</button><button id="overview" class="icon-button">⌖ 全景</button><button id="toggle-library" class="icon-button" aria-controls="library">☷ 目錄</button></div>
    </header>
    <section class="welcome" aria-labelledby="welcome-title">
      <p class="edition-label">電通行銷傳播集團 · 決策智慧十週年</p>
      <h1 id="welcome-title">十年的智慧，<br>在這裡相遇。</h1>
      <p class="welcome-copy">穿過十年的智慧，<br>尋找品牌與人的真實距離。</p>
      <div class="welcome-bottom"><button id="enter" class="primary">${t('開始我的情境任務', 'Start my scenario')} <span>↗</span></button><button id="skip-intro" class="text-button">直接開始閱讀</button></div>
      <p class="welcome-note">選一個角色，在生活與工作的小選擇中理解觀點。</p>
    </section>
    <section class="world-caption" hidden><span class="small-line">2026 · Agentic 時代</span><h1>重塑品牌與人的<br>真實距離。</h1><p>點一座島，讓觀點連起來。</p></section>
    <div class="world-bottom" hidden><div class="chapter-legend">${Object.entries(chapters).map(([id,c]) => `<button data-chapter="${id}"><i style="background:${c.color}"></i>${c.title}</button>`).join('')}</div><span class="map-hint">拖曳旋轉 · 點選探索</span></div>
    <div id="explorer-ui"></div><div id="reading-journey"></div>
    <aside id="library" class="library" aria-label="閱讀目錄" tabindex="-1">
      <div class="library-head"><span class="library-kicker">觀點在這裡相遇</span><button id="close-library" class="icon-button" aria-label="收起目錄">×</button><h2>把理解，連起來。</h2><p id="edition-stats">2026 決策智慧</p><label class="search-box"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="搜尋觀點、作者、關鍵字" aria-label="搜尋觀點、作者、關鍵字"><kbd>/</kbd></label><div class="tabs" role="tablist" aria-label="目錄類型"><button id="tab-articles" role="tab" aria-selected="true">全部觀點</button><button id="tab-paths" role="tab" aria-selected="false">策展路線</button><button id="tab-saved" role="tab" aria-selected="false">我的書籤</button></div></div>
      <div class="library-content" id="library-content" role="tabpanel" aria-label="觀點清單"></div>
      <footer class="library-footer"><label for="year">年度藏書</label><select id="year" aria-label="選擇年度"></select><button id="about" class="text-button">關於這座群島</button><div class="progress-label"><span id="progress-text">閱讀足跡</span><span>只保存在這台裝置</span></div><div class="progress-track"><span id="progress-fill"></span></div></footer>
    </aside>
  </div>
  <dialog id="reader" aria-labelledby="reader-title"><div class="reader-toolbar"><button id="reader-back" class="text-button">← 回到群島</button><div><button id="font-down" class="icon-button" aria-label="縮小字級">A−</button><button id="font-up" class="icon-button" aria-label="放大字級">A＋</button><button id="bookmark" class="icon-button" aria-pressed="false">收藏</button><button id="reader-close" class="icon-button" aria-label="關閉閱讀">×</button></div></div><div class="reading-progress"><span id="reading-progress-fill"></span></div><div id="reader-content"></div></dialog>
  <dialog id="about-dialog" class="about-dialog" aria-labelledby="about-title"><button id="about-close" class="icon-button" aria-label="關閉關於">×</button><p class="edition-label">決策智慧十週年</p><h2 id="about-title">先理解人，<br>再理解下一步。</h2><p>${t('這是一座以真實刊物為基礎的閱讀群島。先選生活或工作情境，從你在意的問題開始，再補上其他觀點。地圖區域是本站策展分類，原書章節仍可在目錄中查閱。', 'Begin with a life or work context, choose a question, and explore complementary perspectives from the book. Map regions are editorial groupings; original chapters remain available in the directory.')}</p><p>文章標題、作者與摘要來自提供的刊物及編輯目錄。閱讀導引與串聯理由屬本網站策展。全文由刊物轉錄，圖表與原版排版請對照各篇 PDF。</p><p>目前收錄 2026。其他年度將在取得 PDF 並完成校對後匯入。收藏與閱讀足跡只存在你的瀏覽器，不傳送到伺服器。</p><a href="https://dentsupro.com.tw/decision-wisdom-2026-event/" target="_blank" rel="noopener noreferrer">比賽規則與出處 ↗</a><p class="about-credit">內容著作權屬電通行銷傳播集團及原作者。互動視覺為本作品原創。</p></dialog>
  <div id="toast" role="status" aria-live="polite"></div>`;

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const reader = $<HTMLDialogElement>('#reader');
const disclosure=document.createElement('a');
disclosure.href='https://www.dentsu.com/uk/en/policies/responsible-disclosure-policy';
disclosure.textContent='資安問題揭露政策 ↗';
disclosure.target='_blank';disclosure.rel='noopener noreferrer';
$('.about-credit').before(disclosure);
const mobileLayout = matchMedia('(max-width: 760px)');
function setLibrary(open: boolean, focus = false) {
  document.body.classList.toggle('library-open', open);
  $('#library').inert = !open;
  $('#explorer-ui').inert = open;
  if (open) { guidedReading = false; journeyUI?.setActive(false); explorerState.listOpen = false; explorerState.detailOpen = false; syncExplorer(); }
  $('#toggle-library').setAttribute('aria-expanded',String(open));
  if (focus) (open ? $('#library') : $('#toggle-library')).focus();
}
mobileLayout.addEventListener('change',()=>setLibrary(document.body.classList.contains('library-open')));
setLibrary(false);
const storage = () => { if (!saveState(state)) toast(t('瀏覽器無法儲存，本次仍可閱讀。', 'Your browser could not save progress. You can keep reading.')); };
function toast(message: string) { $('#toast').textContent = message; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 3000); }

function renderList() {
  if (!edition) return;
  document.querySelectorAll('#library [role="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.id === `tab-${tab}`)));
  const panel = $('#library-content');
  if (tab === 'paths' && !query) {
    const availablePaths = isExplorerCurated(DATA, edition) ? paths : [];
    panel.innerHTML = `<p class="panel-intro">${availablePaths.length ? '不必讀完全部，先找到你在意的問題。' : '這本書的策展路線尚未編排，先從全部觀點開始。'}</p>${availablePaths.map((p,i) => `<button class="path-card" data-path="${p.id}"><span class="path-no">路線 ${String(i+1).padStart(2,'0')}</span><h3>${p.title}</h3><p>${p.question}</p><span class="path-bottom">${p.orders.length} 篇串讀 <span>↗</span></span></button>`).join('')}`;
  } else {
    let filtered = findArticles(edition.articles, query, chapter);
    if (tab === 'saved') filtered = filtered.filter(a => state.bookmarks.includes(a.id));
    panel.innerHTML = `${chapter ? `<div class="active-filter"><span>${chapters[chapter].title}</span><button data-clear="true" aria-label="清除章節篩選">×</button></div>` : ''}${query ? `<p class="result-count" role="status">找到 ${filtered.length} 篇觀點</p>` : ''}${!filtered.length ? `<div class="empty"><h3>${tab === 'saved' ? '把想讀的，留在這裡。' : '還沒有找到這個觀點。'}</h3><p>${tab === 'saved' ? '閱讀時點選「收藏」，下次就能接著探索。' : '試試「信任」「注意力」或作者姓名。'}</p><button class="text-button" data-reset="true">回到全部觀點</button></div>` : filtered.map(a => `<button class="article-row ${state.completed.includes(a.id) ? 'is-complete' : ''}" data-article="${a.id}"><span class="article-no">${String(a.order).padStart(2,'0')}</span><span class="article-row-copy"><span class="article-chapter" style="color:${chapters[a.chapter].color}">${chapters[a.chapter].english}${state.completed.includes(a.id) ? ' · 已讀' : ''}</span><h3>${h(a.title)}</h3><span class="article-author">${h(a.authors)}</span></span><span class="row-arrow" aria-hidden="true">↗</span></button>`).join('')}`;
  }
  panel.querySelectorAll<HTMLElement>('[data-article]').forEach(b => b.onclick = () => { activePath = null; openArticle(b.dataset.article!); });
  panel.querySelectorAll<HTMLElement>('[data-path]').forEach(b => b.onclick = () => { activePath = paths.find(p => p.id === b.dataset.path)!; openArticle(edition.articles.find(a => a.order === activePath!.orders[0])!.id); });
  panel.querySelector<HTMLElement>('[data-clear]')?.addEventListener('click', () => selectChapter(null));
  panel.querySelector<HTMLElement>('[data-reset]')?.addEventListener('click', () => { query=''; chapter=null; tab='articles'; $<HTMLInputElement>('#search').value=''; explorerState.chapter = null; syncExplorer(); renderList(); });
  const completed = edition.articles.filter(a => state.completed.includes(a.id)).length;
  $('#progress-text').textContent = `已讀 ${completed} / ${edition.articles.length} 篇`;
  $('#progress-fill').style.width = `${completed / edition.articles.length * 100}%`;
  localizeChrome($('#library'));
}

function selectChapter(value: Chapter | null) {
  chapter = value; tab = 'articles'; query = ''; $<HTMLInputElement>('#search').value = '';
  explorerState.chapter = value; syncExplorer(); renderList();
  document.querySelectorAll<HTMLElement>('[data-chapter]').forEach(b => b.classList.toggle('selected',b.dataset.chapter === value));
  setLibrary(true);
}

async function enter(animate = true, guide = true) {
  if (!edition) return;
  if (entered) return;
  entered = true;
  document.body.classList.add('entering');
  try {
    if (guide) {
      if (journeyFailure) await loadEdition(edition.year);
      await journeyReady;
      if (journeyFailure) throw journeyFailure;
    }
    if (!animate) world?.setMotion(false);
    await world?.enter();
  } catch {
    entered = false;
    document.body.classList.remove('entering');
    setLibrary(true, true);
    toast(t('情境任務暫時無法載入，仍可從目錄閱讀；請重試或重新整理。', 'Scenarios could not load. You can still read the directory; retry or reload.'));
    return;
  }
  if (!animate) world?.setMotion(motion);
  document.body.classList.add('exploring');
  document.body.classList.remove('entering');
  setLibrary(document.body.classList.contains('library-open'));
  $('.welcome').hidden = true;
  $('.world-caption').hidden = true;
  $('.world-bottom').hidden = true;
  explorerUI?.setActive(true);
  syncExplorer();
  if (guide && !reader.open && !document.body.classList.contains('library-open')) {
    guidedReading = true;
    journeyUI?.setActive(true); journeyUI?.showPicker();
  }
}

function openArticle(id: string, updateHash = true) {
  const a = edition.articles.find(item => item.id === id);
  if (!a) { toast(t('這篇文章尚未收錄。', 'This article is not available yet.')); return; }
  explorerState.detailOpen = false;
  npcSpeech = null;
  world?.setNpcSpeech(null);
  const journeyContext = !activePath && guidedReading ? journeyUI?.getContext(a.id) : null;
  if (journeyContext) journeyUI?.syncArticle(a.id);
  const item = explorerData?.items.find(item => item.articleId === a.id);
  if (guidedReading && !journeyContext) {
    guidedReading = false; journeyUI?.setActive(false);
  }
  if (item) {
    explorerState.selection = { kind: 'item', itemId: item.id };
    if (journeyContext || document.body.classList.contains('library-open')) explorerState.detailOpen = false;
    world?.setSelection(explorerState.selection, false);
  }
  syncExplorer();
  state.last = a.id; storage();
  const color = chapters[a.chapter].color;
  const pathIndex = activePath?.orders.indexOf(a.order) ?? -1;
  const nextOrder = activePath && pathIndex >= 0 ? activePath.orders[pathIndex + 1] : null;
  const next = journeyContext ? edition.articles.find(x => x.id === journeyContext.nextArticleId) : activePath ? (nextOrder ? edition.articles.find(x=>x.order===nextOrder) : undefined) : edition.articles.find(x=>x.order===a.order+1);
  const related = edition.articles.filter(x => x.id!==a.id && x.chapter===a.chapter).slice(0,2);
  cleanupReadingNotes?.();
  cleanupReadingNotes = undefined;
  $('#reader-content').innerHTML = `<article class="reading-article" style="--chapter-color:${color};--reading-size:${state.fontSize}px">
    ${activePath ? `<div class="path-context">${h(activePath.title)}<span>${pathIndex + 1} / ${activePath.orders.length} 篇</span></div>` : ''}
    ${journeyContext ? `<div class="path-context journey-reader-context">${h(journeyContext.questionTitle)}<span>${journeyContext.stepIndex + 1} / ${journeyContext.total}</span></div>` : ''}
    <div class="article-eyebrow">${a.year} 決策智慧 <span>／</span> ${chapters[a.chapter].english} <span>／</span> 原刊 p.${a.printedStart}–${a.printedEnd}</div>
    <h1 id="reader-title">${h(a.title)}</h1><p class="byline">${h(a.authors)}</p>
    <div class="reader-meta"><span>約 ${a.minutes} 分鐘</span><a href="${asset(a.sourcePdf)}" target="_blank" rel="noopener noreferrer">對照原刊 PDF ↗</a><a href="${asset(a.htmlUrl)}">獨立閱讀頁 ↗</a></div>
    <section class="summary-block" aria-label="編輯摘要"><span>先讀這個觀點</span><p>${h(a.summary.replace(/^【決策智慧 2026】/,''))}</p></section>
    ${a.highlights.length ? `<details class="reading-guide"><summary>這篇值得帶走什麼？</summary><div><p class="provenance">以下導讀來自提供的編輯目錄。</p>${a.highlights.map(p=>`<p>${h(p)}</p>`).join('')}</div></details>` : ''}
    <p class="transcription-note">刊物文字整理。圖表與原始版面請對照原刊 PDF。${a.unpublishedDifferenceCount ? ' 與刊物版本無法核對的排版文字未收錄，以原刊 PDF 為完整依據。' : ''}</p>
    <div class="article-body">${a.paragraphs.map(p=>`<p>${h(p)}</p>`).join('')}</div>
    ${a.supplementaryParagraphs?.length ? `<details class="reading-guide"><summary>圖表、註解與補充文字</summary><p class="provenance">以下文字見於原刊的多個位置，集中保留供查閱；圖表關係請對照 PDF。</p>${a.supplementaryParagraphs.map(p=>`<p>${h(p)}</p>`).join('')}</details>` : ''}
    <footer class="article-end"><p>讀到這裡，你帶走了什麼？</p><button id="complete" class="primary">${state.completed.includes(a.id) ? '已完成閱讀 ✓' : '留下閱讀足跡'}</button>
    ${next ? `<div class="next-reading"><span>${journeyContext ? t('補上另一個角度', 'Add another perspective') : activePath ? '沿著這條路線' : '繼續探索'}</span><h2>${h(next.title)}</h2>${journeyContext?.nextReason ? `<p>${h(journeyContext.nextReason)}</p>` : ''}${activePath && pathIndex >= 0 && activePath.connections[pathIndex] ? `<p>${h(activePath.connections[pathIndex])}</p>` : ''}<button id="next-article" class="text-button">閱讀下一篇 ↗</button></div>` : `<p>${journeyContext?.hasMission ? t('回到情境，整理你的選擇與尚待確認的條件。', 'Return to the task to review your choices and open questions.') : t('你已走完這條閱讀路線。', 'You have reached the end of this reading path.')}</p>${journeyContext ? `<button id="return-journey" class="text-button">${t('回到我的閱讀路線', 'Back to my reading path')} ↗</button>` : ''}`}
    <div class="related"><h2>同一座島，其他觀點</h2>${related.map(r=>`<button class="text-button" data-related="${r.id}">${h(r.title)} ↗</button>`).join('')}</div></footer></article>`;
  cleanupReadingNotes = mountReadingNotes($('#reader-content'), a, edition.title);
  const bookmarked = () => { const value = state.bookmarks.includes(a.id); $('#bookmark').textContent = value ? '已收藏 ★' : '收藏 ☆'; $('#bookmark').setAttribute('aria-pressed',String(value)); };
  bookmarked();
  localizeChrome($('#reader'));
  $('#bookmark').onclick = () => { state.bookmarks = state.bookmarks.includes(a.id) ? state.bookmarks.filter(x=>x!==a.id) : [...state.bookmarks,a.id]; storage(); bookmarked(); localizeChrome($('#reader')); renderList(); syncExplorer(); };
  $('#complete').onclick = () => { if (!state.completed.includes(a.id)) state.completed.push(a.id); storage(); $('#complete').textContent='已完成閱讀 ✓'; renderList(); syncExplorer(); toast(t('已留下這篇的閱讀足跡。', 'Your reading progress has been saved.')); localizeChrome($('#reader')); };
  if (journeyContext?.hasMission) {
    const nextButton = $('#next-article');
    if (nextButton) nextButton.textContent = t('回到情境，進入下一回合 →', 'Return to the task and continue →');
    const returnButton = $('#return-journey');
    if (returnButton) returnButton.textContent = t('回到我的處理方案 ↗', 'Back to my plan ↗');
  }
  $('#next-article')?.addEventListener('click',()=>{
    if (journeyContext?.hasMission) { closeReader(); journeyUI?.advance(); }
    else openArticle(next!.id);
  });
  $('#return-journey')?.addEventListener('click', closeReader);
  document.querySelectorAll<HTMLElement>('[data-related]').forEach(b=>b.onclick=()=>{activePath=null;openArticle(b.dataset.related!);});
  if (!reader.open) { lastFocus = document.activeElement as HTMLElement; reader.showModal(); }
  world?.setMotion(false);
  journeyUI?.setMotion(false);
  reader.scrollTop = 0; $('#reader-title').setAttribute('tabindex','-1'); $('#reader-title').focus({preventScroll:true});
  $('#reading-progress-fill').style.width='0%';
  if (updateHash) history.pushState({article:a.id},'',`#read/${a.id}`);
}

function closeReader() {
  cleanupReadingNotes?.();
  cleanupReadingNotes = undefined;
  reader.close();
  syncExplorer();
  journeyUI?.setMotion(motion);
  if (location.hash.startsWith('#read/')) history.replaceState(null,'',location.pathname+location.search);
  const original = lastFocus?.isConnected && lastFocus.tabIndex>=0 && !reader.contains(lastFocus) ? lastFocus : state.last ? document.querySelector<HTMLElement>(`[data-article="${CSS.escape(state.last)}"]`) : null;
  if (original && !original.closest('[inert]')) original.focus();
  else if (guidedReading) $('#my-reading').focus();
  else if (mobileLayout.matches && !document.body.classList.contains('library-open')) $('#toggle-library').focus();
  else if (document.body.classList.contains('library-open')) $('#library').focus();
  else $('#toggle-library').focus();
}
$('#reader-close').onclick = closeReader; $('#reader-back').onclick = closeReader;
reader.addEventListener('cancel',e=>{e.preventDefault();closeReader();});
reader.addEventListener('scroll',()=>{const total=reader.scrollHeight-reader.clientHeight; $('#reading-progress-fill').style.width=`${total>0?reader.scrollTop/total*100:100}%`;});
for (const [id, delta] of [['font-down',-2],['font-up',2]] as const) $(`#${id}`).onclick = () => {state.fontSize=Math.max(18,Math.min(24,state.fontSize+delta)); $('.reading-article').style.setProperty('--reading-size',`${state.fontSize}px`);storage();};
$('#enter').onclick = () => void enter();
$('#my-reading').onclick = async () => {
  if (reader.open) closeReader();
  await enter(false);
  if (!journeyUI) return;
  guidedReading = true; journeyUI?.setActive(true); journeyUI?.showPicker();
};
$('.skip-link').onclick = e => {e.preventDefault();void enter(false, false);setLibrary(true,true);};
$('#skip-intro').onclick = () => { void enter(false, false); setLibrary(true,true); };
$('#motion').onclick = () => { explorerState.paused = !explorerState.paused; syncExplorer(); };
motionPreference.addEventListener('change', event => { explorerState.reducedMotion = event.matches; syncExplorer(); });
$('#overview').onclick = () => { void enter(false, false); commandExplorer({ type: 'overview' }); };
$<HTMLSelectElement>('#season').onchange = event => commandExplorer({ type: 'season', season: (event.target as HTMLSelectElement).value as Season });
$('#toggle-library').onclick = () => {void enter(false, false);setLibrary(!document.body.classList.contains('library-open'),true);};
$('#close-library').onclick = () => setLibrary(false,true);
document.querySelectorAll<HTMLElement>('[data-chapter]').forEach(b=>b.onclick=()=>{void enter(false, false);selectChapter(b.dataset.chapter as Chapter);});
for (const t of ['articles','paths','saved'] as const) $(`#tab-${t}`).onclick=()=>{tab=t;query='';$<HTMLInputElement>('#search').value='';renderList();};
$<HTMLInputElement>('#search').oninput = e => { query=(e.target as HTMLInputElement).value;renderList(); };
$('#about').onclick=()=>$<HTMLDialogElement>('#about-dialog').showModal();
$('#about-close').onclick=()=>$<HTMLDialogElement>('#about-dialog').close();
document.addEventListener('keydown',e=>{if(e.key==='/'&&!reader.open&&!['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName)){e.preventDefault();setLibrary(true);$('#search').focus();}});
window.addEventListener('popstate',()=>{void navigateHash();});
async function navigateHash() {
  if (!catalog || !edition) return;
  if (location.hash.startsWith('#read/')) {
    const id=location.hash.slice(6);
    const year=Number(id.match(/^(\d{4})-/)?.[1]);
    try {
      if (year!==edition.year && catalog.years.some(y=>y.year===year)) await loadEdition(year);
      openArticle(id,false);
    } catch { toast(t('無法開啟這篇文章，請從年度目錄重試。', 'Could not open this article. Try the edition directory.')); }
  } else if(reader.open) closeReader();
}

function syncExplorer() {
  journeyUI?.setCompleted(state.completed);
  explorerState.completedArticleIds = [...state.completed];
  explorerState.bookmarkedArticleIds = [...state.bookmarks];
  motion = !explorerState.reducedMotion && !explorerState.paused;
  journeyUI?.setMotion(motion && !reader.open);
  world?.setState(explorerState);
  world?.setMotion(motion && !guidedReading && !reader.open);
  explorerUI?.render(explorerState);
  $('#motion').textContent = motion ? t('◌ 動態開啟', '◌ Motion on') : t('◌ 動態暫停', '◌ Motion paused');
  $('#motion').setAttribute('aria-pressed', String(motion));
  $<HTMLSelectElement>('#season').value = explorerState.season;
}

function selectExplorer(selection: ExplorerSelection, focus = true) {
  if (selection) { guidedReading = false; journeyUI?.setActive(false); }
  explorerState.selection = selection;
  explorerState.detailOpen = selection !== null;
  if (selection) setLibrary(false);
  world?.setSelection(selection, focus);
  syncExplorer();
}

function commandExplorer(command: ExplorerCommand) {
  switch (command.type) {
    case 'overview':
      guidedReading = false; journeyUI?.setActive(false);
      explorerState.selection = null; explorerState.birdseye = false; explorerState.detailOpen = false;
      world?.reset(); break;
    case 'birdseye': explorerState.birdseye = command.enabled; break;
    case 'minute': explorerState.minute = ((command.minute % 1440) + 1440) % 1440; break;
    case 'population': {
      explorerState.population = clampNpcPopulation(command.count);
      const selected = explorerState.selection;
      if (selected?.kind === 'walker' && explorerData && !createNpcRoster(explorerData, explorerState.population).some(npc => npc.id === selected.walkerId)) {
        explorerState.selection = null; explorerState.detailOpen = false;
      }
      break;
    }
    case 'paused': explorerState.paused = command.paused; break;
    case 'season':
      explorerState.season = command.season; applySeason(command.season); world?.setSeason(command.season);
      if (!saveSeason(command.season)) toast(t('瀏覽器無法儲存節慶設定。', 'Your browser could not save the season.'));
      break;
    case 'chapter':
      explorerState.chapter = command.chapter; chapter = command.chapter; renderList(); break;
    case 'toggle': explorerState[command.key] = command.value; break;
    case 'query': explorerState.query = command.query; break;
    case 'tab': explorerState.tab = command.tab; break;
    case 'panel':
      if (command.open) { guidedReading = false; journeyUI?.setActive(false); setLibrary(false); }
      if (command.panel === 'list') {
        explorerState.listOpen = command.open;
        if (command.open) explorerState.detailOpen = false;
      }
      else explorerState.detailOpen = command.open;
      break;
    case 'journalFilter': explorerState.journalFilter = command.flowId; break;
    default: { const exhaustive: never = command; return exhaustive; }
  }
  syncExplorer();
}

function localizeChrome(host: HTMLElement) {
  if (!en) return;
  const translations: Record<string, string> = {
    '暫時無法展開目錄。': 'The directory is unavailable.', '重新整理後再試，或先開啟完整閱讀目錄。': 'Reload to retry, or open the reading directory.', '開啟閱讀目錄': 'Open reading directory', '重新載入': 'Reload',
    '跳到文章目錄': 'Skip to article directory', '決策群島首頁': 'Decision Islands home',
    '決策群島互動場景': 'Interactive Decision Islands scene', '決策': 'Decision', '群島': 'Islands', '決策智慧': 'Decision Wisdom',
    '⌖ 全景': '⌖ Overview', '☷ 目錄': '☷ Articles', '收起目錄': 'Close directory',
    '電通行銷傳播集團 · 決策智慧十週年': 'dentsu · Ten years of Decision Wisdom',
    '十年的智慧，': 'Ten years of wisdom,', '在這裡相遇。': 'meet here.', '穿過十年的智慧，': 'Travel through ten years of ideas,',
    '尋找品牌與人的真實距離。': 'discover the distance between brands and people.', '啟程，探索 2026': 'Begin exploring 2026',
    '直接開始閱讀': 'Start reading', '選一個角色，在生活與工作的小選擇中理解觀點。': 'Choose a role. Explore ideas through everyday decisions.',
    '閱讀目錄': 'Article directory', '觀點在這裡相遇': 'Ideas meet here', '把理解，連起來。': 'Connect your understanding.',
    '搜尋觀點、作者、關鍵字': 'Search ideas, authors, keywords', '目錄類型': 'Directory view', '全部觀點': 'All articles',
    '策展路線': 'Reading paths', '我的書籤': 'Bookmarks', '觀點清單': 'Article list', '年度藏書': 'Edition', '選擇年度': 'Choose edition',
    '關於這座群島': 'About these islands', '閱讀足跡': 'Reading progress', '只保存在這台裝置': 'Saved on this device',
    '← 回到群島': '← Back to islands', '縮小字級': 'Decrease text size', '放大字級': 'Increase text size', '收藏': 'Bookmark',
    '已收藏 ★': 'Saved ★', '收藏 ☆': 'Bookmark ☆', '關閉閱讀': 'Close reader', '關閉關於': 'Close about',
    '決策智慧十週年': 'Ten years of Decision Wisdom', '先理解人，': 'Understand people,', '再理解下一步。': 'then the next step.',
    '比賽規則與出處 ↗': 'Competition rules and source ↗', '資安問題揭露政策 ↗': 'Responsible disclosure policy ↗',
    '不必讀完全部，先找到你在意的問題。': 'Find a question that matters to you.',
    '這本書的策展路線尚未編排，先從全部觀點開始。': 'Reading paths are being prepared. Start with all articles.',
    '清除章節篩選': 'Clear chapter filter', '把想讀的，留在這裡。': 'Keep the articles you want to read.',
    '還沒有找到這個觀點。': 'No matching articles yet.', '閱讀時點選「收藏」，下次就能接著探索。': 'Bookmark an article to return to it later.',
    '試試「信任」「注意力」或作者姓名。': 'Try a keyword or author name in the original language.', '回到全部觀點': 'Show all articles',
    '刊物文字整理。圖表與原始版面請對照原刊 PDF。': 'Transcribed publication text. Consult the original PDF for charts and layout.',
    '刊物文字整理。圖表與原始版面請對照原刊 PDF。 與刊物版本無法核對的排版文字未收錄，以原刊 PDF 為完整依據。': 'Transcribed publication text. Unverified layout text is omitted. Consult the original PDF as the full source.',
    '編輯摘要': 'Editorial summary', '先讀這個觀點': 'Start with this idea', '這篇值得帶走什麼？': 'What can you take from this article?',
    '以下導讀來自提供的編輯目錄。': 'This guide comes from the supplied editorial directory.', '對照原刊 PDF ↗': 'Original PDF ↗',
    '獨立閱讀頁 ↗': 'Standalone reading page ↗', '圖表、註解與補充文字': 'Charts, notes and additional text',
    '以下文字見於原刊的多個位置，集中保留供查閱；圖表關係請對照 PDF。': 'Additional text is collected here for reference. Consult the original PDF for charts.',
    '讀到這裡，你帶走了什麼？': 'What will you take away?', '已完成閱讀 ✓': 'Completed ✓', '留下閱讀足跡': 'Mark as read',
    '沿著這條路線': 'Along this reading path', '繼續探索': 'Keep exploring', '閱讀下一篇 ↗': 'Read next ↗', '你已走完這條閱讀路線。': 'You have completed this reading path.',
    '同一座島，其他觀點': 'Other ideas on this island',
    '文章標題、作者與摘要來自提供的刊物及編輯目錄。閱讀導引與串聯理由屬本網站策展。全文由刊物轉錄，圖表與原版排版請對照各篇 PDF。': 'Titles, authors, summaries and original article text come from the supplied publication. Connections are curator suggestions. Consult the PDF for charts and layout. Original articles remain in Chinese.',
    '目前收錄 2026。其他年度將在取得 PDF 並完成校對後匯入。收藏與閱讀足跡只存在你的瀏覽器，不傳送到伺服器。': 'The 2026 edition is available. Earlier editions will follow after source checks. Bookmarks and progress stay in your browser.',
    '內容著作權屬電通行銷傳播集團及原作者。互動視覺為本作品原創。': 'Content copyright belongs to dentsu and the original authors. Interactive visuals are original to this project.',
  };
  const translate = (value: string) => {
    const key = value.trim();
    if (translations[key]) return value.replace(key, translations[key]);
    return value.replace(/已讀 (\d+) \/ (\d+) 篇/, 'Read $1 / $2 articles').replace(/找到 (\d+) 篇觀點/, '$1 articles found')
      .replace(/^路線 (\d+)$/, 'Path $1').replace(/(\d+) 篇串讀/, '$1 articles').replace(/約 (\d+) 分鐘/, 'About $1 minutes')
      .replace(/原刊 p\./, 'Original p.').replace(/(\d{4}) 決策智慧/, '$1 Decision Wisdom').replace(/ · 已讀/g, ' · Read');
  };
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!(node.parentElement?.closest('.article-body, .summary-block>p, .reading-guide p:not(.provenance), .byline'))) node.textContent = translate(node.textContent ?? '');
  }
  for (const element of host.querySelectorAll<HTMLElement>('[aria-label], [placeholder]')) {
    for (const attribute of ['aria-label', 'placeholder']) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, translate(value));
    }
  }
}

function initializeWorld() {
  if (worldStarting) return;
  worldStarting = true;
  const nextPaint = new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  void Promise.all([import('./world').catch(() => null), nextPaint]).then(([module]) => {
    if (!module) { explorerUI?.setFallback(true); return; }
    world = module.createWorld($('#world'), {
      reducedMotion: explorerState.reducedMotion, season: explorerState.season, language,
      onSelection: selection => { void enter(false); selectExplorer(selection, false); },
      onMinute: minute => { explorerState.minute = minute; explorerUI?.render(explorerState); },
      onEvents: events => explorerUI?.appendEvents(events),
      onFallback: (fallback, message) => explorerUI?.setFallback(fallback, message),
    });
    if (explorerData) world.setData(explorerData);
    syncExplorer();
    world.setNpcSpeech(npcSpeech);
    explorerUI?.setFallback(world.getFallback());
    if (entered) {
      world.setMotion(false);
      void world.enter().then(() => world?.setMotion(motion && !guidedReading && !reader.open));
    }
  }).catch(() => explorerUI?.setFallback(true));
}

async function loadEdition(year: number) {
  const item = catalog.years.find(y => y.year === year);
  if (!item) return;
  const request = ++editionRequest;
  const response = await fetch(asset(item.dataUrl));
  if (!response.ok) throw new Error('Edition load failed');
  const nextEdition: Edition & {journeys?: JourneyDefinition} = await response.json();
  if (nextEdition.schemaVersion !== 1 || nextEdition.year !== year || !Array.isArray(nextEdition.articles) || !nextEdition.articles.length) throw new Error('Invalid edition');
  const nextData = buildExplorerData(DATA, nextEdition);
  const nextJourneys = buildReadingJourneys(nextEdition, nextEdition.journeys);
  if (request !== editionRequest) return;
  world?.setData(nextData);
  edition = nextEdition;
  explorerData = nextData;
  hasCuratedJourneys = nextJourneys.personas.length > 0;
  chapter = null; query = ''; activePath = null;
  explorerState.chapter = null; explorerState.query = ''; explorerState.selection = null;
  explorerState.journalFilter = null; explorerState.detailOpen = false;
  $<HTMLInputElement>('#search').value = '';
  if (explorerUI) { explorerUI.setData(nextData); explorerUI.clearEvents(); }
  else {
    const callbacks: ExplorerUICallbacks = {
      onNpcSpeech: cue => { npcSpeech = cue; world?.setNpcSpeech(cue); },
      onLayout: () => world?.setState(explorerState),
      onSelection: selection => selectExplorer(selection),
      onReadArticle: id => { activePath = null; openArticle(id); },
      onCommand: commandExplorer,
      onThumbnail: id => world?.thumbnail(id) ?? null,
      onResolveWalker: id => world?.getWalkers().find(walker => walker.id === id),
    };
    explorerUI = createExplorerUI($('#explorer-ui'), nextData, callbacks);
    explorerUI?.setActive(entered && document.body.classList.contains('exploring'));
  }
  explorerUI?.setFallback(world?.getFallback() ?? true);
  $('.brand-meta b').textContent = String(year);
  $('.world-caption .small-line').textContent = `${year} · ${t('決策智慧', 'Decision Wisdom')}`;
  $('.world-caption h1').textContent = edition.title;
  document.title = `${t('決策群島', 'Decision Islands')} | ${year} ${t('決策智慧', 'Decision Wisdom')}`;
  $<HTMLSelectElement>('#year').value = String(year);
  $('#edition-stats').textContent = t(`${year} 年刊 ／ ${edition.articles.length} 篇觀點 ／ 人、模型與 AI`, `${year} edition / ${edition.articles.length} articles / People, models and AI`);
  world?.setSelection(null, false);
  syncExplorer(); renderList();
  const journeyModule = import('./reading-journey-ui');
  journeyReady = journeyModule.then(() => { journeyFailure = undefined; }, error => { journeyFailure = error; });
  const loadedJourney = await journeyModule.catch(() => null);
  if (!loadedJourney) return;
  const { createReadingJourneyUI } = loadedJourney;
  if (request !== editionRequest) return;
  if (!journeyUI) {
    journeyUI = createReadingJourneyUI($('#reading-journey'), {
      onFocusArticle: id => {
        const item = explorerData?.items.find(value => value.articleId === id);
        if (!item) return;
        guidedReading = true;
        explorerState.selection = { kind: 'item', itemId: item.id };
        explorerState.detailOpen = false; explorerState.listOpen = false;
        world?.setSelection(explorerState.selection);
        syncExplorer();
      },
      onReadArticle: id => { activePath = null; openArticle(id); },
      onBrowseArticles: () => {
        guidedReading = false; journeyUI?.setActive(false); setLibrary(true, true);
      },
      onFreeExplore: () => {
        guidedReading = false; journeyUI?.setActive(false);
        if (!hasCuratedJourneys) { setLibrary(true, true); return; }
        explorerState.listOpen = true; explorerState.detailOpen = false;
        syncExplorer();
      },
      onOpen: () => {
        guidedReading = true; setLibrary(false);
        explorerState.listOpen = false; explorerState.detailOpen = false;
        syncExplorer();
      },
    }, language);
  }
  journeyUI.setActive(false);
  journeyUI.setData(nextJourneys, edition.articles);
  journeyUI.setCompleted(state.completed);
  if (entered && !reader.open && !document.body.classList.contains('library-open')) {
    guidedReading = true; journeyUI.setActive(true); journeyUI.showPicker();
  }
  syncExplorer(); renderList();
}

async function boot() {
  try {
    syncExplorer();
    const response = await fetch(asset('data/catalog.json'), { priority: 'high' });
    if (!response.ok) throw new Error('目錄載入失敗');
    catalog = await response.json();
    if (catalog.schemaVersion!==1 || !Array.isArray(catalog.years)) throw new Error('目錄格式錯誤');
    $<HTMLSelectElement>('#year').innerHTML=catalog.years.map(y=>`<option value="${y.year}">${y.year} ${t('決策智慧', 'Decision Wisdom')}</option>`).join('')+`<option disabled>${t('歷年刊物 · 待匯入', 'Earlier editions · coming soon')}</option>`;
    $<HTMLSelectElement>('#year').onchange=e=>{void loadEdition(Number((e.target as HTMLSelectElement).value)).catch(() => { $<HTMLSelectElement>('#year').value = String(edition.year); toast(t('無法載入這個年度，請重新整理。', 'Could not load this edition. Please retry.')); });};
    const linkedYear = Number(location.hash.match(/^#read\/(\d{4})-/)?.[1]);
    await loadEdition(catalog.years.some(y=>y.year===linkedYear)?linkedYear:catalog.years.some(y=>y.year===2026)?2026:catalog.years[0].year);
    initializeWorld();
    if(location.hash.startsWith('#read/')){void enter(false, false);openArticle(location.hash.slice(6),false);}
    else if(state.last && edition.articles.some(a=>a.id===state.last)) {
      const resume=document.createElement('button');resume.className='resume-reading';resume.textContent=t('接著上次的觀點讀下去 ↗', 'Continue your last article ↗');resume.onclick=()=>{void enter(false, false);openArticle(state.last!);};$('#library-content').prepend(resume);
    }
  } catch(error) {
    $('#library-content').innerHTML='<div class="empty"><h3>暫時無法展開目錄。</h3><p>重新整理後再試，或先開啟完整閱讀目錄。</p><a href="./read/2026/index.html">開啟閱讀目錄</a><button id="retry" class="text-button">重新載入</button></div>';
    $('#retry').onclick=()=>location.reload(); localizeChrome($('#library')); setLibrary(true); console.error(error);
  }
}
localizeChrome(root);
void boot();
initializeBrowserCache();

import './style.css';
import { createWorld } from './world';
import { chapters, paths, findArticles, readState, saveState, escapeHtml as h } from './library';
import type { Article, Catalog, Chapter, Edition, ReadingPath } from './types';

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
let motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let world: ReturnType<typeof createWorld> | undefined;
let lastFocus: HTMLElement | null = null;

root.innerHTML = `
  <a class="skip-link" href="#library">跳到文章目錄</a>
  <div class="experience">
    <div id="world" aria-label="決策群島互動場景"></div>
    <header class="masthead">
      <a class="brand" href="#" aria-label="決策群島首頁"><span class="brand-mark">決策<br>群島<span class="brand-dot">.</span></span><span class="brand-meta">決策智慧<br><b>2026</b></span></a>
      <div class="top-actions"><button id="motion" class="icon-button" aria-pressed="${motion}">${motion ? '◌ 動態開啟' : '◌ 動態暫停'}</button><button id="overview" class="icon-button">⌖ 全景</button><button id="toggle-library" class="icon-button" aria-controls="library">☷ 目錄</button></div>
    </header>
    <section class="welcome" aria-labelledby="welcome-title">
      <p class="edition-label">電通行銷傳播集團 · 決策智慧十週年</p>
      <h1 id="welcome-title">十年的智慧，<br>在這裡相遇。</h1>
      <p class="welcome-copy">穿過十年的智慧，<br>尋找品牌與人的真實距離。</p>
      <div class="welcome-bottom"><button id="enter" class="primary">啟程，探索 2026 <span>↗</span></button><button id="skip-intro" class="text-button">直接開始閱讀</button></div>
      <p class="welcome-note">從一個問題出發，不必從第一頁開始。</p>
    </section>
    <section class="world-caption" hidden><span class="small-line">2026 · Agentic 時代</span><h1>重塑品牌與人的<br>真實距離。</h1><p>點一座島，讓觀點連起來。</p></section>
    <div class="world-bottom" hidden><div class="chapter-legend">${Object.entries(chapters).map(([id,c]) => `<button data-chapter="${id}"><i style="background:${c.color}"></i>${c.title}</button>`).join('')}</div><span class="map-hint">拖曳旋轉 · 點選探索</span></div>
    <aside id="library" class="library" aria-label="閱讀目錄" tabindex="-1">
      <div class="library-head"><span class="library-kicker">觀點在這裡相遇</span><button id="close-library" class="icon-button" aria-label="收起目錄">×</button><h2>把理解，連起來。</h2><p id="edition-stats">2026 決策智慧</p><label class="search-box"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="搜尋觀點、作者、關鍵字" aria-label="搜尋觀點、作者、關鍵字"><kbd>/</kbd></label><div class="tabs" role="tablist" aria-label="目錄類型"><button id="tab-articles" role="tab" aria-selected="true">全部觀點</button><button id="tab-paths" role="tab" aria-selected="false">策展路線</button><button id="tab-saved" role="tab" aria-selected="false">我的書籤</button></div></div>
      <div class="library-content" id="library-content" role="tabpanel" aria-label="觀點清單"></div>
      <footer class="library-footer"><label for="year">年度藏書</label><select id="year" aria-label="選擇年度"></select><button id="about" class="text-button">關於這座群島</button><div class="progress-label"><span id="progress-text">閱讀足跡</span><span>只保存在這台裝置</span></div><div class="progress-track"><span id="progress-fill"></span></div></footer>
    </aside>
  </div>
  <dialog id="reader" aria-labelledby="reader-title"><div class="reader-toolbar"><button id="reader-back" class="text-button">← 回到群島</button><div><button id="font-down" class="icon-button" aria-label="縮小字級">A−</button><button id="font-up" class="icon-button" aria-label="放大字級">A＋</button><button id="bookmark" class="icon-button" aria-pressed="false">收藏</button><button id="reader-close" class="icon-button" aria-label="關閉閱讀">×</button></div></div><div class="reading-progress"><span id="reading-progress-fill"></span></div><div id="reader-content"></div></dialog>
  <dialog id="about-dialog" class="about-dialog" aria-labelledby="about-title"><button id="about-close" class="icon-button" aria-label="關閉關於">×</button><p class="edition-label">決策智慧十週年</p><h2 id="about-title">先理解人，<br>再理解下一步。</h2><p>這是一座以《2026 決策智慧》為基礎的閱讀群島。島嶼對應原書章節，策展路線則把不同章節的觀點串起來，陪你從問題出發閱讀。</p><p>文章標題、作者與摘要來自提供的刊物及編輯目錄。閱讀導引與串聯理由屬本網站策展。全文由刊物轉錄，圖表與原版排版請對照各篇 PDF。</p><p>目前收錄 2026。其他年度將在取得 PDF 並完成校對後匯入。收藏與閱讀足跡只存在你的瀏覽器，不傳送到伺服器。</p><a href="https://dentsupro.com.tw/decision-wisdom-2026-event/" target="_blank" rel="noopener noreferrer">比賽規則與出處 ↗</a><p class="about-credit">內容著作權屬電通行銷傳播集團及原作者。互動視覺為本作品原創。</p></dialog>
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
  $('#library').inert = (!entered && !open) || (mobileLayout.matches && !open);
  $('#toggle-library').setAttribute('aria-expanded',String(open));
  if (focus) (open ? $('#library') : $('#toggle-library')).focus();
}
mobileLayout.addEventListener('change',()=>setLibrary(document.body.classList.contains('library-open')));
setLibrary(false);
const storage = () => { if (!saveState(state)) toast('瀏覽器無法儲存，本次仍可閱讀。'); };
function toast(message: string) { $('#toast').textContent = message; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 3000); }

function renderList() {
  if (!edition) return;
  document.querySelectorAll('[role="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.id === `tab-${tab}`)));
  const panel = $('#library-content');
  if (tab === 'paths' && !query) {
    const availablePaths = edition.year === 2026 ? paths : [];
    panel.innerHTML = `<p class="panel-intro">${availablePaths.length ? '不必讀完全部，先找到你在意的問題。' : '這一年的策展路線正在整理，先從全部觀點開始。'}</p>${availablePaths.map((p,i) => `<button class="path-card" data-path="${p.id}"><span class="path-no">路線 ${String(i+1).padStart(2,'0')}</span><h3>${p.title}</h3><p>${p.question}</p><span class="path-bottom">${p.orders.length} 篇串讀 <span>↗</span></span></button>`).join('')}`;
  } else {
    let filtered = findArticles(edition.articles, query, chapter);
    if (tab === 'saved') filtered = filtered.filter(a => state.bookmarks.includes(a.id));
    panel.innerHTML = `${chapter ? `<div class="active-filter"><span>${chapters[chapter].title}</span><button data-clear="true" aria-label="清除章節篩選">×</button></div>` : ''}${query ? `<p class="result-count" role="status">找到 ${filtered.length} 篇觀點</p>` : ''}${!filtered.length ? `<div class="empty"><h3>${tab === 'saved' ? '把想讀的，留在這裡。' : '還沒有找到這個觀點。'}</h3><p>${tab === 'saved' ? '閱讀時點選「收藏」，下次就能接著探索。' : '試試「信任」「注意力」或作者姓名。'}</p><button class="text-button" data-reset="true">回到全部觀點</button></div>` : filtered.map(a => `<button class="article-row ${state.completed.includes(a.id) ? 'is-complete' : ''}" data-article="${a.id}"><span class="article-no">${String(a.order).padStart(2,'0')}</span><span class="article-row-copy"><span class="article-chapter" style="color:${chapters[a.chapter].color}">${chapters[a.chapter].english}${state.completed.includes(a.id) ? ' · 已讀' : ''}</span><h3>${h(a.title)}</h3><span class="article-author">${h(a.authors)}</span></span><span class="row-arrow" aria-hidden="true">↗</span></button>`).join('')}`;
  }
  panel.querySelectorAll<HTMLElement>('[data-article]').forEach(b => b.onclick = () => { activePath = null; openArticle(b.dataset.article!); });
  panel.querySelectorAll<HTMLElement>('[data-path]').forEach(b => b.onclick = () => { activePath = paths.find(p => p.id === b.dataset.path)!; openArticle(edition.articles.find(a => a.order === activePath!.orders[0])!.id); });
  panel.querySelector<HTMLElement>('[data-clear]')?.addEventListener('click', () => selectChapter(null));
  panel.querySelector<HTMLElement>('[data-reset]')?.addEventListener('click', () => { query=''; chapter=null; tab='articles'; $<HTMLInputElement>('#search').value=''; world?.setChapter(null); renderList(); });
  const completed = edition.articles.filter(a => state.completed.includes(a.id)).length;
  $('#progress-text').textContent = `已讀 ${completed} / ${edition.articles.length} 篇`;
  $('#progress-fill').style.width = `${completed / edition.articles.length * 100}%`;
}

function selectChapter(value: Chapter | null) {
  chapter = value; tab = 'articles'; query = ''; $<HTMLInputElement>('#search').value = '';
  world?.setChapter(value); renderList();
  document.querySelectorAll<HTMLElement>('[data-chapter]').forEach(b => b.classList.toggle('selected',b.dataset.chapter === value));
  setLibrary(true);
}

async function enter(animate = true) {
  if (entered) return;
  entered = true;
  document.body.classList.add('entering');
  if (!animate) world?.setMotion(false);
  await world?.enter();
  if (!animate) world?.setMotion(motion);
  document.body.classList.add('exploring');
  document.body.classList.remove('entering');
  setLibrary(document.body.classList.contains('library-open'));
  $('.welcome').hidden = true;
  $('.world-caption').hidden = false;
  $('.world-bottom').hidden = false;
}

function openArticle(id: string, updateHash = true) {
  const a = edition.articles.find(item => item.id === id);
  if (!a) { toast('這篇文章尚未收錄。'); return; }
  state.last = a.id; storage();
  const color = chapters[a.chapter].color;
  const pathIndex = activePath?.orders.indexOf(a.order) ?? -1;
  const nextOrder = activePath && pathIndex >= 0 ? activePath.orders[pathIndex + 1] : null;
  const next = activePath ? (nextOrder ? edition.articles.find(x=>x.order===nextOrder) : undefined) : edition.articles.find(x=>x.order===a.order+1);
  const related = edition.articles.filter(x => x.id!==a.id && x.chapter===a.chapter).slice(0,2);
  $('#reader-content').innerHTML = `<article class="reading-article" style="--chapter-color:${color};--reading-size:${state.fontSize}px">
    ${activePath ? `<div class="path-context">${h(activePath.title)}<span>${pathIndex + 1} / ${activePath.orders.length} 篇</span></div>` : ''}
    <div class="article-eyebrow">${a.year} 決策智慧 <span>／</span> ${chapters[a.chapter].english} <span>／</span> 原刊 p.${a.printedStart}–${a.printedEnd}</div>
    <h1 id="reader-title">${h(a.title)}</h1><p class="byline">${h(a.authors)}</p>
    <div class="reader-meta"><span>約 ${a.minutes} 分鐘</span><a href="${asset(a.sourcePdf)}" target="_blank" rel="noopener noreferrer">對照原刊 PDF ↗</a><a href="${asset(a.htmlUrl)}">獨立閱讀頁 ↗</a></div>
    <section class="summary-block" aria-label="編輯摘要"><span>先讀這個觀點</span><p>${h(a.summary.replace(/^【決策智慧 2026】/,''))}</p></section>
    ${a.highlights.length ? `<details class="reading-guide"><summary>這篇值得帶走什麼？</summary><div><p class="provenance">以下導讀來自提供的編輯目錄。</p>${a.highlights.map(p=>`<p>${h(p)}</p>`).join('')}</div></details>` : ''}
    <p class="transcription-note">刊物文字整理。圖表與原始版面請對照原刊 PDF。${a.unpublishedDifferenceCount ? ' 與刊物版本無法核對的排版文字未收錄，以原刊 PDF 為完整依據。' : ''}</p>
    <div class="article-body">${a.paragraphs.map(p=>`<p>${h(p)}</p>`).join('')}</div>
    ${a.supplementaryParagraphs?.length ? `<details class="reading-guide"><summary>圖表、註解與補充文字</summary><p class="provenance">以下文字見於原刊的多個位置，集中保留供查閱；圖表關係請對照 PDF。</p>${a.supplementaryParagraphs.map(p=>`<p>${h(p)}</p>`).join('')}</details>` : ''}
    <footer class="article-end"><p>讀到這裡，你帶走了什麼？</p><button id="complete" class="primary">${state.completed.includes(a.id) ? '已完成閱讀 ✓' : '留下閱讀足跡'}</button>
    ${next ? `<div class="next-reading"><span>${activePath ? '沿著這條路線' : '繼續探索'}</span><h2>${h(next.title)}</h2>${activePath && pathIndex >= 0 && activePath.connections[pathIndex] ? `<p>${h(activePath.connections[pathIndex])}</p>` : ''}<button id="next-article" class="text-button">閱讀下一篇 ↗</button></div>` : '<p>你已走完這條閱讀路線。</p>'}
    <div class="related"><h2>同一座島，其他觀點</h2>${related.map(r=>`<button class="text-button" data-related="${r.id}">${h(r.title)} ↗</button>`).join('')}</div></footer></article>`;
  const bookmarked = () => { const value = state.bookmarks.includes(a.id); $('#bookmark').textContent = value ? '已收藏 ★' : '收藏 ☆'; $('#bookmark').setAttribute('aria-pressed',String(value)); };
  bookmarked();
  $('#bookmark').onclick = () => { state.bookmarks = state.bookmarks.includes(a.id) ? state.bookmarks.filter(x=>x!==a.id) : [...state.bookmarks,a.id]; storage(); bookmarked(); renderList(); };
  $('#complete').onclick = () => { if (!state.completed.includes(a.id)) state.completed.push(a.id); storage(); $('#complete').textContent='已完成閱讀 ✓'; renderList(); toast('已留下這篇的閱讀足跡。'); };
  $('#next-article')?.addEventListener('click',()=>openArticle(next!.id));
  document.querySelectorAll<HTMLElement>('[data-related]').forEach(b=>b.onclick=()=>{activePath=null;openArticle(b.dataset.related!);});
  if (!reader.open) { lastFocus = document.activeElement as HTMLElement; reader.showModal(); }
  reader.scrollTop = 0; $('#reader-title').setAttribute('tabindex','-1'); $('#reader-title').focus({preventScroll:true});
  $('#reading-progress-fill').style.width='0%';
  if (updateHash) history.pushState({article:a.id},'',`#read/${a.id}`);
}

function closeReader() {
  reader.close();
  if (location.hash.startsWith('#read/')) history.replaceState(null,'',location.pathname+location.search);
  const original = lastFocus?.isConnected && lastFocus.tabIndex>=0 && !reader.contains(lastFocus) ? lastFocus : state.last ? document.querySelector<HTMLElement>(`[data-article="${CSS.escape(state.last)}"]`) : null;
  if (original && !original.closest('[inert]')) original.focus();
  else if (mobileLayout.matches && !document.body.classList.contains('library-open')) $('#toggle-library').focus();
  else $('#library').focus();
}
$('#reader-close').onclick = closeReader; $('#reader-back').onclick = closeReader;
reader.addEventListener('cancel',e=>{e.preventDefault();closeReader();});
reader.addEventListener('scroll',()=>{const total=reader.scrollHeight-reader.clientHeight; $('#reading-progress-fill').style.width=`${total>0?reader.scrollTop/total*100:100}%`;});
for (const [id, delta] of [['font-down',-2],['font-up',2]] as const) $(`#${id}`).onclick = () => {state.fontSize=Math.max(18,Math.min(24,state.fontSize+delta)); $('.reading-article').style.setProperty('--reading-size',`${state.fontSize}px`);storage();};
$('#enter').onclick = () => void enter();
$('.skip-link').onclick = e => {e.preventDefault();void enter(false);setLibrary(true,true);};
$('#skip-intro').onclick = () => { void enter(false); setLibrary(true,true); };
$('#motion').onclick = () => {motion=!motion;world?.setMotion(motion);$('#motion').textContent=motion?'◌ 動態開啟':'◌ 動態暫停';$('#motion').setAttribute('aria-pressed',String(motion));};
$('#overview').onclick = () => {void enter(false);selectChapter(null);world?.reset();};
$('#toggle-library').onclick = () => {void enter(false);setLibrary(!document.body.classList.contains('library-open'),true);};
$('#close-library').onclick = () => setLibrary(false,true);
document.querySelectorAll<HTMLElement>('[data-chapter]').forEach(b=>b.onclick=()=>{void enter(false);selectChapter(b.dataset.chapter as Chapter);});
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
    } catch { toast('無法開啟這篇文章，請從年度目錄重試。'); }
  } else if(reader.open) closeReader();
}

async function loadEdition(year: number) {
  const item = catalog.years.find(y=>y.year===year);
  if (!item) return;
  const response = await fetch(asset(item.dataUrl));
  if (!response.ok) throw new Error('年度內容載入失敗');
  edition = await response.json();
  if (edition.schemaVersion !== 1 || !Array.isArray(edition.articles) || !edition.articles.length) throw new Error('年度資料格式錯誤');
  chapter=null; query=''; activePath=null;
  $<HTMLInputElement>('#search').value='';
  $('.brand-meta b').textContent=String(year);
  $('.world-caption .small-line').textContent=`${year} · 決策智慧`;
  $('.world-caption h1').textContent=year===2026?'重塑品牌與人的\n真實距離。':edition.title;
  document.title=`決策群島｜${year} 決策智慧`;
  $<HTMLSelectElement>('#year').value=String(year);
  world?.setChapter(null);
  $('#edition-stats').textContent=`${year} 年刊 ／ ${edition.articles.length} 篇觀點 ／ 人、模型與 AI`;
  world?.setArticles(edition.articles);renderList();
}
async function boot() {
  try {
    world=createWorld($('#world'),{onChapter:c=>{void enter(false);selectChapter(c as Chapter);},onArticle:id=>{activePath=null;openArticle(id);},reducedMotion:!motion});
    const response = await fetch(asset('data/catalog.json'));
    if (!response.ok) throw new Error('目錄載入失敗');
    catalog = await response.json();
    if (catalog.schemaVersion!==1 || !Array.isArray(catalog.years)) throw new Error('目錄格式錯誤');
    $<HTMLSelectElement>('#year').innerHTML=catalog.years.map(y=>`<option value="${y.year}">${y.year} 決策智慧</option>`).join('')+'<option disabled>歷年刊物 · 待匯入</option>';
    $<HTMLSelectElement>('#year').onchange=e=>{void loadEdition(Number((e.target as HTMLSelectElement).value)).catch(()=>toast('無法載入這個年度，請重新整理。'));};
    const linkedYear = Number(location.hash.match(/^#read\/(\d{4})-/)?.[1]);
    await loadEdition(catalog.years.some(y=>y.year===linkedYear)?linkedYear:catalog.years.some(y=>y.year===2026)?2026:catalog.years[0].year);
    if(location.hash.startsWith('#read/')){void enter(false);openArticle(location.hash.slice(6),false);}
    else if(state.last && edition.articles.some(a=>a.id===state.last)) {
      const resume=document.createElement('button');resume.className='resume-reading';resume.textContent='接著上次的觀點讀下去 ↗';resume.onclick=()=>{void enter(false);openArticle(state.last!);};$('#library-content').prepend(resume);
    }
  } catch(error) {
    $('#library-content').innerHTML='<div class="empty"><h3>暫時無法展開目錄。</h3><p>重新整理後再試，或先開啟完整閱讀目錄。</p><a href="./read/2026/index.html">開啟閱讀目錄</a><button id="retry" class="text-button">重新載入</button></div>';
    $('#retry').onclick=()=>location.reload();console.error(error);
  }
}
void boot();

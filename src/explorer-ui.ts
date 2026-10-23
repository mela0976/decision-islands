import './explorer.css';
import { HOLIDAYS } from './season';
import type { Article, Chapter } from './types';
import type {
  ExplorerCommand,
  ExplorerData,
  ExplorerEvent,
  ExplorerFlow,
  ExplorerIsland,
  ExplorerItem,
  ExplorerSelection,
  ExplorerState,
  ExplorerUI,
  ExplorerUICallbacks,
  FlowEvidence,
  ModelKind,
  WalkerSnapshot,
} from './explorer-types';

type CopyKey = keyof typeof COPY;
type ChapterFilter = Chapter | null;

const COPY = {
  region: { zh: '決策群島探索介面', en: 'Decision Islands explorer interface' },
  overview: { zh: '全景', en: 'Overview' },
  themes: { zh: '探索清單', en: 'Explore list' },
  help: { zh: '操作說明', en: 'Help' },
  close: { zh: '關閉', en: 'Close' },
  closeDetail: { zh: '關閉詳細卡', en: 'Close detail card' },
  closeList: { zh: '關閉探索清單', en: 'Close explorer list' },
  detail: { zh: '探索詳細資訊', en: 'Explorer details' },
  list: { zh: '主題與連線清單', en: 'Themes and connections' },
  journal: { zh: '閱讀日誌', en: 'Reading journal' },
  search: { zh: '搜尋主題、原文、作者或連線', en: 'Search themes, articles, authors, or connections' },
  searchPlaceholder: { zh: '搜尋主題、文章或作者', en: 'Search themes, articles, or authors' },
  themeTab: { zh: '閱讀主題', en: 'Reading themes' },
  connectionTab: { zh: '閱讀連線', en: 'Reading connections' },
  chapter: { zh: '原刊章節篩選', en: 'Original chapter filter' },
  allChapters: { zh: '全部章節', en: 'All chapters' },
  intro: { zh: '前言', en: 'Introduction' },
  people: { zh: '人', en: 'People' },
  model: { zh: '模型', en: 'Models' },
  ai: { zh: 'AI', en: 'AI' },
  articles: { zh: '篇文章', en: 'articles' },
  themesCount: { zh: '個閱讀主題', en: 'reading themes' },
  placements: { zh: '個閱讀落點', en: 'placements' },
  curatorGuide: { zh: '網站策展導讀', en: 'Curator guide' },
  originalChinese: { zh: '原文為中文', en: 'Original article in Chinese' },
  readArticle: { zh: '閱讀全文', en: 'Read article' },
  reopenArticle: { zh: '再次開啟原文', en: 'Open article again' },
  manageBookmark: { zh: '開啟原文管理收藏', en: 'Open article to manage bookmark' },
  sourcePdf: { zh: '原始 PDF', en: 'Source PDF' },
  bookmarked: { zh: '已收藏', en: 'Bookmarked' },
  notBookmarked: { zh: '尚未收藏', en: 'Not bookmarked' },
  completed: { zh: '已讀', en: 'Completed' },
  unread: { zh: '未讀', en: 'Unread' },
  sourcePages: { zh: '來源 PDF 頁數', en: 'Source PDF pages' },
  estimatedMinutes: { zh: '估計閱讀分鐘', en: 'Estimated reading minutes' },
  publicationYear: { zh: '刊物年度', en: 'Publication year' },
  printedPages: { zh: '原刊印刷頁', en: 'Printed pages' },
  chapterLabel: { zh: '原刊章節', en: 'Original chapter' },
  noSelection: { zh: '選擇一座島、文章落點、閱讀連線或閱讀者，查看相關資料。', en: 'Choose a theme, article placement, reading connection, or walker to view its details.' },
  unavailableSelection: { zh: '這項選取已不在目前年度資料中。', en: 'This selection is unavailable in the current edition.' },
  emptyThemes: { zh: '目前沒有符合條件的主題或文章。', en: 'No themes or articles match these filters.' },
  emptyFlows: { zh: '目前沒有符合條件的閱讀連線。', en: 'No reading connections match these filters.' },
  noArticles: { zh: '此主題目前沒有可用文章。', en: 'This theme has no available articles.' },
  noConnections: { zh: '此主題目前沒有策展連線。', en: 'This theme has no curated connections.' },
  relatedArticles: { zh: '相關原文', en: 'Related articles' },
  relatedConnections: { zh: '相關閱讀連線', en: 'Related reading connections' },
  from: { zh: '起點', en: 'From' },
  to: { zh: '目的地', en: 'To' },
  destination: { zh: '目前目的地', en: 'Current destination' },
  evidence: { zh: '閱讀依據', en: 'Reading basis' },
  cargo: { zh: '搬運內容', en: 'Carried item' },
  readerRole: { zh: '閱讀者角色', en: 'Reader role' },
  sourceSequence: { zh: '來源串讀', en: 'Source sequence' },
  curatedTheme: { zh: '策展主題', en: 'Curated theme' },
  openQuestion: { zh: '待探索', en: 'Open question' },
  editorialBoundary: { zh: '所有連線都是網站策展閱讀，不代表官方認證、機構合作或因果證據。', en: 'All connections are curated reading suggestions. They do not indicate official endorsement, institutional partnership, or causal evidence.' },
  walker: { zh: '閱讀者', en: 'Walker' },
  walkerUnavailable: { zh: '這位閱讀者目前沒有可用的模擬快照。', en: 'This walker has no available simulation snapshot.' },
  overviewHint: { zh: '場景時間', en: 'Scene time' },
  time: { zh: '時間', en: 'Time' },
  dawn: { zh: '清晨', en: 'Morning' },
  day: { zh: '白天', en: 'Day' },
  dusk: { zh: '黃昏', en: 'Dusk' },
  night: { zh: '夜讀', en: 'Night' },
  names: { zh: '名牌', en: 'Name badges' },
  walkers: { zh: '搬運', en: 'Walkers' },
  flows: { zh: '連線', en: 'Connections' },
  paused: { zh: '暫停', en: 'Pause' },
  resume: { zh: '繼續', en: 'Resume' },
  birdseye: { zh: '鳥瞰', en: 'Bird’s-eye view' },
  journalToggle: { zh: '日誌', en: 'Journal' },
  helpTitle: { zh: '三步開始探索', en: 'Three steps to explore' },
  helpStepOne: { zh: '選一座主題島，再挑一個文章落點。', en: 'Choose a theme island, then select an article placement.' },
  helpStepTwo: { zh: '閱讀落點顯示原刊資料。按「閱讀全文」可開啟原文。', en: 'Article placements show publication details. Choose “Read article” to open the original.' },
  helpStepThree: { zh: '跟隨閱讀連線探索文章間的策展讀序。', en: 'Follow reading connections to explore the curated reading order.' },
  helpNote: { zh: '策展導讀由本網站提供，原刊標題、作者與內容保留原文。', en: 'Curator guides come from this site. Original titles, authors, and article text remain in their source language.' },
  fallbackTitle: { zh: '3D 場景目前無法使用', en: 'The 3D scene is unavailable' },
  fallbackBody: { zh: '以下提供相同資料的可操作主題地圖。閱讀者動畫與模擬日誌已停用。', en: 'Use this interactive theme map with the same data. Walker animation and the simulated journal are unavailable.' },
  fallbackUnavailable: { zh: '場景模擬不可用', en: 'Simulation unavailable' },
  simulationLog: { zh: '場景模擬日誌', en: 'Scene simulation journal' },
  simulationNote: { zh: '以下事件由場景模擬產生，不是其他使用者或實際合作紀錄。', en: 'These events come from the scene simulation. They do not describe other users or real partnerships.' },
  live: { zh: 'LIVE', en: 'LIVE' },
  pausedStatus: { zh: '已暫停', en: 'Paused' },
  filterConnection: { zh: '依連線篩選日誌', en: 'Filter journal by connection' },
  allConnections: { zh: '全部連線', en: 'All connections' },
  noEvents: { zh: '尚無場景模擬事件。', en: 'No scene simulation events yet.' },
  depart: { zh: '啟程', en: 'Depart' },
  arrive: { zh: '抵達', en: 'Arrive' },
  handoff: { zh: '交接', en: 'Handoff' },
  eventAt: { zh: '在', en: 'at' },
  readSource: { zh: '開啟原文', en: 'Open article' },
  available: { zh: '可探索', en: 'Available' },
  noWalkerDestination: { zh: '尚未抵達', en: 'In transit' },
  modelPreview: { zh: '模型預覽不可用', en: 'Model preview unavailable' },
  articleCountLabel: { zh: '此年度文章數', en: 'Articles in this edition' },
} as const satisfies Record<string, { zh: string; en: string }>;

const CHAPTER_KEYS: Record<Chapter, CopyKey> = {
  intro: 'intro',
  people: 'people',
  model: 'model',
  ai: 'ai',
};

const CARGO = {
  book: { zh: '書本', en: 'Book' },
  idea: { zh: '想法', en: 'Idea' },
  memory: { zh: '記憶', en: 'Memory' },
  data: { zh: '資料', en: 'Data' },
} as const;

const EVIDENCE_KEYS: Record<FlowEvidence['kind'], CopyKey> = {
  source: 'sourceSequence',
  thematic: 'curatedTheme',
  pending: 'openQuestion',
};

const MODEL_SHAPES: Record<ModelKind, string> = {
  book: 'book', pavilion: 'pavilion', classroom: 'classroom', observatory: 'observatory',
  studio: 'studio', bridge: 'bridge', garden: 'garden', stage: 'stage', clock: 'clock',
  globe: 'globe', workshop: 'workshop', lighthouse: 'lighthouse',
};

const ONBOARDING_KEY = 'decision-islands-explorer-help-v1';
const EVENT_LIMIT = 100;
const PRESETS = [
  { minute: 360, label: 'dawn' as const, icon: '◒' },
  { minute: 720, label: 'day' as const, icon: '☼' },
  { minute: 1080, label: 'dusk' as const, icon: '◓' },
  { minute: 1260, label: 'night' as const, icon: '☾' },
];

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function button(text: string, className: string, label: string, onClick: () => void): HTMLButtonElement {
  const value = node('button', className, text);
  value.type = 'button';
  value.setAttribute('aria-label', label);
  value.addEventListener('click', onClick);
  return value;
}

function setText(element: HTMLElement, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}

function selectionKey(selection: ExplorerSelection): string {
  if (!selection) return 'none';
  switch (selection.kind) {
    case 'island': return `island:${selection.islandId}`;
    case 'item': return `item:${selection.itemId}`;
    case 'flow': return `flow:${selection.flowId}`;
    case 'walker': return `walker:${selection.walkerId}`;
  }
}

function minuteLabel(minute: number): string {
  const normalized = ((Math.floor(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function focusableTarget(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement;
}

function readHelpSeen(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'seen';
  } catch {
    return false;
  }
}

function markHelpSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'seen');
  } catch {
    return;
  }
}

export function createExplorerUI(host: HTMLElement, initialData: ExplorerData, callbacks: ExplorerUICallbacks): ExplorerUI {
  let data = initialData;
  let state: Readonly<ExplorerState> | null = null;
  let active = true;
  let fallback = false;
  let fallbackMessage = '';
  let dataVersion = 0;
  let listKey = '';
  let detailKey = '';
  let journalKey = '';
  let fallbackKey = '';
  let chromeLanguage: 'zh' | 'en' | null = null;
  let appliedSeason: ExplorerState['season'] | null = null;
  let helpOpen = !readHelpSeen();
  let mobileTimeOpen = false;
  let events: ExplorerEvent[] = [];
  let eventRevision = 0;
  const eventIds = new Set<number>();
  const abort = new AbortController();
  let listTrigger: HTMLElement | null = null;
  let detailTrigger: HTMLElement | null = null;
  let listWasOpen = false;
  let detailWasOpen = false;

  const root = node('div', 'explorer-ui');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', COPY.region.zh);
  root.dataset.season = 'christmas';
  root.inert = false;

  const toolbar = node('nav', 'explorer-toolbar');
  toolbar.setAttribute('aria-label', '決策群島探索工具列');
  const overviewButton = button('⌖', 'explorer-tool-button', COPY.overview.zh, () => callbacks.onCommand({ type: 'overview' }));
  const listButton = button('☷', 'explorer-tool-button', COPY.themes.zh, () => {
    if (!state) return;
    listTrigger = toolbar;
    callbacks.onCommand({ type: 'panel', panel: 'list', open: !state.listOpen });
  });
  const helpButton = button('?', 'explorer-tool-button explorer-help-trigger', COPY.help.zh, () => setHelpOpen(!helpOpen));
  toolbar.append(overviewButton, listButton, helpButton);

  const detailPanel = node('aside', 'explorer-panel explorer-detail');
  detailPanel.setAttribute('aria-label', COPY.detail.zh);
  detailPanel.setAttribute('aria-labelledby', 'explorer-detail-title');
  detailPanel.hidden = true;
  const detailHandle = node('button', 'explorer-sheet-handle');
  detailHandle.type = 'button';
  detailHandle.setAttribute('aria-label', COPY.detail.zh);
  detailHandle.setAttribute('aria-expanded', 'false');
  detailHandle.append(node('span', 'explorer-sheet-grip'));
  const detailHeader = node('div', 'explorer-panel-header');
  const detailKicker = node('p', 'explorer-eyebrow');
  const detailTitle = node('h2', '', COPY.noSelection.zh);
  detailTitle.id = 'explorer-detail-title';
  const detailClose = button('×', 'explorer-close', COPY.closeDetail.zh, () => closeWithFocus('detail'));
  detailHeader.append(node('div', 'explorer-header-copy'), detailClose);
  detailHeader.firstElementChild?.append(detailKicker, detailTitle);
  const detailContent = node('div', 'explorer-panel-content');
  detailPanel.append(detailHandle, detailHeader, detailContent);

  const listPanel = node('aside', 'explorer-panel explorer-list');
  listPanel.setAttribute('aria-label', COPY.list.zh);
  listPanel.setAttribute('aria-labelledby', 'explorer-list-title');
  listPanel.hidden = true;
  const listHandle = node('button', 'explorer-sheet-handle');
  listHandle.type = 'button';
  listHandle.setAttribute('aria-label', COPY.list.zh);
  listHandle.setAttribute('aria-expanded', 'false');
  listHandle.append(node('span', 'explorer-sheet-grip'));
  const listHead = node('div', 'explorer-list-head');
  const listTop = node('div', 'explorer-list-title-row');
  const listTitle = node('h2', '', COPY.themes.zh);
  listTitle.id = 'explorer-list-title';
  const listClose = button('×', 'explorer-close', COPY.closeList.zh, () => closeWithFocus('list'));
  listTop.append(listTitle, listClose);
  const listCount = node('p', 'explorer-list-count');
  const searchLabel = node('label', 'explorer-search');
  const searchIcon = node('span', 'explorer-search-icon', '⌕');
  searchIcon.setAttribute('aria-hidden', 'true');
  const searchInput = node('input', '');
  searchInput.type = 'search';
  searchInput.autocomplete = 'off';
  searchLabel.append(searchIcon, searchInput);
  const chapterLabel = node('label', 'explorer-chapter-filter');
  const chapterSelect = node('select', '');
  const chapterOptions: Array<{ value: ChapterFilter; key: CopyKey }> = [
    { value: null, key: 'allChapters' }, { value: 'intro', key: 'intro' },
    { value: 'people', key: 'people' }, { value: 'model', key: 'model' }, { value: 'ai', key: 'ai' },
  ];
  for (const option of chapterOptions) {
    const element = node('option', '', COPY[option.key].zh);
    element.value = option.value ?? '';
    chapterSelect.append(element);
  }
  chapterLabel.append(node('span', '', COPY.chapter.zh), chapterSelect);
  const tabList = node('div', 'explorer-tabs');
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-label', '閱讀探索分類');
  const themesTab = button(COPY.themeTab.zh, 'explorer-tab', COPY.themeTab.zh, () => callbacks.onCommand({ type: 'tab', tab: 'themes' }));
  const connectionsTab = button(COPY.connectionTab.zh, 'explorer-tab', COPY.connectionTab.zh, () => callbacks.onCommand({ type: 'tab', tab: 'connections' }));
  themesTab.id = 'explorer-tab-themes';
  connectionsTab.id = 'explorer-tab-connections';
  themesTab.setAttribute('role', 'tab');
  connectionsTab.setAttribute('role', 'tab');
  const listContent = node('div', 'explorer-list-content');
  listContent.id = 'explorer-list-content';
  listContent.setAttribute('role', 'tabpanel');
  listContent.setAttribute('tabindex', '0');
  themesTab.setAttribute('aria-controls', listContent.id);
  connectionsTab.setAttribute('aria-controls', listContent.id);
  listPanel.append(listHandle, listHead, listContent);
  listHead.append(listTop, listCount, searchLabel, chapterLabel, tabList);
  tabList.append(themesTab, connectionsTab);

  const hud = node('nav', 'explorer-hud');
  hud.setAttribute('aria-label', '探索控制');
  const mobileTimeButton = button('◷', 'explorer-time-mobile', COPY.time.zh, () => {
    mobileTimeOpen = !mobileTimeOpen;
    hud.dataset.timeOpen = String(mobileTimeOpen);
    mobileTimeButton.setAttribute('aria-expanded', String(mobileTimeOpen));
  });
  mobileTimeButton.append(node('span', 'explorer-hud-label', COPY.time.zh));
  const timeControls = node('div', 'explorer-time-controls');
  const timeButtons = PRESETS.map(preset => {
    const control = button(preset.icon, 'explorer-hud-button explorer-time-button', `${minuteLabel(preset.minute)} ${COPY[preset.label].zh}`, () => callbacks.onCommand({ type: 'minute', minute: preset.minute }));
    control.append(node('span', 'explorer-hud-label', COPY[preset.label].zh));
    control.dataset.minute = String(preset.minute);
    return control;
  });
  timeControls.append(...timeButtons);
  const toggleControls = node('div', 'explorer-toggle-controls');
  const toggleButtons = new Map<string, HTMLButtonElement>();
  const addToggle = (key: 'names' | 'walkers' | 'flows' | 'paused' | 'birdseye' | 'journal', icon: string, labelKey: CopyKey, command: ExplorerCommand['type']) => {
    const control = button(icon, 'explorer-hud-button', COPY[labelKey].zh, () => {
      if (!state) return;
      if (key === 'paused') callbacks.onCommand({ type: 'paused', paused: !state.paused });
      else if (key === 'birdseye') callbacks.onCommand({ type: 'birdseye', enabled: !state.birdseye });
      else if (key === 'journal') callbacks.onCommand({ type: 'toggle', key: 'journal', value: !state.journal });
      else callbacks.onCommand({ type: 'toggle', key, value: !state[key] });
    });
    control.dataset.toggle = key;
    control.dataset.command = command;
    control.append(node('span', 'explorer-hud-label', COPY[labelKey].zh));
    toggleControls.append(control);
    toggleButtons.set(key, control);
  };
  addToggle('names', '♧', 'names', 'toggle');
  addToggle('walkers', '♟', 'walkers', 'toggle');
  addToggle('flows', '⌁', 'flows', 'toggle');
  addToggle('paused', 'Ⅱ', 'paused', 'paused');
  addToggle('birdseye', '⌖', 'birdseye', 'birdseye');
  addToggle('journal', '▤', 'journalToggle', 'toggle');
  const hudTime = node('output', 'explorer-clock');
  hudTime.setAttribute('aria-label', COPY.overviewHint.zh);
  hud.append(mobileTimeButton, timeControls, toggleControls, hudTime);

  const journalPanel = node('aside', 'explorer-panel explorer-journal');
  journalPanel.setAttribute('aria-labelledby', 'explorer-journal-title');
  const journalHead = node('div', 'explorer-journal-head');
  const journalTitleGroup = node('div', '');
  const journalTitle = node('h2', '', COPY.journal.zh);
  journalTitle.id = 'explorer-journal-title';
  const journalSub = node('p', 'explorer-journal-note', COPY.simulationNote.zh);
  journalTitleGroup.append(journalTitle, journalSub);
  const live = node('span', 'explorer-live');
  live.append(node('i', 'explorer-live-dot'), node('span', '', COPY.live.zh));
  journalHead.append(journalTitleGroup, live);
  const journalFilter = node('label', 'explorer-journal-filter');
  const journalFilterLabel = node('span', '', COPY.filterConnection.zh);
  const journalSelect = node('select', '');
  journalFilter.append(journalFilterLabel, journalSelect);
  const journalContent = node('ol', 'explorer-journal-list');
  journalContent.setAttribute('aria-live', 'polite');
  journalContent.setAttribute('aria-label', COPY.journal.zh);
  journalPanel.append(journalHead, journalFilter, journalContent);

  const helpPanel = node('aside', 'explorer-help');
  helpPanel.setAttribute('role', 'note');
  helpPanel.setAttribute('aria-labelledby', 'explorer-help-title');
  const helpClose = button('×', 'explorer-close', COPY.close.zh, () => setHelpOpen(false));
  const helpTitle = node('h2', '', COPY.helpTitle.zh);
  helpTitle.id = 'explorer-help-title';
  const helpSteps = node('ol', 'explorer-help-steps');
  const helpNote = node('p', 'explorer-help-note', COPY.helpNote.zh);
  helpPanel.append(helpClose, helpTitle, helpSteps, helpNote);

  const fallbackPanel = node('section', 'explorer-fallback');
  fallbackPanel.setAttribute('aria-labelledby', 'explorer-fallback-title');
  const fallbackHeader = node('div', 'explorer-fallback-header');
  const fallbackTitle = node('h2', '', COPY.fallbackTitle.zh);
  fallbackTitle.id = 'explorer-fallback-title';
  const fallbackText = node('p', 'explorer-fallback-message');
  const fallbackMap = node('div', 'explorer-fallback-map');
  fallbackHeader.append(node('div', 'explorer-header-copy'));
  fallbackHeader.firstElementChild?.append(fallbackTitle, fallbackText);
  fallbackPanel.append(fallbackHeader, fallbackMap);

  root.append(toolbar, detailPanel, listPanel, hud, journalPanel, helpPanel, fallbackPanel);
  host.append(root);

  function tr(key: CopyKey): string {
    return COPY[key][state?.language ?? 'zh'];
  }

  function localized(value: { zh: string; en: string }): string {
    return value[state?.language ?? 'zh'];
  }

  function setHelpOpen(open: boolean): void {
    helpOpen = open;
    helpPanel.hidden = !open;
    helpPanel.inert = !open || !active;
    helpButton.setAttribute('aria-expanded', String(open));
    if (!open) markHelpSeen();
    if (open) renderHelp();
  }

  function setSeasonVariables(): void {
    const season = state?.season ?? 'christmas';
    if (appliedSeason === season) return;
    appliedSeason = season;
    const palette = HOLIDAYS[season];
    root.dataset.season = season;
    for (const key of ['accent', 'secondary', 'paper', 'ink', 'sea', 'sky', 'glow', 'ornament'] as const) {
      root.style.setProperty(`--holiday-${key}`, palette[key]);
    }
  }

  function updatePanelVisibility(): void {
    if (!state) return;
    const listOpen = state.listOpen;
    const detailOpen = state.detailOpen && state.selection !== null;
    listPanel.hidden = !listOpen;
    listPanel.inert = !listOpen || !active;
    detailPanel.hidden = !detailOpen;
    detailPanel.inert = !detailOpen || !active;
    listButton.setAttribute('aria-pressed', String(listOpen));
    listButton.setAttribute('aria-expanded', String(listOpen));
    if (active && listWasOpen && !listOpen) (listTrigger ?? listButton).focus();
    if (active && detailWasOpen && !detailOpen) (findDetailReturnTarget() ?? (listOpen ? listButton : overviewButton)).focus();
    listWasOpen = listOpen;
    detailWasOpen = detailOpen;
    listHandle.setAttribute('aria-expanded', String(listOpen && listPanel.dataset.expanded === 'true'));
    detailHandle.setAttribute('aria-expanded', String(detailOpen && detailPanel.dataset.expanded === 'true'));
  }

  function findDetailReturnTarget(): HTMLElement | null {
    if (detailTrigger?.isConnected && !detailTrigger.closest('[inert]')) return detailTrigger;
    const selection = state?.selection;
    if (!selection) return null;
    const candidates = Array.from(listContent.querySelectorAll<HTMLElement>('[data-item-id], [data-island-id], [data-flow-id]'));
    const target = candidates.find(element => {
      if (selection.kind === 'item') return element.dataset.itemId === selection.itemId;
      if (selection.kind === 'island') return element.dataset.islandId === selection.islandId;
      if (selection.kind === 'flow') return element.dataset.flowId === selection.flowId;
      return false;
    });
    return target?.closest('[inert]') ? null : target ?? null;
  }

  function applyLanguageChrome(): void {
    if (!state) return;
    if (chromeLanguage === state.language) return;
    chromeLanguage = state.language;
    const language = state.language;
    root.lang = language;
    root.setAttribute('aria-label', COPY.region[language]);
    toolbar.setAttribute('aria-label', language === 'zh' ? '決策群島探索工具列' : 'Decision Islands explorer toolbar');
    overviewButton.setAttribute('aria-label', COPY.overview[language]);
    listButton.setAttribute('aria-label', COPY.themes[language]);
    helpButton.setAttribute('aria-label', COPY.help[language]);
    detailPanel.setAttribute('aria-label', COPY.detail[language]);
    detailClose.setAttribute('aria-label', COPY.closeDetail[language]);
    listPanel.setAttribute('aria-label', COPY.list[language]);
    listClose.setAttribute('aria-label', COPY.closeList[language]);
    searchInput.setAttribute('aria-label', COPY.search[language]);
    searchInput.placeholder = COPY.searchPlaceholder[language];
    chapterLabel.firstElementChild!.textContent = COPY.chapter[language];
    for (const option of Array.from(chapterSelect.options)) {
      const entry = chapterOptions.find(item => (item.value ?? '') === option.value);
      if (entry) option.textContent = COPY[entry.key][language];
    }
    themesTab.textContent = COPY.themeTab[language];
    themesTab.setAttribute('aria-label', COPY.themeTab[language]);
    connectionsTab.textContent = COPY.connectionTab[language];
    connectionsTab.setAttribute('aria-label', COPY.connectionTab[language]);
    tabList.setAttribute('aria-label', language === 'zh' ? '閱讀探索分類' : 'Explorer categories');
    listTitle.textContent = COPY.themes[language];
    if (!state.selection && !detailWasOpen) detailTitle.textContent = COPY.noSelection[language];
    hud.setAttribute('aria-label', language === 'zh' ? '探索控制' : 'Explorer controls');
    mobileTimeButton.setAttribute('aria-label', `${language === 'zh' ? '顯示或隱藏' : 'Show or hide'} ${COPY.time[language]}`);
    mobileTimeButton.querySelector('.explorer-hud-label')?.replaceChildren(document.createTextNode(COPY.time[language]));
    hudTime.setAttribute('aria-label', COPY.overviewHint[language]);
    journalPanel.setAttribute('aria-label', COPY.journal[language]);
    journalTitle.textContent = COPY.journal[language];
    journalSub.textContent = COPY.simulationNote[language];
    live.querySelector('span:last-child')!.textContent = COPY.live[language];
    journalFilterLabel.textContent = COPY.filterConnection[language];
    journalSelect.setAttribute('aria-label', COPY.filterConnection[language]);
    detailHandle.setAttribute('aria-label', COPY.detail[language]);
    listHandle.setAttribute('aria-label', COPY.list[language]);
    journalContent.setAttribute('aria-label', COPY.journal[language]);
    helpPanel.setAttribute('aria-label', COPY.helpTitle[language]);
    helpTitle.textContent = COPY.helpTitle[language];
    helpNote.textContent = COPY.helpNote[language];
    helpClose.setAttribute('aria-label', COPY.close[language]);
    fallbackTitle.textContent = COPY.fallbackTitle[language];
    mobileTimeButton.setAttribute('aria-expanded', String(mobileTimeOpen));
    for (const preset of PRESETS) {
      const target = timeButtons.find(item => item.dataset.minute === String(preset.minute));
      target?.querySelector('.explorer-hud-label')?.replaceChildren(document.createTextNode(COPY[preset.label][language]));
      target?.setAttribute('aria-label', `${minuteLabel(preset.minute)} ${COPY[preset.label][language]}`);
    }
    renderHelp();
  }

  function renderHelp(): void {
    if (!state) return;
    helpSteps.replaceChildren();
    for (const key of ['helpStepOne', 'helpStepTwo', 'helpStepThree'] as const) helpSteps.append(node('li', '', tr(key)));
  }

  function articleFor(item: ExplorerItem): Article | undefined {
    return data.articles.find(article => article.id === item.articleId);
  }

  function islandFor(id: string): ExplorerIsland | undefined {
    return data.islands.find(island => island.id === id);
  }

  function itemFor(id: string): ExplorerItem | undefined {
    return data.items.find(item => item.id === id);
  }

  function flowFor(id: string): ExplorerFlow | undefined {
    return data.flows.find(flow => flow.id === id);
  }

  function articleMatches(article: Article, query: string): boolean {
    if (!query) return true;
    const text = [article.title, article.authors, article.summary, ...article.tags].join(' ').toLocaleLowerCase(state?.language);
    return text.includes(query);
  }

  function currentChapter(): ChapterFilter {
    return state?.chapter ?? null;
  }

  function flowArticles(flow: ExplorerFlow): Article[] {
    return flow.articleIds.flatMap(id => {
      const article = data.articles.find(value => value.id === id);
      if (!article) return [];
      if (currentChapter() && article.chapter !== currentChapter()) return [];
      if (!articleMatches(article, searchInput.value.trim().toLocaleLowerCase(state?.language))) return [];
      return [article];
    });
  }

  function emitSelection(selection: ExplorerSelection): void {
    if (focusableTarget(document.activeElement) && root.contains(document.activeElement)) detailTrigger = document.activeElement;
    callbacks.onSelection(selection);
  }

  function makeArticleButton(article: Article, placement?: ExplorerItem, compact = false): HTMLButtonElement {
    const value = button('', `explorer-article-link${compact ? ' is-compact' : ''}`, `${article.title} · ${article.authors}`, () => {
      if (placement) emitSelection({ kind: 'item', itemId: placement.id });
      else callbacks.onReadArticle(article.id);
    });
    value.dataset.articleId = article.id;
    if (placement) value.dataset.itemId = placement.id;
    const index = placement ? data.islands.find(island => island.id === placement.islandId)?.itemIds.indexOf(placement.id) ?? -1 : -1;
    if (placement) value.append(node('span', 'explorer-item-number', String(index + 1).padStart(2, '0')));
    const copy = node('span', 'explorer-article-link-copy');
    copy.append(node('strong', '', article.title), node('span', '', article.authors));
    const status = node('span', 'explorer-article-status');
    if (state?.completedArticleIds.includes(article.id)) status.textContent = '✓';
    status.setAttribute('aria-label', state?.completedArticleIds.includes(article.id) ? tr('completed') : tr('unread'));
    value.append(copy, status);
    if (state?.selection?.kind === 'item' && state.selection.itemId === placement?.id) value.setAttribute('aria-current', 'true');
    return value;
  }

  function makeFlowButton(flow: ExplorerFlow): HTMLButtonElement {
    const from = islandFor(flow.from);
    const to = islandFor(flow.to);
    const value = button('', 'explorer-flow-select', `${localized(from?.title ?? { zh: flow.from, en: flow.from })} → ${localized(to?.title ?? { zh: flow.to, en: flow.to })}`, () => emitSelection({ kind: 'flow', flowId: flow.id }));
    value.dataset.flowId = flow.id;
    value.setAttribute('aria-pressed', String(state?.selection?.kind === 'flow' && state.selection.flowId === flow.id));
    const evidence = node('span', `explorer-evidence explorer-evidence-${flow.evidence.kind}`, tr(EVIDENCE_KEYS[flow.evidence.kind]));
    const title = node('strong', '', `${localized(from?.title ?? { zh: flow.from, en: flow.from })} → ${localized(to?.title ?? { zh: flow.to, en: flow.to })}`);
    const meta = node('span', 'explorer-flow-meta', `${tr('readerRole')}: ${localized(data.roles.find(role => role.id === flow.role)?.title ?? { zh: flow.role, en: flow.role })} · ${tr('cargo')}: ${localized(CARGO[flow.cargo])}`);
    value.append(evidence, title, meta);
    return value;
  }

  function makeFlowArticleLinks(flow: ExplorerFlow, compact = true): HTMLElement {
    const group = node('div', 'explorer-flow-articles');
    group.setAttribute('aria-label', tr('relatedArticles'));
    for (const article of flowArticles(flow)) {
      const read = button('↗', 'explorer-source-link', `${tr('readSource')}: ${article.title}`, () => callbacks.onReadArticle(article.id));
      read.append(node('span', '', article.title));
      group.append(read);
    }
    if (!group.childElementCount && !compact) group.append(node('p', 'explorer-muted', tr('emptyFlows')));
    return group;
  }

  function rebuildList(): void {
    if (!state) return;
    const language = state.language;
    const uniqueArticleCount = new Set(data.articles.map(article => article.id)).size;
    setText(listCount, `${uniqueArticleCount} ${COPY.articles[language]} · ${data.islands.length} ${COPY.themesCount[language]} · ${data.items.length} ${COPY.placements[language]}`);
    searchInput.setAttribute('aria-label', COPY.search[language]);
    searchInput.placeholder = COPY.searchPlaceholder[language];
    if (searchInput.value !== state.query) searchInput.value = state.query;
    chapterSelect.value = state.chapter ?? '';
    themesTab.setAttribute('aria-selected', String(state.tab === 'themes'));
    themesTab.setAttribute('aria-controls', listContent.id);
    connectionsTab.setAttribute('aria-selected', String(state.tab === 'connections'));
    connectionsTab.setAttribute('aria-controls', listContent.id);
    listContent.replaceChildren();
    const query = state.query.trim().toLocaleLowerCase(language);
    const chapter = state.chapter;
    if (state.tab === 'themes') {
      const matches: Array<{ island: ExplorerIsland; items: ExplorerItem[] }> = [];
      for (const island of data.islands) {
        const items = island.itemIds.flatMap(id => {
          const item = itemFor(id);
          const article = item && articleFor(item);
          if (!item || !article || (chapter && article.chapter !== chapter) || !articleMatches(article, query)) return [];
          return [item];
        });
        const islandMatch = localized(island.title).toLocaleLowerCase(language).includes(query) || localized(island.description).toLocaleLowerCase(language).includes(query);
        if (items.length || islandMatch) matches.push({ island, items });
      }
      if (!matches.length) listContent.append(node('p', 'explorer-empty', tr('emptyThemes')));
      for (const { island, items } of matches) {
        const details = node('details', 'explorer-theme');
        const selectedIsland = state.selection?.kind === 'island' && state.selection.islandId === island.id;
        const selectedItemIsland = state.selection?.kind === 'item' && itemFor(state.selection.itemId)?.islandId === island.id;
        details.open = selectedIsland || selectedItemIsland || Boolean(query);
        const summary = node('summary', 'explorer-theme-summary');
        summary.dataset.islandId = island.id;
        const marker = node('span', 'explorer-theme-marker');
        marker.style.setProperty('--theme-color', island.color);
        marker.setAttribute('aria-hidden', 'true');
        const title = node('span', 'explorer-theme-title');
        title.append(node('strong', '', island.title[language]), node('small', '', `${items.length} ${COPY.placements[language]}`));
        const chevron = node('span', 'explorer-theme-chevron', '⌄');
        chevron.setAttribute('aria-hidden', 'true');
        summary.append(marker, title, chevron);
        details.append(summary);
        summary.addEventListener('click', event => {
          const selection = state?.selection;
          if (selection?.kind !== 'island' || selection.islandId !== island.id) {
            event.preventDefault();
            emitSelection({ kind: 'island', islandId: island.id });
          }
        });
        const content = node('div', 'explorer-theme-items');
        if (items.length) {
          for (const [index, item] of items.entries()) {
            const article = articleFor(item);
            if (article) content.append(makeArticleButton(article, item));
            if (index < items.length - 1) content.append(node('span', 'explorer-item-divider'));
          }
        } else content.append(node('p', 'explorer-muted', tr('noArticles')));
        const related = data.flows.filter(flow => flow.from === island.id || flow.to === island.id);
        if (related.length) {
          const links = node('div', 'explorer-theme-flows');
          links.setAttribute('aria-label', tr('relatedConnections'));
          for (const flow of related) {
            const link = button(localized(flow.evidence.rationale).slice(0, 42), 'explorer-flow-chip', tr(EVIDENCE_KEYS[flow.evidence.kind]), () => emitSelection({ kind: 'flow', flowId: flow.id }));
            link.setAttribute('aria-label', `${localized(flow.evidence.rationale)}. ${tr(EVIDENCE_KEYS[flow.evidence.kind])}`);
            links.append(link);
          }
          content.append(links);
        }
        details.append(content);
        listContent.append(details);
      }
    } else {
      const flows = data.flows.filter(flow => flowArticles(flow).length > 0 || (!query && !chapter));
      const note = node('p', 'explorer-editorial-note', tr('editorialBoundary'));
      listContent.append(note);
      if (!flows.length) listContent.append(node('p', 'explorer-empty', tr('emptyFlows')));
      for (const flow of flows) {
        const card = node('article', 'explorer-flow-card');
        if (state.selection?.kind === 'flow' && state.selection.flowId === flow.id) card.classList.add('is-selected');
        card.append(makeFlowButton(flow));
        card.append(makeFlowArticleLinks(flow));
        listContent.append(card);
      }
    }
  }

  function createMetric(value: string, label: string): HTMLElement {
    const card = node('div', 'explorer-metric');
    card.append(node('strong', '', value), node('span', '', label));
    return card;
  }

  function createModelFallback(model: ModelKind): HTMLElement {
    const preview = node('div', `explorer-model-fallback model-${MODEL_SHAPES[model]}`);
    preview.setAttribute('aria-hidden', 'true');
    const ground = node('span', 'model-ground');
    const body = node('span', 'model-body');
    const roof = node('span', 'model-roof');
    const detail = node('span', 'model-detail');
    preview.append(ground, body, roof, detail);
    preview.setAttribute('data-label', tr('modelPreview'));
    return preview;
  }

  function createThumbnail(item: ExplorerItem, article: Article): HTMLElement {
    const frame = node('div', 'explorer-thumbnail');
    const alt = `${article.title} ${COPY.curatorGuide[state?.language ?? 'zh']}`;
    let dataUrl: string | null = null;
    try {
      dataUrl = callbacks.onThumbnail(item.id);
    } catch {
      dataUrl = null;
    }
    if (dataUrl) {
      const image = node('img', 'explorer-thumbnail-image');
      image.src = dataUrl;
      image.alt = alt;
      image.width = 160;
      image.height = 160;
      image.loading = 'lazy';
      frame.append(image);
    } else {
      const fallback = createModelFallback(item.model);
      fallback.setAttribute('role', 'img');
      fallback.setAttribute('aria-label', `${MODEL_SHAPES[item.model]} ${COPY.modelPreview[state?.language ?? 'zh']}`);
      frame.append(fallback);
      frame.setAttribute('aria-label', `${MODEL_SHAPES[item.model]} ${COPY.modelPreview[state?.language ?? 'zh']}`);
    }
    return frame;
  }

  function articleStatus(article: Article): HTMLElement {
    const row = node('div', 'explorer-reading-status');
    const isCompleted = Boolean(state?.completedArticleIds.includes(article.id));
    const isBookmarked = Boolean(state?.bookmarkedArticleIds.includes(article.id));
    row.append(node('span', isCompleted ? 'is-completed' : '', `${isCompleted ? '✓' : '○'} ${isCompleted ? tr('completed') : tr('unread')}`));
    row.append(node('span', isBookmarked ? 'is-bookmarked' : '', `${isBookmarked ? '★' : '☆'} ${isBookmarked ? tr('bookmarked') : tr('notBookmarked')}`));
    return row;
  }

  function renderIslandDetail(island: ExplorerIsland): void {
    detailKicker.textContent = tr('curatorGuide');
    detailTitle.textContent = localized(island.title);
    detailContent.replaceChildren();
    detailContent.append(node('p', 'explorer-description', localized(island.description)));
    const items = island.itemIds.flatMap(id => {
      const item = itemFor(id);
      const article = item && articleFor(item);
      return item && article ? [{ item, article }] : [];
    });
    const heading = node('h3', 'explorer-section-title', `${items.length} ${tr('placements')}`);
    detailContent.append(heading);
    if (!items.length) detailContent.append(node('p', 'explorer-empty', tr('noArticles')));
    for (const { item, article } of items) detailContent.append(makeArticleButton(article, item));
    const related = data.flows.filter(flow => flow.from === island.id || flow.to === island.id);
    detailContent.append(node('h3', 'explorer-section-title', tr('relatedConnections')));
    if (!related.length) detailContent.append(node('p', 'explorer-muted', tr('noConnections')));
    for (const flow of related) detailContent.append(makeFlowButton(flow));
  }

  function appendArticleActions(article: Article, item: ExplorerItem): void {
    const actions = node('div', 'explorer-primary-actions');
    const read = button('↗', 'explorer-primary-button', `${tr('readArticle')}: ${article.title}`, () => callbacks.onReadArticle(article.id));
    read.append(node('span', '', state?.completedArticleIds.includes(article.id) ? tr('reopenArticle') : tr('readArticle')));
    const pdf = node('a', 'explorer-secondary-button', tr('sourcePdf'));
    pdf.href = `${import.meta.env.BASE_URL}${article.sourcePdf.replace(/^\/+/, '')}`;
    pdf.target = '_blank';
    pdf.rel = 'noopener noreferrer';
    pdf.setAttribute('aria-label', `${tr('sourcePdf')}: ${article.title}`);
    const bookmark = button(state?.bookmarkedArticleIds.includes(article.id) ? '★' : '☆', 'explorer-bookmark-button', `${tr('manageBookmark')}: ${article.title}`, () => callbacks.onReadArticle(article.id));
    bookmark.append(node('span', '', state?.bookmarkedArticleIds.includes(article.id) ? tr('bookmarked') : tr('manageBookmark')));
    actions.append(read, pdf, bookmark);
    detailContent.append(actions);
  }

  function renderItemDetail(item: ExplorerItem, article: Article): void {
    detailKicker.textContent = tr('curatorGuide');
    detailTitle.textContent = article.title;
    detailContent.replaceChildren();
    const isEnglish = state?.language === 'en';
    if (isEnglish) detailContent.append(node('p', 'explorer-original-note', tr('originalChinese')));
    detailContent.append(createThumbnail(item, article));
    const meta = node('p', 'explorer-article-byline');
    meta.append(node('span', 'explorer-chapter-tag', `${tr(CHAPTER_KEYS[article.chapter])} · ${article.year}`), node('span', '', article.authors));
    detailContent.append(meta);
    detailContent.append(node('p', 'explorer-article-summary', article.summary.replace(/^【決策智慧 2026】/, '')));
    const caption = node('p', 'explorer-curator-caption');
    caption.append(node('span', 'explorer-eyebrow', tr('curatorGuide')), node('span', '', localized(item.caption)));
    detailContent.append(caption);
    const metrics = node('div', 'explorer-metrics');
    metrics.append(createMetric(String(article.sourcePages.length), tr('sourcePages')));
    metrics.append(createMetric(String(article.minutes), tr('estimatedMinutes')));
    metrics.append(createMetric(String(article.year), tr('publicationYear')));
    detailContent.append(metrics);
    const timeline = node('div', 'explorer-reading-axis');
    timeline.append(node('span', 'explorer-eyebrow', tr('printedPages')));
    timeline.append(node('strong', '', `p. ${article.printedStart}–${article.printedEnd}`));
    timeline.append(articleStatus(article));
    detailContent.append(timeline);
    appendArticleActions(article, item);
  }

  function appendRelatedArticles(flow: ExplorerFlow): void {
    detailContent.append(node('h3', 'explorer-section-title', tr('relatedArticles')));
    const articles = flow.articleIds.flatMap(id => data.articles.filter(article => article.id === id));
    if (!articles.length) detailContent.append(node('p', 'explorer-empty', tr('emptyFlows')));
    for (const article of articles) {
      const entry = node('div', 'explorer-related-article');
      entry.append(node('div', 'explorer-related-copy', `${article.title} · ${article.authors}`));
      entry.append(button('↗', 'explorer-source-link', `${tr('readSource')}: ${article.title}`, () => callbacks.onReadArticle(article.id)));
      detailContent.append(entry);
    }
  }

  function renderFlowDetail(flow: ExplorerFlow, snapshot?: WalkerSnapshot): void {
    const from = islandFor(flow.from);
    const to = islandFor(flow.to);
    detailKicker.textContent = snapshot ? `${tr('walker')} · ${snapshot.id}` : tr(EVIDENCE_KEYS[flow.evidence.kind]);
    detailTitle.textContent = `${localized(from?.title ?? { zh: flow.from, en: flow.from })} → ${localized(to?.title ?? { zh: flow.to, en: flow.to })}`;
    detailContent.replaceChildren();
    if (snapshot) {
      const role = data.roles.find(value => value.id === snapshot.role);
      detailContent.append(node('p', 'explorer-walker-summary', `${localized(role?.title ?? { zh: snapshot.role, en: snapshot.role })} · ${localized(CARGO[snapshot.cargo])}`));
      const destination = snapshot.direction === 1 ? to : from;
      detailContent.append(node('p', 'explorer-destination', `${tr('destination')}: ${localized(destination?.title ?? { zh: tr('noWalkerDestination'), en: tr('noWalkerDestination') })}`));
    }
    const route = node('dl', 'explorer-flow-facts');
    const facts: Array<[CopyKey, string]> = [
      ['from', localized(from?.title ?? { zh: flow.from, en: flow.from })],
      ['to', localized(to?.title ?? { zh: flow.to, en: flow.to })],
      ['evidence', tr(EVIDENCE_KEYS[flow.evidence.kind])],
      ['cargo', localized(CARGO[flow.cargo])],
      ['readerRole', localized(data.roles.find(role => role.id === flow.role)?.title ?? { zh: flow.role, en: flow.role })],
    ];
    for (const [key, value] of facts) {
      route.append(node('dt', '', tr(key)), node('dd', '', value));
    }
    detailContent.append(route);
    detailContent.append(node('p', 'explorer-rationale', localized(flow.evidence.rationale)));
    detailContent.append(node('p', 'explorer-editorial-note', tr('editorialBoundary')));
    appendRelatedArticles(flow);
  }

  function resolveWalker(walkerId: string): WalkerSnapshot | undefined {
    try {
      return callbacks.onResolveWalker(walkerId);
    } catch {
      return undefined;
    }
  }

  function renderDetail(): void {
    if (!state) return;
    const selection = state.selection;
    detailContent.replaceChildren();
    if (!selection) {
      detailKicker.textContent = tr('detail');
      detailTitle.textContent = tr('noSelection');
      detailContent.append(node('p', 'explorer-empty', tr('noSelection')));
      return;
    }
    if (selection.kind === 'island') {
      const island = islandFor(selection.islandId);
      if (island) renderIslandDetail(island);
      else renderUnavailableDetail();
      return;
    }
    if (selection.kind === 'item') {
      const item = itemFor(selection.itemId);
      const article = item && articleFor(item);
      if (item && article) renderItemDetail(item, article);
      else renderUnavailableDetail();
      return;
    }
    if (selection.kind === 'flow') {
      const flow = flowFor(selection.flowId);
      if (flow) renderFlowDetail(flow);
      else renderUnavailableDetail();
      return;
    }
    const snapshot = resolveWalker(selection.walkerId);
    const flow = snapshot && flowFor(snapshot.flowId);
    detailKicker.textContent = tr('walker');
    if (flow && snapshot) renderFlowDetail(flow, snapshot);
    else {
      detailTitle.textContent = `${tr('walker')} · ${selection.walkerId}`;
      detailContent.append(node('p', 'explorer-empty', tr('walkerUnavailable')));
    }
  }

  function renderUnavailableDetail(): void {
    detailKicker.textContent = tr('detail');
    detailTitle.textContent = tr('unavailableSelection');
    detailContent.replaceChildren(node('p', 'explorer-empty', tr('unavailableSelection')));
  }

  function renderJournalFilter(): void {
    if (!state) return;
    const previous = journalSelect.value;
    journalSelect.replaceChildren();
    const all = node('option', '', tr('allConnections'));
    all.value = '';
    journalSelect.append(all);
    for (const flow of data.flows) {
      const from = islandFor(flow.from);
      const to = islandFor(flow.to);
      const option = node('option', '', `${localized(from?.title ?? { zh: flow.from, en: flow.from })} → ${localized(to?.title ?? { zh: flow.to, en: flow.to })}`);
      option.value = flow.id;
      journalSelect.append(option);
    }
    journalSelect.value = state.journalFilter ?? (data.flows.some(flow => flow.id === previous) ? previous : '');
  }

  function renderJournal(): void {
    if (!state) return;
    journalPanel.hidden = !state.journal || fallback;
    journalPanel.inert = !state.journal || fallback || !active;
    const key = [dataVersion, eventRevision, state.language, state.paused, state.journal, state.journalFilter, fallback].join('|');
    if (key === journalKey) return;
    journalKey = key;
    live.classList.toggle('is-paused', state.paused || fallback);
    live.classList.toggle('is-unavailable', fallback);
    const paused = state.paused || state.reducedMotion;
    live.querySelector('span:last-child')!.textContent = fallback ? tr('fallbackUnavailable') : paused ? tr('pausedStatus') : tr('live');
    journalTitle.textContent = fallback ? tr('simulationLog') : tr('journal');
    journalSub.textContent = tr('simulationNote');
    renderJournalFilter();
    journalContent.replaceChildren();
    if (fallback) {
      journalContent.append(node('li', 'explorer-journal-empty', tr('fallbackBody')));
      return;
    }
    const visible = events.filter(event => !state?.journalFilter || event.flowId === state.journalFilter).slice(-EVENT_LIMIT).reverse();
    if (!visible.length) {
      journalContent.append(node('li', 'explorer-journal-empty', tr('noEvents')));
      return;
    }
    for (const event of visible) {
      const flow = flowFor(event.flowId);
      const island = islandFor(event.islandId);
      const row = node('li', 'explorer-journal-event');
      const eventType: CopyKey = event.type;
      const time = node('time', '', minuteLabel(event.minute));
      time.dateTime = `T${minuteLabel(event.minute)}`;
      const message = node('div', 'explorer-journal-event-copy');
      message.append(node('strong', '', tr(eventType)));
      message.append(node('span', '', `${event.walkerId} · ${localized(island?.title ?? { zh: event.islandId, en: event.islandId })}`));
      if (flow) {
        const relation = button(`${localized(islandFor(flow.from)?.title ?? { zh: flow.from, en: flow.from })} → ${localized(islandFor(flow.to)?.title ?? { zh: flow.to, en: flow.to })}`, 'explorer-journal-flow', tr('relatedConnections'), () => emitSelection({ kind: 'flow', flowId: flow.id }));
        relation.setAttribute('aria-label', `${tr('relatedConnections')}: ${relation.textContent}`);
        message.append(relation);
      }
      row.append(time, message);
      journalContent.append(row);
    }
  }

  function renderFallback(): void {
    fallbackPanel.hidden = !fallback;
    fallbackPanel.inert = !fallback || !active;
    if (!fallback) return;
    fallbackText.textContent = fallbackMessage ? `${fallbackMessage} ${tr('fallbackBody')}` : tr('fallbackBody');
    const key = `${dataVersion}:${state?.language}:${fallbackMessage}`;
    if (key === fallbackKey) return;
    fallbackKey = key;
    fallbackMap.replaceChildren();
    for (const island of data.islands) {
      const section = node('section', 'explorer-map-theme');
      const heading = button('', 'explorer-map-theme-button', `${tr('themes')}: ${localized(island.title)}`, () => emitSelection({ kind: 'island', islandId: island.id }));
      const marker = node('span', 'explorer-theme-marker');
      marker.style.setProperty('--theme-color', island.color);
      heading.append(marker, node('strong', '', island.title[state?.language ?? 'zh']));
      section.append(heading);
      const placements = node('div', 'explorer-map-items');
      for (const [index, id] of island.itemIds.entries()) {
        const item = itemFor(id);
        const article = item && articleFor(item);
        if (!item || !article) continue;
        const entry = button('', 'explorer-map-item', article.title, () => emitSelection({ kind: 'item', itemId: item.id }));
        entry.append(node('span', 'explorer-item-number', ['①', '②', '③', '④'][index] ?? String(index + 1)));
        entry.append(node('span', '', article.title));
        entry.setAttribute('aria-label', `${island.title[state?.language ?? 'zh']}, ${article.title}, ${article.authors}`);
        placements.append(entry);
      }
      section.append(placements);
      fallbackMap.append(section);
    }
  }

  function render(): void {
    if (!state) return;
    setSeasonVariables();
    applyLanguageChrome();
    updatePanelVisibility();
    if (searchInput.value !== state.query) searchInput.value = state.query;
    const nextListKey = [dataVersion, state.language, state.query, state.tab, state.chapter, selectionKey(state.selection), state.bookmarkedArticleIds.join(','), state.completedArticleIds.join(',')].join('|');
    if (nextListKey !== listKey) {
      listKey = nextListKey;
      rebuildList();
    }
    const nextDetailKey = [dataVersion, selectionKey(state.selection), state.language, state.completedArticleIds.join(','), state.bookmarkedArticleIds.join(',')].join('|');
    if (nextDetailKey !== detailKey) {
      detailKey = nextDetailKey;
      renderDetail();
    }
    setText(hudTime, minuteLabel(state.minute));
    for (const preset of PRESETS) {
      const control = timeButtons.find(item => item.dataset.minute === String(preset.minute));
      control?.setAttribute('aria-pressed', String(state.minute === preset.minute));
    }
    const toggles: Record<string, boolean> = {
      names: state.names, walkers: state.walkers, flows: state.flows, paused: state.paused,
      birdseye: state.birdseye, journal: state.journal,
    };
    const toggleCopy: Array<[string, CopyKey]> = [
      ['names', 'names'], ['walkers', 'walkers'], ['flows', 'flows'], ['paused', state.paused ? 'resume' : 'paused'],
      ['birdseye', 'birdseye'], ['journal', 'journalToggle'],
    ];
    for (const [key, enabled] of Object.entries(toggles)) toggleButtons.get(key)?.setAttribute('aria-pressed', String(enabled));
    for (const [key, copyKey] of toggleCopy) {
      const target = toggleButtons.get(key);
      if (!target) continue;
      const label = COPY[copyKey][state.language];
      target.setAttribute('aria-label', label);
      const targetLabel = target.querySelector<HTMLElement>('.explorer-hud-label');
      if (targetLabel) setText(targetLabel, label);
    }
    renderJournal();
    renderFallback();
    if (helpOpen) {
      helpPanel.hidden = false;
      helpPanel.inert = !active;
      helpButton.setAttribute('aria-expanded', 'true');
    }
  }

  function closeWithFocus(panel: 'detail' | 'list'): void {
    if (panel === 'detail') {
      const returnTarget = findDetailReturnTarget() ?? detailTrigger;
      callbacks.onCommand({ type: 'panel', panel, open: false });
      queueMicrotask(() => {
        if (active && state?.detailOpen === false) {
          const target = returnTarget?.isConnected && !returnTarget.closest('[inert]') ? returnTarget : findDetailReturnTarget();
          (target ?? (state.listOpen ? listButton : overviewButton)).focus();
        }
      });
    } else {
      listTrigger = listButton;
      callbacks.onCommand({ type: 'panel', panel, open: false });
      queueMicrotask(() => {
        if (active && state?.listOpen === false) listButton.focus();
      });
    }
  }

  function addSheetBehavior(handle: HTMLButtonElement, panel: HTMLElement): void {
    let startY = 0;
    let lastY = 0;
    let dragging = false;
    let dragged = false;
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      startY = event.clientY;
      lastY = startY;
      dragging = true;
      dragged = false;
      handle.setPointerCapture(event.pointerId);
    }, { signal: abort.signal });
    handle.addEventListener('pointermove', event => {
      if (!dragging) return;
      lastY = event.clientY;
      panel.dataset.dragging = 'true';
    }, { signal: abort.signal });
    const finish = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      delete panel.dataset.dragging;
      if (Math.abs(lastY - startY) > 36) {
        panel.dataset.expanded = String(lastY < startY);
        handle.setAttribute('aria-expanded', panel.dataset.expanded);
        dragged = true;
      }
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    };
    handle.addEventListener('pointerup', finish, { signal: abort.signal });
    handle.addEventListener('pointercancel', finish, { signal: abort.signal });
    handle.addEventListener('click', () => {
      if (dragged) {
        dragged = false;
        return;
      }
      if (dragging) return;
      panel.dataset.expanded = String(panel.dataset.expanded !== 'true');
      handle.setAttribute('aria-expanded', panel.dataset.expanded);
    }, { signal: abort.signal });
  }

  searchInput.addEventListener('input', () => callbacks.onCommand({ type: 'query', query: searchInput.value }), { signal: abort.signal });
  chapterSelect.addEventListener('change', () => callbacks.onCommand({ type: 'chapter', chapter: (chapterSelect.value || null) as ChapterFilter }), { signal: abort.signal });
  journalSelect.addEventListener('change', () => callbacks.onCommand({ type: 'journalFilter', flowId: journalSelect.value || null }), { signal: abort.signal });
  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !active) return;
    if (state?.detailOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeWithFocus('detail');
      return;
    }
    if (helpOpen) {
      event.preventDefault();
      setHelpOpen(false);
      helpButton.focus();
      return;
    }
    if (state?.selection) {
      event.preventDefault();
      callbacks.onSelection(null);
    }
  }, { signal: abort.signal });
  addSheetBehavior(listHandle, listPanel);
  addSheetBehavior(detailHandle, detailPanel);
  listHandle.setAttribute('aria-label', COPY.list.zh);
  detailHandle.setAttribute('aria-label', COPY.detail.zh);

  if (helpOpen) {
    setHelpOpen(true);
    markHelpSeen();
  }

  const ui: ExplorerUI = {
    setData(nextData) {
      data = nextData;
      dataVersion += 1;
      listKey = '';
      detailKey = '';
      journalKey = '';
      fallbackKey = '';
      events = [];
      eventIds.clear();
      eventRevision += 1;
      render();
    },
    render(nextState) {
      state = nextState;
      render();
    },
    appendEvents(nextEvents) {
      if (fallback) return;
      for (const event of nextEvents) {
        if (eventIds.has(event.id)) continue;
        eventIds.add(event.id);
        events.push(event);
      }
      if (events.length > EVENT_LIMIT) {
        const removed = events.splice(0, events.length - EVENT_LIMIT);
        for (const event of removed) eventIds.delete(event.id);
      }
      eventRevision += 1;
      renderJournal();
    },
    clearEvents() {
      events = [];
      eventIds.clear();
      eventRevision += 1;
      renderJournal();
    },
    setActive(nextActive) {
      active = nextActive;
      root.hidden = !active;
      root.inert = !active;
      if (state) {
        updatePanelVisibility();
        renderJournal();
      }
    },
    setFallback(nextFallback, message = '') {
      fallback = nextFallback;
      fallbackMessage = message;
      if (fallback) {
        events = [];
        eventIds.clear();
        eventRevision += 1;
      }
      fallbackKey = '';
      render();
    },
    dispose() {
      abort.abort();
      root.remove();
      events = [];
      eventIds.clear();
      state = null;
    },
  };

  listTrigger = listButton;

  return ui;
}

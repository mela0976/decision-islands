import './reading-journey.css';
import type { JourneyAudience, JourneyAudienceId, JourneyConnectionKind, JourneyPersona, JourneyQuestion, JourneyStep, ReadingJourneys } from './journey-types';
import type { Article } from './types';

export interface ReadingJourneyContext {
  personaTitle: string;
  questionTitle: string;
  stepIndex: number;
  total: number;
  nextArticleId: string | null;
  nextReason: string | null;
}

export interface ReadingJourneyCallbacks {
  onFocusArticle(id: string): void;
  onReadArticle(id: string): void;
  onFreeExplore(): void;
  onBrowseArticles(): void;
  onOpen(): void;
}

export interface ReadingJourneyUI {
  setData(data: ReadingJourneys, articles: readonly Article[]): void;
  setCompleted(ids: readonly string[]): void;
  setActive(active: boolean): void;
  showPicker(): void;
  getNextArticle(id: string): string | null;
  getContext(id: string): ReadingJourneyContext | null;
  syncArticle(id: string): void;
  advance(): void;
  dispose(): void;
}

type Language = 'zh' | 'en';
type SelectedJourney = { bookId: string; personaId: string; questionId: string; stepIndex: number };
type AudienceId = JourneyAudienceId;
type JourneyView =
  | { kind: 'closed'; selection: SelectedJourney | null }
  | { kind: 'audiences'; selection: SelectedJourney | null }
  | { kind: 'roles'; selection: SelectedJourney | null; audienceId: AudienceId }
  | { kind: 'questions'; selection: SelectedJourney | null; audienceId: AudienceId | null; personaId: string }
  | { kind: 'rail'; selection: SelectedJourney };

const copy = {
  audienceHeading: { zh: '你想從哪個面向開始？', en: 'Where would you like to start?' },
  audienceIntro: { zh: '先選工作或日常情境，再挑一個貼近自己的角色。', en: 'Start with work or everyday life, then choose a role that fits.' },
  roleHeading: { zh: '選一個最貼近你的角色', en: 'Choose a role that fits you' },
  roleIntro: { zh: '從你此刻所在的位置，挑一個切入點。', en: 'Choose a perspective that fits where you are now.' },
  questionHeading: { zh: '你最想先弄懂哪一件事？', en: 'What would you like to understand first?' },
  questionIntro: { zh: '先選一個問題。你可以隨時換角度或跳到其他文章。', en: 'Choose a question to begin. You can change views or skip to another article at any time.' },
  firstQuestion: { zh: '先看看適合我的文章', en: 'Show me an article to start with' },
  backRoles: { zh: '← 回到角色', en: '← Back to roles' },
  backAudiences: { zh: '← 換個面向', en: '← Change area' },
  closePicker: { zh: '關閉閱讀引導', en: 'Close reading guide' },
  pickerLabel: { zh: '從工作與日常找到閱讀起點', en: 'Find a reading start in work or everyday life' },
  railLabel: { zh: '你的閱讀起點', en: 'Your reading start' },
  switchQuestion: { zh: '換個問題', en: 'Choose another question' },
  freeExplore: { zh: '改用自由探索', en: 'Explore freely' },
  chooseQuestion: { zh: '選擇另一個問題', en: 'Choose another question' },
  promptLabel: { zh: '從這個問題開始', en: 'Start with this question' },
  reasonLabel: { zh: '本站策展導讀', en: 'Editorial guide' },
  articleLabel: { zh: '原刊編輯摘要', en: 'Original editorial summary' },
  editorialGuide: { zh: '本站策展導讀', en: 'Editorial guide' },
  reflection: { zh: '把三個角度放一起，你原本的想法改變了什麼？', en: 'Now that you have seen all three angles, what has changed in your original view?' },
  minutes: { zh: '約 {minutes} 分鐘', en: 'About {minutes} minutes' },
  focusArticle: { zh: '在群島中定位', en: 'Locate in the islands' },
  readArticle: { zh: '閱讀這篇文章', en: 'Read this article' },
  skipNext: { zh: '略過，先看下一個觀點', en: 'Skip to the next view' },
  nextView: { zh: '看下一個觀點', en: 'See the next view' },
  lastStep: { zh: '這條路線已到最後一篇。', en: 'This path has reached its last article.' },
  otherViews: { zh: '選擇另一個閱讀角度', en: 'Choose another perspective' },
  complement: { zh: '互補觀點', en: 'Complement' },
  tradeoff: { zh: '取捨觀點', en: 'Trade-off' },
  context: { zh: '脈絡觀點', en: 'Context' },
  emptyTitle: { zh: '這一年還沒有角色導讀', en: 'Role-based reading is not available for this edition yet' },
  emptyNotice: { zh: '這本書的角色導讀尚未編排。你仍可搜尋已收錄的文章，或回到目錄自由閱讀。', en: 'Role-based journeys have not been curated for this edition. Search the available articles or return to the directory to explore.' },
  noData: { zh: '文章資料尚未載入。你可以回到目錄檢視已收錄的篇目。', en: 'Article data has not loaded yet. Return to the directory to see available articles.' },
  browseArticles: { zh: '瀏覽文章目錄', en: 'Browse the article directory' },
  searchArticles: { zh: '搜尋文章', en: 'Search articles' },
  searchLabel: { zh: '搜尋標題、作者或摘要', en: 'Search titles, authors or summaries' },
  searchPlaceholder: { zh: '輸入標題、作者或關鍵字', en: 'Enter a title, author or keyword' },
  searchHint: { zh: '搜尋目前收錄的文章。', en: 'Search articles in this edition.' },
  resultCount: { zh: '找到 {count} 篇文章', en: '{count} articles found' },
  noResults: { zh: '沒有符合的文章，試試其他關鍵字。', en: 'No articles match. Try another keyword.' },
  noArticles: { zh: '目前沒有可搜尋的文章。', en: 'There are no searchable articles yet.' },
  readSearchResult: { zh: '閱讀這篇', en: 'Read article' },
  missingArticle: { zh: '這篇文章不在目前收錄的年度中。', en: 'This article is not available in the current edition.' },
  missingSummary: { zh: '這篇文章目前沒有可顯示的摘要。', en: 'No summary is available for this article.' },
  closeRail: { zh: '收起閱讀路線', en: 'Close reading path' },
  unavailableQuestion: { zh: '這個問題目前沒有可閱讀的文章。', en: 'There are no available articles for this question yet.' },
  stepLabel: { zh: '第 {step} 個觀點：{title}', en: 'View {step}: {title}' },
  stepComplete: { zh: '，已讀', en: ', read' },
  articleOrder: { zh: '觀點 {order}', en: 'View {order}' },
  routeCount: { zh: '{current} / {total}', en: '{current} / {total}' },
} as const;

const html = (value: string): string => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

export function createReadingJourneyUI(
  host: HTMLElement,
  callbacks: ReadingJourneyCallbacks,
  language: Language,
): ReadingJourneyUI {
  const words = (key: keyof typeof copy): string => copy[key][language];
  const root = document.createElement('div');
  root.className = 'reading-journey-ui';
  root.hidden = true;
  host.append(root);

  const picker = document.createElement('dialog');
  picker.id = 'journey-picker';
  picker.className = 'journey-picker-dialog';
  picker.setAttribute('aria-modal', 'true');
  document.body.append(picker);

  let data: ReadingJourneys | null = null;
  let articles: readonly Article[] = [];
  let articlesById = new Map<string, Article>();
  let completed = new Set<string>();
  let active = false;
  let pickerOpen = false;
  let pickerQuery = '';
  let returnFocus: HTMLElement | null = null;
  let view: JourneyView = { kind: 'closed', selection: null };

  const selected = (): SelectedJourney | null => view.selection;
  const personaFor = (personaId: string): JourneyPersona | undefined => data?.personas.find(persona => persona.id === personaId);
  const personaAudience = (persona: JourneyPersona | undefined): AudienceId | null => persona?.audienceId ?? null;
  const audiencesFor = (): readonly JourneyAudience[] => data?.audiences ?? [];
  const questionFor = (personaId: string, questionId: string): JourneyQuestion | undefined =>
    personaFor(personaId)?.questions.find(question => question.id === questionId);
  const localized = (value: { zh: string; en: string } | undefined): string => value?.[language] ?? '';
  const setSelection = (selection: SelectedJourney | null): void => {
    switch (view.kind) {
      case 'closed': view = { kind: 'closed', selection }; break;
      case 'audiences': view = { kind: 'audiences', selection }; break;
      case 'roles': view = { kind: 'roles', selection, audienceId: view.audienceId }; break;
      case 'questions': view = { kind: 'questions', selection, audienceId: view.audienceId, personaId: view.personaId }; break;
      case 'rail': view = selection ? { kind: 'rail', selection } : { kind: 'closed', selection: null }; break;
    }
  };

  function focusPickerHeading(): void {
    picker.querySelector<HTMLElement>('#journey-picker-title')?.focus({ preventScroll: true });
  }

  function focusRailHeading(): void {
    root.querySelector<HTMLElement>('#journey-rail-title')?.focus({ preventScroll: true });
  }

  function setPickerOpen(open: boolean, restoreFocus: boolean): void {
    pickerOpen = open;
    if (open) {
      if (!picker.open) picker.showModal();
      return;
    }
    if (picker.open) picker.close();
    const target = returnFocus;
    returnFocus = null;
    if (restoreFocus && target?.isConnected && !target.closest('[inert]') && !target.closest('[hidden]')) {
      target.focus({ preventScroll: true });
    }
  }

  function openPicker(page: 'audiences' | 'questions', personaId?: string): void {
    if (!pickerOpen) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    callbacks.onOpen();
    pickerQuery = '';
    if (page === 'audiences') {
      view = { kind: 'audiences', selection: selected() };
    } else {
      const persona = personaFor(personaId ?? '');
      view = { kind: 'questions', selection: selected(), personaId: personaId ?? '', audienceId: personaAudience(persona) };
    }
    renderPicker();
    setPickerOpen(true, false);
    focusPickerHeading();
  }

  function closePicker(restoreFocus = true): void {
    if (!pickerOpen) return;
    const route = selected();
    view = route ? { kind: 'rail', selection: route } : { kind: 'closed', selection: null };
    setPickerOpen(false, restoreFocus);
  }

  function startQuestion(personaId: string, questionId: string): void {
    const question = questionFor(personaId, questionId);
    if (!data || !question) return;
    const firstAvailable = question.steps.findIndex(step => articlesById.has(step.articleId));
    if (firstAvailable < 0) {
      renderPickerMessage(words('unavailableQuestion'));
      return;
    }
    const selection: SelectedJourney = { bookId: data.bookId, personaId, questionId, stepIndex: firstAvailable };
    view = { kind: 'rail', selection };
    setPickerOpen(false, false);
    callbacks.onFocusArticle(question.steps[firstAvailable].articleId);
    renderRail();
    focusRailHeading();
  }

  function renderPickerMessage(message: string): void {
    const body = picker.querySelector<HTMLElement>('.journey-picker-body');
    if (!body) return;
    let feedback = body.querySelector<HTMLElement>('.journey-picker-feedback');
    if (!feedback) {
      feedback = document.createElement('p');
      feedback.className = 'journey-picker-feedback journey-inline-message';
      feedback.setAttribute('role', 'status');
      body.append(feedback);
    }
    feedback.textContent = message;
  }

  function renderEmptyPicker(): string {
    const notice = data ? localized(data.notice) : words('noData');
    const title = data ? words('emptyTitle') : words('noData');
    return `<section class="journey-empty-state" aria-labelledby="journey-empty-title">
      <h3 id="journey-empty-title">${html(title)}</h3>
      <p>${html(notice || words('emptyNotice'))}</p>
      <div class="journey-empty-actions">
        <button class="journey-secondary-button" type="button" data-action="browse-articles">${html(words('browseArticles'))}</button>
        <button class="journey-picker-explore" type="button" data-action="free-explore" data-free-explore="true">${html(words('freeExplore'))}</button>
        <button class="journey-primary-button" type="button" data-action="focus-search">${html(words('searchArticles'))}</button>
      </div>
      <div class="journey-search">
        <label for="journey-search-input">${html(words('searchLabel'))}</label>
        <input id="journey-search-input" data-journey-search type="search" placeholder="${html(words('searchPlaceholder'))}" value="${html(pickerQuery)}" autocomplete="off">
        <p class="journey-search-status" role="status" aria-live="polite"></p>
        <div class="journey-search-results"></div>
      </div>
    </section>`;
  }

  function renderPicker(): void {
    const isQuestions = view.kind === 'questions';
    const isRoles = view.kind === 'roles';
    const personaId = view.kind === 'questions' ? view.personaId : '';
    const persona = isQuestions ? personaFor(personaId) : undefined;
    const audienceId = view.kind === 'roles' || view.kind === 'questions' ? view.audienceId : null;
    const audience = audienceId ? audiencesFor().find(value => value.id === audienceId) : undefined;
    const hasRoles = Boolean(data?.personas.length);
    const hasAudiences = audiencesFor().length > 0;
    const heading = isQuestions && persona ? words('questionHeading') : isRoles ? words('roleHeading') : words('audienceHeading');
    const intro = isQuestions && persona
      ? words('questionIntro')
      : isRoles && audience
        ? localized(audience.description)
        : words('audienceIntro');
    let content = '';

    if (!hasRoles || !hasAudiences) {
      content = renderEmptyPicker();
    } else if (isQuestions && persona?.questions.length) {
      content = `<div class="journey-question-context">
          <span class="journey-role-icon" aria-hidden="true">${html(persona.icon)}</span>
          <div><p class="journey-context-title">${html(localized(persona.title))}</p><p>${html(localized(persona.description))}</p></div>
        </div>
        <button class="journey-primary-button journey-first-question" type="button" data-action="first-question" data-skip-question="true">${html(words('firstQuestion'))}<span aria-hidden="true">↗</span></button>
        <div class="journey-question-grid">${persona.questions.map(question => `<button class="journey-question-choice" type="button" data-action="choose-question" data-role="${html(persona.id)}" data-question="${html(question.id)}">
          <span class="journey-question-mark" aria-hidden="true">↗</span><strong>${html(localized(question.title))}</strong><span>${html(localized(question.why))}</span><small>${html(language === 'zh' ? '從這個問題開始' : 'Start with this question')}</small>
        </button>`).join('')}</div>`;
    } else if (isRoles && audience) {
      const roles = data?.personas.filter(role => role.audienceId === audience.id) ?? [];
      content = `<div class="journey-role-group"><span aria-hidden="true">${html(audience.icon)}</span><strong>${html(localized(audience.title))}</strong></div>
        ${roles.length ? `<div class="journey-role-grid">${roles.map(persona => `<button class="journey-role-choice" type="button" data-action="choose-role" data-role="${html(persona.id)}" data-audience="${html(audience.id)}">
        <span class="journey-role-icon" aria-hidden="true">${html(persona.icon)}</span><span class="journey-role-copy"><strong>${html(localized(persona.title))}</strong><span>${html(localized(persona.description))}</span></span><span class="journey-role-arrow" aria-hidden="true">↗</span>
      </button>`).join('')}</div>` : `<p class="journey-inline-message">${html(words('emptyNotice'))}</p>`}`;
    } else if (hasAudiences) {
      content = `<div class="journey-audience-grid">${audiencesFor().map(item => `<button class="journey-audience-choice" type="button" data-action="choose-audience" data-audience="${html(item.id)}">
        <span class="journey-audience-icon" aria-hidden="true">${html(item.icon)}</span>
        <span class="journey-audience-copy"><strong>${html(localized(item.title))}</strong><span>${html(localized(item.description))}</span></span>
        <span class="journey-role-arrow" aria-hidden="true">↗</span>
      </button>`).join('')}</div>`;
    } else {
      content = renderEmptyPicker();
    }

    const pickerActions = hasRoles && hasAudiences ? `<nav class="journey-picker-actions" aria-label="${html(language === 'zh' ? '其他閱讀方式' : 'Other ways to read')}">
      <button class="journey-picker-explore" type="button" data-action="free-explore" data-free-explore="true">${html(words('freeExplore'))}</button>
      <button class="journey-picker-browse" type="button" data-action="browse-articles">${html(words('browseArticles'))}<span aria-hidden="true">↗</span></button>
    </nav>` : '';
    picker.innerHTML = `<section class="journey-picker">
      <header class="journey-picker-header">
        <div><p class="journey-picker-kicker">${html(words('pickerLabel'))}</p><h2 id="journey-picker-title" tabindex="-1">${html(heading)}</h2><p id="journey-picker-description">${html(isQuestions && persona ? localized(persona.description) : intro)}</p></div>
        <button class="journey-picker-close" type="button" data-action="close-picker" aria-label="${html(words('closePicker'))}">×</button>
        ${isQuestions ? `<button class="journey-back-button" type="button" data-action="back-roles">${html(words('backRoles'))}</button>` : ''}
        ${isRoles ? `<button class="journey-back-button" type="button" data-action="back-audiences" data-change-role="true">${html(words('backAudiences'))}</button>` : ''}
      </header>
      ${hasRoles ? `<p class="journey-editorial-note">${html(localized(data?.notice))}</p>` : ''}
      <div class="journey-picker-body">${content}</div>
      ${isQuestions && persona ? `<footer class="journey-picker-footer"><span>${html(localized(persona.title))}</span><span>${html(`${persona.questions.length} ${language === 'zh' ? '個閱讀問題' : 'questions'}`)}</span></footer>` : ''}
      ${pickerActions}
    </section>`;
    picker.setAttribute('aria-labelledby', 'journey-picker-title');
    picker.setAttribute('aria-describedby', 'journey-picker-description');
    renderSearchResults();
  }

  function renderSearchResults(): void {
    const resultHost = picker.querySelector<HTMLElement>('.journey-search-results');
    const status = picker.querySelector<HTMLElement>('.journey-search-status');
    if (!resultHost || !status) return;
    const query = pickerQuery.trim().toLocaleLowerCase(language === 'zh' ? 'zh-Hant' : 'en');
    if (!query) {
      status.textContent = words('searchHint');
      resultHost.innerHTML = '';
      return;
    }
    const matches = articles.filter(article => [article.title, article.authors, article.summary].join(' ').toLocaleLowerCase(language === 'zh' ? 'zh-Hant' : 'en').includes(query)).slice(0, 8);
    status.textContent = matches.length ? words('resultCount').replace('{count}', String(matches.length)) : (articles.length ? words('noResults') : words('noArticles'));
    resultHost.innerHTML = matches.map(article => `<button class="journey-search-result" type="button" data-action="read-search-result" data-article="${html(article.id)}" data-read-article="${html(article.id)}">
      <span class="journey-search-result-meta">${html(words('articleOrder').replace('{order}', String(article.order).padStart(2, '0')))} <span>${html(words('minutes').replace('{minutes}', String(article.minutes)))}</span></span>
      <strong>${html(article.title)}</strong><span>${html(article.summary)}</span>
    </button>`).join('');
  }

  function connectionLabel(kind: JourneyConnectionKind): string {
    switch (kind) {
      case 'complement': return words('complement');
      case 'tradeoff': return words('tradeoff');
      case 'context': return words('context');
      default: return '';
    }
  }

  function stepName(step: JourneyStep, index: number): string {
    const title = articlesById.get(step.articleId)?.title ?? words('missingArticle');
    const read = completed.has(step.articleId) ? words('stepComplete') : '';
    return words('stepLabel').replace('{step}', String(index + 1)).replace('{title}', title) + read;
  }

  function renderRail(): void {
    if (!active || view.kind !== 'rail') {
      root.innerHTML = '';
      return;
    }
    if (pickerOpen) return;
    const selection = view.selection;
    const persona = personaFor(selection.personaId);
    const question = questionFor(selection.personaId, selection.questionId);
    const step = question?.steps[selection.stepIndex];
    if (!persona || !question || !step) {
      root.innerHTML = '';
      return;
    }
    const article = articlesById.get(step.articleId);
    const hasNext = selection.stepIndex + 1 < question.steps.length;
    const markers = question.steps.map((journeyStep, index) => {
      const isComplete = completed.has(journeyStep.articleId);
      const isCurrent = index === selection.stepIndex;
      const label = stepName(journeyStep, index);
      return `<button class="journey-step-marker${isCurrent ? ' is-current' : ''}${isComplete ? ' is-complete' : ''}" type="button" data-action="choose-step" data-step="${index}" aria-label="${html(label)}" aria-current="${isCurrent ? 'step' : 'false'}">
        <span class="journey-step-number">${String(index + 1).padStart(2, '0')}</span><span class="journey-step-check" aria-hidden="true">${isComplete ? '✓' : ''}</span>
      </button>`;
    }).join('');
    const otherViews = question.steps.map((journeyStep, index) => {
      if (index === selection.stepIndex) return '';
      const linkedArticle = articlesById.get(journeyStep.articleId);
      if (!linkedArticle) return '';
      const relation = journeyStep.connection ? connectionLabel(journeyStep.connection.kind) : '';
      const explanation = localized(journeyStep.connection?.explanation ?? journeyStep.reason);
      return `<button class="journey-other-view" type="button" data-action="choose-step" data-step="${index}">
        <span>${html(`${words('editorialGuide')} · ${relation || words('articleOrder').replace('{order}', String(linkedArticle.order).padStart(2, '0'))}`)}</span><strong>${html(linkedArticle.title)}</strong><small>${html(explanation)}</small><small>${html(words('minutes').replace('{minutes}', String(linkedArticle.minutes)))}</small>
      </button>`;
    }).join('');
    const relationship = step.connection ? `<div class="journey-connection journey-connection-${html(step.connection.kind)}"><span>${html(`${words('editorialGuide')} · ${connectionLabel(step.connection.kind)}`)}</span><p>${html(localized(step.connection.explanation))}</p></div>` : '';

    root.innerHTML = `<aside class="journey-rail" aria-labelledby="journey-rail-title">
      <header class="journey-rail-header">
        <div><p class="journey-rail-kicker">${html(words('railLabel'))}</p><p class="journey-rail-persona">${html(localized(persona.title))}</p></div>
        <div class="journey-rail-actions">
          <button class="journey-rail-action" type="button" data-action="change-question" data-change-role="true" aria-label="${html(words('switchQuestion'))}">${html(words('switchQuestion'))}</button>
          <button class="journey-rail-close" type="button" data-action="free-explore" data-free-explore="true" aria-label="${html(words('closeRail'))}">×</button>
        </div>
      </header>
      <div class="journey-rail-content">
        <h2 id="journey-rail-title" tabindex="-1">${html(localized(question.title))}</h2>
        <div class="journey-step-markers" aria-label="${html(words('routeCount').replace('{current}', String(selection.stepIndex + 1)).replace('{total}', String(question.steps.length)))}">${markers}</div>
        <section class="journey-current-step" data-step-current="${selection.stepIndex}">
          <div class="journey-reason-block"><span>${html(words('reasonLabel'))}</span><p>${html(localized(step.reason))}</p></div>
          ${relationship}
          ${article ? `<article class="journey-article-card" data-article-id="${html(article.id)}">
            <p class="journey-article-meta">${html(words('articleOrder').replace('{order}', String(article.order).padStart(2, '0')))} <span>${html(words('minutes').replace('{minutes}', String(article.minutes)))}</span></p>
            <h3>${html(article.title)}</h3>
            <div class="journey-insight"><span>${html(words('articleLabel'))}</span><p>${html(article.summary)}</p></div>
          </article>` : `<p class="journey-inline-message" role="status">${html(words('missingArticle'))}</p>`}
          ${selection.stepIndex === question.steps.length - 1 ? `<p class="journey-reflection">${html(words('reflection'))}</p>` : ''}
          ${otherViews ? `<details class="journey-other-views"><summary>${html(words('otherViews'))}</summary><div>${otherViews}</div></details>` : ''}
        </section>
      </div>
      <footer class="journey-rail-footer">
        <button class="journey-primary-button" type="button" data-action="read-current" data-read-article="${html(article?.id ?? '')}" ${article ? '' : 'disabled'}>${html(words('readArticle'))}<span aria-hidden="true">↗</span></button>
        ${hasNext ? `<button class="journey-next-button" type="button" data-action="advance">${html(completed.has(step.articleId) ? words('nextView') : words('skipNext'))}<span aria-hidden="true">→</span></button>` : `<p class="journey-last-step">${html(words('lastStep'))}</p><button class="journey-next-button" type="button" data-action="change-question">${html(words('chooseQuestion'))}</button>`}
      </footer>
    </aside>`;
  }

  function focusSearch(): void {
    picker.querySelector<HTMLInputElement>('[data-journey-search]')?.focus({ preventScroll: true });
  }

  function handleClick(event: MouseEvent): void {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLElement>('[data-action]');
    if (!button) return;
    const action = button.dataset.action;

    if (action === 'close-picker') { closePicker(); return; }
    if (action === 'back-roles' && view.kind === 'questions') {
      view = view.audienceId
        ? { kind: 'roles', selection: view.selection, audienceId: view.audienceId }
        : { kind: 'audiences', selection: view.selection };
      renderPicker(); focusPickerHeading(); return;
    }
    if (action === 'back-audiences' && view.kind === 'roles') {
      view = { kind: 'audiences', selection: view.selection };
      renderPicker(); focusPickerHeading(); return;
    }
    if (action === 'choose-audience') {
      const audienceId = button.dataset.audience as AudienceId | undefined;
      if (!audienceId || !audiencesFor().some(audience => audience.id === audienceId)) return;
      view = { kind: 'roles', selection: selected(), audienceId };
      renderPicker(); focusPickerHeading(); return;
    }
    if (action === 'choose-role') {
      const personaId = button.dataset.role;
      const persona = personaFor(personaId ?? '');
      if (!persona) return;
      view = { kind: 'questions', selection: selected(), personaId: persona.id, audienceId: persona.audienceId };
      renderPicker(); focusPickerHeading(); return;
    }
    if (action === 'first-question' && view.kind === 'questions') {
      const question = personaFor(view.personaId)?.questions[0];
      if (question) startQuestion(view.personaId, question.id);
      return;
    }
    if (action === 'choose-question') {
      const personaId = button.dataset.role ?? (view.kind === 'questions' ? view.personaId : '');
      const questionId = button.dataset.question;
      if (personaId && questionId) startQuestion(personaId, questionId);
      return;
    }
    if (action === 'free-explore') {
      view = { kind: 'closed', selection: null };
      if (pickerOpen) setPickerOpen(false, false);
      renderRail();
      callbacks.onFreeExplore();
      return;
    }
    if (action === 'browse-articles') {
      view = { kind: 'closed', selection: null };
      if (pickerOpen) setPickerOpen(false, false);
      renderRail();
      callbacks.onBrowseArticles();
      return;
    }
    if (action === 'focus-search') { focusSearch(); return; }
    if (action === 'read-search-result') {
      const article = articlesById.get(button.dataset.article ?? '');
      if (!article) return;
      view = { kind: 'closed', selection: null };
      setPickerOpen(false, false);
      callbacks.onFocusArticle(article.id);
      callbacks.onReadArticle(article.id);
      return;
    }
    if (action === 'change-question') {
      const route = selected();
      if (route) openPicker('questions', route.personaId);
      return;
    }
    if (action === 'choose-step') {
      const route = selected();
      const nextIndex = Number(button.dataset.step);
      const question = route && questionFor(route.personaId, route.questionId);
      const step = Number.isInteger(nextIndex) ? question?.steps[nextIndex] : undefined;
      if (!route || !step || !articlesById.has(step.articleId)) return;
      view = { kind: 'rail', selection: { ...route, stepIndex: nextIndex } };
      renderRail();
      callbacks.onFocusArticle(step.articleId);
      focusRailHeading();
      return;
    }
    if (action === 'read-current') {
      const route = selected();
      const question = route && questionFor(route.personaId, route.questionId);
      const articleId = route && question?.steps[route.stepIndex]?.articleId;
      if (articleId && articlesById.has(articleId)) callbacks.onReadArticle(articleId);
      return;
    }
    if (action === 'advance') { advance(); return; }
  }

  function handleInput(event: Event): void {
    if (!(event.target instanceof HTMLInputElement) || !event.target.matches('[data-journey-search]')) return;
    pickerQuery = event.target.value;
    renderSearchResults();
  }

  function advance(): void {
    const route = selected();
    const question = route && questionFor(route.personaId, route.questionId);
    const nextIndex = route ? route.stepIndex + 1 : -1;
    const nextStep = nextIndex >= 0 ? question?.steps[nextIndex] : undefined;
    if (!route || !nextStep || !articlesById.has(nextStep.articleId)) return;
    view = { kind: 'rail', selection: { ...route, stepIndex: nextIndex } };
    renderRail();
    callbacks.onFocusArticle(nextStep.articleId);
    if (!pickerOpen) focusRailHeading();
  }

  function getContext(id: string): ReadingJourneyContext | null {
    const route = selected();
    if (!route || !data || route.bookId !== data.bookId) return null;
    const persona = personaFor(route.personaId);
    const question = questionFor(route.personaId, route.questionId);
    const index = question?.steps.findIndex(step => step.articleId === id) ?? -1;
    if (!persona || !question || index < 0) return null;
    const next = question.steps[index + 1];
    const availableNext = next && articlesById.has(next.articleId) ? next : undefined;
    const nextReason = availableNext
      ? localized(availableNext.connection?.explanation ?? availableNext.reason)
      : null;
    return {
      personaTitle: localized(persona.title),
      questionTitle: localized(question.title),
      stepIndex: index,
      total: question.steps.length,
      nextArticleId: availableNext?.articleId ?? null,
      nextReason,
    };
  }

  function syncArticle(id: string): void {
    const route = selected();
    const question = route && questionFor(route.personaId, route.questionId);
    const index = question?.steps.findIndex(step => step.articleId === id) ?? -1;
    if (!route || !question || index < 0 || index === route.stepIndex) return;
    view = { kind: 'rail', selection: { ...route, stepIndex: index } };
    renderRail();
  }

  root.addEventListener('click', handleClick);
  picker.addEventListener('click', event => {
    if (event.target === picker) closePicker();
    else handleClick(event);
  });
  picker.addEventListener('input', handleInput);
  picker.addEventListener('cancel', event => {
    event.preventDefault();
    closePicker();
  });

  return {
    setData(nextData, nextArticles) {
      const changedBook = data !== null && data.bookId !== nextData.bookId;
      data = nextData;
      articles = nextArticles;
      articlesById = new Map(nextArticles.map(article => [article.id, article]));
      const route = selected();
      const question = route && questionFor(route.personaId, route.questionId);
      const currentStep = route && question?.steps[route.stepIndex];
      if (changedBook || (route && (!personaFor(route.personaId) || !question || !currentStep || !articlesById.has(currentStep.articleId)))) setSelection(null);
      if (pickerOpen) renderPicker();
      renderRail();
    },
    setCompleted(ids) {
      const next = new Set(ids);
      if (next.size === completed.size && [...next].every(id => completed.has(id))) return;
      completed = next;
      for (const marker of root.querySelectorAll<HTMLElement>('.journey-step-marker[data-step]')) {
        const route = selected();
        const stepIndex = Number(marker.dataset.step);
        const question = route && questionFor(route.personaId, route.questionId);
        const step = Number.isInteger(stepIndex) ? question?.steps[stepIndex] : undefined;
        if (!step) continue;
        const isComplete = completed.has(step.articleId);
        marker.classList.toggle('is-complete', isComplete);
        const check = marker.querySelector<HTMLElement>('.journey-step-check');
        if (check) check.textContent = isComplete ? '✓' : '';
        marker.setAttribute('aria-label', stepName(step, stepIndex));
      }
      const route = selected();
      const step = route && questionFor(route.personaId, route.questionId)?.steps[route.stepIndex];
      const nextLabel = root.querySelector<HTMLElement>('.journey-next-button');
      if (step && nextLabel && route) {
        const question = questionFor(route.personaId, route.questionId);
        if (route.stepIndex + 1 < (question?.steps.length ?? 0)) {
          const text = completed.has(step.articleId) ? words('nextView') : words('skipNext');
          nextLabel.firstChild && (nextLabel.firstChild.textContent = text);
        }
      }
    },
    setActive(nextActive) {
      active = nextActive;
      if (!active && pickerOpen) closePicker(false);
      root.hidden = !active;
      renderRail();
    },
    showPicker() {
      openPicker('audiences');
    },
    getNextArticle(id) {
      return getContext(id)?.nextArticleId ?? null;
    },
    getContext,
    syncArticle,
    advance,
    dispose() {
      if (picker.open) picker.close();
      pickerOpen = false;
      root.removeEventListener('click', handleClick);
      picker.removeEventListener('click', handleClick);
      picker.removeEventListener('input', handleInput);
      root.remove();
      picker.remove();
    },
  };
}

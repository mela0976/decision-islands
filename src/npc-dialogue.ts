import type { Article } from './types';
import type { ExplorerData, ExplorerNpc, I18nText } from './explorer-types';
import {
  NPC_ARTICLE_SCENARIOS,
  NPC_DIALOGUE_ROLE_IDS,
  NPC_ROLE_SCENARIOS,
  NPC_SCENARIO_BOOK_TITLE,
  type NpcArticleScenario,
  type NpcDialogueRoleId,
  type NpcRoleScenario,
} from './npc-scenarios.ts';
export { NPC_DIALOGUE_ROLE_IDS, type NpcDialogueRoleId };

export type NpcQuestionId = 'summary' | 'highlight' | 'source';
export type NpcDialogueLanguage = 'zh' | 'en';
export interface NpcDialogueQuestion {
  id: NpcQuestionId;
  label: I18nText;
}

export interface NpcDialogueProfile {
  roleTitle: string;
  roleColor: string | null;
  greeting: string;
  topics: readonly Article[];
  moreArticles: readonly Article[];
}

export interface NpcSituation {
  opening: string;
  scene: string;
}

interface RoleVoice {
  opening: I18nText;
  activity: I18nText;
  application: I18nText;
  check: I18nText;
  greeting: I18nText;
}

interface LocalizedRoleVoice {
  opening: string;
  activity: string;
  application: string;
  check: string;
  greeting: string;
}

interface LocalizedRoleScenario {
  situation: string;
  action: string;
  cost: string;
}

const QUESTIONS: readonly NpcDialogueQuestion[] = [
  { id: 'summary', label: { zh: '你遇到什麼狀況？', en: 'What situation are you facing?' } },
  { id: 'highlight', label: { zh: '你會怎麼做？', en: 'What would you try?' } },
  { id: 'source', label: { zh: '這跟文章哪個觀點有關？', en: 'Which idea from the article connects to this?' } },
];

const ROLE_VOICES: Readonly<Record<NpcDialogueRoleId, RoleVoice>> = {
  curator: {
    opening: { zh: '我正替展覽整理導讀，想找一個能讓讀者開口的問題。', en: 'I am shaping an exhibition guide around a question visitors can discuss.' },
    activity: { zh: '替讀者準備展覽導讀', en: 'preparing an exhibition guide for visitors' },
    application: { zh: '把它改寫成讀者能討論的問題，並說明這是我的讀法', en: 'turn it into a question visitors can discuss and label it as my reading' },
    check: { zh: '核對全文脈絡，避免把本站整理當成作者原話', en: 'check the full article so I do not present a site note as the author’s words' },
    greeting: { zh: '我是策展員。我想從讀者會遇到的問題開始聊。', en: 'I am the curator. I like to start with a question visitors might actually face.' },
  },
  researcher: {
    opening: { zh: '我在整理研究簡報，會先分清哪些是證據、哪些還是推測。', en: 'I am preparing a research memo and separating evidence from hypotheses.' },
    activity: { zh: '把一個說法寫進研究簡報', en: 'putting a claim into a research memo' },
    application: { zh: '把文章論點和可查證的資料分開標示', en: 'separate the article’s argument from evidence I can verify' },
    check: { zh: '核對原始來源、反例和樣本範圍', en: 'check primary sources, counterexamples, and sample coverage' },
    greeting: { zh: '我是研究者。我會把觀點、證據和資料限制分開看。', en: 'I am a researcher. I keep viewpoints, evidence, and data limits distinct.' },
  },
  reader: {
    opening: { zh: '我想把讀到的想法帶到社區讀書會，聽聽大家的生活經驗。', en: 'I want to bring this idea to a neighborhood reading group and hear people’s experiences.' },
    activity: { zh: '在社區讀書會聊一個生活選擇', en: 'discussing an everyday choice at a neighborhood reading group' },
    application: { zh: '拿一個日常例子和不同看法對照，不把文章直接當成通則', en: 'compare an everyday example and other views instead of treating the article as a rule' },
    check: { zh: '確認它是否符合我的經驗，也聽聽不同世代的看法', en: 'see whether it fits my experience and hear views from other generations' },
    greeting: { zh: '我是長者讀者。我喜歡把文章的想法帶回日常生活裡想一想。', en: 'I am a senior reader. I like to bring an article’s ideas back to everyday life.' },
  },
  student: {
    opening: { zh: '我在做課堂專題，想讓結論有自己的觀察和資料來源。', en: 'I am working on a class project and want my conclusions to include my own observations and sources.' },
    activity: { zh: '完成一份課堂專題', en: 'working on a class project' },
    application: { zh: '用課堂資料做一個小型驗證，並列出文章和資料來源', en: 'run a small check with class material and cite the article and data' },
    check: { zh: '標出哪些是資料、哪些是自己的觀察', en: 'mark which parts are evidence and which are my own observations' },
    greeting: { zh: '我是學生。我會先弄懂問題，再把資料和自己的想法分開。', en: 'I am a student. I first make sense of the question, then separate sources from my own view.' },
  },
  parent: {
    opening: { zh: '我正和孩子討論一項家庭安排，想先弄清楚彼此在意什麼。', en: 'I am discussing a family plan with my child and want to hear what matters to each of us.' },
    activity: { zh: '和孩子討論家庭安排', en: 'talking through a family plan with my child' },
    application: { zh: '先問孩子真正想解決什麼，再談家裡可以接受的界線', en: 'ask what my child is trying to solve before agreeing on boundaries for our family' },
    check: { zh: '確認孩子的需要、安全和家裡都能接受的範圍', en: 'check my child’s needs, safety, and boundaries the family can accept' },
    greeting: { zh: '我是家長。我喜歡先聽孩子怎麼看，再一起找做法。', en: 'I am a parent. I like to hear my child’s view before working out what to do.' },
  },
  cyclist: {
    opening: { zh: '我在規劃一趟自行車路線，會先看路況和能不能安全折返。', en: 'I am planning a cycling route and checking road conditions and safe ways back.' },
    activity: { zh: '規劃一趟自行車路線', en: 'planning a cycling route' },
    application: { zh: '先用熟悉的短程試一遍，再核對路況、天氣並保留安全備案', en: 'try it on a familiar short ride, check road and weather conditions, and keep a safe backup' },
    check: { zh: '確認路況、天氣與實際路面，不把導航建議當成保證', en: 'check road conditions, weather, and the actual route instead of treating navigation as a guarantee' },
    greeting: { zh: '我是騎車的人。我會把路線建議和實際路況一起看。', en: 'I ride a bicycle. I weigh route suggestions against the road itself.' },
  },
  gardener: {
    opening: { zh: '我在照料一小塊花圃，想先觀察土壤和植株再動手。', en: 'I am tending a small garden plot and want to observe the soil and plants before acting.' },
    activity: { zh: '安排一小塊花圃的照護', en: 'planning care for a small garden plot' },
    application: { zh: '先在小區域試做，記下土壤、天氣和植株的實際反應', en: 'try it in one small area and record the soil, weather, and how the plants respond' },
    check: { zh: '記錄季節和土壤條件，別把一處的結果當成整座花園的答案', en: 'track season and soil conditions instead of treating one patch as the whole garden' },
    greeting: { zh: '我是園丁。我會先小範圍試做，再看植物實際怎麼反應。', en: 'I am a gardener. I try things on a small patch and watch how the plants respond.' },
  },
  worker: {
    opening: { zh: '我和同事正在調整工作流程，得先說清楚資料和責任由誰負責。', en: 'My team is changing a work process, so we need clear data boundaries and ownership.' },
    activity: { zh: '和同事調整工作流程', en: 'changing a work process with colleagues' },
    application: { zh: '先做小規模試辦，說清楚資料權限、負責人和回報方式', en: 'run a small pilot with clear data permissions, an owner, and a feedback route' },
    check: { zh: '確認資料使用範圍、執行責任人和實際影響', en: 'check data permissions, ownership, and real effects' },
    greeting: { zh: '我是工作者。我會先和受影響的同事確認流程怎麼落地。', en: 'I work on a team. I check with the colleagues affected before changing a process.' },
  },
  traveler: {
    opening: { zh: '我在規劃一趟行程，會把時間、預算和臨時變動都算進去。', en: 'I am planning a trip and accounting for time, budget, and last-minute changes.' },
    activity: { zh: '安排一趟行程和交通', en: 'planning a trip and its transportation' },
    application: { zh: '先用可取消或不出票的方案試排，再確認交通、營業時間和取消規則', en: 'test an itinerary without a non-refundable booking, then check transit, opening hours, and cancellation rules' },
    check: { zh: '核對官方交通資訊、營業時間與取消限制', en: 'check official transit information, opening hours, and cancellation terms' },
    greeting: { zh: '我是旅人。我喜歡先排好路線，也留一個可以轉彎的備案。', en: 'I travel with a plan and leave room for a change of route.' },
  },
};

const UNKNOWN_ROLE: RoleVoice = {
  opening: { zh: '我先從目前文章和手邊情境說起。', en: 'I will start with the current article and the situation at hand.' },
  activity: { zh: '處理目前這個決定', en: 'working through the decision at hand' },
  application: { zh: '把這項說法當成待核對的想法，再查目前資料和原文', en: 'treat the claim as something to check against current information and the article' },
  check: { zh: '核對原文和實際資料', en: 'check the article and available evidence' },
  greeting: { zh: '我們可以一起從目前文章的資料和情境開始。', en: 'We can start with the current article and situation.' },
};

export function getNpcDialogueQuestions(language: NpcDialogueLanguage): readonly { id: NpcQuestionId; label: string }[] {
  return QUESTIONS.map(question => ({ id: question.id, label: question.label[language] }));
}

export function buildNpcDialogueProfile(data: ExplorerData, npc: ExplorerNpc, language: NpcDialogueLanguage): NpcDialogueProfile {
  const role = data.roles.find(value => value.id === npc.roleId);
  const assignedIds = npc.articleIds;
  const flow = npc.flowId ? data.flows.find(value => value.id === npc.flowId) : undefined;
  const topicIds = [...assignedIds, ...(flow?.articleIds ?? [])];
  const included = new Set<string>();
  const orderedTopics = topicIds.flatMap(id => {
    if (included.has(id)) return [];
    const article = data.articles.find(value => value.id === id);
    if (!article) return [];
    included.add(id);
    return [article];
  });
  const topics = orderedTopics.slice(0, 3);
  const topicIdsToBrowse = new Set(topics.map(article => article.id));
  const roleTitle = role?.title[language] ?? (npc.roleId || (language === 'zh' ? '閱讀夥伴' : 'Reading companion'));
  const knownVoice = ROLE_VOICES[npc.roleId as NpcDialogueRoleId];
  const greeting = knownVoice?.greeting[language]
    ?? (language === 'zh'
      ? `我是${roleTitle}。我們可以從目前文章和眼前情境開始聊。`
      : `I am ${roleTitle}. We can start with the current article and situation.`);

  return {
    roleTitle,
    roleColor: role?.color ?? null,
    greeting,
    topics,
    moreArticles: data.articles.filter(article => !topicIdsToBrowse.has(article.id)),
  };
}

export function getNpcSituation(
  article: Article,
  roleId: string,
  language: NpcDialogueLanguage,
  bookTitle?: string,
): NpcSituation {
  const voice = getRoleVoice(roleId, language);
  const scenario = findScenario(article, bookTitle);
  if (scenario) {
    const roleScenario = getRoleScenario(roleId, scenario.family, language);
    return {
      opening: language === 'zh'
        ? `${roleScenario.situation}本站整理的文章線索「${scenario.anchor.zh}」，讓我想到這個觀點：${scenario.point.zh}。`
        : `${roleScenario.situation} The site’s reading note points to “${scenario.anchor.en}”; I connect it to this idea: ${scenario.point.en}.`,
      scene: language === 'zh'
        ? `我會${roleScenario.action}，把「${scenario.point.zh}」用在眼前這件事上。這是我的情境示例，代價是${roleScenario.cost}；不是作者報導的案例。`
        : `I would ${roleScenario.action}, applying “${scenario.point.en}” to this situation. This is my illustrative scenario, and the cost is ${roleScenario.cost}; it is not a case reported by the author.`,
    };
  }

  const basis = articleEvidence(article);
  return {
    opening: voice.opening,
    scene: language === 'zh'
      ? basis
        ? `目前摘要或整理重點只告訴我：「${basis}」。我會${voice.application}，再核對原文脈絡。這是我依目前資料想出的情境示例，不是作者報導的案例。`
        : `目前資料沒有提供摘要或延伸重點，還不能確認文章主張。我會${voice.application}，等有原文資料再判斷。`
      : basis
        ? `The current summary or reading note only tells me: “${basis}.” I would ${voice.application}, then check the article’s context. This is an illustrative scenario from ${voice.activity}, not a case reported by the author.`
        : `The current material has no summary or reading note, so I cannot confirm the article’s claim yet. I would ${voice.application} and wait for the article text before deciding.`,
  };
}

export function createNpcReply(
  article: Article,
  questionId: NpcQuestionId,
  language: NpcDialogueLanguage,
  roleId = 'reader',
  bookTitle?: string,
): string {
  const scenario = findScenario(article, bookTitle);
  if (scenario) return createScenarioReply(article, scenario, questionId, roleId, language);
  return createEvidenceReply(article, questionId, getRoleVoice(roleId, language), language);
}

function findScenario(article: Article, bookTitle?: string): NpcArticleScenario | undefined {
  if (bookTitle !== NPC_SCENARIO_BOOK_TITLE) return undefined;
  return NPC_ARTICLE_SCENARIOS.find(value => value.articleId === article.id && value.expectedTitle === article.title);
}

function getRoleVoice(roleId: string, language: NpcDialogueLanguage): LocalizedRoleVoice {
  const voice = ROLE_VOICES[roleId as NpcDialogueRoleId] ?? UNKNOWN_ROLE;
  return {
    opening: voice.opening[language],
    activity: voice.activity[language],
    application: voice.application[language],
    check: voice.check[language],
    greeting: voice.greeting[language],
  };
}

function getRoleScenario(roleId: string, family: NpcArticleScenario['family'], language: NpcDialogueLanguage): LocalizedRoleScenario {
  const role = (NPC_DIALOGUE_ROLE_IDS as readonly string[]).includes(roleId)
    ? roleId as NpcDialogueRoleId
    : 'reader';
  const scenario: NpcRoleScenario = NPC_ROLE_SCENARIOS[role][family];
  return {
    situation: scenario.situation[language],
    action: scenario.action[language],
    cost: scenario.cost[language],
  };
}

function createScenarioReply(
  article: Article,
  scenario: NpcArticleScenario,
  questionId: NpcQuestionId,
  roleId: string,
  language: NpcDialogueLanguage,
): string {
  const roleScenario = getRoleScenario(roleId, scenario.family, language);
  const author = article.authors.trim() || (language === 'zh' ? '作者未列出' : 'Author not listed');
  const pages = sourcePages(article, language);
  const source = language === 'zh'
    ? `作者為${author}，收錄於 ${article.year} 年刊${pages}。`
    : `It is by ${author}, in the ${article.year} edition${pages}.`;

  if (questionId === 'highlight') {
    return language === 'zh'
      ? `我會把本站整理的「${scenario.point.zh}」帶進這個情境。遇到這件事，我會${roleScenario.action}。代價是${roleScenario.cost}。這是我的應用示例，不是文章報導的案例。`
      : `I would apply the site’s reading note that ${scenario.point.en}. In this situation, I would ${roleScenario.action}. The cost is ${roleScenario.cost}. This is my application, not a case reported by the article.`;
  }

  if (questionId === 'source') {
    return language === 'zh'
      ? `《${article.title}》的整理線索「${scenario.anchor.zh}」讓我想到「${scenario.issue.zh}」，我把觀點理解為：${scenario.point.zh}。${source}放進我的情境，我會${roleScenario.action}，可能付出${roleScenario.cost}；若把這個觀點用在這裡，也要接受${scenario.tradeoff.zh}。這是我的應用示例，不是作者報導的案例。`
      : `The site’s reading note for “${article.title}” points to ${scenario.anchor.en}; I connect it to ${scenario.issue.en} and understand the idea as ${scenario.point.en}. ${source}In my situation, I would ${roleScenario.action}, at the cost of ${roleScenario.cost}; applying the idea here may also mean accepting this tradeoff: ${scenario.tradeoff.en}. This is my application, not a case reported by the article.`;
  }

  return language === 'zh'
    ? `${roleScenario.situation}我會把本站整理的觀點「${scenario.point.zh}」帶進來，做法是${roleScenario.action}。這是我的應用示例，不是作者報導的案例。`
    : `${roleScenario.situation} I would apply the site’s reading note that ${scenario.point.en}, and ${roleScenario.action}. This is my application, not a case reported by the author.`;
}

function createEvidenceReply(
  article: Article,
  questionId: NpcQuestionId,
  voice: Pick<LocalizedRoleVoice, 'activity' | 'application' | 'check'>,
  language: NpcDialogueLanguage,
): string {
  const summary = excerpt(article.summary);
  const highlight = firstHighlight(article);
  const author = article.authors.trim() || (language === 'zh' ? '作者未列出' : 'Author not listed');
  const pages = sourcePages(article, language);
  const source = language === 'zh'
    ? `作者為${author}，收錄於 ${article.year} 年刊${pages}。`
    : `It is by ${author}, in the ${article.year} edition${pages}.`;
  const basis = summary || highlight;

  if (questionId === 'highlight') {
    if (!highlight) {
      return language === 'zh'
        ? `目前資料沒有提供本站整理的延伸重點。${summary ? `摘要提到「${summary}」。` : ''}我會${voice.application}，再核對${voice.check}。這是我的情境示例，不是作者報導的案例。`
        : `The current material has no site reading note.${summary ? ` The summary says: “${summary}.”` : ''} I would ${voice.application}, then ${voice.check}. This is an illustrative scenario, not a case reported by the author.`;
    }
    return language === 'zh'
      ? `本站整理的重點提到「${highlight}」。我在${voice.activity}時會${voice.application}。這是我依目前整理內容想出的情境，不是作者報導的案例。`
      : `A site reading note says: “${highlight}.” While ${voice.activity}, I would ${voice.application}, then ${voice.check}. This is an illustrative scenario based on the current notes, not a case reported by the author.`;
  }

  if (questionId === 'source') {
    return language === 'zh'
      ? basis
        ? `我目前只根據這篇摘要或整理重點：「${basis}」來說明文章觀點，還需要回原文確認完整脈絡。${source}我在${voice.activity}時會${voice.application}；這是我的應用示例，不是文章報導的案例。`
        : `目前資料沒有摘要或延伸重點，還不能確認文章觀點。${source}我會先${voice.check}，不替文章補上沒有提供的主張。`
      : basis
        ? `I can only connect the article to its current summary or reading note: “${basis}”; I would need the full text to confirm the context. ${source}For ${voice.activity}, I would ${voice.application}. This is my application of the available material, not a case reported by the article.`
        : `The current material has no summary or reading note, so I cannot confirm the article’s idea yet. ${source}I would ${voice.check} rather than add a claim the material does not provide.`;
  }

  return language === 'zh'
    ? basis
      ? `我在${voice.activity}時，先從目前資料讀到「${basis}」。我會${voice.application}，再核對原文脈絡。這是我的閱讀情境示例，不是作者報導的案例。`
      : `目前資料沒有提供這篇文章的摘要或延伸重點，所以我還不能說清楚它的主張。我會${voice.check}，不猜測作者的意思。`
    : basis
      ? `For ${voice.activity}, the current material says: “${basis}.” I would ${voice.application}, then check the article’s context. This is an illustrative reading scenario, not a case reported by the author.`
      : `The current material has no summary or reading note, so I cannot explain the article’s claim yet. I would ${voice.check} rather than guess what the author means.`;
}

function articleEvidence(article: Article): string {
  return excerpt(article.summary) || firstHighlight(article);
}

function excerpt(text: string): string {
  const cleaned = text.trim().replace(/^【[^】]*】\s*/u, '');
  const firstSentence = cleaned.split(/[。.!?！？]/u, 1)[0]?.trim() ?? cleaned;
  return firstSentence.length > 150 ? `${firstSentence.slice(0, 147).trimEnd()}…` : firstSentence;
}

function firstHighlight(article: Article): string {
  const text = article.highlights.find(value => value.trim())?.trim();
  if (!text) return '';
  const colon = text.search(/[：:]/u);
  const content = colon >= 0 ? text.slice(colon + 1).trim() : text;
  const firstSentence = content.split(/[。.!?！？]/u, 1)[0]?.trim() ?? content;
  return firstSentence.length > 150 ? `${firstSentence.slice(0, 147).trimEnd()}…` : firstSentence;
}

function sourcePages(article: Article, language: NpcDialogueLanguage): string {
  if (!Number.isFinite(article.printedStart) || !Number.isFinite(article.printedEnd)) return '';
  return language === 'zh'
    ? `，原刊頁碼 ${article.printedStart}–${article.printedEnd}`
    : `, pages ${article.printedStart}–${article.printedEnd}`;
}

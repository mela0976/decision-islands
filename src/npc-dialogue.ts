import type { Article } from './types';
import type { ExplorerData, ExplorerNpc, I18nText } from './explorer-types';

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

const QUESTIONS: readonly NpcDialogueQuestion[] = [
  { id: 'summary', label: { zh: '這篇文章談什麼？', en: 'What is this article about?' } },
  { id: 'highlight', label: { zh: '本站整理了哪些重點？', en: 'Which reading notes did the site prepare?' } },
  { id: 'source', label: { zh: '作者與原刊資訊？', en: 'Who wrote it, and where was it published?' } },
];

const ROLE_GREETINGS: Readonly<Record<string, I18nText>> = {
  curator: { zh: '嗨，我是策展員。我陪你從這期文章找閱讀線索。', en: 'Hi, I am the curator. I can help you find reading paths in this edition.' },
  researcher: { zh: '我是研究者。我們可以從文章摘要和來源開始核對。', en: 'I am a researcher. We can start with the article summary and its source.' },
  reader: { zh: '我是長者讀者。我會先從文章裡的日常經驗聊起。', en: 'I am a senior reader. I like to start with everyday experiences in an article.' },
  student: { zh: '我是學生。你想先看看文章提出了什麼問題嗎？', en: 'I am a student. Shall we begin with the question this article raises?' },
  parent: { zh: '我是家長讀者。我們一起從摘要找出可以追問的地方。', en: 'I am a parent reader. We can find follow-up questions in the summary.' },
  cyclist: { zh: '我是騎車讀者。先抓住一個文章重點，再去看原文細節。', en: 'I am a cycling reader. Let us start with one idea, then check the source.' },
  gardener: { zh: '我是園丁讀者。我想看看文章怎麼連起想法與情境。', en: 'I am a gardening reader. I look for links between ideas and situations.' },
  worker: { zh: '我是工作者。我們先讀摘要，再一起核對作者與原文。', en: 'I am a working reader. We can read the summary, then check the author and source.' },
  traveler: { zh: '我是通勤旅人。挑一個主題，我們用一段路的時間聊聊。', en: 'I am a commuting reader. Pick a topic and we can talk during the ride.' },
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
  const greeting = ROLE_GREETINGS[npc.roleId]?.[language]
    ?? (language === 'zh'
      ? `我是${roleTitle}。我們可以從目前文章的網站摘要開始，再打開原文核對脈絡。`
      : `I am ${roleTitle}. We can start with this edition's summary and open the source to check its context.`);

  return {
    roleTitle,
    roleColor: role?.color ?? null,
    greeting,
    topics,
    moreArticles: data.articles.filter(article => !topicIdsToBrowse.has(article.id)),
  };
}

export function createNpcReply(article: Article, questionId: NpcQuestionId, language: NpcDialogueLanguage): string {
  const summary = article.summary.trim();
  const author = article.authors.trim() || (language === 'zh' ? '作者未列出' : 'Author not listed');
  const rawHighlight = article.highlights.find(Boolean)?.trim() ?? '';
  const highlightBody = rawHighlight.includes('：')
    ? rawHighlight.slice(rawHighlight.indexOf('：') + 1)
    : rawHighlight;
  const firstHighlight = highlightBody
    .split(/[。.!?！？]/u, 1)[0]
    .replace(/[「」『』“”"']/gu, '')
    .trim();
  const pages = Number.isFinite(article.printedStart) && Number.isFinite(article.printedEnd)
    ? `p. ${article.printedStart}–${article.printedEnd}`
    : '';
  const summarySentence = summary
    ? (language === 'zh' ? `本站摘要提到：${summary}` : `The site summary says: ${summary}`)
    : (language === 'zh' ? '目前資料沒有提供這篇文章的摘要。' : 'The current edition does not include a summary for this article.');
  const sourceCheck = language === 'zh' ? '你可以開啟原文核對完整脈絡。' : 'Open the source article to check its full context.';

  if (questionId === 'highlight') {
    if (firstHighlight) {
      return language === 'zh'
        ? `本站整理的延伸重點是：${firstHighlight}。這是網站導讀內容，可以打開原文核對脈絡。`
        : `One site reading note is: ${firstHighlight}. Open the source article to check its context.`;
    }
    return `${language === 'zh' ? '目前資料沒有提供本站延伸重點。' : 'The current edition does not include a site reading note.'} ${summarySentence} ${sourceCheck}`;
  }

  if (questionId === 'source') {
    const publication = language === 'zh' ? `收錄於 ${article.year} 年刊` : `published in the ${article.year} edition`;
    const pageText = pages ? (language === 'zh' ? `，原刊頁碼 ${pages}` : `, on pages ${pages}`) : '';
    return `${language === 'zh' ? `《${article.title}》由 ${author} 撰寫，${publication}${pageText}。` : `${article.title} is by ${author}, ${publication}${pageText}.`} ${summarySentence} ${sourceCheck}`;
  }

  const titleSentence = language === 'zh'
    ? `這篇是《${article.title}》，作者為 ${author}。`
    : `This is ${article.title} by ${author}.`;
  return `${summarySentence} ${titleSentence} ${sourceCheck}`;
}

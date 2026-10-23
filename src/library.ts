import type { Article, Chapter, ReadingPath } from './types';

export const chapters: Record<Chapter, { title: string; english: string; color: string; question: string }> = {
  intro: { title: '啟航', english: 'Intro', color: '#8a8969', question: 'AI 時代，我們為什麼出發？' },
  people: { title: '人心之島', english: 'People', color: '#b65b36', question: '效率之外，什麼讓人願意相信？' },
  model: { title: '洞察之島', english: 'Model', color: '#3d7775', question: '當答案更快，判斷如何更準？' },
  ai: { title: '行動之島', english: 'A.I.', color: '#757c48', question: '如何把生成力，變成真實影響力？' },
};

export const paths: ReadingPath[] = [
  { id: 'trust', title: '讓品牌重新被相信', question: 'AI 越像人，品牌該如何真實？', description: '從真實感開始，理解信任，再回到人的購買動機。', orders: [3, 6, 7], connections: ['先看見真實感為何稀缺，再理解信任如何累積。', '有了信任，下一步是理解人為什麼想買。'] },
  { id: 'memory', title: '留下滑不走的記憶', question: '品牌如何從被看見，走到被記住？', description: '把注意力、媒體體驗與共同記憶接在一起。', orders: [8, 10, 11], connections: ['從娛樂與運動的注意力，走向可參與的媒體體驗。', '再從單次體驗，走入人們共享的文化記憶。'] },
  { id: 'action', title: '把 AI 帶進決策現場', question: '更快得到答案，然後呢？', description: '先理解研究的變化，再校準判斷，最後走進消費旅程。', orders: [2, 12, 14, 22], connections: ['從 Agentic 時代的提問，走進 People Model 的研究方法。', '模擬提供線索，人的衡斷決定如何使用答案。', '帶著判斷與邊界，回到可執行的消費旅程。'] },
];

export function findArticles(articles: Article[], query = '', chapter: Chapter | null = null): Article[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return articles.filter(a => (!chapter || a.chapter === chapter) && terms.every(term =>
    [a.title, a.authors, a.summary, ...a.tags, ...a.paragraphs, ...(a.supplementaryParagraphs || [])].join(' ').toLocaleLowerCase().includes(term)));
}

const key = 'decision-islands-v1';
export interface ReadingState { bookmarks: string[]; completed: string[]; last: string | null; fontSize: number }
export function readState(): ReadingState {
  const empty: ReadingState = { bookmarks: [], completed: [], last: null, fontSize: 20 };
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return { bookmarks: Array.isArray(value.bookmarks) ? value.bookmarks.filter((x: unknown) => typeof x === 'string') : [],
      completed: Array.isArray(value.completed) ? value.completed.filter((x: unknown) => typeof x === 'string') : [],
      last: typeof value.last === 'string' ? value.last : null,
      fontSize: [18, 20, 22, 24].includes(value.fontSize) ? value.fontSize : 20 };
  } catch { return empty; }
}
export function saveState(state: ReadingState): boolean {
  try { localStorage.setItem(key, JSON.stringify(state)); return true; } catch { return false; }
}
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

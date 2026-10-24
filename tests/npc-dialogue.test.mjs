import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const scenarioSource = readFileSync(new URL('../src/npc-scenarios.ts', import.meta.url), 'utf8');
const scenarioModule = ts.transpileModule(scenarioSource, {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext},
}).outputText;
const scenarioUrl = `data:text/javascript;base64,${Buffer.from(scenarioModule).toString('base64')}`;
const dialogueSource = readFileSync(new URL('../src/npc-dialogue.ts', import.meta.url), 'utf8')
  .replace("from './npc-scenarios.ts'", `from '${scenarioUrl}'`);
const dialogueModule = ts.transpileModule(dialogueSource, {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext},
}).outputText;
const dialogueUrl = `data:text/javascript;base64,${Buffer.from(dialogueModule).toString('base64')}`;
const {buildNpcDialogueProfile, createNpcReply, getNpcDialogueQuestions, getNpcSituation} = await import(dialogueUrl);
const {NPC_SCENARIO_BOOK_TITLE} = await import(scenarioUrl);

const edition = JSON.parse(readFileSync(new URL('../public/data/2026.json', import.meta.url), 'utf8'));
const article = (id, order, details = {}) => ({
  id,
  year: 2026,
  order,
  chapter: 'people',
  title: `文章 ${order}`,
  authors: `作者 ${order}`,
  summary: `摘要 ${order} 說明文章線索。`,
  highlights: ['本站重點：文章細節可以回查當期原刊。'],
  tags: [`主題 ${order}`, '閱讀'],
  minutes: 4,
  printedStart: 10 + order,
  printedEnd: 12 + order,
  sourcePdf: '/book.pdf',
  sourcePages: [1],
  paragraphs: [],
  htmlUrl: `/read/${id}`,
  ...details,
});

const data = (articles, roles = [], flows = []) => ({
  schemaVersion: 1,
  year: 2026,
  title: {zh: '本期書目', en: 'This edition'},
  bookTitle: '測試書名',
  seed: 1,
  layout: {radius: 1, spacing: 1, top: 1, waterY: 0},
  articles,
  islands: [],
  items: [],
  flows,
  roles,
  daySegments: [],
  dayKeyframes: [],
});

const sentenceCount = text => text.replace(/《.*?》/gu, 'article title').split(/[。.!?！？]+/u).filter(part => part.trim()).length;

test('NPC profile leads with assigned articles, removes duplicates, and browses the rest of the current book', () => {
  const articles = [article('book-a', 1), article('book-b', 2), article('book-c', 3), article('book-d', 4)];
  const current = data(articles, [{id: 'curator', title: {zh: '策展員', en: 'Curator'}, color: '#db6a41'}], [
    {id: 'opening', articleIds: ['book-b', 'book-c', 'missing']},
  ]);
  const npc = {id: 'opening:0', roleId: 'curator', flowId: 'opening', homeIslandId: 'one', articleIds: ['book-a', 'book-b']};
  const profile = buildNpcDialogueProfile(current, npc, 'zh');

  assert.equal(profile.roleTitle, '策展員');
  assert.equal(profile.roleColor, '#db6a41');
  assert.deepEqual(profile.topics.map(value => value.id), ['book-a', 'book-b', 'book-c']);
  assert.deepEqual(profile.moreArticles.map(value => value.id), ['book-d']);
});

test('role greetings remain distinct and unknown roles use the current edition role data', () => {
  const roles = [
    {id: 'curator', title: {zh: '策展員', en: 'Curator'}, color: '#db6a41'},
    {id: 'researcher', title: {zh: '研究者', en: 'Researcher'}, color: '#fff8f4'},
  ];
  const current = data([article('book-a', 1)], roles);
  const curator = buildNpcDialogueProfile(current, {id: 'a', roleId: 'curator', flowId: null, homeIslandId: 'x', articleIds: ['book-a']}, 'zh');
  const researcher = buildNpcDialogueProfile(current, {id: 'b', roleId: 'researcher', flowId: null, homeIslandId: 'x', articleIds: ['book-a']}, 'zh');
  const unknown = buildNpcDialogueProfile(current, {id: 'c', roleId: 'archivist', flowId: null, homeIslandId: 'x', articleIds: ['missing']}, 'en');

  assert.notEqual(curator.greeting, researcher.greeting);
  assert.match(curator.greeting, /策展員/);
  assert.match(researcher.greeting, /觀點、證據和資料限制/);
  assert.equal(unknown.roleTitle, 'archivist');
  assert.match(unknown.greeting, /archivist/);
  assert.deepEqual(unknown.topics, []);
  assert.deepEqual(unknown.moreArticles.map(value => value.id), ['book-a']);
});

test('dialogue questions open on a role situation, an action, and the article idea', () => {
  const zh = getNpcDialogueQuestions('zh');
  const en = getNpcDialogueQuestions('en');

  assert.deepEqual(zh.map(value => value.id), ['summary', 'highlight', 'source']);
  assert.deepEqual(zh.map(value => value.label), ['你遇到什麼狀況？', '你會怎麼做？', '這跟文章哪個觀點有關？']);
  assert.deepEqual(en.map(value => value.label), ['What situation are you facing?', 'What would you try?', 'Which idea from the article connects to this?']);
});

test('the source answer identifies the article and current publication metadata', () => {
  const source = edition.articles.find(value => value.id === '2026-18');
  const reply = createNpcReply(source, 'source', 'zh', 'worker', edition.title);

  assert.match(reply, /體驗這件事，我們一直只問了一半/);
  assert.match(reply, /意圖預覽、自主性調節和升級路徑/);
  assert.match(reply, /作者為.*收錄於 2026 年刊，原刊頁碼/);
  assert.match(reply, /不是作者報導的案例/);
});

test('same-year books and reused IDs fall back to only the selected article evidence', () => {
  const matched = edition.articles.find(value => value.id === '2026-06');
  const sameIdDifferentBook = {...matched, title: '2026 當年新刊的另一篇文章', year: 2026, summary: '新書摘要只談新的服務情境。', highlights: ['新書重點：先核對新的原始資料。']};
  const wrongBook = createNpcReply(matched, 'highlight', 'zh', 'researcher', '另一冊 2026 年書');
  const wrongTitle = createNpcReply(sameIdDifferentBook, 'highlight', 'zh', 'researcher', edition.title);
  const unscoped = createNpcReply(matched, 'highlight', 'zh', 'researcher');
  const unknownSituation = getNpcSituation(sameIdDifferentBook, 'researcher', 'zh', edition.title);

  assert.match(wrongBook, /消息來源交叉驗證/);
  assert.doesNotMatch(wrongBook, /內容的成本轉到查證/);
  assert.match(unscoped, /消息來源交叉驗證/);
  assert.doesNotMatch(unscoped, /內容的成本轉到查證/);
  assert.match(wrongTitle, /重點提到「先核對新的原始資料」/);
  assert.doesNotMatch(wrongTitle, /內容的成本轉到查證|交叉核對/);
  assert.match(unknownSituation.scene, /新書摘要只談新的服務情境/);
  assert.match(unknownSituation.scene, /目前摘要或整理重點/);
});

test('reused IDs with a new title never inherit old-edition dialogue', () => {
  const newArticle = article('shared-id', 1, {
    year: 2032,
    title: '另一年度的文章',
    authors: '新作者',
    summary: '新年度摘要只描述新的服務問題。',
    highlights: ['本期重點：先核對本期的資料來源。'],
  });
  const reply = createNpcReply(newArticle, 'summary', 'zh', 'traveler', NPC_SCENARIO_BOOK_TITLE);
  const situation = getNpcSituation(newArticle, 'traveler', 'zh', NPC_SCENARIO_BOOK_TITLE);

  assert.match(reply, /新年度摘要只描述新的服務問題/);
  assert.match(reply, /目前資料/);
  assert.doesNotMatch(reply, /學習循環|Share of Choice|最難複製/);
  assert.match(situation.scene, /新年度摘要只描述新的服務問題/);
});

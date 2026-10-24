import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../src/npc-dialogue.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext},
}).outputText;
const {buildNpcDialogueProfile, createNpcReply, getNpcDialogueQuestions} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

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

test('each known role has a distinct, purposeful greeting; unknown roles use current role data', () => {
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
  assert.match(researcher.greeting, /摘要和來源/);
  assert.equal(unknown.roleTitle, 'archivist');
  assert.match(unknown.greeting, /archivist/);
  assert.deepEqual(unknown.topics, []);
  assert.deepEqual(unknown.moreArticles.map(value => value.id), ['book-a']);
});

test('question branches answer from the selected article summary and current source metadata', () => {
  const source = article('2026-source', 2, {
    title: '作者如何整理線索',
    authors: '林作者',
    summary: '文章摘要保留了當期書目中的實際線索。',
    highlights: ['延伸方向：作者把不同線索放在同一篇文章裡。'],
    tags: ['作者整理', '閱讀脈絡'],
    year: 2026,
    printedStart: 44,
    printedEnd: 48,
  });
  const questions = getNpcDialogueQuestions('zh');
  const summaryReply = createNpcReply(source, 'summary', 'zh');
  const highlightReply = createNpcReply(source, 'highlight', 'zh');
  const sourceReply = createNpcReply(source, 'source', 'zh');

  assert.equal(questions.length, 3);
  assert.equal(new Set(questions.map(value => value.id)).size, 3);
  assert.equal(new Set(questions.map(value => value.label)).size, 3);
  for (const reply of [summaryReply, sourceReply]) assert.match(reply, /文章摘要保留了當期書目中的實際線索/);
  assert.match(highlightReply, /作者把不同線索放在同一篇文章裡/);
  assert.doesNotMatch(highlightReply, /文章摘要保留了當期書目中的實際線索/);
  assert.match(sourceReply, /作者如何整理線索.*林作者.*2026.*p\. 44–48/);
  assert.notEqual(summaryReply, highlightReply);
  assert.notEqual(highlightReply, sourceReply);
  assert.doesNotMatch(summaryReply, /核准|採購|ROI|原文引述/);
});

test('reused article IDs resolve only against the new book and missing summaries stay explicit', () => {
  const oldData = data([article('shared-id', 1, {year: 2026, title: '舊書文章', summary: '舊摘要'})]);
  const nextArticle = article('shared-id', 1, {year: 2032, title: '新書文章', authors: '新作者', summary: '新書目前的摘要。'});
  const nextData = data([nextArticle], [], [{id: 'new-flow', articleIds: ['shared-id']}]);
  const reusedNpc = {id: 'new-flow:0', roleId: 'reader', flowId: 'new-flow', homeIslandId: 'one', articleIds: ['shared-id']};
  const profile = buildNpcDialogueProfile(nextData, reusedNpc, 'zh');
  const reply = createNpcReply(profile.topics[0], 'source', 'zh');
  const missing = createNpcReply(article('empty', 2, {summary: '  '}), 'summary', 'zh');

  assert.equal(oldData.articles[0].title, '舊書文章');
  assert.equal(profile.topics[0], nextArticle);
  assert.match(reply, /新書文章.*新作者.*2032.*新書目前的摘要/);
  assert.doesNotMatch(reply, /舊書文章|舊摘要/);
  assert.match(missing, /沒有提供這篇文章的摘要/);
});

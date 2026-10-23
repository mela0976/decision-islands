import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const code = ts.transpileModule(readFileSync(new URL('../src/reading-journeys.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { buildReadingJourneys, JOURNEY_2026, resolveJourney } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const edition = JSON.parse(readFileSync(new URL('../public/data/2026.json', import.meta.url), 'utf8'));
const data = buildReadingJourneys(edition);
const copy = () => structuredClone(JOURNEY_2026);

test('six reader roles each offer two concerns and three distinct canonical articles', () => {
  assert.deepEqual(data.personas.map(p => p.id), ['family', 'life-transition', 'newcomer', 'commuter', 'marketer', 'decision-maker']);
  assert.equal(data.bookId, edition.title);
  assert.equal(data.year, 2026);
  for (const role of data.personas) {
    assert.equal(role.questions.length, 2);
    assert.ok(role.title.zh && role.title.en && role.description.zh && role.description.en && role.icon);
    for (const question of role.questions) {
      assert.ok(question.title.zh && question.title.en && question.why.zh && question.why.en);
      assert.equal(question.steps.length, 3);
      assert.equal(new Set(question.steps.map(s => s.articleId)).size, 3);
      assert.equal(question.steps[0].connection, undefined);
      for (const [index, step] of question.steps.entries()) {
        assert.ok(edition.articles.some(a => a.id === step.articleId));
        assert.ok(step.prompt.zh && step.prompt.en && step.reason.zh && step.reason.en);
        if (index) {
          assert.ok(['complement', 'tradeoff', 'context'].includes(step.connection.kind));
          assert.ok(step.connection.explanation.zh && step.connection.explanation.en);
        }
      }
      assert.equal(resolveJourney(data, role.id, question.id), question);
    }
  }
  assert.equal(resolveJourney(data, 'missing', 'missing'), undefined);
  assert.equal(resolveJourney(data, 'family', 'human-skill'), undefined);
});

test('curation uses article-specific context without asserting prerequisites or personal advice', () => {
  assert.deepEqual(resolveJourney(data, 'marketer', 'seen-remembered').steps.map(s => s.articleId), ['2026-19', '2026-09', '2026-13']);
  assert.match(resolveJourney(data, 'family', 'shared-memory').steps[0].reason.zh, /金曲獎/);
  assert.match(data.notice.zh, /編輯/);
  assert.match(data.notice.zh, /品牌、人與 AI/);
  const wording = JSON.stringify(data);
  assert.doesNotMatch(wording, /必須先讀|前置條件|邏輯依賴|投票|候選人|報酬保證/);
});

test('unknown year, other book and sparse editions never inherit old article references', () => {
  const future = { ...edition, year: 2031, title: 'Another book', articles: [{ ...edition.articles[0], year: 2031, id: 'new-only', order: 1 }] };
  assert.deepEqual(buildReadingJourneys(future).personas, []);
  assert.deepEqual(buildReadingJourneys({ ...edition, title: 'Other 2026 book' }).personas, []);
  assert.deepEqual(buildReadingJourneys({ ...edition, articles: edition.articles.slice(0, 1) }).personas, []);
  const sparse = buildReadingJourneys({ ...edition, articles: edition.articles.filter(a => [19, 9, 13].includes(a.order)) });
  assert.equal(sparse.personas.length, 1);
  assert.equal(sparse.personas[0].id, 'marketer');
  assert.equal(sparse.personas[0].questions.length, 1);
  assert.ok(sparse.personas.flatMap(p => p.questions.flatMap(q => q.steps)).every(s => ['2026-19', '2026-09', '2026-13'].includes(s.articleId)));
});

test('declarative definitions bind to a book and resolve its IDs or current orders', () => {
  const next = { ...edition, year: 2031, title: 'New edition', articles: edition.articles.slice(0, 3).map((a, i) => ({ ...a, id: `new-${i}`, year: 2031 })) };
  const config = copy();
  config.bookId = next.title; config.year = next.year; config.personas = [config.personas[0]];
  config.personas[0].questions = [config.personas[0].questions[0]];
  const steps = config.personas[0].questions[0].steps;
  for (const [index, step] of steps.entries()) { delete step.articleOrder; step.articleId = `new-${index}`; }
  assert.deepEqual(buildReadingJourneys(next, config).personas[0].questions[0].steps.map(s => s.articleId), ['new-0', 'new-1', 'new-2']);
  delete steps[1].articleId; steps[1].articleOrder = 2;
  assert.equal(buildReadingJourneys(next, config).personas[0].questions[0].steps[1].articleId, 'new-1');
  assert.throws(() => buildReadingJourneys(edition, config), /another book/);
});

test('invalid identities, references, duplicate selections and malformed copy fail at the boundary', () => {
  assert.throws(() => buildReadingJourneys({ ...edition, articles: [edition.articles[0], edition.articles[0]] }), /duplicate/);
  assert.throws(() => buildReadingJourneys({ ...edition, articles: [{ ...edition.articles[0], year: 2025 }] }), /another year/);
  for (const mutate of [
    c => { c.personas[1].id = c.personas[0].id; },
    c => { c.personas[1].questions[0].id = c.personas[0].questions[0].id; },
    c => { c.personas[0].questions[0].steps[0].articleOrder = 999; },
    c => { c.personas[0].questions[0].steps[1].articleOrder = c.personas[0].questions[0].steps[0].articleOrder; },
    c => { c.personas[0].questions[0].steps[0].articleId = '2026-11'; },
    c => { c.personas[0].questions[0].steps.pop(); },
    c => { delete c.personas[0].questions[0].steps[1].connection; },
    c => { c.personas[0].questions[0].steps[1].connection.kind = 'prerequisite'; },
    c => { c.personas[0].title.en = ''; },
  ]) {
    const config = copy(); mutate(config);
    assert.throws(() => buildReadingJourneys(edition, config));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
const urls = new Map();
async function load(name) {
  if (urls.has(name)) return import(urls.get(name));
  let code = ts.transpileModule(readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const match of [...code.matchAll(/from ['"]\.\/([^'"]+)['"]/g)]) { await load(match[1]); code = code.replace(match[0], `from '${urls.get(match[1])}'`); }
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  urls.set(name, url); return import(url);
}
const { DATA, buildExplorerData, initialExplorerState } = await load('explorer-data');
const { createNpcRoster, clampNpcPopulation } = await load('explorer-npcs');
const { createSimulation } = await load('explorer-simulation');
const { buildPathGraph } = await load('explorer-graph');
const edition = JSON.parse(readFileSync(new URL('../public/data/2026.json', import.meta.url), 'utf8'));
const data = buildExplorerData(DATA, edition);

test('population boundary accepts ten through one hundred and starts with thirty visible readers', () => {
  for (const [input, expected] of [[-1, 10], [10, 10], [10.4, 10], [10.5, 11], [99.7, 100], [101, 100], [NaN, 30], [Infinity, 30]]) assert.equal(clampNpcPopulation(input), expected);
  const state = initialExplorerState(); assert.equal(state.population, 30); assert.equal(state.walkers, true); assert.equal(state.names, false); assert.equal(state.flows, false);
});

test('roster identities and current-book topics remain fixed across population changes', () => {
  const small = createNpcRoster(data, 10), large = createNpcRoster(data, 100);
  assert.equal(large.length, 100); assert.equal(new Set(large.map(n => n.id)).size, 100);
  assert.deepEqual(large.slice(0, 10), small); assert.deepEqual(createNpcRoster(data, 10), small);
  assert.equal(new Set(createNpcRoster(data, 30).flatMap(n => n.articleIds)).size, data.articles.length);
  for (const npc of large) { assert.ok(data.roles.some(r => r.id === npc.roleId)); assert.ok(npc.articleIds.every(id => data.articles.some(a => a.id === id))); }
});

test('resizing preserves retained positions and monotonic simulation time, including while paused', () => {
  const sim = createSimulation(data, buildPathGraph(data), 10);
  sim.update(4.7, true); const before = sim.snapshot(); sim.setPopulation(100); const large = sim.snapshot();
  assert.equal(large.walkers.length, 100); assert.deepEqual(large.walkers.slice(0, 10), before.walkers); assert.equal(large.minute, before.minute);
  assert.deepEqual(large.walkers.map(w => w.id), createNpcRoster(data, 100).map(n => n.id));
  sim.update(20, false); assert.deepEqual(sim.snapshot(), large);
  sim.setPopulation(10); assert.deepEqual(sim.snapshot(), before);
  sim.setPopulation(100); assert.deepEqual(sim.snapshot(), large);
  sim.update(.2, true); assert.ok(sim.snapshot().minute > before.minute);
});

test('uncurated editions retain local walking readers and never inherit previous-book topics or flow events', () => {
  const article = { ...edition.articles[0], id: '2031-local', year: 2031, order: 98 };
  const next = buildExplorerData(DATA, { ...edition, year: 2031, articles: [article] });
  assert.equal(next.flows.length, 0);
  const roster = createNpcRoster(next, 100); assert.equal(roster.length, 100);
  assert.ok(roster.every(npc => npc.flowId === null && npc.articleIds.join() === article.id && next.islands.some(i => i.id === npc.homeIslandId)));
  const sim = createSimulation(next, buildPathGraph(next), 100), before = sim.snapshot();
  assert.equal(before.walkers.length, 100); assert.deepEqual(sim.update(1, true), []);
  assert.notDeepEqual(sim.snapshot().walkers.map(w => w.position), before.walkers.map(w => w.position));
  assert.ok(sim.snapshot().walkers.every(w => w.flowId === '' && w.position.every(Number.isFinite)));
});

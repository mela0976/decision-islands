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
const {createNpcReply, getNpcSituation} = await import(dialogueUrl);
const {NPC_ARTICLE_SCENARIOS, NPC_DIALOGUE_ROLE_IDS, NPC_ROLE_SCENARIOS, NPC_SCENARIO_BOOK_TITLE} = await import(scenarioUrl);

const edition = JSON.parse(readFileSync(new URL('../public/data/2026.json', import.meta.url), 'utf8'));
const families = ['trust', 'attention', 'understanding', 'delegation'];
const sentenceCount = text => text.replace(/《.*?》/gu, 'article title').split(/[。.!?！？]+/u).filter(part => part.trim()).length;

test('the registry has exact identities and one grounded application for all 22 current articles', () => {
  assert.equal(NPC_SCENARIO_BOOK_TITLE, edition.title);
  assert.equal(NPC_ARTICLE_SCENARIOS.length, edition.articles.length);
  assert.equal(new Set(NPC_ARTICLE_SCENARIOS.map(value => value.articleId)).size, edition.articles.length);
  assert.deepEqual(new Set(NPC_ARTICLE_SCENARIOS.map(value => value.family)), new Set(families));

  for (const source of edition.articles) {
    const scenario = NPC_ARTICLE_SCENARIOS.find(value => value.articleId === source.id);
    assert.ok(scenario, `missing curated scenario for ${source.id}`);
    assert.equal(scenario.expectedTitle, source.title, `article identity changed for ${source.id}`);
    for (const field of ['anchor', 'issue', 'point', 'action', 'tradeoff']) {
      assert.ok(scenario[field].zh.trim(), `${source.id} has no Chinese ${field}`);
      assert.ok(scenario[field].en.trim(), `${source.id} has no English ${field}`);
    }
  }
});

test('each role has a hand-authored scene, action, and cost in all four topic families', () => {
  assert.equal(NPC_DIALOGUE_ROLE_IDS.length, 9);
  for (const roleId of NPC_DIALOGUE_ROLE_IDS) {
    const scenes = NPC_ROLE_SCENARIOS[roleId];
    assert.deepEqual(Object.keys(scenes).sort(), [...families].sort());
    for (const family of families) {
      for (const field of ['situation', 'action', 'cost']) {
        assert.ok(scenes[family][field].zh.trim(), `${roleId}/${family} has no Chinese ${field}`);
        assert.ok(scenes[family][field].en.trim(), `${roleId}/${family} has no English ${field}`);
      }
    }
  }
});

test('all nine roles get distinct first-person scenes and three useful answers for all 22 articles', () => {
  for (const source of edition.articles) {
    const scenario = NPC_ARTICLE_SCENARIOS.find(value => value.articleId === source.id);
    const scenes = NPC_DIALOGUE_ROLE_IDS.map(roleId => getNpcSituation(source, roleId, 'zh', edition.title));
    assert.equal(new Set(scenes.map(value => value.opening)).size, NPC_DIALOGUE_ROLE_IDS.length, `role openings collide for ${source.id}`);
    assert.equal(new Set(scenes.map(value => value.scene)).size, NPC_DIALOGUE_ROLE_IDS.length, `role scenes collide for ${source.id}`);

    for (const roleId of NPC_DIALOGUE_ROLE_IDS) {
      const situation = getNpcSituation(source, roleId, 'zh', edition.title);
      assert.ok(situation.opening.length > 12, `${source.id}/${roleId} has no role-specific opening`);
      assert.ok(situation.scene.includes('情境示例'), `${source.id}/${roleId} does not mark the illustration`);

      const replies = ['summary', 'highlight', 'source'].map(questionId => createNpcReply(source, questionId, 'zh', roleId, edition.title));
      assert.equal(new Set(replies).size, 3, `${source.id}/${roleId} repeats one answer for multiple questions`);
      assert.ok(replies[2].includes(scenario.tradeoff.zh), `${source.id}/${roleId} lost its article-specific tradeoff`);
      assert.doesNotMatch(replies[2], /文章建議|文章也提醒|The article suggests|The article also points/u,
        `${source.id}/${roleId} attributes the illustrative action or cost to the author`);
      assert.match(replies[2], /放進我的情境.*可能付出|In my situation.*at the cost of/u,
        `${source.id}/${roleId} does not frame the action and cost as the NPC's application`);
      for (const reply of replies) {
        assert.ok(sentenceCount(reply) >= 2 && sentenceCount(reply) <= 4, `${source.id}/${roleId} reply is not brief: ${reply}`);
        assert.doesNotMatch(reply, new RegExp(source.summary.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
        assert.match(reply, /示例/);
      }
    }
  }
});

test('named role situations apply each article idea to that role’s actual decision', () => {
  const article = id => edition.articles.find(value => value.id === id);

  const outing = getNpcSituation(article('2026-07'), 'parent', 'zh', edition.title);
  const outingAction = createNpcReply(article('2026-07'), 'highlight', 'zh', 'parent', edition.title);
  assert.match(outing.opening, /家庭出遊.*孩子真正想/);
  assert.match(outingAction, /先問孩子最期待哪個活動.*共同回憶/);
  assert.doesNotMatch(outing.opening, /品牌、廣告、曝光/);

  const groupRide = getNpcSituation(article('2026-08'), 'cyclist', 'zh', edition.title);
  assert.match(groupRide.opening, /安排車友團騎.*一起完成的記憶/);
  assert.match(groupRide.scene, /安全路線.*補給點/);

  const garden = getNpcSituation(article('2026-12'), 'gardener', 'zh', edition.title);
  assert.match(garden.opening, /社區花圃.*小塊試種區/);
  assert.match(garden.scene, /日照和土壤.*幾個花床/);

  const work = getNpcSituation(article('2026-18'), 'worker', 'zh', edition.title);
  assert.match(work.opening, /Agent.*哪些帳戶.*資料是不是最新/);
  assert.match(work.scene, /來源、更新時間、缺漏和信心/);

  const modelSource = createNpcReply(article('2026-12'), 'source', 'zh', 'researcher', edition.title);
  assert.match(modelSource, /把直接支持、模型估計和情境模擬分開/);
  assert.match(modelSource, /把資料支持、模型估計和待驗假設分開/);
  assert.doesNotMatch(modelSource, /0\.89|精確百分比/);

  const english = createNpcReply(article('2026-07'), 'highlight', 'en', 'parent', edition.title);
  assert.match(english, /ask what my child is most excited about/);
});

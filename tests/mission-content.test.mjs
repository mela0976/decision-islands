import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const moduleUrl = new URL('../src/journey-mission-content.ts', import.meta.url);
const source = await readFile(moduleUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { MISSION_ROUNDS } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

test('each role question has three distinct bilingual choice missions', () => {
  const entries = Object.entries(MISSION_ROUNDS);
  assert.equal(entries.length, 16);

  const missionIds = new Set();
  const scenes = { zh: new Set(), en: new Set() };
  const outcomes = { zh: new Set(), en: new Set() };
  const contentFields = [];

  for (const [questionId, missions] of entries) {
    assert.equal(missions.length, 3, `${questionId} should have three rounds`);

    for (const [index, mission] of missions.entries()) {
      assert.deepEqual(Object.keys(mission).sort(), ['choices', 'goal', 'id', 'scene', 'takeaway']);
      assert.equal(mission.id, `${questionId}-${index + 1}`);
      assert.ok(!missionIds.has(mission.id), `duplicate mission ID ${mission.id}`);
      missionIds.add(mission.id);

      for (const field of ['scene', 'goal', 'takeaway']) {
        assert.deepEqual(Object.keys(mission[field]).sort(), ['en', 'zh']);
        for (const language of ['zh', 'en']) {
          const value = mission[field][language];
          assert.equal(typeof value, 'string');
          assert.ok(value.trim(), `${mission.id} ${field}.${language} is empty`);
          contentFields.push(value);
        }
      }

      for (const [language, text] of Object.entries(mission.scene)) {
        const key = normalize(text);
        assert.ok(!scenes[language].has(key), `duplicate ${language} scene: ${text}`);
        scenes[language].add(key);
      }

      assert.equal(mission.choices.length, 2, `${mission.id} should offer two choices`);
      assert.deepEqual(mission.choices.map(({ id }) => id), ['a', 'b']);
      for (const option of mission.choices) {
        assert.deepEqual(Object.keys(option).sort(), ['id', 'label', 'outcome', 'tradeoff']);
        for (const field of ['label', 'outcome', 'tradeoff']) {
          assert.deepEqual(Object.keys(option[field]).sort(), ['en', 'zh']);
          for (const language of ['zh', 'en']) {
            const value = option[field][language];
            assert.equal(typeof value, 'string');
            assert.ok(value.trim(), `${mission.id} choice ${option.id} ${field}.${language} is empty`);
            contentFields.push(value);
          }
        }
        for (const [language, text] of Object.entries(option.outcome)) {
          const key = normalize(text);
          assert.ok(!outcomes[language].has(key), `duplicate ${language} outcome: ${text}`);
          outcomes[language].add(key);
        }
      }
    }
  }

  assert.equal(missionIds.size, 48);
  assert.equal(scenes.zh.size, 48);
  assert.equal(scenes.en.size, 48);
  assert.equal(outcomes.zh.size, 96);
  assert.equal(outcomes.en.size, 96);

  for (const value of contentFields) {
    assert.doesNotMatch(value, /\d|%|百分之/);
    assert.doesNotMatch(value, /guarantee|guaranteed|唯一正確答案|保證結果|一定會/u);
  }

  for (const mission of Object.values(MISSION_ROUNDS).flat()) {
    for (const value of [mission.scene.zh, mission.takeaway.zh, ...mission.choices.flatMap((option) => [option.outcome.zh, option.tradeoff.zh])]) {
      assert.ok(Array.from(value).length <= 65, `${mission.id} Chinese copy exceeds 65 characters: ${value}`);
    }
  }
});

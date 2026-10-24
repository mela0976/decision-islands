import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildData } from '../public/immersive/data.js';

const edition = JSON.parse(await readFile(new URL('../public/data/2026.json', import.meta.url), 'utf8'));
const data = buildData(edition);

test('all 68 article choices carry one short, named, character-bound visual effect', () => {
  assert.equal(data.scenes.length, 22);
  const effects = data.scenes.flatMap(scene => scene.interaction.outcomes.map(outcome => ({ scene, outcome })));
  assert.equal(effects.length, 68);
  assert.equal(new Set(effects.map(({ outcome }) => outcome.visualEffect.id)).size, 68);
  assert.equal(new Set(effects.map(({ outcome }) => outcome.visualEffect.propId)).size, 68);
  const characters = new Set(data.characters.map(({ id }) => id));

  for (const scene of data.scenes) {
    const optionIds = scene.interaction.control.options.map(({ id }) => id).sort();
    const outcomeIds = scene.interaction.outcomes.map(({ choiceId }) => choiceId).sort();
    assert.deepEqual(outcomeIds, optionIds, `${scene.islandId} maps every selectable option once`);
    const actions = scene.interaction.outcomes.map(({ visualEffect }) => visualEffect.action);
    assert.equal(new Set(actions).size, actions.length, `${scene.islandId} uses a different visible action per option`);

    for (const { choiceId, visualEffect } of scene.interaction.outcomes) {
      assert.equal(visualEffect.id, `${scene.islandId}-${choiceId}`);
      assert.match(visualEffect.propId, /^[a-z0-9-]+$/);
      assert.ok(visualEffect.action.length > 0);
      assert.ok(characters.has(visualEffect.actorId), `${scene.islandId}/${choiceId} names an existing character`);
      assert.ok(visualEffect.reactionText.length <= 40, `${scene.islandId}/${choiceId} keeps its mobile reaction short`);
    }
  }
});

test('P06, M05, and A01 effects name visible objects and actions from their scene choices', () => {
  const expected = {
    P06: { song: ['stage-chorus', 'sing'], cheer: ['cheer-card', 'exchange'], place: ['shared-stands', 'gather'], story: ['story-photo', 'retell'] },
    M05: { fear: ['employee-concern', 'surface'], guidance: ['next-step-sheet', 'center'], silo: ['department-halves', 'split'] },
    A01: { 'before-pay': ['checkout-info-board', 'face'], 'after-order': ['delivery-parcel', 'deliver'], support: ['service-ticket', 'assist'] },
  };
  for (const [islandId, choices] of Object.entries(expected)) {
    const scene = data.scenes.find(item => item.islandId === islandId);
    for (const [choiceId, [propId, action]] of Object.entries(choices)) {
      const outcome = scene.interaction.outcomes.find(item => item.choiceId === choiceId);
      assert.deepEqual([outcome.visualEffect.propId, outcome.visualEffect.action], [propId, action]);
    }
  }
});

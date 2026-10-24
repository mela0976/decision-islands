import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const [{ MISSION_3D_ACTIONS }, { MISSION_VISUALS }, { MISSION_ROUNDS }] = await Promise.all([
  server.ssrLoadModule('/src/mission-3d-actions.ts'),
  server.ssrLoadModule('/src/mission-visual-content.ts'),
  server.ssrLoadModule('/src/journey-mission-content.ts'),
]);
after(() => server.close());

const actorKinds = new Set(['adult', 'elder', 'child', 'robot']);
const visible = (entity) => entity && (entity.opacity ?? 1) > 0;
const shape = (actions) => actions.map(({ kind, actor, target, prop }) => ({ kind, actor, target, ...(prop ? { prop } : {}) }));

test('action registry covers each source mission and exactly its two choices', () => {
  const sourceIds = Object.values(MISSION_ROUNDS).flat().map(({ id }) => id).sort();
  assert.equal(sourceIds.length, 48);
  assert.deepEqual(Object.keys(MISSION_3D_ACTIONS).sort(), sourceIds);

  for (const missionId of sourceIds) {
    assert.deepEqual(Object.keys(MISSION_3D_ACTIONS[missionId]).sort(), ['a', 'b'], missionId);
    assert.deepEqual(Object.keys(MISSION_VISUALS[missionId].choices).sort(), ['a', 'b'], missionId);
  }
});

test('each action is an observable interaction between visible frame entities', () => {
  const supportedKinds = new Set(['show', 'review', 'operate', 'handoff', 'pause']);

  for (const [missionId, choices] of Object.entries(MISSION_3D_ACTIONS)) {
    for (const choiceId of ['a', 'b']) {
      const frame = MISSION_VISUALS[missionId].choices[choiceId];
      const entities = new Map(frame.entities.map((entity) => [entity.id, entity]));
      const actors = new Set();
      const actions = choices[choiceId];
      assert.ok(actions.length >= 1 && actions.length <= 3, `${missionId}/${choiceId} action count`);

      for (const [index, action] of actions.entries()) {
        const context = `${missionId}/${choiceId}/action ${index + 1}`;
        const actor = entities.get(action.actor);
        const target = entities.get(action.target);
        assert.ok(supportedKinds.has(action.kind), `${context} kind`);
        assert.ok(visible(actor), `${context} actor is visible`);
        assert.ok(actorKinds.has(actor.kind), `${context} actor is a person or robot`);
        assert.ok(visible(target), `${context} target is visible`);
        assert.notEqual(action.actor, action.target, `${context} actor and target differ`);
        assert.ok(!actors.has(action.actor), `${context} gives each actor one readable action`);
        actors.add(action.actor);

        if (action.prop !== undefined) {
          const prop = entities.get(action.prop);
          assert.ok(visible(prop), `${context} prop is visible`);
          assert.ok(!actorKinds.has(prop.kind), `${context} prop is an object`);
          assert.notEqual(action.prop, action.target, `${context} prop and target differ`);
          assert.ok(['show', 'handoff', 'operate', 'pause'].includes(action.kind), `${context} prop has an interaction kind`);
        }
        if (action.kind === 'show' || action.kind === 'handoff') {
          assert.ok(action.prop, `${context} presents or transfers a visible object`);
        }
      }

    }

    assert.notDeepEqual(
      shape(choices.a),
      shape(choices.b),
      `${missionId} presents different actions for its two consequences`,
    );
  }
});

test('family listening choices change who leads and how the family participates', () => {
  assert.deepEqual(shape(MISSION_3D_ACTIONS['shared-memory-1'].a), [
    { kind: 'operate', actor: 'adult', target: 'screen', prop: 'playlist' },
    { kind: 'review', actor: 'elder', target: 'screen' },
    { kind: 'review', actor: 'child', target: 'screen' },
  ]);
  assert.deepEqual(shape(MISSION_3D_ACTIONS['shared-memory-1'].b), [
    { kind: 'show', actor: 'elder', target: 'adult', prop: 'playlist' },
    { kind: 'show', actor: 'child', target: 'adult', prop: 'phone' },
  ]);
});

test('family scheduling distinguishes a draft handoff from a reviewed preview', () => {
  assert.deepEqual(shape(MISSION_3D_ACTIONS['family-trust-3'].a), [
    { kind: 'handoff', actor: 'robot', target: 'adult', prop: 'document' },
    { kind: 'review', actor: 'adult', target: 'phone' },
  ]);
  assert.deepEqual(shape(MISSION_3D_ACTIONS['family-trust-3'].b), [
    { kind: 'show', actor: 'robot', target: 'adult', prop: 'document' },
    { kind: 'review', actor: 'adult', target: 'phone' },
  ]);
});

test('shopping authority is explicit and the stop control pauses this action', () => {
  assert.deepEqual(shape(MISSION_3D_ACTIONS['shopping-help-2'].a), [
    { kind: 'show', actor: 'robot', target: 'adult', prop: 'document' },
    { kind: 'review', actor: 'adult', target: 'document' },
  ]);
  assert.deepEqual(shape(MISSION_3D_ACTIONS['shopping-help-2'].b), [
    { kind: 'operate', actor: 'robot', target: 'cart' },
    { kind: 'pause', actor: 'adult', target: 'robot', prop: 'stop-control' },
  ]);
});

test('sample calibration and agent decisions enact their distinct human review boundaries', () => {
  assert.deepEqual(shape(MISSION_3D_ACTIONS['reliable-delivery-1'].b), [
    { kind: 'operate', actor: 'robot', target: 'screen' },
    { kind: 'review', actor: 'manager', target: 'screen' },
  ]);
  assert.deepEqual(shape(MISSION_3D_ACTIONS['agent-investment-1'].a), [
    { kind: 'handoff', actor: 'robot', target: 'staff', prop: 'document' },
    { kind: 'operate', actor: 'staff', target: 'phone' },
  ]);
  assert.deepEqual(shape(MISSION_3D_ACTIONS['agent-investment-1'].b), [
    { kind: 'operate', actor: 'robot', target: 'phone', prop: 'document' },
    { kind: 'review', actor: 'staff', target: 'document' },
  ]);
});

test('human-centered filming and support pilots produce different actions on each branch', () => {
  assert.deepEqual(shape(MISSION_3D_ACTIONS['scale-distinctiveness-3'].a), [
    { kind: 'pause', actor: 'contributor', target: 'camera' },
    { kind: 'review', actor: 'director', target: 'camera' },
  ]);
  assert.deepEqual(shape(MISSION_3D_ACTIONS['scale-distinctiveness-3'].b), [
    { kind: 'operate', actor: 'contributor', target: 'mug' },
    { kind: 'review', actor: 'director', target: 'camera' },
  ]);
  assert.deepEqual(shape(MISSION_3D_ACTIONS['research-decision-3'].a), [
    { kind: 'operate', actor: 'robot', target: 'case-a' },
    { kind: 'review', actor: 'lead', target: 'chart' },
  ]);
  assert.deepEqual(shape(MISSION_3D_ACTIONS['research-decision-3'].b), [
    { kind: 'operate', actor: 'robot', target: 'case-b' },
    { kind: 'review', actor: 'lead', target: 'shield' },
  ]);
});

import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const [{ MISSION_VISUALS }, { MISSION_ROUNDS }, { MISSION_PROPS, MISSION_SETTINGS }] = await Promise.all([
  server.ssrLoadModule('/src/mission-visual-content.ts'),
  server.ssrLoadModule('/src/journey-mission-content.ts'),
  server.ssrLoadModule('/src/mission-stage-types.ts'),
]);
after(() => server.close());

const framesFor = (definition) => [definition.initial, definition.choices.a, definition.choices.b];

const entityState = (entity) => ({
  id: entity.id,
  kind: entity.kind,
  x: entity.x,
  y: entity.y,
  scale: entity.scale ?? 1,
  opacity: entity.opacity ?? 1,
  pose: entity.pose ?? 'idle',
});

const frameState = (frame) => ({
  entities: frame.entities.map(entityState).sort((a, b) => a.id.localeCompare(b.id)),
  flows: frame.flows.map(({ id, from, to, kind }) => ({ id, from, to, kind })).sort((a, b) => a.id.localeCompare(b.id)),
});

test('visual registry covers the 48 source missions and all eight settings', () => {
  const sourceIds = Object.values(MISSION_ROUNDS).flat().map((round) => round.id).sort();
  const visualIds = Object.keys(MISSION_VISUALS).sort();
  assert.equal(sourceIds.length, 48);
  assert.deepEqual(visualIds, sourceIds);
  assert.deepEqual(
    [...new Set(Object.values(MISSION_VISUALS).map(({ setting }) => setting))].sort(),
    [...MISSION_SETTINGS].sort(),
  );
});

test('every frame uses valid, bounded entities and resolves each flow endpoint', () => {
  const kinds = new Set(MISSION_PROPS);
  const poses = new Set(['idle', 'present', 'listen', 'work', 'walk']);

  for (const [missionId, definition] of Object.entries(MISSION_VISUALS)) {
    assert.deepEqual(Object.keys(definition.choices).sort(), ['a', 'b'], missionId);
    const frames = framesFor(definition);
    const initialIds = frames[0].entities.map(({ id }) => id).sort();

    for (const frame of frames) {
      assert.ok(frame.description.zh.trim(), `${missionId} has a Chinese description`);
      assert.ok(frame.description.en.trim(), `${missionId} has an English description`);
      assert.ok(frame.entities.length >= 4 && frame.entities.length <= 9, `${missionId} entity count`);
      const ids = frame.entities.map(({ id }) => id);
      assert.equal(new Set(ids).size, ids.length, `${missionId} entity IDs are unique`);
      assert.deepEqual(ids.slice().sort(), initialIds, `${missionId} keeps stable entity IDs`);

      for (const item of frame.entities) {
        assert.ok(kinds.has(item.kind), `${missionId}/${item.id} kind`);
        assert.ok(item.x >= 0 && item.x <= 100, `${missionId}/${item.id} x`);
        assert.ok(item.y >= 50 && item.y <= 85, `${missionId}/${item.id} y`);
        if (item.scale !== undefined) assert.ok(item.scale >= 0.8 && item.scale <= 1.2, `${missionId}/${item.id} scale`);
        if (item.opacity !== undefined) assert.ok(item.opacity >= 0 && item.opacity <= 1, `${missionId}/${item.id} opacity`);
        if (item.pose !== undefined) assert.ok(poses.has(item.pose), `${missionId}/${item.id} pose`);
        if (item.label) {
          const chineseLength = Array.from(item.label.zh).length;
          assert.ok(chineseLength >= 2 && chineseLength <= 6, `${missionId}/${item.id} Chinese label length`);
          assert.ok(item.label.en.length < 18, `${missionId}/${item.id} English label length`);
        }
      }

      const flowIds = frame.flows.map(({ id }) => id);
      assert.equal(new Set(flowIds).size, flowIds.length, `${missionId} flow IDs are unique`);
      for (const link of frame.flows) {
        assert.ok(ids.includes(link.from), `${missionId}/${link.id} from endpoint`);
        assert.ok(ids.includes(link.to), `${missionId}/${link.id} to endpoint`);
      }
    }
  }
});

test('each choice changes multiple entities and A and B show different physical frames', () => {
  for (const [missionId, definition] of Object.entries(MISSION_VISUALS)) {
    const initial = new Map(definition.initial.entities.map((entity) => [entity.id, entityState(entity)]));

    for (const choiceId of ['a', 'b']) {
      const choice = definition.choices[choiceId];
      assert.ok(choice.description.zh.trim(), `${missionId}/${choiceId} has a Chinese description`);
      assert.ok(choice.description.en.trim(), `${missionId}/${choiceId} has an English description`);
      const changed = choice.entities.filter((entity) => (
        JSON.stringify(entityState(entity)) !== JSON.stringify(initial.get(entity.id))
      ));
      assert.ok(changed.length >= 2, `${missionId}/${choiceId} changes at least two visible entity states`);
    }

    assert.notDeepEqual(
      frameState(definition.choices.a),
      frameState(definition.choices.b),
      `${missionId} choices differ by physical state or flow topology`,
    );
  }
});

test('titles and entity labels have both language versions', () => {
  for (const [missionId, definition] of Object.entries(MISSION_VISUALS)) {
    assert.ok(definition.title.zh.trim(), `${missionId} title zh`);
    assert.ok(definition.title.en.trim(), `${missionId} title en`);
    for (const frame of framesFor(definition)) {
      for (const item of frame.entities) {
        if (!item.label) continue;
        assert.ok(item.label.zh.trim(), `${missionId}/${item.id} label zh`);
        assert.ok(item.label.en.trim(), `${missionId}/${item.id} label en`);
      }
    }
  }
});

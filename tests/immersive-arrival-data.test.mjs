import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ARTICLE_ORDER, WORLD_SEED, buildData } from '../public/immersive/data.js';

const editionUrl = new URL('../public/data/2026.json', import.meta.url);
const sourceEdition = JSON.parse(await readFile(editionUrl, 'utf8'));
const data = buildData(sourceEdition);
const repeatedData = buildData(sourceEdition);
const sceneByIslandId = new Map(data.scenes.map((scene) => [scene.islandId, scene]));
const actors = new Set(['achi', 'yue', 'yingzhen', 'fenjie']);
const propKinds = new Set(['paper', 'photo', 'product', 'parcel', 'phone', 'radio', 'sign', 'route', 'barrier', 'curtain', 'lamp', 'tray']);
const actionTypes = new Set(['walk', 'look', 'gesture', 'manipulate', 'exchange', 'transform', 'crowd']);
const gestures = new Set(['pen-stop', 'mark', 'point', 'hesitate', 'remember', 'sing', 'listen']);
const vector = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const close = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const allActions = (islandId) => sceneByIslandId.get(islandId).arrivalEvent.beats.flatMap(({ actions }) => actions);
const hasAction = (islandId, type, predicate = () => true) => allActions(islandId).some((action) => action.type === type && predicate(action));
const hasProp = (islandId, predicate) => sceneByIslandId.get(islandId).arrivalEvent.props.some(predicate);

test('all 22 scenes have complete, source-linked arrival events with reproducible island placement', () => {
  assert.equal(data.meta.seed, WORLD_SEED);
  assert.deepEqual(data.islands.map(({ id }) => id), ARTICLE_ORDER);
  assert.deepEqual(repeatedData.islands.map(({ id, position }) => [id, position]), data.islands.map(({ id, position }) => [id, position]));
  assert.deepEqual(repeatedData.scenes.map(({ islandId, arrivalEvent }) => [islandId, arrivalEvent]), data.scenes.map(({ islandId, arrivalEvent }) => [islandId, arrivalEvent]));
  assert.equal(data.scenes.length, 22);
  assert.equal(new Set(data.scenes.map(({ islandId }) => islandId)).size, 22);

  for (const islandId of ARTICLE_ORDER) {
    const scene = sceneByIslandId.get(islandId);
    const event = scene.arrivalEvent;
    assert.deepEqual(Object.keys(event).sort(), ['beats', 'cast', 'cause', 'fictional', 'handoff', 'id', 'props']);
    assert.equal(event.id, `${islandId}-arrival`);
    assert.equal(event.fictional, true);
    assert.equal(event.cause, scene.lifeEvent);
    assert.equal(event.handoff.question, scene.transition.question);
    assert.ok(event.handoff.question.endsWith('？') || event.handoff.question.endsWith('?'));
    assert.ok(scene.sourceGrounding.sourceArticleId === scene.articleId);
    assert.ok(scene.interaction.sourceEvidence.length > 0);
    assert.ok(event.cast.length >= 1);
    assert.equal(new Set(event.cast.map(({ actorId }) => actorId)).size, event.cast.length);

    for (const actor of event.cast) {
      assert.ok(actors.has(actor.actorId), `${islandId} uses a supported actor`);
      assert.ok(scene.characterIds.includes(actor.actorId), `${islandId} makes each arrival actor available to the scene`);
      assert.ok(vector(actor.position));
      assert.equal(actor.position[1], 1.1, `${islandId} stages actors at floor height`);
      assert.ok(Math.abs(actor.position[0]) <= 4 && actor.position[2] >= 2 && actor.position[2] <= 5, `${islandId} stages actors in front of its island`);
    }

    const propById = new Map(event.props.map((prop) => [prop.id, prop]));
    assert.equal(propById.size, event.props.length, `${islandId} has unique prop IDs`);
    assert.ok(propById.has(event.handoff.propId), `${islandId} hands off a prop visible in its own event`);
    for (const prop of event.props) {
      assert.deepEqual(Object.keys(prop).sort(), ['id', 'kind', 'label', 'position', 'scale']);
      assert.ok(propKinds.has(prop.kind), `${islandId} uses a supported prop kind`);
      assert.ok(prop.label.length >= 3);
      assert.ok(vector(prop.position) && vector(prop.scale));
      assert.ok(prop.scale.every((size) => size > 0));
      assert.ok(Math.abs(prop.position[0]) <= 4 && prop.position[1] >= 1.1 && prop.position[1] <= 3 && prop.position[2] >= 2 && prop.position[2] <= 5, `${islandId} keeps props in its visible local staging area`);
    }

    assert.equal(event.beats.length, 3, `${islandId} has cause, action, and reaction beats`);
    assert.deepEqual(event.beats.map(({ id }) => id), ['cause', 'action', 'reaction']);
    assert.equal(event.beats.reduce((total, beat) => total + beat.duration, 0), 8, `${islandId} arrival lasts about eight seconds`);
    for (const beat of event.beats) {
      assert.ok(beat.duration > 0);
      assert.deepEqual(Object.keys(beat).sort(), ['actions', 'caption', 'duration', 'id']);
      assert.deepEqual(Object.keys(beat.caption).sort(), ['actorId', 'text']);
      assert.ok(event.cast.some(({ actorId }) => actorId === beat.caption.actorId));
      assert.ok(beat.caption.text.length >= 4);
      assert.ok(beat.actions.length > 0, `${islandId}/${beat.id} has a visible event action`);
    }
  }
});

test('arrival actions stay within the supported vocabulary and keep actors and props reachable', () => {
  for (const scene of data.scenes) {
    const { islandId, arrivalEvent: event } = scene;
    const actorIds = new Set(event.cast.map(({ actorId }) => actorId));
    const propById = new Map(event.props.map((prop) => [prop.id, prop]));
    const actorById = new Map(event.cast.map((actor) => [actor.actorId, actor]));

    for (const beat of event.beats) {
      const actorChannels = new Set();
      const propWriters = new Set();
      const walkingActors = new Set();
      const manipulatingActors = new Set();
      for (const action of beat.actions) {
        assert.ok(actionTypes.has(action.type), `${islandId}/${beat.id} uses a supported action`);
        if (action.actorId) assert.ok(actorIds.has(action.actorId), `${islandId}/${beat.id} references a cast actor`);
        if (action.type === 'walk') {
          assert.deepEqual(Object.keys(action).sort(), ['actorId', 'gait', 'to', 'type']);
          assert.ok(['walk', 'hesitate', 'pass'].includes(action.gait));
          assert.ok(vector(action.to));
          assert.equal(action.to[1], 1.1);
          assert.ok(Math.abs(action.to[0]) <= 4 && action.to[2] >= 2 && action.to[2] <= 5);
          walkingActors.add(action.actorId);
          assert.ok(!actorChannels.has(`movement:${action.actorId}`), `${islandId}/${beat.id} has one movement writer per actor`);
          actorChannels.add(`movement:${action.actorId}`);
        } else if (action.type === 'look') {
          assert.deepEqual(Object.keys(action).sort(), ['actorId', 'target', 'type']);
          assert.equal(Object.keys(action.target).length, 1);
          if (action.target.actorId) assert.ok(actorIds.has(action.target.actorId));
          if (action.target.propId) assert.ok(propById.has(action.target.propId));
          const targetId = action.target.actorId ? `actor:${action.target.actorId}` : `prop:${action.target.propId}`;
          assert.ok(!actorChannels.has(`look:${targetId}`), `${islandId}/${beat.id} has one look writer per target`);
          actorChannels.add(`look:${targetId}`);
        } else if (action.type === 'gesture') {
          assert.deepEqual(Object.keys(action).sort(), ['actorId', 'gesture', 'type']);
          assert.ok(gestures.has(action.gesture));
          assert.ok(!actorChannels.has(`gesture:${action.actorId}`), `${islandId}/${beat.id} has one gesture writer per actor`);
          actorChannels.add(`gesture:${action.actorId}`);
        } else if (action.type === 'manipulate') {
          assert.deepEqual(Object.keys(action).sort(), ['actorId', 'operation', 'propId', 'to', 'type']);
          assert.ok(['lift', 'flip', 'place'].includes(action.operation));
          assert.ok(propById.has(action.propId));
          assert.ok(vector(action.to));
          assert.ok(action.to[0] >= -4 && action.to[0] <= 4 && action.to[1] >= 1.5 && action.to[1] <= 2.8 && action.to[2] >= 2 && action.to[2] <= 5);
          manipulatingActors.add(action.actorId);
          assert.ok(!propWriters.has(action.propId), `${islandId}/${beat.id} has one writer for each manipulated prop`);
          propWriters.add(action.propId);
        } else if (action.type === 'exchange') {
          assert.deepEqual(Object.keys(action).sort(), ['actorId', 'propId', 'receiverId', 'to', 'type']);
          assert.ok(actorIds.has(action.receiverId));
          assert.ok(propById.has(action.propId));
          assert.ok(vector(action.to));
          assert.ok(close(actorById.get(action.actorId).position, actorById.get(action.receiverId).position) <= 1.6, `${islandId} keeps exchange partners close enough to meet`);
          manipulatingActors.add(action.actorId);
          manipulatingActors.add(action.receiverId);
          assert.ok(!propWriters.has(action.propId), `${islandId}/${beat.id} has one writer for each exchanged prop`);
          propWriters.add(action.propId);
        } else if (action.type === 'transform') {
          assert.deepEqual(Object.keys(action).sort(), ['propId', 'rotation', 'to', 'type']);
          assert.ok(propById.has(action.propId));
          assert.ok(vector(action.to) && vector(action.rotation));
          assert.ok(!propWriters.has(action.propId), `${islandId}/${beat.id} has one writer for each transformed prop`);
          propWriters.add(action.propId);
        } else if (action.type === 'crowd') {
          assert.deepEqual(Object.keys(action).sort(), ['count', 'mode', 'targetPropId', 'type']);
          assert.ok(['gather', 'sing', 'listen'].includes(action.mode));
          assert.ok(propById.has(action.targetPropId));
          assert.ok(Number.isInteger(action.count) && action.count >= 3 && action.count <= 6);
        }
      }
      for (const actorId of walkingActors) {
        assert.ok(!manipulatingActors.has(actorId), `${islandId}/${beat.id} does not move and manipulate with the same actor at once`);
      }
    }
  }
});

test('arrival stories use distinct island details instead of repeating a card-and-wave template', () => {
  const layouts = data.scenes.map(({ arrivalEvent }) => JSON.stringify([
    arrivalEvent.cast.map(({ actorId, position }) => [actorId, position]),
    arrivalEvent.props.map(({ kind, position, label }) => [kind, position, label]),
  ]));
  const usedKinds = new Set(data.scenes.flatMap(({ arrivalEvent }) => arrivalEvent.props.map(({ kind }) => kind)));
  const usedActions = new Set(data.scenes.flatMap(({ arrivalEvent }) => arrivalEvent.beats.flatMap(({ actions }) => actions.map(({ type }) => type))));
  assert.equal(new Set(layouts).size, 22);
  assert.ok(usedKinds.size >= 10);
  assert.deepEqual(usedActions, actionTypes);

  assert.ok(hasAction('I01', 'gesture', (action) => action.actorId === 'achi' && action.gesture === 'pen-stop'));
  assert.ok(hasAction('I01', 'look', (action) => action.actorId === 'yingzhen' && action.target.propId === 'value-sheet'));
  assert.ok(hasAction('I02', 'transform', (action) => action.propId === 'message-route'));
  assert.ok(hasAction('I02', 'walk', (action) => action.actorId === 'yue' && action.gait === 'hesitate'));
  assert.ok(hasAction('P01', 'manipulate', (action) => action.propId === 'unmarked-photo' && action.operation === 'flip'));
  assert.ok(hasAction('P01', 'gesture', (action) => action.actorId === 'fenjie' && action.gesture === 'hesitate'));
  assert.ok(hasAction('P02', 'gesture', (action) => action.actorId === 'fenjie' && action.gesture === 'listen'));
  assert.ok(hasAction('P03', 'gesture', (action) => action.actorId === 'yingzhen' && action.gesture === 'mark'));
  assert.ok(hasProp('P04', ({ kind }) => kind === 'barrier') && hasProp('P04', ({ kind }) => kind === 'tray'));
  assert.ok(hasAction('P04', 'manipulate', (action) => action.operation === 'place' && action.propId === 'draft-story'));
  assert.ok(hasAction('P05', 'manipulate', (action) => action.operation === 'lift' && action.propId === 'recommended-product'));
  assert.ok(hasAction('P05', 'look', (action) => action.target.propId === 'life-photo'));
  assert.ok(hasAction('P06', 'crowd', (action) => action.mode === 'sing' && action.count >= 3 && action.count <= 5));
  assert.ok(hasProp('P07', ({ kind }) => kind === 'phone') && hasProp('P07', ({ kind }) => kind === 'photo'));
  assert.ok(data.scenes.find(({ islandId }) => islandId === 'P08').arrivalEvent.props.filter(({ kind }) => kind === 'sign').length >= 3);
  assert.equal(allActions('P08').some(({ type }) => type === 'crowd'), false);
  assert.ok(hasProp('P09', ({ kind }) => kind === 'radio'));
  assert.ok(hasAction('P09', 'crowd', (action) => action.mode === 'gather'));
  assert.ok(hasAction('P09', 'crowd', (action) => action.mode === 'listen'));
  assert.equal(allActions('P09').some(({ type, mode }) => type === 'crowd' && mode === 'sing'), false);
  assert.ok(hasAction('M01', 'manipulate', (action) => action.propId === 'simulation-card' && action.operation === 'place'));
  assert.ok(hasAction('M01', 'manipulate', (action) => action.propId === 'sample-scenario' && action.operation === 'flip'));
  assert.ok(hasAction('M02', 'gesture', (action) => action.actorId === 'achi' && action.gesture === 'point'));
  assert.ok(hasAction('M03', 'gesture', (action) => action.actorId === 'achi' && action.gesture === 'hesitate'));
  assert.ok(sceneByIslandId.get('M04').arrivalEvent.cast.some(({ actorId }) => actorId === 'yue'));
  assert.ok(hasAction('M04', 'gesture', (action) => action.actorId === 'fenjie' && action.gesture === 'listen'));
  assert.ok(hasProp('M05', ({ kind }) => kind === 'lamp') && hasProp('M05', ({ kind }) => kind === 'curtain'));
  assert.ok(hasAction('A01', 'exchange', (action) => action.actorId === 'yue' && action.receiverId === 'fenjie' && action.propId === 'delivery-slip'));
  assert.ok(hasAction('A02', 'manipulate', (action) => action.propId === 'task-board' && action.operation === 'flip'));
  assert.equal(allActions('A03').filter(({ type, actorId }) => type === 'walk' && actorId === 'yue').length, 2);
  assert.ok(hasAction('A03', 'manipulate', (action) => action.actorId === 'achi' && action.propId === 'distinctive-object' && action.operation === 'place'));
  assert.ok(hasAction('A04', 'manipulate', (action) => action.propId === 'off-tone-asset' && action.operation === 'place'));
  assert.ok(hasAction('A05', 'manipulate', (action) => action.actorId === 'yingzhen' && action.propId === 'local-market-asset' && action.operation === 'place'));
  assert.ok(['achi', 'yue', 'fenjie'].every((actorId) => sceneByIslandId.get('A06').arrivalEvent.cast.some((actor) => actor.actorId === actorId)));
  assert.ok(hasAction('A06', 'manipulate', (action) => action.actorId === 'achi' && action.propId === 'achi-pencil' && action.operation === 'place'));
  assert.equal(allActions('A06').some(({ type, actorId }) => type === 'exchange' && actorId === 'yue'), false);
  assert.equal(sceneByIslandId.get('A06').arrivalEvent.handoff.propId, 'opening-value-sheet');
});

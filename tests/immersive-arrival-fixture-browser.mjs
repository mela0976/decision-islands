import assert from 'node:assert/strict';
import * as THREE from 'three';
import { addContactRig } from '../public/immersive/character-events.js';
import { createArrivalEvents } from '../public/immersive/arrival-events.js';
const cast = new THREE.Group(), detail = new THREE.Group();
const mesh = (parent, form, color, position, scale) => {
  const object = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  object.position.fromArray(position); object.scale.fromArray(scale); parent.add(object); return object;
};
const actors = ['achi', 'yue'].map(id => {
  const root = new THREE.Group(); cast.add(root); const head = new THREE.Object3D(); root.add(head);
  const actor = { id, root, head, skin: '#ccc', color: '#ddd', arms: [-1, 1].map(() => mesh(root, '', '', [0, 0, 0], [1, 1, 1])), legs: [], brows: [], mouth: mesh(root, '', '', [0, 0, 0], [1, 1, 1]), prop: mesh(root, '', '', [0, 0, 0], [1, 1, 1]) };
  addContactRig(actor, mesh); return actor;
});
const script = { id: 'fixture-arrival', props: [{ id: 'card', kind: 'paper', position: [.4, 2, 2.4], scale: [.5, .3, .04] }], cast: [{ actorId: 'achi', position: [0, 1.1, 2] }, { actorId: 'yue', position: [1, 1.1, 2] }], handoff: { propId: 'card', question: '你會先確認什麼？' }, beats: [
  { id: 'cause', duration: 2, caption: { actorId: 'achi', text: '報告到了，這頁卻不一樣。' }, actions: [{ type: 'manipulate', actorId: 'achi', propId: 'card', operation: 'lift', to: [.4, 2, 2.4] }] },
  { id: 'action', duration: 2, caption: { actorId: 'yue', text: '讓我看一下。' }, actions: [{ type: 'exchange', actorId: 'achi', receiverId: 'yue', propId: 'card', to: [.7, 2, 2.4] }] },
  { id: 'reaction', duration: 2, caption: { actorId: 'yue', text: '先把這一頁留下。' }, actions: [{ type: 'manipulate', actorId: 'yue', propId: 'card', operation: 'place', to: [1, 1.3, 2.4] }] },
] };
const captions = [], controller = createArrivalEvents({ actors, cast, mesh, onCaption: (caption, detail) => captions.push({ caption, detail }) });
const island = { articleId: 'fixture', detail, sceneData: { arrivalEvent: script } };
controller.start({ island }); controller.update(2.9);
assert.equal(controller.state().phase, 'action'); assert.equal(controller.state().props[0].owner, 'achi');
controller.update(.2); assert.equal(controller.state().props[0].owner, 'yue');
assert.equal(controller.state().props[0].contactDistance, 0);
const elapsed = controller.state().elapsed; assert.equal(controller.state().elapsed, elapsed);
controller.skip(); assert.equal(controller.state().complete, true); assert.equal(controller.state().skipped, true);
assert.deepEqual(controller.state().history, ['cause', 'action', 'reaction']);
assert.deepEqual(controller.state().props[0].position, [1, 1.3, 2.4]); assert.equal(controller.state().props[0].owner, null);
assert.equal(controller.state().props[0].supported, true); assert.equal(detail.children.length, 1);
controller.cancel(); assert.equal(detail.children.length, 0); assert.equal(controller.state(), null);
controller.start({ island, reducedMotion: true }); assert.equal(controller.state().complete, true);
controller.cancel(); assert.ok(actors.every(actor => actor.prop.visible));
console.log('arrival fixture passed ownership, transfer, supported release, skip, reduced final and cleanup');
const { readFile } = await import('node:fs/promises');
const { buildData } = await import('../public/immersive/data.js');
const edition = buildData(JSON.parse(await readFile(new URL('../public/data/2026.json', import.meta.url), 'utf8')));
const farScene = edition.scenes.find(scene => scene.islandId === 'P04');
const researcher = actors[0]; researcher.id = 'yingzhen';
actors[1].id = 'achi';
const farIsland = { articleId: farScene.articleId, detail, sceneData: farScene };
controller.start({ island: farIsland });
let previous = controller.state();
const start = farScene.arrivalEvent.props.find(prop => prop.id === 'draft-story').position;
for (let frame = 0; frame < 410; frame++) {
  controller.update(.02);
  const state = controller.state(), prop = state.props.find(prop => prop.id === 'draft-story');
  const before = previous.props.find(prop => prop.id === 'draft-story');
  assert.ok(vectorDistance(prop.position, before.position) < .08, `P04 frame ${frame} prop stays continuous`);
  for (const actor of state.participants) {
    const prior = previous.participants.find(item => item.actorId === actor.actorId);
    assert.ok(vectorDistance(actor.position, prior.position) < .1, `P04 ${actor.actorId} walk stays continuous`);
  }
  if (state.elapsed < farScene.arrivalEvent.beats[0].duration + farScene.arrivalEvent.beats[1].duration * .3) { assert.equal(prop.owner, null); assert.equal(prop.supported, true); assert.deepEqual(prop.position, start); }
  if (prop.owner) assert.ok(prop.contactDistance < .01, `P04 hand reaches before owning ${prop.contactDistance}`);
  previous = state;
}
assert.equal(previous.complete, true); controller.cancel();
function vectorDistance(a, b) { return Math.hypot(...a.map((value, index) => value - b[index])); }
console.log('real P04 far-distance approach keeps supported prop still until contact and every frame continuous');

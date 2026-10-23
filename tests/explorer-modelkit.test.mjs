import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';

const vite = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' });
const { MODEL_BUILDERS, createModelKit } = await vite.ssrLoadModule('/src/explorer-modelkit.ts');
const { createExplorerEnvironment } = await vite.ssrLoadModule('/src/explorer-environment.ts');
after(() => vite.close());

const modelKinds = ['book', 'pavilion', 'classroom', 'observatory', 'studio', 'bridge', 'garden', 'stage', 'clock', 'globe', 'workshop', 'lighthouse'];
const geometryKinds = ['box', 'rbox', 'cylinder', 'cone', 'sphere', 'ico', 'dome', 'torus', 'prism', 'hip', 'glowbox', 'glowsphere'];
const placements = modelKinds.map((model, index) => ({
  id: `placement-${model}`,
  model,
  position: [index * 2, 0.65, -index] ,
  scale: 1,
  color: '#db6a41',
  rotation: index * 0.13,
}));
const island = { id: 'island-1', title: { zh: '島', en: 'Island' }, description: { zh: '', en: '' }, axial: [0, 0], color: '#c5b5a7', ground: 'brick', tree: 'pine', itemIds: [] };
const data = {
  schemaVersion: 1,
  year: 2026,
  seed: 20261023,
  title: { zh: '決策群島', en: 'Decision Islands' },
  layout: { radius: 2.02, spacing: 2.28, top: 0.65, waterY: -0.18 },
  articles: [],
  islands: [island],
  items: [],
  flows: [],
  roles: [],
  daySegments: [],
  dayKeyframes: [{ minute: 720, skyTop: '9fd0ec', horizon: 'f4eee3', sunColor: 'fff1de', sunIntensity: 2.9, hemiSky: 'eef6fa', hemiGround: '8f8270', hemiIntensity: 1.35, night: 0, water: 'a9d8db' }],
};
const day = { minute: 1260, skyTop: '22325f', horizon: '445488', sunColor: 'c0ccff', sunIntensity: 1.2, hemiSky: '98a8dc', hemiGround: '685a6e', hemiIntensity: 1.9, night: 1, water: '5a88b2', sunDirection: [0.35, 0.8, 0.48] };
const readColor = (mesh, index) => { const result = new THREE.Color(); mesh.getColorAt(index, result); return result; };
const colorDistance = (first, second) => Math.hypot(...first.toArray().map((value, index) => value - second.toArray()[index]));

test('the total model registry builds all twelve owner-addressable, repeatable archetypes', () => {
  assert.deepEqual(Object.keys(MODEL_BUILDERS), modelKinds);
  const first = createModelKit(placements, 20261023);
  const second = createModelKit(placements, 20261023);
  assert.ok(first.hitMeshes.some(mesh => mesh.name === 'explorer-model-rbox'));
  assert.deepEqual(new Set(first.hitMeshes.map(mesh => mesh.name.slice('explorer-model-'.length))), new Set(geometryKinds));
  assert.deepEqual(first.hitMeshes.map(mesh => mesh.count), second.hitMeshes.map(mesh => mesh.count));
  for (let i = 0; i < first.hitMeshes.length; i++) {
    assert.deepEqual(Array.from(first.hitMeshes[i].instanceMatrix.array), Array.from(second.hitMeshes[i].instanceMatrix.array));
    assert.deepEqual(Array.from(first.hitMeshes[i].instanceColor.array), Array.from(second.hitMeshes[i].instanceColor.array));
  }
  for (const mesh of first.hitMeshes) for (let i = 0; i < mesh.count; i++) assert.ok(placements.some(placement => placement.id === first.resolveHit(mesh, i)));
  assert.equal(first.resolveHit(first.group, 0), null);
  first.dispose();
  second.dispose();
});

test('each archetype stays inside the shared ground footprint and height envelope', () => {
  for (const model of modelKinds) {
    const kit = createModelKit([{ ...placements[modelKinds.indexOf(model)], id: `bounds-${model}`, position: [0, 0, 0], scale: 1, color: '#58a6a6', rotation: 0 }], 19);
    const bounds = new THREE.Box3();
    const oversizedParts = [];
    for (const mesh of kit.hitMeshes) {
      mesh.geometry.computeBoundingBox();
      for (let index = 0; index < mesh.count; index++) {
        const transform = new THREE.Matrix4();
        mesh.getMatrixAt(index, transform);
        const part = mesh.geometry.boundingBox.clone().applyMatrix4(transform);
        if (part.min.x < -0.51 || part.max.x > 0.51 || part.min.z < -0.51 || part.max.z > 0.51) oversizedParts.push(`${mesh.name}[${index}] x=${part.min.x.toFixed(3)}..${part.max.x.toFixed(3)} z=${part.min.z.toFixed(3)}..${part.max.z.toFixed(3)}`);
        bounds.union(part);
      }
    }
    assert.ok(bounds.min.x >= -0.51 && bounds.max.x <= 0.51, `${model} width is bounded (${bounds.min.x}, ${bounds.max.x}); ${oversizedParts.join(', ')}`);
    assert.ok(bounds.min.z >= -0.51 && bounds.max.z <= 0.51, `${model} depth is bounded (${bounds.min.z}, ${bounds.max.z}); ${oversizedParts.join(', ')}`);
    assert.ok(bounds.min.y >= -0.01 && bounds.max.y <= 1.51, `${model} height is bounded (${bounds.min.y}, ${bounds.max.y})`);
    kit.dispose();
  }
});

test('highlight recalculates from base color in yellow-then-coral order and night emission is reversible', () => {
  const kit = createModelKit([placements[0], { ...placements[1], position: [2, 0.65, 0] }], 31);
  const mesh = kit.hitMeshes.find(value => value.name === 'explorer-model-glowbox');
  assert.ok(mesh);
  const instanceId = Array.from({ length: mesh.count }, (_, index) => index).find(index => kit.resolveHit(mesh, index) === 'placement-pavilion');
  const base = readColor(mesh, instanceId);
  kit.highlight(new Set(), new Set(['placement-pavilion']));
  const yellow = readColor(mesh, instanceId);
  assert.ok(colorDistance(yellow, base.clone().lerp(new THREE.Color('#fcea8b'), 0.22)) < 1e-6);
  kit.highlight(new Set(['placement-pavilion']), new Set(['placement-pavilion']));
  const selected = readColor(mesh, instanceId);
  assert.ok(colorDistance(selected, base.clone().lerp(new THREE.Color('#fcea8b'), 0.22).lerp(new THREE.Color('#db6a41'), 0.22)) < 1e-6);
  kit.highlight(new Set(), new Set());
  assert.ok(colorDistance(readColor(mesh, instanceId), base) < 1e-6);
  kit.setNight(0.5);
  assert.equal(mesh.material.emissiveIntensity, 1.6);
  kit.setNight(0);
  assert.equal(mesh.material.emissiveIntensity, 0);
  kit.dispose();
});

test('environment keeps seeded tree placement, mobile counts, day-cycle state and seasonal groups', () => {
  const first = createExplorerEnvironment(data);
  const second = createExplorerEnvironment(data);
  assert.ok(first.group instanceof THREE.Group);
  assert.ok(first.fog instanceof THREE.Fog);
  assert.equal(first.group.getObjectByName('season-christmas').visible, true);
  assert.equal(first.group.getObjectByName('season-halloween').visible, false);
  assert.equal(first.group.getObjectByName('season-easter').visible, false);
  assert.equal(first.group.getObjectByName('christmas-gifts').count, 18);
  assert.equal(first.group.getObjectByName('christmas-trees').count, 18);
  const firstTrees = first.group.getObjectByName('explorer-pine-trees');
  const secondTrees = second.group.getObjectByName('explorer-pine-trees');
  assert.equal(firstTrees.count + first.group.getObjectByName('explorer-broadleaf-trees').count, 2400);
  assert.deepEqual(Array.from(firstTrees.instanceMatrix.array), Array.from(secondTrees.instanceMatrix.array));
  const firstCloud = first.group.getObjectByName('explorer-cloud-1');
  const cloudStart = firstCloud.position.x;
  first.update(0);
  assert.equal(firstCloud.position.x, cloudStart);
  first.update(2);
  assert.ok(firstCloud.position.x > cloudStart);
  first.setMobile(true);
  assert.equal(firstTrees.count + first.group.getObjectByName('explorer-broadleaf-trees').count, 900);
  first.setMobile(false);
  assert.equal(firstTrees.count + first.group.getObjectByName('explorer-broadleaf-trees').count, 2400);
  first.setSeason('halloween');
  assert.equal(first.group.getObjectByName('season-christmas').visible, false);
  assert.equal(first.group.getObjectByName('season-halloween').visible, true);
  assert.equal(first.group.getObjectByName('halloween-pumpkins').count, 28);
  assert.equal(first.group.getObjectByName('halloween-bats').count, 22);
  first.applyDay(day);
  const nightFog = first.fog.color.clone();
  first.setSeason('easter');
  assert.equal(first.group.getObjectByName('season-easter').visible, true);
  assert.notDeepEqual(first.fog.color.toArray(), nightFog.toArray());
  assert.equal(first.group.getObjectByName('easter-eggs').count, 42);
  first.dispose();
  first.dispose();
  second.dispose();
  first.setSeason('christmas');
  first.update(1);
});

test('model and environment disposal releases each owned resource once', () => {
  const kit = createModelKit(placements, 11);
  const kitCounts = new Map();
  const watch = value => {
    const original = value.dispose.bind(value);
    value.dispose = () => { kitCounts.set(value, (kitCounts.get(value) ?? 0) + 1); original(); };
  };
  for (const mesh of kit.hitMeshes) { watch(mesh); watch(mesh.geometry); watch(mesh.material); }
  kit.dispose(); kit.dispose();
  for (const count of kitCounts.values()) assert.equal(count, 1);

  const environment = createExplorerEnvironment(data);
  const envCounts = new Map();
  const envWatch = value => {
    const original = value.dispose.bind(value);
    value.dispose = () => { envCounts.set(value, (envCounts.get(value) ?? 0) + 1); original(); };
  };
  const geometries = new Set(), materials = new Set(), meshes = new Set();
  environment.group.traverse(object => {
    if (object instanceof THREE.Mesh) { geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material); }
    if (object instanceof THREE.InstancedMesh) meshes.add(object);
  });
  for (const value of [...geometries, ...materials, ...meshes]) envWatch(value);
  environment.dispose(); environment.dispose();
  assert.equal(envCounts.size, geometries.size + materials.size + meshes.size);
  for (const count of envCounts.values()) assert.equal(count, 1);
});

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';

const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
  logLevel: 'error',
});
const [{ createMission3DAssets }, { MISSION_PROPS, MISSION_SETTINGS }] = await Promise.all([
  vite.ssrLoadModule('/src/mission-3d-assets.ts'),
  vite.ssrLoadModule('/src/mission-stage-types.ts'),
]);
after(() => vite.close());

const meshes = (root) => {
  const result = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) result.push(object);
  });
  return result;
};

const boundsOf = (root) => {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root);
};

const materialSet = (root) => new Set(meshes(root).map((mesh) => mesh.material));

test('all eight rooms are rounded 3D cutaways with their recognizable setting furniture', () => {
  const assets = createMission3DAssets();
  const signature = new Set();

  const expectedFeatures = {
    home: ['home-window', 'home-sofa', 'home-bookshelf', 'mission-table'],
    community: ['community-workshop-sign', 'community-plant-left', 'community-workshop-board'],
    office: ['office-desk-left', 'office-desk-right', 'office-project-board'],
    commute: ['commute-train', 'commute-yellow-safety-line', 'commute-platform'],
    'brand-studio': ['brand-studio-moodboard', 'brand-studio-product-display-0'],
    meeting: ['meeting-long-table', 'meeting-whiteboard', 'meeting-chair-left'],
    production: ['production-light-0', 'production-camera-rig', 'production-backdrop'],
    'insight-lab': ['insight-lab-research-screen', 'insight-lab-chart-board', 'insight-lab-plant'],
  };

  for (const setting of MISSION_SETTINGS) {
    const room = assets.room(setting);
    assert.ok(room instanceof THREE.Group, setting);
    assert.equal(room.userData.setting, setting);
    assert.strictEqual(assets.room(setting), room, setting + ' room reuse');
    for (const feature of expectedFeatures[setting]) assert.ok(room.getObjectByName(feature), setting + ' includes ' + feature);

    const allMeshes = meshes(room);
    assert.ok(allMeshes.length > 45, setting + ' contains physical room geometry');
    assert.ok(allMeshes.every((mesh) => mesh.geometry instanceof THREE.BufferGeometry), setting + ' has real mesh geometry');
    assert.ok(allMeshes.every((mesh) => mesh.material instanceof THREE.MeshStandardMaterial), setting + ' uses lit materials');
    assert.ok(allMeshes.every((mesh) => mesh.castShadow && mesh.receiveShadow), setting + ' geometry participates in shadows');

    const bounds = boundsOf(room);
    assert.ok(bounds.min.x <= -5 && bounds.max.x >= 5, setting + ' floor width spans ten units');
    assert.ok(bounds.min.z <= -3 && bounds.max.z >= 3, setting + ' floor depth spans six units');
    assert.ok(bounds.min.y < 0 && bounds.max.y > 2.5, setting + ' has a raised island and room walls');
    assert.ok(room.getObjectByName('room-wall-back'));
    assert.ok(room.getObjectByName('room-wall-left'));
    assert.equal(room.getObjectByName('room-wall-front'), undefined, setting + ' remains open to the camera');
    assert.equal(room.getObjectByName('room-wall-right'), undefined, setting + ' remains open on the right');
    signature.add(setting + ':' + allMeshes.length + ':' + bounds.max.y.toFixed(2));
  }

  assert.equal(signature.size, MISSION_SETTINGS.length, 'every setting has a distinct room build');
  assets.dispose();
});
test('every mission kind builds a compact shadowed model and all actors expose six animation joints', () => {
  const assets = createMission3DAssets();
  const models = new Map();

  for (const kind of MISSION_PROPS) {
    const model = assets.entity(kind, 'entity-' + kind);
    models.set(kind, model);
    assert.ok(model.root instanceof THREE.Group, kind + ' root');
    assert.equal(model.root.userData.kind, kind);
    assert.equal(model.root.userData.id, 'entity-' + kind);
    const modelMeshes = meshes(model.root);
    assert.ok(modelMeshes.length > 0, kind + ' has visible three-dimensional geometry');
    assert.ok(modelMeshes.every((mesh) => mesh.material instanceof THREE.MeshStandardMaterial), kind + ' is lit');
    assert.ok(modelMeshes.every((mesh) => mesh.castShadow && mesh.receiveShadow), kind + ' casts and receives shadows');
    const bounds = boundsOf(model.root);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok([size.x, size.y, size.z].every(Number.isFinite), kind + ' has finite bounds');
    assert.ok(size.x > 0.05 && size.y > 0.35 && size.z > 0.03, kind + ' has a readable 3D silhouette');
    assert.ok(bounds.min.y >= -0.04 && bounds.max.y < 1.65, kind + ' fits the actor or tabletop scale');

    if (['adult', 'child', 'elder', 'robot'].includes(kind)) {
      assert.ok(model.joints, kind + ' has an articulated rig');
      assert.deepEqual(Object.keys(model.joints).sort(), ['head', 'leftArm', 'leftLeg', 'rightArm', 'rightLeg', 'torso']);
      for (const [jointName, joint] of Object.entries(model.joints)) {
        assert.ok(joint instanceof THREE.Group, kind + '/' + jointName + ' is an animatable group');
        assert.ok(meshes(joint).length > 0, kind + '/' + jointName + ' owns visible geometry');
      }
    } else {
      assert.equal(model.joints, undefined, kind + ' is not an actor');
    }
  }

  const actorHeights = Object.fromEntries(['adult', 'child', 'elder', 'robot'].map((kind) => {
    const bounds = boundsOf(models.get(kind).root);
    return [kind, bounds.max.y - bounds.min.y];
  }));
  assert.ok(actorHeights.adult > 1.42 && actorHeights.adult < 1.58, 'adult actor is about 1.5 units tall');
  assert.ok(actorHeights.child > 0.92 && actorHeights.child < 1.1, 'child actor is about 1.0 unit tall');
  assert.ok(actorHeights.elder > 1.3 && actorHeights.elder < 1.52, 'elder actor is about 1.4 units tall');
  assert.ok(actorHeights.robot > 1.2 && actorHeights.robot < 1.5, 'robot actor is about 1.3 units tall');
  assets.dispose();
});

test('entity assets reuse stable IDs while keeping distinct entities materials isolated', () => {
  const assets = createMission3DAssets();
  const first = assets.entity('adult', 'repeatable-id');
  const separate = assets.entity('adult', 'other-id');
  assert.strictEqual(assets.entity('adult', 'repeatable-id'), first, 'a removed mission can reuse its stable actor');
  assert.equal(materialSet(first.root).size, meshes(first.root).length, 'each mesh owns an independently adjustable material');
  assert.equal([...materialSet(first.root)].some((material) => materialSet(separate.root).has(material)), false, 'entities never share mutable materials');

  first.root.position.set(8, 8, 8);
  first.root.rotation.y = 1;
  first.joints.leftArm.rotation.x = 0.8;
  meshes(first.root)[0].material.opacity = 0.3;
  const reused = assets.entity('adult', 'repeatable-id');
  assert.strictEqual(reused.root, first.root);
  assert.deepEqual(reused.root.position.toArray(), [0, 0, 0]);
  assert.deepEqual(reused.root.rotation.toArray(), [0, 0, 0, 'XYZ']);
  assert.equal(reused.joints.leftArm.rotation.x, 0);
  assert.equal(meshes(reused.root)[0].material.opacity, 1);
  const lens = meshes(assets.entity('magnifier', 'lens').root).find(mesh => mesh.material.opacity < 1);
  const originalLens = {opacity:lens.material.opacity,transparent:lens.material.transparent,depthWrite:lens.material.depthWrite};
  lens.material.opacity = 0;
  assets.entity('magnifier', 'lens');
  assert.deepEqual({opacity:lens.material.opacity,transparent:lens.material.transparent,depthWrite:lens.material.depthWrite}, originalLens, 'cached optics preserve their intended transparent material');
  assets.dispose();
});

test('resource disposal is complete, idempotent, and closes the factory', () => {
  const assets = createMission3DAssets();
  const roots = [...MISSION_SETTINGS.map((setting) => assets.room(setting)), ...MISSION_PROPS.map((kind) => assets.entity(kind, 'dispose-' + kind).root)];
  const allMeshes = roots.flatMap(meshes);
  const geometries = new Set(allMeshes.map((mesh) => mesh.geometry));
  const materials = new Set(allMeshes.map((mesh) => mesh.material));
  const geometryDisposals = new Map([...geometries].map((geometry) => [geometry, 0]));
  const materialDisposals = new Map([...materials].map((material) => [material, 0]));
  for (const geometry of geometryDisposals.keys()) geometry.addEventListener('dispose', () => geometryDisposals.set(geometry, geometryDisposals.get(geometry) + 1));
  for (const material of materialDisposals.keys()) material.addEventListener('dispose', () => materialDisposals.set(material, materialDisposals.get(material) + 1));

  assets.dispose();
  assets.dispose();
  assert.ok([...geometryDisposals.values()].every((count) => count === 1), 'shared geometry is released once');
  assert.ok([...materialDisposals.values()].every((count) => count === 1), 'entity-private materials are released once');
  assert.throws(() => assets.room('home'), /disposed/);
  assert.throws(() => assets.entity('adult', 'after-dispose'), /disposed/);
});

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const moduleDirectory = mkdtempSync(join(testDirectory, '.library-holidays-'));
const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };

for (const name of ['entrance', 'season', 'library-materials', 'library-scene']) {
  let source = readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8');
  source = ts.transpileModule(source, { compilerOptions }).outputText;
  source = source.replaceAll("from './entrance'", "from './entrance.mjs'")
    .replaceAll("from './season'", "from './season.mjs'")
    .replaceAll("from './library-materials'", "from './library-materials.mjs'");
  writeFileSync(join(moduleDirectory, `${name}.mjs`), source);
}

const originalDocument = globalThis.document;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
let frameRequests = 0;
globalThis.requestAnimationFrame = () => { frameRequests++; };
globalThis.document = {
  createElement(name) {
    assert.equal(name, 'canvas');
    const canvas = { width: 1, height: 1 };
    const context = new Proxy({
      canvas,
      measureText: value => ({ width: String(value).length * 7 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    }, {
      get(target, key) {
        return key in target ? target[key] : () => {};
      },
    });
    canvas.getContext = () => context;
    return canvas;
  },
};

const [{ createLibraryScene }, { HOLIDAYS }, THREE] = await Promise.all([
  import(pathToFileURL(join(moduleDirectory, 'library-scene.mjs'))),
  import(pathToFileURL(join(moduleDirectory, 'season.mjs'))),
  import('three'),
]);

after(() => {
  rmSync(moduleDirectory, { recursive: true, force: true });
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
  else globalThis.requestAnimationFrame = originalRequestAnimationFrame;
});

function visibleDecorations(root, prefix) {
  return root.children.filter(child => child.name.startsWith(prefix) && child.visible);
}

function assertSeason(scene, season) {
  const treeGroups = visibleDecorations(scene.tree, 'holiday-tree-');
  const groundGroups = visibleDecorations(scene.group, 'holiday-ground-');
  assert.equal(treeGroups.length, 1);
  assert.equal(treeGroups[0].name, `holiday-tree-${season}`);
  assert.equal(groundGroups.length, 1);
  assert.equal(groundGroups[0].name, `holiday-ground-${season}`);
  for (const decoration of [treeGroups[0], groundGroups[0]]) {
    let meshCount = 0;
    decoration.traverse(object => {
      if (object.isMesh) {
        meshCount++;
        assert.ok(object.geometry?.getAttribute('position')?.count > 0);
      }
    });
    assert.ok(meshCount >= 2);
  }
  const sky = scene.group.getObjectByName('library-ambient-sky');
  const daylight = scene.group.getObjectByName('library-glass-atrium-daylight');
  const treeGlow = scene.tree.getObjectByName('tree-garland-glow');
  assert.equal(sky.color.getHexString(), new THREE.Color(HOLIDAYS[season].sky).getHexString());
  assert.equal(daylight.color.getHexString(), new THREE.Color(HOLIDAYS[season].glow).getHexString());
  assert.equal(treeGlow.color.getHexString(), new THREE.Color(HOLIDAYS[season].glow).getHexString());
}

function trackOwnedResources(scene) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  scene.group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean)) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  const resources = [...geometries, ...materials, ...textures];
  const counts = new Map(resources.map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  return counts;
}

test('圖書館節慶裝飾切換、轉速與資源回收', () => {
  const scene = createLibraryScene();
  const resourceDisposals = trackOwnedResources(scene);
  assertSeason(scene, 'christmas');
  assert.ok(scene.tree.getObjectByName('holiday-tree-christmas').getObjectByName('faceted-brass-star'));
  scene.update(37.5);
  assert.ok(Math.abs(scene.tree.rotation.y - Math.PI / 2) < 1e-12);
  const rotation = scene.tree.rotation.y;

  for (const season of ['halloween', 'easter', 'christmas']) {
    scene.setSeason(season);
    assertSeason(scene, season);
    assert.equal(scene.tree.rotation.y, rotation);
    assert.equal(frameRequests, 0);
    const colorSnapshot = [
      scene.group.getObjectByName('library-ambient-sky').color.getHex(),
      scene.group.getObjectByName('library-glass-atrium-daylight').color.getHex(),
    ];
    const activeSnapshot = [
      ...visibleDecorations(scene.tree, 'holiday-tree-'),
      ...visibleDecorations(scene.group, 'holiday-ground-'),
    ].map(group => group.name);
    scene.setSeason(season);
    assert.deepEqual([
      scene.group.getObjectByName('library-ambient-sky').color.getHex(),
      scene.group.getObjectByName('library-glass-atrium-daylight').color.getHex(),
    ], colorSnapshot);
    assert.deepEqual([
      ...visibleDecorations(scene.tree, 'holiday-tree-'),
      ...visibleDecorations(scene.group, 'holiday-ground-'),
    ].map(group => group.name), activeSnapshot);
    assert.equal(scene.tree.rotation.y, rotation);
  }

  for (const delta of [0, -1, NaN, Infinity, -Infinity]) {
    scene.update(delta);
    assert.equal(scene.tree.rotation.y, rotation);
  }
  scene.setSeason('autumn');
  assertSeason(scene, 'christmas');
  scene.dispose();
  scene.dispose();
  assert.equal(scene.group.children.length, 0);
  for (const count of resourceDisposals.values()) assert.equal(count, 1);
  scene.setSeason('easter');
  scene.update(10);
  assert.equal(scene.group.children.length, 0);

  const initialEaster = createLibraryScene('easter');
  const initialEasterResources = trackOwnedResources(initialEaster);
  assertSeason(initialEaster, 'easter');
  initialEaster.dispose();
  for (const count of initialEasterResources.values()) assert.equal(count, 1);
  assert.equal(frameRequests, 0);
});

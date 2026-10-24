import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildData } from '../public/immersive/data.js';
import { createEditorialTextureFactory } from '../public/immersive/editorial-textures.js';

const sourceEdition = JSON.parse(await readFile(new URL('../public/data/2026.json', import.meta.url), 'utf8'));
const themes = buildData(sourceEdition).visualThemes;

function themeConfig(chapterId, islandId, motifId) {
  return themes.find(theme => theme.chapterId === chapterId)?.editorialMotifs?.[islandId]?.[motifId];
}

function canvasDocument() {
  const context = new Proxy({
    createRadialGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(512 * 512 * 4).fill(220) }),
  }, {
    get(target, property) {
      if (property in target) return target[property];
      return () => {};
    },
  });
  return { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
}

test('editorial motifs are scene-specific, seeded, and preserve distinct original and simulated finishes', () => {
  assert.deepEqual(themeConfig('intro', 'I01', 'proposal'), {
    type: 'portrait', finish: 'photo', seed: 20261024, palette: ['#f4f0e7', '#222728', '#777a76'],
  });
  assert.equal(themeConfig('people', 'P01', 'sourcePortrait').finish, 'halftone');
  assert.equal(themeConfig('people', 'P01', 'simulatedPortrait').finish, 'pixel');
  assert.equal(themeConfig('people', 'P04', 'fingerprint').type, 'fingerprint');
  assert.equal(themeConfig('people', 'P07', 'fingerprint').type, 'fingerprint');
  assert.equal(themeConfig('model', 'M01', 'originalPortrait').finish, 'halftone');
  assert.equal(themeConfig('model', 'M01', 'simulatedPortrait').finish, 'pixel');
  assert.equal(themeConfig('ai', 'A03', 'flowerPaper').petalPalettes.length, 3);
  assert.notDeepEqual(
    themeConfig('ai', 'A03', 'flowerPaper').petalPalettes[0],
    themeConfig('ai', 'A03', 'flowerPaper').petalPalettes[1],
  );
});

test('repeated motif requests share one CanvasTexture and release the texture cache', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: canvasDocument() });
  try {
    const ownedTextures = new Set();
    class CanvasTexture {
      constructor(image) { this.image = image; }
    }
    const factory = createEditorialTextureFactory({ CanvasTexture, SRGBColorSpace: 'srgb' }, themes, ownedTextures);
    const original = themeConfig('people', 'P01', 'sourcePortrait');
    const repeated = themeConfig('people', 'P04', 'originalPortrait');
    const source = factory.textureFor(original);
    assert.equal(factory.textureFor(repeated), source);
    assert.equal(factory.cacheSize, 1);
    assert.equal(ownedTextures.size, 1);
    assert.equal(source.colorSpace, 'srgb');
    assert.ok(source.needsUpdate);

    const simulated = factory.textureFor(themeConfig('people', 'P01', 'simulatedPortrait'));
    assert.notEqual(simulated, source);
    assert.equal(factory.cacheSize, 2);
    assert.equal(ownedTextures.size, 2);
    factory.dispose();
    assert.equal(factory.cacheSize, 0);
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const actualThree = require('three');
const source = await readFile(new URL('../public/immersive/intro.js', import.meta.url), 'utf8');
let moduleId = 0;

async function harness({ failRenderer = false } = {}) {
  const saved = new Map();
  const set = (key, value) => { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true }); };
  const frames = new Map(), renderers = [], images = [], tracked = new Set(), disposed = new Set();
  let frameId = 0;
  const canvas = () => ({ style: {}, dataset: {}, listeners: new Map(), setAttribute() {}, addEventListener(name, fn) { this.listeners.set(name, fn); }, removeEventListener(name) { this.listeners.delete(name); }, remove() { this.removed = true; }, getContext() { return { fillRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {} }; } });
  class Renderer {
    constructor() { if (failRenderer) throw new Error('WebGL unavailable'); this.domElement = canvas(); this.shadowMap = {}; this.info = { render: { calls: 0 } }; renderers.push(this); }
    setPixelRatio() {} setClearColor() {} setClearAlpha() {} setSize() {}
    render(scene) {
      this.scene = scene; this.info.render.calls++;
      scene.traverse((object) => {
        for (const value of [object.geometry, ...([object.material].flat().filter(Boolean)), ...([object.material].flat().filter(Boolean).map((material) => material.map).filter(Boolean))]) {
          if (!value || tracked.has(value)) continue;
          tracked.add(value); value.addEventListener('dispose', () => disposed.add(value));
        }
      });
    }
    dispose() { this.disposed = true; } forceContextLoss() { this.lost = true; }
  }
  set('__bookIntroTHREE', { ...actualThree, WebGLRenderer: Renderer });
  set('document', { createElement: canvas });
  set('Image', class { constructor() { images.push(this); } });
  set('ResizeObserver', class { observe() {} disconnect() { this.disconnected = true; } });
  set('requestAnimationFrame', (fn) => { frames.set(++frameId, fn); return frameId; });
  set('cancelAnimationFrame', (id) => frames.delete(id));
  const encoded = Buffer.from(source.replace("import * as THREE from 'three';", 'const THREE = globalThis.__bookIntroTHREE;')).toString('base64');
  const { createBookIntro } = await import(`data:text/javascript;base64,${encoded}#${moduleId++}`);
  const host = { clientWidth: 1280, clientHeight: 800, children: [], appendChild(node) { this.children.push(node); } };
  return {
    createBookIntro, host, frames, renderers, images, tracked, disposed,
    advance(now) { const pending = [...frames.values()]; frames.clear(); pending.forEach((fn) => fn(now)); },
    restore() { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } },
  };
}

test('reduced motion, skip before play, repeated calls and dispose settle without WebGL', async () => {
  const h = await harness({ failRenderer: true });
  try {
    let completed = 0;
    const intro = h.createBookIntro({ reducedMotion: true, onComplete: () => completed++ });
    const playing = intro.play(); assert.equal(intro.play(), playing); await playing;
    intro.skip(); intro.dispose(); intro.dispose();
    assert.equal(completed, 1); assert.equal(intro.getState().phase, 'disposed'); assert.equal(h.renderers.length, 0);
    const skipped = h.createBookIntro({ onComplete: () => completed++ }); skipped.skip(); await skipped.play();
    assert.equal(completed, 2); assert.equal(h.frames.size, 0);
  } finally { h.restore(); }
});

test('renderer failure rejects play promptly so the caller can show its 2D fallback', async () => {
  const h = await harness({ failRenderer: true });
  try {
    const intro = h.createBookIntro({ host: h.host });
    await assert.rejects(intro.play(), /WebGL unavailable/);
    assert.equal(intro.getState().phase, 'failed'); assert.equal(intro.getState().running, false); assert.equal(h.frames.size, 0);
    intro.dispose();
  } finally { h.restore(); }
});

test('real Three geometry travels from book through tower and coasts, then releases every rendered resource', async () => {
  const h = await harness();
  try {
    const captions = []; let completed = 0;
    const intro = h.createBookIntro({ host: h.host, onCaption: (caption) => captions.push(caption), onComplete: () => completed++ });
    const playing = intro.play();
    const phases = [];
    for (const now of [0, 1600, 3000, 4400, 6100, 7100]) { h.advance(now); phases.push(intro.getState().phase); }
    assert.deepEqual(phases, ['cover', 'opening', 'tower', 'archipelago', 'archipelago', 'arrival']);
    assert.equal(intro.getState().pagecount, 28);
    const coasts = h.renderers[0].scene.children.filter((object) => object.geometry?.type === 'BoxGeometry' && object.children.some((child) => child.type === 'Group'));
    assert.equal(coasts.length, 28); assert.ok(coasts.some((coast) => Math.abs(coast.position.x) > 5));
    assert.ok(coasts.every((coast) => coast.children[0].visible));
    h.advance(8600); await playing;
    assert.equal(completed, 1); assert.equal(captions.length, 5); assert.equal(intro.getState().elapsed, 8.6);
    assert.equal(intro.getState().phase, 'complete'); assert.equal(h.frames.size, 0);
    assert.equal(h.disposed.size, h.tracked.size); assert.ok(h.tracked.size > 100);
    assert.ok(h.renderers[0].disposed && h.renderers[0].lost && h.host.children[0].removed);
    assert.equal(h.images[0].onload, null); assert.equal(h.images[0].onerror, null);
  } finally { h.restore(); }
});

test('skip or dispose during a pending texture load cancels the frame and settles once', async () => {
  const h = await harness();
  try {
    for (const action of ['skip', 'dispose']) {
      let completed = 0;
      const intro = h.createBookIntro({ host: h.host, onComplete: () => completed++ });
      const playing = intro.play(); const pendingImage = h.images.at(-1); const staleLoad = pendingImage.onload;
      intro[action](); intro[action](); staleLoad(); await playing;
      assert.equal(completed, 1); assert.equal(h.frames.size, 0); assert.equal(pendingImage.onload, null);
      assert.equal(intro.getState().running, false);
      intro.dispose();
    }
  } finally { h.restore(); }
});

test('context loss rejects a running transition and releases its canvas', async () => {
  const h = await harness();
  try {
    const intro = h.createBookIntro({ host: h.host }); const playing = intro.play();
    let prevented = false;
    h.host.children[0].listeners.get('webglcontextlost')({ preventDefault() { prevented = true; } });
    await assert.rejects(playing, /context lost/);
    assert.equal(prevented, true); assert.equal(h.frames.size, 0); assert.equal(h.host.children[0].removed, true);
  } finally { h.restore(); }
});

test('a loaded cover replaces the procedural fallback and both textures are released', async () => {
  const h = await harness();
  try {
    const intro = h.createBookIntro({ host: h.host }); const playing = intro.play();
    const image = h.images[0]; image.onload(); h.advance(0);
    assert.equal(image.onload, null);
    const textures = [...h.tracked].filter((resource) => resource.isTexture);
    assert.equal(textures.length, 2);
    intro.skip(); await playing;
    assert.ok(textures.every((texture) => h.disposed.has(texture)));
  } finally { h.restore(); }
});

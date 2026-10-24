import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const output = 'test-results/immersive-startup-overlap';
const html = (await readFile('public/immersive/index.html', 'utf8')).replace('<script type="module" src="./app.js"></script>', '');
const source = await readFile('public/immersive/world.js', 'utf8');
const instrumentation = `
  const originalCompile = renderer.compile.bind(renderer);
  renderer.compile = (objects, view, target) => {
    let visibleMaterials = 0;
    target.traverseVisible(object => { if (object.material) visibleMaterials++; });
    window.__compile = { objects: objects.children.length, visibleMaterials, revision: THREE.REVISION, parallelShaderCompile: Boolean(renderer.getContext().getExtension('KHR_parallel_shader_compile')) };
    originalCompile(objects, view, target);
    window.__compile.finished = true;
    if (window.__loseAfterCompile) {
      renderer.getContext().getExtension('WEBGL_lose_context').loseContext();
      window.__contextLost = renderer.getContext().isContextLost();
    }
  };
  const originalRender = renderer.render.bind(renderer);
  renderer.render = (...args) => {
    if (!window.__firstRender) window.__firstRender = {
      loadedFaces: [...document.fonts].filter(face => face.family.replaceAll('"', '') === 'Publication Sans TW' && face.status === 'loaded').length,
      draws: [...window.__textDraws],
    };
    return originalRender(...args);
  };
  const originalDispose = renderer.dispose.bind(renderer);
  renderer.dispose = () => { window.__rendererDisposed = true; window.__releasedOwnership = { geometries: geometries.size, materials: materials.size, textures: textures.size }; return originalDispose(); };
`;
const instrumented = source.replace("  renderer.setPixelRatio(", `${instrumentation}\n  renderer.setPixelRatio(`);
assert.notEqual(instrumented, source);
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false } });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const records = [], errors = [];
try {
  for (const kind of ['success', 'font-failure', 'mixed-font-failure', 'context-loss']) {
    const failFont = kind === 'font-failure' || kind === 'mixed-font-failure';
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/immersive/index.html', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.route('**/immersive/world.js', route => route.fulfill({ contentType: 'text/javascript', body: instrumented }));
    await page.addInitScript(({ failFont, kind }) => {
      window.__loseAfterCompile = kind === 'context-loss';
      window.__worldListeners = [];
      const originalAdd = EventTarget.prototype.addEventListener;
      const originalRemove = EventTarget.prototype.removeEventListener;
      const isWorldTarget = target => target === window || target === document || target.id === 'world';
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (window.__trackWorldListeners && isWorldTarget(this) && /world\.js|OrbitControls\.js/.test(new Error().stack)) window.__worldListeners.push({ target: this, type, listener });
        return originalAdd.call(this, type, listener, options);
      };
      EventTarget.prototype.removeEventListener = function (type, listener, options) {
        const index = window.__worldListeners.findIndex(item => item.target === this && item.type === type && item.listener === listener);
        if (index >= 0) window.__worldListeners.splice(index, 1);
        return originalRemove.call(this, type, listener, options);
      };
      window.__pendingFrames = new Set();
      const originalRAF = requestAnimationFrame;
      const originalCancelRAF = cancelAnimationFrame;
      window.requestAnimationFrame = callback => {
        const id = originalRAF(time => { window.__pendingFrames.delete(id); callback(time); });
        window.__pendingFrames.add(id);
        return id;
      };
      window.cancelAnimationFrame = id => { window.__pendingFrames.delete(id); originalCancelRAF(id); };
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      window.__releaseFonts = () => { window.__gateReleased = true; release(); };
      const originalLoad = document.fonts.load.bind(document.fonts);
      let calls = 0;
      document.fonts.load = (font, text) => {
        const faces = originalLoad(font, text);
        if (++calls > 2) return faces;
        if (kind === 'mixed-font-failure' && calls === 2) { window.__fontKeptPending = true; return new Promise(() => {}); }
        return faces.then(async result => {
          await gate;
          if (failFont) throw new Error('intentional startup font rejection');
          return result;
        });
      };
      window.__textDraws = [];
      const originalFillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        if (this.font.includes('Publication Sans TW')) window.__textDraws.push({ text, font: this.font, released: Boolean(window.__gateReleased) });
        return originalFillText.call(this, text, ...args);
      };
    }, { failFont, kind });
    await page.goto(`${origin}/immersive/index.html`);
    await page.evaluate(async () => {
      const [{ createWorld }, { buildData }, raw] = await Promise.all([
        import('./world.js'), import('./data.js'), fetch('../data/2026.json').then(response => response.json()),
      ]);
      const data = buildData(raw);
      window.__trackWorldListeners = true;
      window.__startupPromise = createWorld({ canvas: document.querySelector('#world'), data, initialArrival: false, reducedMotion: true })
        .then(world => { window.__world = world; }).catch(error => { window.__startupError = error.message; });
    });
    await page.waitForFunction(() => window.__compile, { timeout: 30000 });
    const pending = await page.evaluate(() => ({ compile: window.__compile, ready: Boolean(window.__world), drawn: Boolean(window.__firstRender) }));
    assert.equal(pending.compile.revision, '160');
    assert.equal(pending.compile.objects, pending.compile.visibleMaterials, 'compile scope has only visible material objects');
    assert.equal(pending.ready, false, 'world API waits for initial font barrier');
    assert.equal(pending.drawn, false, 'no scene frame before initial font barrier');
    await page.evaluate(() => window.__releaseFonts());
    const settled = await page.evaluate(() => Promise.race([window.__startupPromise.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 2000))]));
    assert.equal(settled, true, `${kind} startup settles within bounded observation`);
    if (kind === 'context-loss') {
      const lost = await page.evaluate(async () => {
        window.__world.dispose();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { lost: window.__contextLost, render: window.__world.getRenderState(), pendingFrames: window.__pendingFrames.size, listeners: window.__worldListeners.map(item => item.type), rendererDisposed: window.__rendererDisposed };
      });
      assert.equal(lost.lost, true);
      assert.equal(lost.render.disposed, true);
      assert.equal(lost.rendererDisposed, true);
      assert.equal(lost.pendingFrames, 0);
      assert.deepEqual(lost.listeners, []);
      records.push({ kind, pending, lost });
    } else if (failFont) {
      const failed = await page.evaluate(() => ({ error: window.__startupError, disposed: window.__rendererDisposed, drawn: Boolean(window.__firstRender), compile: window.__compile, releasedOwnership: window.__releasedOwnership, fontKeptPending: Boolean(window.__fontKeptPending), pendingFrames: window.__pendingFrames.size, listeners: window.__worldListeners.map(item => item.type) }));
      assert.match(failed.error, /intentional startup font rejection/);
      assert.equal(failed.disposed, true);
      assert.equal(failed.drawn, false);
      assert.equal(failed.pendingFrames, 0);
      assert.deepEqual(failed.listeners, []);
      assert.equal(failed.compile.finished, true, 'visible shader submission completed');
      assert.deepEqual(failed.releasedOwnership, { geometries: 0, materials: 0, textures: 0 });
      if (kind === 'mixed-font-failure') assert.equal(failed.fontKeptPending, true, 'other initial font remains unresolved');
      records.push({ kind, pending, failed });
    } else {
      await page.waitForFunction(() => window.__world.getRenderState().renderedFrames > 0);
      const ready = await page.evaluate(() => ({ first: window.__firstRender, state: window.__world.getState(), labels: window.__world.getLabelResourceState() }));
      assert.ok(ready.first.loadedFaces > 0, 'actual Publication Sans TW FontFace is loaded');
      const latestDraws = new Map(ready.first.draws.map(draw => [draw.text, draw]));
      assert.ok(latestDraws.size >= 5, 'island label and character names were drawn');
      assert.ok([...latestDraws.values()].every(draw => draw.released), 'every startup text was redrawn after the font barrier');
      assert.equal(ready.state.renderedIslandCount, 22);
      assert.equal(ready.labels.untrackedMaterialCount, 0);
      const disposed = await page.evaluate(async () => {
        window.__world.dispose(); window.__world.dispose();
        const before = window.__world.getRenderState();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { before, after: window.__world.getRenderState(), rendererDisposed: window.__rendererDisposed, pendingFrames: window.__pendingFrames.size, listeners: window.__worldListeners.map(item => item.type) };
      });
      assert.equal(disposed.before.disposed, true);
      assert.equal(disposed.rendererDisposed, true);
      assert.equal(disposed.pendingFrames, 0);
      assert.deepEqual(disposed.listeners, []);
      assert.equal(disposed.before.renderedFrames, disposed.after.renderedFrames);
      assert.equal(disposed.after.ownedTextureCount, 0);
      assert.equal(disposed.after.ownedMaterialCount, 0);
      assert.equal(disposed.after.ownedGeometryCount, 0);
      records.push({ kind, pending, ready, disposed });
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/results.json`, JSON.stringify({ records, errors }, null, 2));
  console.log(JSON.stringify({ cases: records.length, errors }));
} finally {
  await browser.close(); server.httpServer.closeAllConnections?.(); await server.close();
}

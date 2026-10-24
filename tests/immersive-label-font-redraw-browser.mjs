import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const html = (await readFile('public/immersive/index.html', 'utf8')).replace('<script type="module" src="./app.js"></script>', '');
const source = await readFile('public/immersive/world.js', 'utf8');
const css = await readFile('public/fonts/publication.css', 'utf8');
const candidates = [...css.matchAll(/@font-face\{[^}]*font-family:"Publication Sans TW"[^}]*src:url\("([^"]+)"\)[^}]*unicode-range:([^}]+)\}/g)].reverse().map(match => ({ file: match[1], points: [...match[2].matchAll(/U\+([0-9A-F]+)/g)].map(item => parseInt(item[1], 16)).filter(point => /\p{Script=Han}/u.test(String.fromCodePoint(point))) }));
const instrumentation = `
  window.__speechSprite = () => speech;
  const originalRender = renderer.render.bind(renderer);
  renderer.render = (...args) => {
    if (speech) {
      const distance = camera.position.distanceTo(speech.getWorldPosition(new THREE.Vector3()));
      const parentScale = speech.parent?.getWorldScale(new THREE.Vector3()).x || 1;
      window.__lastSpeechRender = { text: speech.userData.text, scale: speech.scale.toArray(), screenWidth: speech.userData.screenWidth, impliedWidth: speech.scale.x * parentScale / (distance * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * canvas.clientHeight };
    }
    return originalRender(...args);
  };
  const originalDispose = renderer.dispose.bind(renderer);
  renderer.dispose = () => { window.__disposedOwnership = { geometries: geometries.size, materials: materials.size, textures: textures.size }; return originalDispose(); };
`;
let instrumented = source.replace('  renderer.setPixelRatio(', `${instrumentation}\n  renderer.setPixelRatio(`);
instrumented = instrumented.replace(']).then(() => labels.forEach(sprite => sprite.userData.redraw?.())).catch', ']).then(() => { labels.forEach(sprite => sprite.userData.redraw?.()); window.__backgroundDone = true; }).catch');
assert.notEqual(instrumented, source); assert.ok(instrumented.includes('window.__backgroundDone = true'));
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false } }); await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const errors = [], records = [];
let releaseNetwork = () => {};
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/immersive/index.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.route('**/immersive/world.js', route => route.fulfill({ contentType: 'text/javascript', body: instrumented }));
  await page.addInitScript(() => {
    window.__draws = []; window.__loads = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (this.font.includes('Publication Sans TW')) window.__draws.push({ text, font: this.font, loaded: document.fonts.check(this.font, String(text)) });
      return fill.call(this, text, ...args);
    };
    const load = document.fonts.load.bind(document.fonts);
    document.fonts.load = (font, text) => {
      const original = load(font, text);
      if (text !== window.__controlledText) return original;
      window.__loads.push({ text, font });
      const control = window.__control;
      return original.then(faces => control.then(() => { if (window.__rejectText === text) throw new Error('intentional label font rejection'); return faces; }));
    };
    window.__controlLabel = text => { window.__controlledText = text; window.__control = new Promise(resolve => { window.__releaseLabel = resolve; }); };
  });
  await page.goto(`${origin}/immersive/index.html`);
  await page.evaluate(async () => {
    const [{ createWorld }, { buildData }, raw] = await Promise.all([import('./world.js'), import('./data.js'), fetch('../data/2026.json').then(response => response.json())]);
    window.__world = await createWorld({ canvas: document.querySelector('#world'), data: buildData(raw), reducedMotion: true, initialArrival: false });
  });
  await page.waitForFunction(() => window.__world.getRenderState().renderedFrames > 0 && window.__backgroundDone, { timeout: 30000 });
  const chosen = await page.evaluate(candidates => {
    const font = '600 42px "Publication Latin", "Publication Sans TW", sans-serif';
    for (const candidate of candidates) for (const point of candidate.points) {
      const text = `${String.fromCodePoint(point)} ABC 26`;
      if (!document.fonts.check(font, text)) return { text, file: candidate.file, point };
    }
    return null;
  }, candidates);
  assert.ok(chosen, 'publication has a cold glyph outside initial/background label text');
  const network = new Promise(resolve => { releaseNetwork = resolve; });
  await page.route(`**/fonts/${chosen.file}`, async route => { await network; await route.continue(); });
  const start = async (text, inactive = false) => {
    await page.evaluate(({ text, inactive }) => { window.__world.setActive(!inactive); window.__world.setEncounter('aqi'); window.__controlLabel(text); window.__world.setSpeech(text); }, { text, inactive });
    await page.waitForFunction(text => window.__loads.some(item => item.text === text), text);
  };
  const drawn = (text, count) => page.waitForFunction(({ text, count }) => window.__draws.filter(item => item.text === text).length >= count, { text, count });
  const read = text => page.evaluate(text => {
    const point = text.codePointAt(0);
    const hanLoaded = [...document.fonts].some(face => face.family.replaceAll('"', '') === 'Publication Sans TW' && face.status === 'loaded' && face.unicodeRange.split(',').some(range => {
      const [start, end = start] = range.trim().replace(/^U\+/i, '').split('-'); return parseInt(start, 16) <= point && point <= parseInt(end, 16);
    }));
    const latinLoaded = [...document.fonts].some(face => face.family.replaceAll('"', '') === 'Publication Latin' && face.status === 'loaded');
    return { draws: window.__draws.filter(item => item.text === text), frames: window.__world.getRenderState().renderedFrames, rendered: window.__lastSpeechRender, hanLoaded, latinLoaded };
  }, text);
  await start(chosen.text);
  const cold = await read(chosen.text); assert.equal(cold.draws.length, 1); assert.equal(cold.draws[0].loaded, false);
  releaseNetwork(); await page.evaluate(() => window.__releaseLabel()); await drawn(chosen.text, 2);
  const active = await read(chosen.text); assert.equal(active.draws.at(-1).loaded, true); assert.equal(active.hanLoaded, true); assert.equal(active.latinLoaded, true); assert.ok(active.draws.at(-1).font.includes('Publication Latin') && active.draws.at(-1).font.includes('Publication Sans TW')); records.push({ kind: 'cold-active', chosen, cold, active });

  const inactiveText = `${String.fromCodePoint(chosen.point)} XYZ 52`;
  await start(inactiveText, true); const before = await read(inactiveText); assert.equal(before.draws.length, 1);
  await page.evaluate(() => window.__releaseLabel()); await drawn(inactiveText, 2);
  const inactive = await read(inactiveText); assert.equal(inactive.frames, before.frames + 1); assert.equal(inactive.rendered.text, inactiveText); assert.ok(inactive.rendered.scale[0] > 1); assert.ok(Math.abs(inactive.rendered.impliedWidth - inactive.rendered.screenWidth) < .01); records.push({ kind: 'inactive-visible', before, inactive });

  const hiddenText = `${String.fromCodePoint(chosen.point)} HIDE 7`;
  await start(hiddenText, true); await page.evaluate(() => { window.__speechSprite().visible = false; }); const hiddenBefore = await read(hiddenText);
  await page.evaluate(() => window.__releaseLabel()); await drawn(hiddenText, 2); const hidden = await read(hiddenText); assert.equal(hidden.frames, hiddenBefore.frames); records.push({ kind: 'inactive-hidden', hiddenBefore, hidden });

  const rejectedText = `${String.fromCodePoint(chosen.point)} FAIL 8`;
  await start(rejectedText, true); await page.evaluate(text => { window.__rejectText = text; window.__releaseLabel(); }, rejectedText);
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 40))); const rejected = await read(rejectedText); assert.equal(rejected.draws.length, 1); assert.equal(await page.locator('#read').count(), 1); assert.equal(await page.evaluate(() => window.__world.getRenderState().disposed), false); records.push({ kind: 'font-rejection', rejected });

  const lateText = `${String.fromCodePoint(chosen.point)} LATE 9`;
  await start(lateText, true);
  const disposed = await page.evaluate(async text => {
    const sprite = window.__speechSprite(); window.__world.dispose(); const version = sprite.material.map.version, drawCount = window.__draws.filter(item => item.text === text).length, frames = window.__world.getRenderState().renderedFrames;
    window.__releaseLabel(); await new Promise(resolve => setTimeout(resolve, 40));
    return { beforeVersion: version, afterVersion: sprite.material.map.version, beforeDraws: drawCount, afterDraws: window.__draws.filter(item => item.text === text).length, beforeFrames: frames, afterFrames: window.__world.getRenderState().renderedFrames, owned: window.__disposedOwnership, render: window.__world.getRenderState() };
  }, lateText);
  assert.equal(disposed.beforeVersion, disposed.afterVersion); assert.equal(disposed.beforeDraws, disposed.afterDraws); assert.equal(disposed.beforeFrames, disposed.afterFrames); assert.deepEqual(disposed.owned, { geometries: 0, materials: 0, textures: 0 }); assert.equal(disposed.render.disposed, true); records.push({ kind: 'disposed-late', disposed });
  assert.deepEqual(errors, []); await mkdir('test-results/immersive-label-font-redraw', { recursive: true }); await writeFile('test-results/immersive-label-font-redraw/results.json', JSON.stringify({ records, errors }, null, 2)); console.log(JSON.stringify({ cases: records.length, errors }));
} finally { releaseNetwork(); await browser.close(); server.httpServer.closeAllConnections?.(); await server.close(); }

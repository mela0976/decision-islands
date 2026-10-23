import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
test('explorer scene renders, freezes, rebuilds, restores thumbnail state and disposes', { timeout: 120000 }, async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4197', '--strictPort'], { cwd: root, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch('http://127.0.0.1:4197')).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--disable-features=LocalNetworkAccessChecks'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/scene-harness', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><canvas tabindex="0" style="width:1280px;height:800px"></canvas><div id="labels"></div></body></html>' }));
    await page.goto('http://127.0.0.1:4197/scene-harness');
    await page.exposeFunction('sceneProbePointer', async (x, y, distance) => { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + distance, y); await page.mouse.up(); });
    const result = await page.evaluate(async () => {
      const T = await import('/node_modules/three/build/three.module.js');
      const { createExplorerEngine } = await import('/src/explorer-scene.ts');
      const { DATA, buildExplorerData, initialExplorerState } = await import('/src/explorer-data.ts');
      const edition = await (await fetch('/data/2026.json')).json();
      const data = buildExplorerData(DATA, edition), canvas = document.querySelector('canvas'), labelHost = document.querySelector('#labels');
      const selections = [], minutes = [], events = []; let invalidations = 0;
      const engine = createExplorerEngine({ data, canvas, labelHost, invalidate() { invalidations++; }, onSelection(s) { selections.push(s); }, onMinute(m) { minutes.push(m); }, onEvents(e) { events.push(...e); } });
      const state = initialExplorerState();
      engine.resize(1280, 800); engine.setState(state);
      let scene, camera;
      const inspect = { toneMappingExposure: 0, render(s, c) { scene = s; camera = c; } };
      engine.render(inspect);
      const inactiveRender = !!scene && labelHost.hidden && labelHost.inert;
      engine.setActive(true); engine.render(inspect);
      const islandLabels = labelHost.querySelectorAll('.explorer-scene-label--island').length;
      const floorMeshes = []; scene.traverse(o => { if (o.isMesh && o.name.startsWith('explorer-island-surface-')) floorMeshes.push(o); });
      const topHeights = floorMeshes.flatMap(m => Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.geometry.attributes.position.getY(i)));
      const surfaceBatchCount=floorMeshes.length;
      const flows = []; scene.traverse(o => { if (o.userData.flowId) flows.push(o); });
      const flowsInitiallyHidden = flows.every(f => !f.visible);
      const furniture = scene.getObjectByName('explorer-small-furniture'); const farFurnitureHidden = !furniture.visible;
      const original = engine.getWalkers().map(w => w.position.slice());
      engine.update(.137); const exactMinute = minutes.at(-1);
      engine.setState({ ...state, minute: exactMinute, paused: true });
      const moved = JSON.stringify(original) !== JSON.stringify(engine.getWalkers().map(w => w.position));
      const frozen = JSON.stringify(engine.getWalkers()); const idle = engine.update(20);
      const frozenMatch = JSON.stringify(engine.getWalkers()) === frozen;
      engine.setState({ ...state, minute: exactMinute }); engine.update(2.5); const slowFrameMinute = minutes.at(-1);
      engine.setState({ ...state, minute: 360, reducedMotion: true }); const reducedWalkers = JSON.stringify(engine.getWalkers()); const reducedResult = engine.update(10); const reducedFrozen = reducedWalkers === JSON.stringify(engine.getWalkers());
      engine.setState({ ...state, minute: exactMinute, paused: true });
      engine.setSelection({ kind: 'island', islandId: data.islands[0].id }, { focus: false });
      const relatedFlowCount = flows.filter(f => f.visible).length;
      const silentSelection = selections.length === 0;
      engine.render(inspect);
      const label = labelHost.querySelector('.explorer-scene-label--island'); label.click();
      const labelSelection = selections.at(-1); engine.render(inspect); const nearFurnitureShown = furniture.visible;
      canvas.focus(); const keyboardBefore = camera.position.clone(); canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); const keyboardMoves = camera.position.distanceTo(keyboardBefore) > .01;
      const input = document.createElement('input'); document.body.append(input); input.focus(); const inputBefore = camera.position.clone(); canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); const inputUntouched = camera.position.equals(inputBefore); input.remove();
      engine.setSelection({ kind: 'island', islandId: data.islands[0].id }); engine.render(inspect);
      const point = new T.Vector3(0, 1.2, -.58).project(camera); const beforePointer = selections.length;
      await window.sceneProbePointer((point.x + 1) * 640, (1 - point.y) * 400, 5); const clickWithinThreshold = selections.length > beforePointer;
      const afterClick = selections.length; await window.sceneProbePointer(640, 400, 7); const dragIgnored = selections.length === afterClick;
      engine.setState({ ...state, minute: exactMinute, paused: true, birdseye: true }); engine.render(inspect);
      const birdHeight = camera.position.y;
      const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setSize(1280, 800, false);
      const rt = new T.WebGLRenderTarget(23, 29); renderer.setRenderTarget(rt); renderer.setViewport(1, 2, 19, 21); renderer.setScissor(3, 4, 9, 12); renderer.setScissorTest(true); renderer.setClearColor('#123456', .4); renderer.autoClear = false; renderer.toneMappingExposure = .8; renderer.shadowMap.enabled = true;
      const thumbnail = engine.thumbnail(data.items[0].id, renderer);
      const restored = renderer.getRenderTarget() === rt && renderer.getViewport(new T.Vector4()).equals(new T.Vector4(1, 2, 19, 21)) && renderer.getScissor(new T.Vector4()).equals(new T.Vector4(3, 4, 9, 12)) && renderer.getScissorTest() && Math.abs(renderer.getClearAlpha() - .4) < 1e-8 && renderer.autoClear === false && renderer.toneMappingExposure === .8 && renderer.shadowMap.enabled;
      renderer.setRenderTarget(null); renderer.setScissorTest(false); engine.render(renderer);
      const renderInfo={...renderer.info.render};
      const excluded=[scene.getObjectByName('explorer-environment'),scene.getObjectByName('explorer-walkers'),...flows];
      const visibility=excluded.map(o=>o.visible);excluded.forEach(o=>o.visible=false);renderer.shadowMap.enabled=false;engine.render(renderer);const staticCalls=renderer.info.render.calls;excluded.forEach((o,i)=>o.visible=visibility[i]);renderer.shadowMap.enabled=true;
      const pngImage = new Image(); pngImage.src = thumbnail ?? ''; if (thumbnail) await pngImage.decode();
      const sample = document.createElement('canvas'); sample.width = sample.height = 160; const sampleContext = sample.getContext('2d'); sampleContext.drawImage(pngImage, 0, 0); const pixelData = sampleContext.getImageData(0, 0, 160, 160).data; const colors = new Set(); for (let i = 0; i < pixelData.length; i += 4) colors.add(`${pixelData[i]},${pixelData[i + 1]},${pixelData[i + 2]}`); const thumbnailColorCount = colors.size;
      const newEdition = { ...edition, year: 2031, articles: [{ ...edition.articles[0], id: '2031-custom', year: 2031, order: 98 }] };
      const replacement = buildExplorerData(DATA, newEdition);
      engine.setData(replacement); engine.render(inspect);
      const rebuilt = labelHost.querySelectorAll('.explorer-scene-label--island').length === replacement.islands.length && engine.getWalkers().length === 0;
      let rejected = false; try { engine.setData({ ...data, islands: [{ ...data.islands[0], axial: [999, 999] }, ...data.islands.slice(1)] }); } catch { rejected = true; }
      const atomic = labelHost.querySelectorAll('.explorer-scene-label--island').length === replacement.islands.length;
      engine.setActive(false); const inactive = engine.update(10); engine.render(inspect);
      engine.dispose(); engine.dispose(); rt.dispose(); renderer.dispose();
      return { staticCalls, renderInfo, keyboardMoves, inputUntouched, clickWithinThreshold, dragIgnored, farFurnitureHidden, nearFurnitureShown, thumbnailColorCount, slowFrameMinute, reducedFrozen, reducedResult, birdHeight, inactiveRender, islandLabels, surfaceBatchCount, topHeights, flowsInitiallyHidden, exactMinute, frozenMatch, idle, relatedFlowCount, silentSelection, labelSelection, thumbnail: thumbnail?.startsWith('data:image/png'), thumbnailSize: [pngImage.width, pngImage.height], restored, rebuilt, atomic, rejected, inactive, disposedLabels: labelHost.childElementCount, invalidations, moved };
    });
    assert.equal(result.inactiveRender, true); assert.equal(result.islandLabels, 12); assert.equal(result.surfaceBatchCount, 3); assert.equal(result.topHeights.length, 96); assert.ok(result.topHeights.every(y => Math.abs(y - .652) < 1e-6));
    assert.equal(result.flowsInitiallyHidden, true); assert.ok(Math.abs(result.exactMinute - 601.37) < 1e-8); assert.equal(result.frozenMatch, true); assert.equal(result.idle.continuous, false);
    assert.ok(Math.abs(result.slowFrameMinute - 626.37) < 1e-8); assert.equal(result.reducedFrozen, true); assert.equal(result.reducedResult.continuous, false);
    assert.ok(result.relatedFlowCount > 0 && result.relatedFlowCount < 10); assert.equal(result.silentSelection, true); assert.equal(result.labelSelection.kind, 'island');
    assert.ok(result.birdHeight > 40, 'birdseye remains above 40 world units');
    assert.equal(result.keyboardMoves, true); assert.equal(result.inputUntouched, true); assert.equal(result.clickWithinThreshold, true); assert.equal(result.dragIgnored, true);
    assert.equal(result.farFurnitureHidden, true); assert.equal(result.nearFurnitureShown, true); assert.ok(result.thumbnailColorCount > 20, 'thumbnail contains a shaded model');
    assert.equal(result.thumbnail, true); assert.deepEqual(result.thumbnailSize, [160, 160]); assert.equal(result.restored, true); assert.equal(result.rebuilt, true); assert.equal(result.rejected, true); assert.equal(result.atomic, true); assert.equal(result.inactive.continuous, false); assert.equal(result.disposedLabels, 0); assert.ok(result.invalidations > 0); assert.equal(result.moved, true);
    assert.ok(result.staticCalls >= 20 && result.staticCalls <= 30, 'static island/model batches meet the planned range');
    console.log('scene render profile:', JSON.stringify({total:result.renderInfo,staticCalls:result.staticCalls}));
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); server.kill('SIGTERM'); }
});

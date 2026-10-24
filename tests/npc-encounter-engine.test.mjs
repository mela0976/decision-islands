import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
test('encounters face the camera, react finitely, and clean speech through engine lifecycles', { timeout: 120000 }, async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4198', '--strictPort'], { cwd: root, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:4198')).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
    browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--disable-features=LocalNetworkAccessChecks'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/encounter-harness', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><canvas style="width:1280px;height:800px"></canvas><div id="labels"></div></body></html>' }));
    await page.goto('http://127.0.0.1:4198/encounter-harness');
    const result = await page.evaluate(async () => {
      const T = await import('/node_modules/three/build/three.module.js');
      const { createExplorerEngine } = await import('/src/explorer-scene.ts');
      const { DATA, buildExplorerData, initialExplorerState } = await import('/src/explorer-data.ts');
      const edition = await (await fetch('/data/2026.json')).json(), data = buildExplorerData(DATA, edition);
      const canvas = document.querySelector('canvas'), labelHost = document.querySelector('#labels');
      let minute = 600, scene, camera;
      const engine = createExplorerEngine({ data, canvas, labelHost, invalidate() {}, onSelection() {}, onEvents() {}, onMinute(value) { minute = value; } });
      let state = { ...initialExplorerState(), population: 100, walkers: true };
      engine.resize(1280, 800); engine.setState(state); engine.setActive(true);
      const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: true }); renderer.setSize(1280, 800, false);
      let compileHadInstanceColors = false;
      const originalCompile = renderer.compileAsync.bind(renderer);
      renderer.compileAsync = (s, c) => { const meshes = s.getObjectByName('explorer-walkers').children.filter(o => o.isInstancedMesh); compileHadInstanceColors = !!meshes[0].instanceColor && !!meshes[1].instanceColor; return originalCompile(s, c); };
      await engine.prepare(renderer);
      const preparedProgramCount = renderer.info.programs.length;
      const originalRender = renderer.render.bind(renderer); renderer.render = (s, c) => { scene = s; camera = c; originalRender(s, c); };
      engine.render(renderer);
      const firstFrameProgramsPrepared = preparedProgramCount > 0 && renderer.info.programs.length === preparedProgramCount;
      const target = engine.getWalkers()[0], index = 0, selection = { kind: 'walker', walkerId: target.id };
      const setState = patch => { state = { ...state, minute, ...patch }; engine.setState(state); };
      setState({ selection, detailOpen: true });
      const cue = { walkerId: target.id, token: 1, text: '<img src=x onerror=alert(1)> 這是一起閱讀的新想法。', reaction: 'greet' };
      engine.setNpcSpeech(cue);
      const before = engine.getWalkers()[0], otherBefore = engine.getWalkers()[1];
      for (let i = 0; i < 15; i++) engine.update(.1);
      engine.render(renderer);
      const after = engine.getWalkers()[0], bubble = labelHost.querySelector('.explorer-npc-speech');
      const held = JSON.stringify(before) === JSON.stringify(after), othersMove = JSON.stringify(otherBefore.position) !== JSON.stringify(engine.getWalkers()[1].position);
      const textSafe = bubble.textContent.includes('<img') && !bubble.querySelector('img') && bubble.getAttribute('aria-hidden') === 'true' && !bubble.hasAttribute('aria-live');
      const bubbleIndependent = !state.names && !bubble.hidden && getComputedStyle(bubble).visibility === 'visible';
      const parts = scene.getObjectByName('explorer-walkers').children.filter(o => o.isInstancedMesh);
      const matrix = mesh => { const m = new T.Matrix4(); mesh.getMatrixAt(index, m); return m; };
      const localPart = part => matrix(parts[0]).invert().multiply(matrix(part));
      const initialArm = localPart(parts[4]), initialHead = localPart(parts[1]);
      engine.setNpcSpeech({ ...cue, token: 2, reaction: 'explain' }); engine.update(.35); engine.render(renderer);
      const headChanged = !localPart(parts[1]).equals(initialHead), armChanged = !localPart(parts[4]).equals(initialArm);
      engine.setNpcSpeech({ ...cue, token: 2, reaction: 'explain' }); engine.update(1); engine.render(renderer);
      const reactionEnded = canvas.dataset.npcReaction === '' && localPart(parts[1]).elements.every((value, i) => Math.abs(value - initialHead.elements[i]) < 1e-5) && localPart(parts[4]).elements.every((value, i) => Math.abs(value - initialArm.elements[i]) < 1e-5);
      const finishedHead = matrix(parts[1]); engine.setNpcSpeech({ ...cue, token: 2, reaction: 'explain' }); engine.update(.3); engine.render(renderer);
      const duplicateDoesNotReplay = matrix(parts[1]).elements.every((value, i) => Math.abs(value - finishedHead.elements[i]) < 1e-6) && canvas.dataset.npcReaction === '';
      setState({ paused: true }); engine.render(renderer);
      const headingError = () => Math.abs(Math.atan2(Math.sin(Number(canvas.dataset.npcHeading) - Number(canvas.dataset.npcFacingTarget)), Math.cos(Number(canvas.dataset.npcHeading) - Number(canvas.dataset.npcFacingTarget))));
      const body = matrix(parts[0]).elements, actualHeading = Math.atan2(body[8], body[10]);
      const cameraHeading = Math.atan2(camera.position.x - target.position[0], camera.position.z - target.position[2]);
      const cameraFacing = headingError() < 1e-8 && Math.abs(Math.atan2(Math.sin(actualHeading - cameraHeading), Math.cos(actualHeading - cameraHeading))) < 1e-6;
      const bodyBeforeOrbit = matrix(parts[0]); canvas.focus(); canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); engine.update(0); engine.render(renderer);
      const pausedOrbitFaces = headingError() < 1e-8 && !matrix(parts[0]).equals(bodyBeforeOrbit);
      const pausedIdle = !engine.update(10).continuous;
      engine.setNpcSpeech({ ...cue, token: 3, reaction: 'nod' }); engine.render(renderer);
      const pausedStatic = !engine.update(10).continuous && canvas.dataset.npcReaction === '';
      setState({ reducedMotion: true, paused: false }); engine.setNpcSpeech({ ...cue, token: 4 }); engine.render(renderer);
      const reducedStatic = !engine.update(10).continuous && canvas.dataset.npcReaction === '';
      const panel = document.createElement('div'); panel.dataset.explorerPanel = ''; panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:320px'; document.body.append(panel);
      canvas.style.width = '390px'; canvas.style.height = '844px'; engine.resize(390, 844); renderer.setSize(390, 844, false); engine.render(renderer);
      const rect = bubble.getBoundingClientRect(), panelRect = panel.getBoundingClientRect();
      const mobileBubble = rect.left >= -1 && rect.right <= 391 && rect.top >= -1 && rect.bottom <= 845 && rect.bottom <= panelRect.top && !bubble.hidden && getComputedStyle(bubble).visibility === 'visible';
      panel.remove();
      setState({ detailOpen: false }); const release = engine.getWalkers()[0].status !== 'talking' && bubble.hidden;
      setState({ detailOpen: true }); engine.setNpcSpeech({ ...cue, token: 5 }); setState({ listOpen: true }); const listClears = bubble.hidden && engine.getWalkers()[0].status !== 'talking';
      setState({ listOpen: false }); engine.setNpcSpeech({ ...cue, token: 6 }); engine.setActive(false); const inactive = bubble.hidden && !engine.update(10).continuous;
      engine.setActive(true); engine.setNpcSpeech({ ...cue, token: 6 }); engine.render(renderer); const noInactiveReplay = bubble.hidden;
      engine.setNpcSpeech({ ...cue, token: 7 });
      let rejected = false; try { engine.setData({ ...data, islands: [{ ...data.islands[0], axial: [999, 999] }, ...data.islands.slice(1)] }); } catch { rejected = true; }
      engine.render(renderer); const failedAtomic = rejected && !bubble.hidden && canvas.dataset.npcEncounter === target.id;
      setState({ selection: { kind: 'walker', walkerId: engine.getWalkers()[99].id } }); engine.setNpcSpeech({ ...cue, walkerId: engine.getWalkers()[99].id, token: 8 }); setState({ population: 10 });
      const removedClears = bubble.hidden && engine.getWalkers().every(w => w.status !== 'talking');
      engine.setData(data); engine.render(renderer); const rebuildClears = bubble.hidden && canvas.dataset.npcEncounter === '' && engine.getWalkers().length === 10;
      const drawCalls = renderer.info.render.calls;
      const gates = []; let watched, disposalCount = 0;
      const controlledCompiler = { compileAsync(s) { watched ??= s.getObjectByName('explorer-walkers').children.find(o => o.isInstancedMesh).material; return new Promise((resolve, reject) => gates.push({ resolve, reject })); } };
      const firstPreparation = engine.prepare(controlledCompiler), secondPreparation = engine.prepare(controlledCompiler);
      watched.addEventListener('dispose', () => disposalCount++);
      let failedWhilePending = false; try { engine.setData({ ...data, islands: [{ ...data.islands[0], axial: [999, 999] }, ...data.islands.slice(1)] }); } catch { failedWhilePending = true; }
      const pendingAtomic = failedWhilePending && disposalCount === 0;
      engine.setData(data); const retainedDuringCompile = disposalCount === 0;
      gates[0].resolve(); await firstPreparation; const retainedUntilAllComplete = disposalCount === 0;
      gates[1].resolve(); await secondPreparation; const retiredAfterCompile = disposalCount === 1;
      watched = undefined; disposalCount = 0;
      const finalPreparation = engine.prepare(controlledCompiler); watched.addEventListener('dispose', () => disposalCount++);
      engine.dispose(); const disposed = labelHost.childElementCount === 0, disposeWaitsForCompile = disposalCount === 0;
      gates[2].reject(new Error('controlled compile failure')); let preparationRejected = false; try { await finalPreparation; } catch { preparationRejected = true; }
      const rejectionReleasesResources = preparationRejected && disposalCount === 1;
      renderer.dispose();
      return { firstFrameProgramsPrepared, compileHadInstanceColors, pendingAtomic, retainedDuringCompile, retainedUntilAllComplete, retiredAfterCompile, disposeWaitsForCompile, rejectionReleasesResources, held, othersMove, textSafe, bubbleIndependent, headChanged, armChanged, reactionEnded, duplicateDoesNotReplay, cameraFacing, pausedOrbitFaces, pausedIdle, pausedStatic, reducedStatic, mobileBubble, release, listClears, inactive, noInactiveReplay, failedAtomic, removedClears, rebuildClears, disposed, drawCalls };
    });
    for (const [name, value] of Object.entries(result)) { if (name !== 'drawCalls') assert.equal(value, true, name); }
    assert.ok(result.drawCalls > 0); assert.deepEqual(errors, []);
  } finally { await browser?.close(); server.kill('SIGTERM'); }
});

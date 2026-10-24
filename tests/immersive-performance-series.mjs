import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { loadavg } from 'node:os';

const outputDir = process.env.PERF_OUTPUT || 'test-results/immersive-performance-series';
const runCount = Number(process.env.PERF_RUNS || 3);
assert.ok(Number.isInteger(runCount) && runCount >= 1 && runCount <= 10, 'PERF_RUNS must be an integer from 1 to 10');
const fontManifest = JSON.parse(await readFile('public/fonts/manifest.json', 'utf8'));
const publicationGlyphs = new Set([...fontManifest.files.flatMap(file => file.codepoints), ...(fontManifest.latinCodepoints || [])]);
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const series = [];

try {
  for (let runNumber = 1; runNumber <= runCount; runNumber++) {
    const browser = await chromium.launch({
      headless: true,
      args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const errors = { page: [], console: [], failedRequests: [], http: [] };
    const requestStartedAt = new Map();
    const requests = [];
    page.on('pageerror', error => errors.page.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()); });
    page.on('request', request => requestStartedAt.set(request, Date.now()));
    page.on('requestfailed', request => errors.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
    page.on('response', response => {
      const request = response.request();
      const status = response.status();
      const record = {
        url: response.url(),
        type: request.resourceType(),
        status,
        startMs: requestStartedAt.has(request) ? requestStartedAt.get(request) - navigationStartedAt : null,
        durationMs: requestStartedAt.has(request) ? Date.now() - requestStartedAt.get(request) : null,
      };
      requests.push(record);
      if (status >= 400) errors.http.push(record);
    });

    let navigationStartedAt = null;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 1_250_000,
      uploadThroughput: 625_000,
      connectionType: 'cellular4g',
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Performance.enable');

    navigationStartedAt = Date.now();
    await page.addInitScript(startEpoch => {
      window.__immersivePerformance = { navigationStartEpochMs: startEpoch, firstWorldFrameObservedEpochMs: null, doubleRafProxyEpochMs: null };
      const observeWorldFrame = () => {
        const world = window.immersive?.world;
        if (window.__immersivePerformance.firstWorldFrameObservedEpochMs === null
          && world?.getRenderState?.().renderedFrames > 0) {
          window.__immersivePerformance.firstWorldFrameObservedEpochMs = Date.now();
          requestAnimationFrame(() => requestAnimationFrame(() => {
            window.__immersivePerformance.doubleRafProxyEpochMs = Date.now();
          }));
        }
        requestAnimationFrame(observeWorldFrame);
      };
      requestAnimationFrame(observeWorldFrame);
    }, navigationStartedAt);
    const startedAt = navigationStartedAt;
    const record = {
      run: runNumber,
      hostLoadAtStart: loadavg(),
      profile: {
        viewport: '390x844',
        deviceScaleFactor: 2,
        latencyMs: 150,
        downloadMbps: 10,
        uploadMbps: 5,
        cpuThrottle: 4,
        reducedMotion: true,
        introSeenInFreshContext: false,
        serviceWorkers: 'blocked',
        cacheState: 'fresh non-persistent Chromium context per run',
        renderer: 'Chromium ANGLE SwiftShader',
        entry: '/?profile=mobile',
      },
    };

    try {
      await page.goto(`${origin}/?profile=mobile`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      record.navigation = await page.evaluate(() => {
        const timing = performance.getEntriesByType('navigation')[0];
        return timing ? {
          name: location.pathname,
          redirectStartMs: timing.redirectStart,
          redirectEndMs: timing.redirectEnd,
          responseStartMs: timing.responseStart,
          domContentLoadedMs: timing.domContentLoadedEventEnd,
          loadEventMs: timing.loadEventEnd,
        } : null;
      });

      await page.waitForFunction(() => Boolean(window.immersive?.world), { polling: 'raf', timeout: 25000 });
      record.worldApiReadyMs = Date.now() - startedAt;
      await page.waitForFunction(() => window.immersive.world.getRenderState().renderedFrames > 0, { polling: 'raf', timeout: 15000 });
      record.firstWorldFrameObservedMs = await page.evaluate(() => window.__immersivePerformance.firstWorldFrameObservedEpochMs - window.__immersivePerformance.navigationStartEpochMs);
      await page.waitForFunction(() => {
        const labels = window.immersive.world.getLabelResourceState().visibleLabels;
        return labels?.length > 0 && labels.every(label => label.status === 'ready' && document.fonts.check(label.font, label.text));
      }, null, { polling: 'raf', timeout: 5000 });
      await page.locator('#interact:enabled').waitFor({ state: 'visible', timeout: 5000 });
      record.firstInteractiveMs = Date.now() - startedAt;
      await page.waitForFunction(() => window.__immersivePerformance.doubleRafProxyEpochMs !== null, { polling: 'raf', timeout: 5000 });
      record.frameMarkers = await page.evaluate(() => ({
        firstWorldFrameObservedAfterDrawMs: window.__immersivePerformance.firstWorldFrameObservedEpochMs - window.__immersivePerformance.navigationStartEpochMs,
        doubleRafProxyMs: window.__immersivePerformance.doubleRafProxyEpochMs - window.__immersivePerformance.navigationStartEpochMs,
      }));
      const firstFramePath = `${outputDir}/run-${String(runNumber).padStart(2, '0')}-first-world-frame.png`;
      await mkdir(outputDir, { recursive: true });
      await page.locator('#world').screenshot({ path: firstFramePath, timeout: 10000 });
      record.firstCapturedFrame = { path: firstFramePath, capturedAtMs: Date.now() - startedAt, selector: '#world' };

      const firstWorldState = await page.evaluate(() => {
        const world = window.immersive.world;
        const state = world.getState();
        const render = world.getRenderState();
        const canvas = document.querySelector('#world');
        const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl') || canvas?.getContext('experimental-webgl');
        const debug = gl?.getExtension('WEBGL_debug_renderer_info');
        return {
          path: location.pathname,
          fallback: document.body.classList.contains('fallback'),
          introHidden: document.querySelector('#intro')?.hidden,
          renderedFrames: render.renderedFrames,
          setupMs: render.setupMs,
          drawCalls: render.drawCalls,
          triangles: render.triangles,
          textureCount: render.textureCount,
          ownedTextureCount: render.ownedTextureCount,
          editorialTextureCount: render.editorialTextureCount,
          programCount: render.programCount,
          shadowCasting: render.shadowCasting,
          pixelRatio: window.devicePixelRatio,
          canvas: { width: canvas?.width, height: canvas?.height, clientWidth: canvas?.clientWidth, clientHeight: canvas?.clientHeight },
          webgl: debug && gl ? {
            vendor: gl.getParameter(debug.UNMASKED_VENDOR_WEBGL),
            renderer: gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
            parallelCompileSupported: Boolean(gl.getExtension('KHR_parallel_shader_compile')),
          } : null,
          currentArticle: state.current,
          arrivalEvent: state.arrivalEvent?.phase || null,
          population: state.population,
          islandCount: state.renderedIslandCount,
          visibleLabels: world.getLabelResourceState().visibleLabels,
          publicationFontReady: world.getLabelResourceState().visibleLabels.every(label => label.status === 'ready' && document.fonts.check(label.font, label.text)),
          loadedPublicationFaces: [...document.fonts].filter(face => /Publication Sans TW/.test(face.family) && face.status === 'loaded').length,
        };
      });
      record.firstWorldState = firstWorldState;
      assert.equal(firstWorldState.fallback, false, 'the test must reach the 3D world, not the 2D fallback');
      assert.equal(firstWorldState.islandCount, 22, 'all article islands must remain available');
      assert.ok(firstWorldState.publicationFontReady && firstWorldState.loadedPublicationFaces > 0, 'the drawn world must use loaded publication font faces');
      const missingGlyphs = [...new Set(firstWorldState.visibleLabels.flatMap(label => [...label.text]))]
        .filter(character => /[\p{Script=Han}\p{Script=Hangul}\p{Script=Latin}\p{Number}]/u.test(character) && !publicationGlyphs.has(character.codePointAt(0)));
      assert.deepEqual(missingGlyphs, [], 'visible label characters must exist in the publication font outlines, not a generic fallback');
      assert.ok(firstWorldState.renderedFrames > 0, 'the world renderer must draw before the scene is counted as ready');
      assert.ok(firstWorldState.canvas.width > 0 && firstWorldState.canvas.height > 0, 'the scene canvas must have a backing buffer');

      record.fonts = await page.evaluate(async () => {
        await document.fonts.ready;
        return {
          status: document.fonts.status,
          expectedFontLoaded: document.fonts.check('12px "Publication Sans TW"', '群島已展開，從一座文章島開始探索。'),
        };
      });

      const npcStartedAt = Date.now();
      await page.evaluate(() => {
        const world = window.immersive.world;
        world.setPopulation(100);
        world.setEncounter('achi', 99);
        world.setSpeech('芬姐：「先別急，我看看你卡在哪一步。」');
      });
      await page.waitForFunction(() => {
        const state = window.immersive.world.getState();
        return state.population === 100 && state.encounter?.npcIndex === 99 && state.speech.includes('芬姐');
      }, { polling: 'raf', timeout: 5000 });
      const npcState = await page.evaluate(() => window.immersive.world.getState());
      record.npc100 = {
        readyMs: Date.now() - npcStartedAt,
        count: npcState.population,
        selectedNpc: npcState.encounter?.npcIndex,
        speech: npcState.speech,
      };

      const taskStartedAt = Date.now();
      await page.locator('#interact').click();
      await page.getByRole('button', { name: '把資訊放上證據桌', exact: true }).click();
      await page.locator('#game-after:not([hidden])').waitFor({ timeout: 7000 });
      await page.waitForFunction(() => {
        const interaction = window.immersive.world.getState().interaction;
        return Boolean(interaction?.scenarioChoice && interaction.scenarioObjects?.length);
      }, { polling: 'raf', timeout: 5000 });
      const taskOutcome = await page.evaluate(() => {
        const interaction = window.immersive.world.getState().interaction;
        return {
          result: document.querySelector('#game-impact')?.innerText || '',
          visible: !document.querySelector('#game-after')?.hidden,
          scenarioChoice: interaction.scenarioChoice,
          effectId: interaction.effectId,
          propCount: interaction.scenarioObjects?.length || 0,
          speech: window.immersive.world.getState().speech,
        };
      });
      record.task = { responseMs: Date.now() - taskStartedAt, ...taskOutcome };
      assert.ok(taskOutcome.visible && taskOutcome.result.length > 0, 'the selected task must show a response');
      assert.ok(taskOutcome.propCount > 0, 'the selected task must change the actual 3D scene');

      record.resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({
        url: entry.name,
        startMs: Math.round(entry.startTime),
        durationMs: Math.round(entry.duration),
        transferBytes: entry.transferSize,
        decodedBytes: entry.decodedBodySize,
        initiator: entry.initiatorType,
      })));
      record.browserMetrics = (await cdp.send('Performance.getMetrics')).metrics
        .filter(metric => /Duration|Time$|Heap/i.test(metric.name))
        .map(({ name, value }) => ({ name, value }));
      record.requests = requests;
      record.errors = errors;
      record.status = 'passed';
    } catch (error) {
      record.status = 'failed';
      record.failure = error.stack || error.message;
      record.requests = requests;
      record.errors = errors;
    } finally {
      series.push(record);
      await context.close();
      await browser.close();
    }
  }

  await mkdir(outputDir, { recursive: true });
  const distribution = valueForRun => {
    const values = series.map(valueForRun).filter(Number.isFinite).sort((a, b) => a - b);
    return values.length ? { medianMs: values[Math.floor(values.length / 2)], minMs: values[0], maxMs: values.at(-1) } : null;
  };
  const summary = {
    profile: series[0]?.profile,
    runCount: series.length,
    distributions: {
      worldApiReady: distribution(run => run.worldApiReadyMs),
      firstWorldFrameObservedAfterDraw: distribution(run => run.firstWorldFrameObservedMs),
      doubleRafProxy: distribution(run => run.frameMarkers?.doubleRafProxyMs),
      firstInteractive: distribution(run => run.firstInteractiveMs),
      firstScreenshotCapture: distribution(run => run.firstCapturedFrame?.capturedAtMs),
      npc100: distribution(run => run.npc100?.readyMs),
      taskResponse: distribution(run => run.task?.responseMs),
    },
    results: series.map(({ run, status, worldApiReadyMs, firstWorldFrameObservedMs, frameMarkers, firstInteractiveMs, firstCapturedFrame, npc100, task, failure }) => ({
      run, status, worldApiReadyMs, firstWorldFrameObservedMs, frameMarkers, firstInteractiveMs, firstCapturedFrame, npc100, task, failure,
    })),
    errors: series.flatMap(run => run.errors?.page.map(message => ({ run: run.run, kind: 'page', message })) || []),
  };
  await writeFile(`${outputDir}/series.json`, JSON.stringify({ summary, runs: series }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  assert.equal(series.length, runCount, 'all requested same-profile cold runs are required');
  assert.ok(series.every(run => run.status === 'passed'), 'all profile runs must complete successfully');
  assert.ok(series.every(run => run.errors.page.length === 0 && run.errors.console.length === 0 && run.errors.failedRequests.length === 0 && run.errors.http.length === 0), 'runs must be error-free');
} finally {
  server.httpServer.closeAllConnections?.();
  await server.close();
}

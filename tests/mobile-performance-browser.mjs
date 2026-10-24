import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { extname, resolve } from 'node:path';
import os from 'node:os';

const root = resolve(process.env.PERF_DIST || '/tmp/decision-islands-performance-baseline');
const compareRoot = process.env.PERF_COMPARE_DIST ? resolve(process.env.PERF_COMPARE_DIST) : null;
const output = resolve(process.env.PERF_OUTPUT || 'test-results/mobile-performance');
const count = Number(process.env.PERF_RUNS || 5);
const network = { offline: false, latency: Number(process.env.PERF_LATENCY_MS || 150), downloadThroughput: Number(process.env.PERF_DOWN_MBPS || 1.6) * 1_000_000 / 8, uploadThroughput: 750_000 / 8, connectionType: 'cellular4g' };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  try {
    let pathname = new URL(req.url, 'http://localhost').pathname;
    const selectedRoot = compareRoot && pathname.startsWith('/baseline/') ? compareRoot : root;
    if (compareRoot) pathname = pathname.replace(/^\/(baseline|candidate)\//, '/');
    const path = resolve(selectedRoot, '.' + pathname.replace(/\/$/, '/index.html'));
    if (!path.startsWith(selectedRoot + '/')) throw Error('outside root');
    let bytes = await readFile(path);
    const compress = /\.(html|js|css|json|svg)$/.test(path);
    if (compress) bytes = gzipSync(bytes);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Content-Length': bytes.length, ...(compress ? { 'Content-Encoding': 'gzip' } : {}), 'Cache-Control': 'no-store' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await mkdir(output, { recursive: true });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = process.env.TEST_URL || `http://127.0.0.1:${server.address().port}/`;
const gpu = process.env.PERF_GPU || 'swiftshader';
const browser = await chromium.launch({ headless: true, args: gpu === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const runs = [];
async function run(index, profile = false, variant = 'candidate') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'no-preference', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', network);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const errors = [], failures = [], nonSuccess = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => failures.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('response', r => { if (r.status() >= 400) nonSuccess.push({ url: r.url(), status: r.status() }); });
  await page.addInitScript(() => {
    window.__perf = { longTasks: [], frames: [] };
    new PerformanceObserver(list => window.__perf.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
    const watch = () => {
      if (!window.__perf.chrome && document.querySelector('#enter')) window.__perf.chrome = performance.now();
      if (!window.__perf.canvas && document.querySelector('.island-world canvas')) window.__perf.canvas = performance.now();
      if (!window.__perf.articles && document.querySelector('.article-row')) window.__perf.articles = performance.now();
      if (!window.__perf.articles) requestAnimationFrame(watch);
    }; requestAnimationFrame(watch);
  });
  if (profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
  await page.goto(compareRoot ? new URL(`${variant}/`, base).href : base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('.article-row').first().waitFor({ state: 'attached' });
  const ready = await page.evaluate(() => ({ ...window.__perf, ready: performance.now(), count: document.querySelectorAll('.article-row').length, resources: performance.getEntriesByType('resource').map(e => ({ name: e.name, start: e.startTime, end: e.responseEnd, transfer: e.transferSize, encoded: e.encodedBodySize })), paints: performance.getEntriesByType('paint').map(e => ({ name: e.name, start: e.startTime })) }));
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return { ready: performance.now(), status: document.fonts.status, loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => ({ family: f.family, weight: f.weight })), resources: performance.getEntriesByType('resource').filter(r => /\.woff2/.test(r.name)).map(r => ({ name: r.name, start: r.startTime, end: r.responseEnd, encoded: r.encodedBodySize })) }; });
  const begin = await page.evaluate(() => { const t = performance.now(); document.querySelector('#enter').click(); return t; });
  await page.locator('#journey-picker [data-free-explore]').waitFor({ state: 'visible' });
  const entered = await page.evaluate(() => performance.now());
  await page.locator(process.env.PERF_REQUIRE_FRAME === '1' && variant !== 'baseline' ? '.island-world[data-island-frame-ms] canvas' : '.island-world canvas').waitFor({ state: 'attached' });
  const worldReady = await page.evaluate(() => { const canvas = document.querySelector('.island-world canvas'), gl = canvas.getContext('webgl2'), debug = gl?.getExtension('WEBGL_debug_renderer_info'), data = document.querySelector('.island-world').dataset; return { at: performance.now(), rendered: data.rendered === 'true', phase: data.phase, firstFrame: data.firstFrameMs, firstFramePhase: data.firstFramePhase, firstIslandFrame: data.islandFrameMs, width: canvas.width, height: canvas.height, parallelShaderCompile: Boolean(gl?.getExtension('KHR_parallel_shader_compile')), renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) }; });
  if (process.env.PERF_REQUIRE_FRAME === '1' && variant !== 'baseline' && !worldReady.rendered) throw Error('Island canvas did not render');
  await page.locator('#journey-picker [data-free-explore]').evaluate(el => el.click());
  await page.locator('[data-npc-open]').evaluate(el => el.click());
  const options = await page.locator('[data-npc-select] option[data-walker-id]').evaluateAll(ns => ns.map(n => n.value));
  if (!options.length) throw Error('No NPCs were created');
  const selectedAt = await page.evaluate(() => performance.now());
  await page.locator('[data-npc-select]').selectOption(options[0]);
  await page.locator('[data-npc-article-id]').waitFor();
  const questionAt = await page.evaluate(() => { const t = performance.now(); document.querySelector('[data-npc-question="summary"]').click(); return t; });
  await page.locator('[data-npc-reply]').last().waitFor({ state: 'visible' });
  const reply = await page.evaluate(() => ({ at: performance.now(), text: [...document.querySelectorAll('[data-npc-reply]')].at(-1).textContent, article: document.querySelector('[data-npc-article-id]').dataset.npcArticleId, gl: document.querySelector('.island-world').dataset.fallback !== 'true', longTasks: window.__perf.longTasks }));
  if (!reply.text.trim() || !reply.article) throw Error('NPC response did not resolve real article');
  const actions = {};
  if (process.env.PERF_FULL_FLOW === '1' && !profile) {
    async function action(name, selector, waitFor) {
      const start = await page.locator(selector).evaluate(el => { const start = performance.now(); el.click(); return start; });
      await waitFor();
      actions[name] = await page.evaluate(start => performance.now() - start, start);
      return start;
    }
    const readerStart = await action('readerOpenMs', '[data-npc-read]', () => page.locator('#reader[open] #reader-title').waitFor({ state: 'visible' }));
    await page.evaluate(() => document.fonts.ready);
    actions.readerFontsReadyMs = await page.evaluate(start => performance.now() - start, readerStart);
    actions.readerTitle = await page.locator('#reader-title').innerText();
    await action('readerCloseMs', '#reader-close', () => page.waitForFunction(() => !document.querySelector('#reader').open));
    await action('pickerOpenMs', '#my-reading', () => page.locator('#journey-picker[open] [data-audience="marketing"]').waitFor({ state: 'visible' }));
    await action('audienceMs', '#journey-picker [data-audience="marketing"]', () => page.locator('#journey-picker [data-role="marketer"]').waitFor({ state: 'visible' }));
    await action('roleMs', '#journey-picker [data-role="marketer"]', () => page.locator('[data-skip-question]').waitFor({ state: 'visible' }));
    await action('missionOpenMs', '[data-skip-question]', () => page.locator('.mission-stage[data-renderer="webgl"] canvas[data-setting]').waitFor({ state: 'visible' }));
    const choiceStart = await page.locator('.journey-mission-choices [data-mission-choice="a"]').evaluate(el => { const start = performance.now(); el.click(); return start; });
    await page.locator('.journey-mission-feedback[data-choice-id="a"]').waitFor({ state: 'visible' });
    actions.choiceFeedbackMs = await page.evaluate(start => performance.now() - start, choiceStart);
    await page.waitForFunction(() => document.querySelector('.mission-stage-canvas')?.dataset.animating === 'false');
    actions.choiceSettledMs = await page.evaluate(start => performance.now() - start, choiceStart);
    actions.missionId = await page.locator('.journey-mission').getAttribute('data-mission-id');
    actions.finalPhase = await page.locator('.mission-stage-canvas').getAttribute('data-phase');
    actions.longTasks = await page.evaluate(() => window.__perf.longTasks);
  }
  const result = { index, variant, profile, ready, fonts, worldReady, actions, enterBegin: begin, enterMs: entered - begin, enterToActualIslandMs: Number(worldReady.firstIslandFrame) - begin, initialIslandFrameMs: Number(worldReady.firstIslandFrame), npcSelectAndQuestionMs: reply.at - selectedAt, npcReplyMs: reply.at - questionAt, reply, errors, failures, nonSuccess };
  if (profile) { const { profile: cpu } = await cdp.send('Profiler.stop'); await writeFile(`${output}/cpu-profile.json`, JSON.stringify(cpu)); }
  await context.close(); return result;
}
try {
  for (let i = 0; i < count; i++) for (const variant of compareRoot ? ['baseline', 'candidate'] : ['candidate']) { const value = await run(i + 1, false, variant); runs.push(value); console.log(JSON.stringify({ run: i + 1, variant, ready: value.ready.ready, enter: value.enterMs, npc: value.npcReplyMs, errors: value.errors.length, httpErrors: value.nonSuccess.length })); await writeFile(`${output}/raw-runs.json`, JSON.stringify(runs, null, 2)); }
  const summarize = variant => {
    const metrics = {};
    for (const key of ['ready', 'fontsReady', 'enterMs', 'npcSelectAndQuestionMs', 'npcReplyMs']) { const values = runs.filter(r => r.variant === variant).map(r => key === 'ready' ? r.ready.ready : key === 'fontsReady' ? r.fonts.ready : r[key]).sort((a, b) => a - b); metrics[key] = { median: values[Math.floor(values.length / 2)], min: values[0], max: values.at(-1) }; }
    for (const key of ['readerOpenMs', 'readerFontsReadyMs', 'readerCloseMs', 'pickerOpenMs', 'audienceMs', 'roleMs', 'missionOpenMs', 'choiceFeedbackMs', 'choiceSettledMs']) {
      const values = runs.filter(r => r.variant === variant).map(r => r.actions[key]).filter(Number.isFinite).sort((a, b) => a - b);
      if (values.length) metrics[key] = { median: values[Math.floor(values.length / 2)], min: values[0], max: values.at(-1) };
    }
    for (const key of ['enterToActualIslandMs', 'initialIslandFrameMs']) {
      const values = runs.filter(r => r.variant === variant).map(r => r[key]).filter(Number.isFinite).sort((a, b) => a - b);
      if (values.length) metrics[key] = { median: values[Math.floor(values.length / 2)], min: values[0], max: values.at(-1) };
    }
    return metrics;
  };
  await writeFile(`${output}/summary.json`, JSON.stringify({ base, root, compareRoot, gpu, measuredAt: new Date().toISOString(), network, cpuThrottle: 4, viewport: '390x844', browser: browser.version(), host: { cores: os.cpus().length, load: os.loadavg() }, caveats: ['Headless desktop Chromium is not a physical phone GPU; raw runs record actual renderer and parallel-shader support.', 'Local gzip static server isolates app cost; excludes remote DNS/TLS/CDN delay.', 'Cold-cache contexts disable HTTP cache and block service workers; offline/cache benefits require separate acceptance.', 'DOM ready controls and source-backed reply measured; canvas presence does not establish first meaningful rendered image.'], metrics: summarize('candidate'), ...(compareRoot ? { baselineMetrics: summarize('baseline') } : {}) }, null, 2));
  if (process.env.PERF_PROFILE !== '0') await writeFile(`${output}/profile-run.json`, JSON.stringify(await run('profile', true), null, 2));
  if (process.env.PERF_FAILURE_PROBE === '1') {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/assets/reading-journey-ui-*.js', route => route.abort('failed'));
    await page.goto(compareRoot ? new URL('candidate/', base).href : base);
    await page.locator('.article-row').first().waitFor({ state: 'attached' });
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.locator('#enter').evaluate(el => el.click());
      try {
        await page.waitForFunction(() => !document.body.classList.contains('entering') && document.body.classList.contains('library-open'));
      } catch (error) {
        await writeFile(`${output}/failure-recovery-error.json`, JSON.stringify(await page.evaluate(() => ({ bodyClasses: document.body.className, articles: document.querySelectorAll('.article-row').length, pickerOpen: document.querySelector('#journey-picker')?.open, toast: document.querySelector('#toast')?.textContent })), null, 2));
        throw error;
      }
    }
    const count = await page.locator('.article-row').count();
    await page.locator('.article-row').first().evaluate(el => el.click());
    await page.locator('#reader[open]').waitFor();
    const title = await page.locator('#reader-title').innerText();
    if (!count || !title.trim() || errors.length) throw Error(`Failed-import reading recovery failed: ${JSON.stringify({ count, title, errors })}`);
    await writeFile(`${output}/failure-recovery.json`, JSON.stringify({ scenario: 'Abort journey module, retry entry twice, retain actual directory and open actual reader', count, title, errors }, null, 2));
    await context.close();
  }
} finally { await browser.close(); server.close(); }

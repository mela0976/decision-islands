import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${origin}/immersive/?npc-touch=1`);
  await page.waitForFunction(() => window.immersive?.world);
  const { candidates, canvasRect } = await page.evaluate(() => {
    const world = window.immersive.world;
    world.setPopulation(100);
    return { candidates: Array.from({ length: 100 }, (_, index) => world.getNPCState(index))
      .filter(item => item.screen.z >= -1 && item.screen.z <= 1 && item.screen.x > 20 && item.screen.x < innerWidth - 20 && item.screen.y > 20 && item.screen.y < innerHeight - 20)
      .sort((a, b) => Math.hypot(a.screen.x - innerWidth / 2, a.screen.y - innerHeight / 2) - Math.hypot(b.screen.x - innerWidth / 2, b.screen.y - innerHeight / 2)), canvasRect: (()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})() };
  });
  if (!candidates.length) console.log(JSON.stringify(await page.evaluate(() => ({ camera: window.immersive.world.getState().camera, residents: Array.from({ length: 5 }, (_, index) => window.immersive.world.getNPCState(index)), viewport: [innerWidth, innerHeight] }))));
  assert.ok(candidates.length, 'at least one crowd resident is touchable in the mobile viewport');
  let selected;
  for (const candidate of candidates.slice(0, 12)) {
    await page.touchscreen.tap(candidate.screen.x, candidate.screen.y);
    try {
      await page.waitForFunction(id => window.immersive.world.getState().encounter?.npcIndex === id, candidate.index, { timeout: 400 });
      selected = candidate;
      break;
    } catch { /* Try the next visible resident. */ }
  }
  assert.ok(selected, 'a real canvas touch hit a crowd resident and opened their encounter');
  const opened = await page.evaluate(() => window.immersive.world.getState());
  assert.equal(opened.encounter.npcIndex, selected.index);
  assert.ok(opened.speech, 'the selected resident has a contextual speech line');
  assert.equal(opened.encounter.characterId, 'yue', 'resident 9 maps to the consumer character');
  assert.equal(opened.speech, '先等等，這個答案跟我現在要做的選擇有什麼關係？', 'a character absent from the island script receives their own role-specific fictional line');
  assert.equal(await page.locator('#game[open]').count(), 1, 'canvas touch opens the playable dialogue');
  const during = await page.evaluate(index => window.immersive.world.getNPCState(index), selected.index);
  assert.ok(during.paused, 'crowd resident pauses during encounter');
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.immersive.world.getState().encounter === null);
  const atClose = await page.evaluate(index => window.immersive.world.getNPCState(index), selected.index);
  assert.ok(!atClose.paused, 'the resident resumes walking when the encounter closes');
  const elapsedMs = 700;
  await page.waitForTimeout(elapsedMs);
  const later = await page.evaluate(index => window.immersive.world.getNPCState(index), selected.index);
  const angularDistance = Math.abs(Math.atan2(Math.sin(later.angle - atClose.angle), Math.cos(later.angle - atClose.angle)));
  const expected = atClose.speed * elapsedMs / 1000;
  assert.ok(Math.abs(angularDistance - expected) < .045, `angle resumes from its paused location (expected ${expected}, actual ${angularDistance})`);
  assert.ok(Math.abs(later.walkPhase - atClose.walkPhase) > .1, 'walk cycle resumes advancing after the conversation');
  const result = { viewport: '390x844 touch, DPR2', canvasRect, population: 100, tappedCrowdNpcIndex: selected.index, encounterOpened: true, speech: opened.speech, resumedAngularDistance: angularDistance, expectedAngularDistance: expected, walkPhaseAdvanced: true };
  await mkdir('test-results/immersive-npc-touch', { recursive: true });
  await writeFile('test-results/immersive-npc-touch/results.json', JSON.stringify(result, null, 2));
  await page.screenshot({ path: 'test-results/immersive-npc-touch/dialog.png' });
  console.log(JSON.stringify(result, null, 2));
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}

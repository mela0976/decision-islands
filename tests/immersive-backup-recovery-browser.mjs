import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : '@playwright/test');
const base = process.env.TEST_URL || 'http://127.0.0.1:4186/immersive/';
const outputDir = resolve('test-results/immersive-backup-recovery');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const startedAt = new Date().toISOString();
const results = {
  head,
  base,
  browser: 'Chromium via @playwright/test; headless WebGL with ANGLE SwiftShader',
  startedAt,
  checks: [],
  artifacts: [],
  browserErrors: { source: [], imported: [] },
};
const failures = [];
let browser;

function check(name, passed, details = {}) {
  const entry = { name, passed: Boolean(passed), ...details };
  results.checks.push(entry);
  if (!entry.passed) failures.push(entry);
}

async function waitForSavedNote(page) {
  await page.waitForFunction(() => document.querySelector('#note-status')?.textContent.includes('已儲存在這個瀏覽器'), undefined, { timeout: 10000 });
}

async function openApp(page) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.immersive?.data?.articles?.length === 22, undefined, { timeout: 30000 });
  if (await page.locator('#skip-intro').isVisible().catch(() => false)) await page.locator('#skip-intro').click();
  await page.locator('#read').waitFor({ state: 'visible' });
}

async function readFullArticle(page) {
  await page.locator('#read').click();
  await page.locator('#reader[open]').waitFor();
  await page.locator('[data-depth="full"]').click();
  return {
    title: await page.locator('#reader-title').innerText(),
    text: await page.locator('#reading-content').innerText(),
  };
}

async function closeReader(page) {
  if (await page.locator('#reader[open]').count()) {
    await page.keyboard.press('Escape');
    await page.locator('#reader').waitFor({ state: 'hidden' });
  }
}

async function runBookmarkRefreshOnly() {
  const startedAt = new Date().toISOString();
  const results = { head, base, mode: 'bookmark-refresh-only', startedAt, checks: [], artifacts: [], browserErrors: [] };
  const failures = [];
  const backupPath = join(outputDir, 'decision-wisdom-reading-backup.json');
  let browser;
  function record(name, passed, details = {}) {
    const entry = { name, passed: Boolean(passed), ...details };
    results.checks.push(entry);
    if (!entry.passed) failures.push(entry);
  }
  await mkdir(outputDir, { recursive: true });
  try {
    browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => results.browserErrors.push(error.message));
    await openApp(page);
    const backup = JSON.parse(await readFile(backupPath, 'utf8'));
    record('saved real browser download includes the favorite under test', backup.bookmarks?.includes('2026-01'), { bookmarks: backup.bookmarks });
    await page.locator('#map-toggle').click();
    await page.locator('#import-progress').setInputFiles(backupPath);
    await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('已合併閱讀紀錄'), undefined, { timeout: 10000 });
    const importStatus = await page.locator('#status').innerText();
    const bookmarkButton = await page.locator('#bookmark').innerText();
    record('import succeeds and the selected article button reflects its restored favorite immediately',
      /已合併閱讀紀錄/.test(importStatus) && /已收藏/.test(bookmarkButton), { importStatus, bookmarkButton });
    await page.locator('#only-bookmarks').check();
    const bookmarkRows = await page.locator('#article-list button').allInnerTexts();
    record('favorite filter still lists the restored article', bookmarkRows.length === 1 && bookmarkRows[0].includes('I01'), { bookmarkRows });
    const screenshotPath = join(outputDir, 'bookmark-refresh-after-import.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.artifacts.push(screenshotPath);
  } catch (error) {
    results.unexpectedError = { name: error.name, message: error.message, stack: error.stack };
    failures.push({ name: 'bookmark-only browser scenario completed without an unexpected error', passed: false, message: error.message });
  } finally {
    if (browser) await browser.close().catch(error => { results.browserCloseError = error.message; });
    results.browserErrors = [...new Set(results.browserErrors)];
    results.failures = failures;
    results.completedAt = new Date().toISOString();
    results.passed = failures.length === 0;
    const resultsPath = join(outputDir, 'bookmark-refresh-results.json');
    await writeFile(resultsPath, JSON.stringify(results, null, 2));
    results.artifacts.push(resultsPath);
    console.log(JSON.stringify(results, null, 2));
  }
  assert.deepEqual(failures, [], `Bookmark refresh check failed; see ${join(outputDir, 'bookmark-refresh-results.json')}`);
}

if (process.env.IMMERSIVE_BOOKMARK_REFRESH_ONLY === '1') {
  await runBookmarkRefreshOnly();
} else {
await mkdir(outputDir, { recursive: true });
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const sourceContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, reducedMotion: 'reduce' });
  const sourcePage = await sourceContext.newPage();
  sourcePage.on('pageerror', error => results.browserErrors.source.push(error.message));
  await openApp(sourcePage);

  const sourceOne = await readFullArticle(sourcePage);
  const sourceNoteOne = '來源備份筆記：原始紀錄應匯出，並由目標瀏覽器的非空白筆記優先保留。';
  await sourcePage.locator('#note').fill(sourceNoteOne);
  await waitForSavedNote(sourcePage);
  await sourcePage.locator('#mark-read').click();
  const sourceReadOne = await sourcePage.locator('#mark-read').innerText();
  await closeReader(sourcePage);
  await sourcePage.locator('#bookmark').click();
  const sourceBookmarkOne = await sourcePage.locator('#bookmark').innerText();

  await sourcePage.locator('#next').click();
  const sourceTwo = await readFullArticle(sourcePage);
  const sourceNoteTwo = '備份匯入專用筆記：在全新瀏覽器中應找回這段內容。';
  await sourcePage.locator('#note').fill(sourceNoteTwo);
  await waitForSavedNote(sourcePage);
  await sourcePage.locator('#mark-read').click();
  const sourceReadTwo = await sourcePage.locator('#mark-read').innerText();
  await closeReader(sourcePage);

  await sourcePage.locator('#map-toggle').click();
  const [download] = await Promise.all([
    sourcePage.waitForEvent('download'),
    sourcePage.locator('#export-progress').click(),
  ]);
  const backupPath = join(outputDir, download.suggestedFilename());
  await download.saveAs(backupPath);
  results.artifacts.push(backupPath);
  const downloadedBackup = JSON.parse(await readFile(backupPath, 'utf8'));
  const ids = Object.keys(downloadedBackup.notes || {}).sort();
  const sourceIds = { first: ids[0], second: ids[1] };
  results.backup = {
    filename: download.suggestedFilename(),
    path: backupPath,
    byteLength: (await readFile(backupPath)).byteLength,
    read: downloadedBackup.read,
    bookmarks: downloadedBackup.bookmarks,
    notes: downloadedBackup.notes,
    last: downloadedBackup.last,
  };
  check('Chromium downloaded the named JSON backup file', download.suggestedFilename() === 'decision-wisdom-reading-backup.json', { filename: download.suggestedFilename() });
  check('downloaded JSON contains both read articles and both note bodies',
    downloadedBackup.read.includes(sourceIds.first) && downloadedBackup.read.includes(sourceIds.second) &&
    downloadedBackup.notes[sourceIds.first] === sourceNoteOne && downloadedBackup.notes[sourceIds.second] === sourceNoteTwo,
    { sourceIds, read: downloadedBackup.read, noteIds: Object.keys(downloadedBackup.notes || {}) });
  check('downloaded JSON contains the bookmarked article', downloadedBackup.bookmarks.includes(sourceIds.first), { bookmarks: downloadedBackup.bookmarks, expected: sourceIds.first });
  check('source UI marked both articles read and the first article collected',
    /已讀完/.test(sourceReadOne) && /已讀完/.test(sourceReadTwo) && /已收藏/.test(sourceBookmarkOne),
    { sourceReadOne, sourceReadTwo, sourceBookmarkOne, articleTitles: [sourceOne.title, sourceTwo.title] });

  const importedContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, reducedMotion: 'reduce' });
  const importedPage = await importedContext.newPage();
  importedPage.on('pageerror', error => results.browserErrors.imported.push(error.message));
  await openApp(importedPage);

  await importedPage.locator('#read').click();
  await importedPage.locator('#reader[open]').waitFor();
  await importedPage.locator('[data-depth="full"]').click();
  const existingNote = '新瀏覽器已存在的非空筆記：匯入時應優先保留。';
  await importedPage.locator('#note').fill(existingNote);
  await waitForSavedNote(importedPage);
  await closeReader(importedPage);
  await importedPage.locator('#map-toggle').click();
  const freshProgress = await importedPage.locator('#progress').innerText();
  await importedPage.locator('#only-bookmarks').check();
  const freshBookmarkState = await importedPage.locator('#article-list').innerText();
  await importedPage.locator('#only-bookmarks').uncheck();
  check('new browser context starts without prior read or bookmark records', /已讀 0 \/ 22/.test(freshProgress) && freshBookmarkState.includes('還沒有收藏文章'),
    { progress: freshProgress, bookmarkState: freshBookmarkState });

  await importedPage.locator('#import-progress').setInputFiles(backupPath);
  await importedPage.waitForFunction(() => /已合併閱讀紀錄|無法匯入：/.test(document.querySelector('#status')?.textContent || ''), undefined, { timeout: 10000 });
  const importStatus = await importedPage.locator('#status').innerText();
  check('actual downloaded JSON imported through the browser file chooser', /已合併閱讀紀錄/.test(importStatus), { importStatus });
  check('UI progress shows merged read records and notes after import',
    /已讀 2 \/ 22/.test(await importedPage.locator('#progress').innerText()) && /筆記 2 篇/.test(await importedPage.locator('#progress').innerText()),
    { progress: await importedPage.locator('#progress').innerText() });

  const bookmarkImmediatelyAfterImport = await importedPage.locator('#bookmark').innerText();
  check('currently selected story button immediately reflects imported bookmark', /已收藏/.test(bookmarkImmediatelyAfterImport), { bookmarkImmediatelyAfterImport });

  await importedPage.locator('#only-bookmarks').check();
  const bookmarkRows = await importedPage.locator('#article-list button').allInnerTexts();
  check('bookmark filter exposes the restored article in the catalog', bookmarkRows.length === 1, { bookmarkRows });
  if (bookmarkRows.length) await importedPage.locator('#article-list button').first().click();
  const bookmarkAfterReselect = await importedPage.locator('#bookmark').innerText();
  check('selecting the restored favorite displays its collected state', /已收藏/.test(bookmarkAfterReselect), { bookmarkAfterReselect });

  const restoredOne = await readFullArticle(importedPage);
  const restoredNoteOne = await importedPage.locator('#note').inputValue();
  const restoredReadOne = await importedPage.locator('#mark-read').innerText();
  check('first full article is readable and matches the source browser', restoredOne.text === sourceOne.text && restoredOne.text.length > 1000,
    { title: restoredOne.title, characters: restoredOne.text.length, matchesSource: restoredOne.text === sourceOne.text });
  check('nonempty target-browser note wins for the same article', restoredNoteOne === existingNote,
    { expected: existingNote, actual: restoredNoteOne });
  check('read status is visible in the reading dialog after import', /已讀完/.test(restoredReadOne), { restoredReadOne });
  await importedPage.locator('#note').scrollIntoViewIfNeeded();
  const readerScreenshot = join(outputDir, 'roundtrip-imported-reader.png');
  await importedPage.screenshot({ path: readerScreenshot, fullPage: true });
  results.artifacts.push(readerScreenshot);
  await closeReader(importedPage);

  await importedPage.locator('#next').click();
  const restoredTwo = await readFullArticle(importedPage);
  const restoredNoteTwo = await importedPage.locator('#note').inputValue();
  const restoredReadTwo = await importedPage.locator('#mark-read').innerText();
  check('second full article and its imported note are available in the new context',
    restoredTwo.text === sourceTwo.text && restoredNoteTwo === sourceNoteTwo,
    { title: restoredTwo.title, characters: restoredTwo.text.length, matchesSource: restoredTwo.text === sourceTwo.text, expectedNote: sourceNoteTwo, actualNote: restoredNoteTwo });
  check('second article read status survives export and import', /已讀完/.test(restoredReadTwo), { restoredReadTwo });
  await importedPage.locator('#note').scrollIntoViewIfNeeded();
  const importedNoteScreenshot = join(outputDir, 'roundtrip-imported-note.png');
  await importedPage.screenshot({ path: importedNoteScreenshot, fullPage: true });
  results.artifacts.push(importedNoteScreenshot);
  await closeReader(importedPage);

  await importedPage.locator('#map-toggle').click();
  await importedPage.locator('#import-progress').setInputFiles({ name: 'invalid-backup.json', mimeType: 'application/json', buffer: Buffer.from('{"notes":') });
  await importedPage.waitForFunction(() => document.querySelector('#status')?.textContent.includes('無法匯入：'), undefined, { timeout: 10000 });
  const invalidJsonStatus = await importedPage.locator('#status').innerText();
  check('invalid JSON reports an import error', /無法匯入：/.test(invalidJsonStatus), { invalidJsonStatus });
  await importedPage.locator('#map-toggle').click();
  let afterInvalid = await readFullArticle(importedPage);
  let noteAfterInvalid = await importedPage.locator('#note').inputValue();
  let readAfterInvalid = await importedPage.locator('#mark-read').innerText();
  check('invalid JSON leaves full text, imported note, and read status intact',
    afterInvalid.text === sourceTwo.text && noteAfterInvalid === sourceNoteTwo && /已讀完/.test(readAfterInvalid),
    { title: afterInvalid.title, matchesSource: afterInvalid.text === sourceTwo.text, noteAfterInvalid, readAfterInvalid });
  await closeReader(importedPage);
  await importedPage.locator('#previous').click();
  const bookmarkAfterInvalid = await importedPage.locator('#bookmark').innerText();
  check('invalid JSON leaves the restored bookmark intact', /已收藏/.test(bookmarkAfterInvalid), { bookmarkAfterInvalid });
  await importedPage.locator('#next').click();

  await importedPage.locator('#map-toggle').click();
  await importedPage.locator('#import-progress').setInputFiles({ name: 'oversized-backup.json', mimeType: 'application/json', buffer: Buffer.alloc(2_000_001, 0x20) });
  await importedPage.waitForFunction(() => document.querySelector('#status')?.textContent.includes('無法匯入：'), undefined, { timeout: 10000 });
  const oversizedStatus = await importedPage.locator('#status').innerText();
  check('oversized JSON reports an import error', oversizedStatus.includes('備份檔案過大'), { oversizedStatus, byteLength: 2_000_001 });
  await importedPage.locator('#map-toggle').click();
  afterInvalid = await readFullArticle(importedPage);
  noteAfterInvalid = await importedPage.locator('#note').inputValue();
  readAfterInvalid = await importedPage.locator('#mark-read').innerText();
  check('oversized JSON leaves full text, imported note, and read status intact',
    afterInvalid.text === sourceTwo.text && noteAfterInvalid === sourceNoteTwo && /已讀完/.test(readAfterInvalid),
    { title: afterInvalid.title, matchesSource: afterInvalid.text === sourceTwo.text, noteAfterInvalid, readAfterInvalid });
  await closeReader(importedPage);
  await importedPage.locator('#previous').click();
  const bookmarkAfterOversized = await importedPage.locator('#bookmark').innerText();
  check('oversized JSON leaves the restored bookmark intact', /已收藏/.test(bookmarkAfterOversized), { bookmarkAfterOversized });
  await importedPage.locator('#next').click();

  const lossTrigger = await importedPage.evaluate(() => {
    const canvas = document.querySelector('#world');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!gl || !extension) return { available: false, contextType: gl ? 'webgl' : null };
    extension.loseContext();
    return { available: true, contextType: gl.constructor?.name || 'webgl' };
  });
  results.contextLossTrigger = lossTrigger;
  check('real WebGL context and WEBGL_lose_context extension were available', lossTrigger.available, lossTrigger);
  if (lossTrigger.available) {
    await importedPage.waitForFunction(() => document.body.classList.contains('fallback') && document.querySelector('#status')?.textContent.includes('3D 連線中斷'), undefined, { timeout: 10000 });
    const fallbackStatus = await importedPage.locator('#status').innerText();
    check('real context loss switches to the 2D reading fallback with a user notice',
      await importedPage.locator('body.fallback').count() === 1 && fallbackStatus.includes('已切換閱讀模式') && fallbackStatus.includes('閱讀紀錄與筆記仍可使用'),
      { fallbackStatus, fallbackClass: await importedPage.locator('body').getAttribute('class') });
    const fallbackScreenshot = join(outputDir, 'webgl-context-loss-fallback.png');
    await importedPage.screenshot({ path: fallbackScreenshot, fullPage: true });
    results.artifacts.push(fallbackScreenshot);

    await importedPage.locator('#map-toggle').click();
    const fallbackFull = await readFullArticle(importedPage);
    const fallbackNote = await importedPage.locator('#note').inputValue();
    check('full article remains readable after real WebGL context loss', fallbackFull.text === sourceTwo.text && fallbackFull.text.length > 1000,
      { title: fallbackFull.title, characters: fallbackFull.text.length, matchesSource: fallbackFull.text === sourceTwo.text });
    check('imported note remains visible after real WebGL context loss', fallbackNote === sourceNoteTwo, { expected: sourceNoteTwo, actual: fallbackNote });
    const postLossNote = 'WebGL 降級後仍可編輯與保存的筆記。';
    await importedPage.locator('#note').fill(postLossNote);
    await waitForSavedNote(importedPage);
    await closeReader(importedPage);
    const reopenedAfterLoss = await readFullArticle(importedPage);
    check('note edited after context loss is saved and readable on reopening', await importedPage.locator('#note').inputValue() === postLossNote,
      { expected: postLossNote, actual: await importedPage.locator('#note').inputValue(), articleTitle: reopenedAfterLoss.title });
    const afterLossScreenshot = join(outputDir, 'webgl-context-loss-reading.png');
    await importedPage.screenshot({ path: afterLossScreenshot, fullPage: true });
    results.artifacts.push(afterLossScreenshot);
    await closeReader(importedPage);
  }

  results.browserErrors.source = [...new Set(results.browserErrors.source)];
  results.browserErrors.imported = [...new Set(results.browserErrors.imported)];
} catch (error) {
  results.unexpectedError = { name: error.name, message: error.message, stack: error.stack };
  failures.push({ name: 'scenario completed without an unexpected Playwright error', passed: false, message: error.message });
} finally {
  if (browser) await browser.close().catch(error => { results.browserCloseError = error.message; });
  results.failures = failures;
  results.completedAt = new Date().toISOString();
  results.passed = failures.length === 0;
  const resultsPath = join(outputDir, 'results.json');
  await writeFile(resultsPath, JSON.stringify(results, null, 2));
  results.artifacts.push(resultsPath);
  console.log(JSON.stringify(results, null, 2));
}

assert.deepEqual(failures, [], `${failures.length} browser acceptance check(s) failed; see ${join(outputDir, 'results.json')}`);
}

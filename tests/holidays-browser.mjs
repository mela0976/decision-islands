import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.TEST_URL||'http://127.0.0.1:4173/';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try {
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.locator('.article-row').first().waitFor({state:'attached'});
  assert.equal(await page.locator('#season').inputValue(),'christmas');
  assert.equal(await page.locator('#season option').count(),3);
  const images=[];
  for(const season of ['christmas','halloween','easter']) {
   await page.locator('#season').selectOption(season);
   await page.waitForFunction(value=>document.documentElement.dataset.season===value&&document.querySelector('.island-world').dataset.season===value,season);
   images.push(await page.locator('.island-world canvas').screenshot());
   await page.screenshot({path:`test-results/holiday-home-${viewport.width}-${season}.png`});
  }
  assert.ok(!images[0].equals(images[1])&&!images[1].equals(images[2]));
  await page.reload();await page.locator('.article-row').first().waitFor({state:'attached'});
  assert.equal(await page.locator('#season').inputValue(),'easter');
  await page.locator('#enter').click();await page.waitForFunction(()=>document.body.classList.contains('exploring'));
  assert.equal(await page.locator('.explorer-ui').getAttribute('data-season'),'easter');
  for(const season of ['halloween','christmas','easter']) {
   await page.locator('#season').selectOption(season);
   assert.equal(await page.locator('.explorer-ui').getAttribute('data-season'),season);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.locator('#toggle-library').click();await page.locator('.article-row').first().click();
  await page.locator('#reader[open]').waitFor();assert.ok((await page.locator('.article-body').innerText()).length>500);
  assert.equal(await page.locator('#season').inputValue(),'easter');
  assert.deepEqual(errors,[]);results.push(`${viewport.width}px: default, three distinct home canvases, persistence, explorer synchronization, original reading`);
  await context.close();
 }
 const denied=await browser.newContext({reducedMotion:'reduce'});
 await denied.addInitScript(()=>{Storage.prototype.getItem=function(){throw Error('storage denied')};Storage.prototype.setItem=function(){throw Error('storage denied')};});
 const dp=await denied.newPage();await dp.goto(new URL('?lang=en',base).href);await dp.locator('.article-row').first().waitFor({state:'attached'});
 assert.equal(await dp.locator('#season').inputValue(),'christmas');assert.match(await dp.locator('#season').innerText(),/Christmas.*Halloween.*Easter/s);
 await dp.locator('#season').selectOption('halloween');assert.equal(await dp.evaluate(()=>document.documentElement.dataset.season),'halloween');
 await dp.locator('#enter').click();await dp.waitForFunction(()=>document.body.classList.contains('exploring'));
 assert.equal(await dp.locator('.explorer-ui').getAttribute('data-season'),'halloween');
 results.push('English holiday labels and denied storage retain working in-session switch');await denied.close();
 await writeFile('test-results/holiday-results.json',JSON.stringify({base,results},null,2));console.log(results.join('\n'));
} finally { await browser.close(); }

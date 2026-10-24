import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4186/immersive/';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
await mkdir('test-results/immersive-intro',{recursive:true});
const results=[];
try{
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
  const context=await browser.newContext({viewport,reducedMotion:'no-preference'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));const epoch=new Date('2026-01-01T00:00:00Z');await page.clock.install({time:epoch});await page.clock.pauseAt(new Date(epoch.getTime()+100));await page.goto(base);
  await page.locator('canvas[data-book-intro=true]').waitFor({state:'attached'});await page.clock.fastForward(32);
  await page.screenshot({path:`test-results/immersive-intro/${viewport.width}-cover.png`});
  await page.clock.fastForward(4100);assert.match(await page.locator('#intro-caption').innerText(),/紙上的觀點/);
  await page.screenshot({path:`test-results/immersive-intro/${viewport.width}-tower.png`});
  await page.clock.fastForward(2000);assert.match(await page.locator('#intro-caption').innerText(),/各有自己的海岸/);
  await page.screenshot({path:`test-results/immersive-intro/${viewport.width}-coasts.png`});
  await page.clock.fastForward(3000);await page.locator('#intro[hidden]').waitFor({state:'attached'});
  assert.equal(await page.locator('canvas[data-book-intro=true]').count(),0,'intro GPU canvas is released');
  await page.waitForFunction(()=>Boolean(window.immersive),{},{polling:100});assert.ok(await page.evaluate(()=>window.immersive.world));
  await page.reload();await page.waitForFunction(()=>Boolean(window.immersive),{},{polling:100});assert.equal(await page.locator('canvas[data-book-intro=true]').count(),0,'intro never repeats after first visit');
  assert.deepEqual(errors,[]);results.push({viewport,phases:['cover','tower','coasts','world'],released:true,repeated:false,errors});await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();await page.goto(base);await page.locator('canvas[data-book-intro=true]').waitFor({state:'attached'});await page.locator('#skip-intro').click();await page.waitForFunction(()=>Boolean(window.immersive));assert.equal(await page.locator('canvas[data-book-intro=true]').count(),0);results.push({skip:'actual skip button releases intro and opens world'});await context.close();
 await writeFile('test-results/immersive-intro/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}

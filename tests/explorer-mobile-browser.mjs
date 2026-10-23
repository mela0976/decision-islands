import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://127.0.0.1:4174/';await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:get.call(this,type,...args)}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const edition=await (await context.request.get(new URL('data/2026.json',base).href)).json();
 await page.goto(base);await page.locator('.article-row').first().waitFor({state:'attached'});await page.locator('#enter').click();await page.locator('#journey-picker [data-free-explore]').click();
 const panel=page.locator('.explorer-list');assert.ok(Math.abs((await panel.boundingBox()).height-844*.52)<2);
 for(const chapter of ['intro','people','model','ai']){
  await page.locator('.explorer-chapter-filter select').selectOption(chapter);const ids=await page.locator('.explorer-list [data-item-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.articleId));
  assert.ok(ids.length>0);assert.ok(ids.every(id=>edition.articles.find(a=>a.id===id)?.chapter===chapter));assert.equal(await page.evaluate(()=>document.body.classList.contains('library-open')),false);
 }
 await page.locator('.explorer-chapter-filter select').selectOption('');assert.equal(await page.locator('.explorer-list [data-item-id]').count(),48);
 const handle=page.locator('.explorer-list .explorer-sheet-handle');let box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,30,{steps:8});await page.mouse.up();assert.equal(await panel.getAttribute('data-expanded'),'true');
 box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,450,{steps:8});await page.mouse.up();assert.equal(await panel.getAttribute('data-expanded'),'false');
 await panel.locator('.explorer-close').click();assert.equal(await panel.evaluate(el=>el.inert),true);assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('explorer-tool-button')),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 const results=['390x844 list starts at 52%, all four chapter filters retain explorer context, drag expands/collapses, close restores focus and inert state, no horizontal overflow'];await writeFile('test-results/explorer-mobile-results.json',JSON.stringify({base,results,errors},null,2));console.log(results.join('\n'));
}finally{await browser.close()}

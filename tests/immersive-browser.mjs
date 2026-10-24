import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : '@playwright/test');
const browser = await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const base=process.env.TEST_URL||'http://127.0.0.1:4186/immersive/';
const results=[];
await mkdir('test-results/immersive',{recursive:true});
try {
 for (const viewport of [{width:1280,height:800},{width:390,height:844}]) {
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}), page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForFunction(()=>window.immersive,{timeout:30000});
  const state=await page.evaluate(()=>window.immersive.world?.getState());
  assert.ok(state,'WebGL world initialized');assert.equal(state.renderedIslandCount,22);assert.equal(state.characters.length,4);
  await page.locator('#read').click();await page.locator('#reader[open]').waitFor();
  await page.locator('#note').fill('手機與桌面閱讀筆記');await page.locator('#mark-read').click();await page.keyboard.press('Escape');
  await page.reload();await page.waitForFunction(()=>window.immersive);await page.locator('#read').click();
  assert.equal(await page.locator('#note').inputValue(),'手機與桌面閱讀筆記');assert.match(await page.locator('#mark-read').innerText(),/已讀完/);await page.keyboard.press('Escape');
  const articles=await page.evaluate(()=>window.immersive.data.articles.map(a=>a.id));
  for(const id of articles){await page.evaluate(id=>window.immersive.visit(id,null,false),id);assert.equal(await page.evaluate(()=>window.immersive.world.getState().current),id);}
  await page.evaluate(()=>window.immersive.visit('2026-03',null,false));await page.locator('#interact').click();await page.evaluate(()=>window.immersive.visit('2026-07',null,false));assert.equal(await page.locator('#game[open]').count(),0,'changing island closes old task');await page.locator('#read').click();assert.equal(await page.locator('#reader-title').innerText(),await page.evaluate(()=>window.immersive.data.articles.find(a=>a.id==='2026-07').title));await page.keyboard.press('Escape');
  await page.evaluate(()=>window.immersive.visit('2026-06',null,false));await page.locator('#interact').click();await page.getByRole('button',{name:'核對：目前證據不足，暫緩定論',exact:true}).click();await page.getByRole('button',{name:'先當成已確認',exact:true}).click();assert.equal(await page.evaluate(()=>window.immersive.world.getState().interaction.layout),'unverified-image-on-desk','evidence IDs do not override final decision');await page.keyboard.press('Escape');
  await page.locator('#overview').click();assert.equal(await page.locator('#mode').innerText(),'自由閱讀');await page.locator('#map-toggle').click();await page.locator('#mode').click();assert.equal(await page.locator('#mode').innerText(),'故事探索');
  await page.evaluate(()=>window.immersive.visit('2026-14',null,false));await page.locator('#interact').click();
  assert.equal(await page.locator('#game-controls select').count(),5);await page.getByRole('button',{name:'把資訊放上證據桌'}).click();
  await page.locator('#game-after:not([hidden])').waitFor();await page.locator('#compare').click();assert.match(await page.locator('#game-result').innerText(),/選擇前/);await page.keyboard.press('Escape');
  const games=[
   ['2026-03','保留待查，補足依據'],['2026-07','依照我的條件比較'],['2026-10','停下來排出「先問人，再問 AI」'],['2026-11','把這段回憶留在廣場'],['2026-12','查看條件與推論邊界'],['2026-14','把資訊放上證據桌'],['2026-17','修復這一段旅程'],['2026-22','啟動協作'],
  ];
  for(const [id,action]of games){
   await page.evaluate(id=>window.immersive.visit(id,null,false),id);await page.locator('#interact').click();
   if(id==='2026-11')await page.getByRole('button',{name:'翻看舊票根',exact:true}).click();
   await page.getByRole('button',{name:action,exact:true}).click();
   if(id==='2026-10'){await page.getByRole('button',{name:'轉身後回想',exact:true}).click();await page.getByRole('button',{name:'先問人，再問 AI',exact:true}).click();}
   await page.locator('#game-after:not([hidden])').waitFor();assert.ok((await page.locator('#game-result').innerText()).length>20);await page.locator('#game-evidence summary').click();assert.ok((await page.locator('#game-evidence').innerText()).includes('觀點來源'));
   const after=await page.evaluate(()=>window.immersive.world.getState().interaction);assert.ok(after.outcomeObjectCount>0,`${id} choice creates visible scene objects`);await page.locator('#replay').click();assert.equal(await page.evaluate(()=>window.immersive.world.getState().interaction.baselineRestored),true,`${id} replay restores original scene`);await page.keyboard.press('Escape');
  }
  await page.evaluate(()=>window.immersive.visit('2026-07',null,false));
  await page.screenshot({path:`test-results/immersive/${viewport.width}-world.png`});
  const contrast=await page.evaluate(()=>{
   const lum=c=>{const rgb=c.match(/[\d.]+/g).slice(0,3).map(x=>{const s=Number(x)/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
   return ['dialogue','chapter-label','status'].map(id=>{const el=document.getElementById(id),s=getComputedStyle(el),parent=getComputedStyle(id==='status'?el:el.parentElement);const a=lum(s.color),b=lum(parent.backgroundColor);return{id,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
  });for(const entry of contrast)assert.ok(entry.ratio>=4.5,`${entry.id} contrast ${entry.ratio}`);
  assert.deepEqual(errors,[]);results.push({viewport,state,contrast,errors});await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
 await page.route('**/cdn.jsdelivr.net/**',route=>route.abort());await page.goto(base);await page.waitForFunction(()=>window.immersive);assert.ok(await page.locator('body.fallback').count());await page.locator('#read').click();await page.locator('#reader[open]').waitFor();results.push({fallback:'CDN failure retains selectable HTML reading'});await context.close();
 const failedContext=await browser.newContext(),failed=await failedContext.newPage(),failedErrors=[];failed.on('pageerror',error=>failedErrors.push(error.message));await failed.route('**/data/2026.json',route=>route.abort());await failed.goto(base);await failed.locator('body.fallback').waitFor({state:'attached'});assert.equal(await failed.locator('#read').isDisabled(),true);assert.equal(await failed.locator('#next').isDisabled(),true);await failed.locator('#dialogue a').waitFor({state:'visible'});assert.deepEqual(failedErrors,[]);results.push({dataFailure:'disabled controls and visible static source directory link'});await failedContext.close();
 await writeFile('test-results/immersive/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}

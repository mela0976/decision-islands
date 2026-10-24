import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

test('visible mission meshes fit mobile and desktop with readable actors and objects', async () => {
  const server = await createServer({server:{port:0,host:'127.0.0.1',hmr:false}});
  await server.listen();
  const browser = await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const measurements = [];
  try {
    const page = await browser.newPage({viewport:{width:700,height:500}});
    await page.clock.install(); await page.clock.pauseAt(new Date());
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    await page.route(`${origin}/__readable`, route => route.fulfill({contentType:'text/html',body:'<main id="fixture" style="width:318px;height:180px"></main>'}));
    await page.goto(`${origin}/__readable`);
    await page.evaluate(async () => {
      const [{createMission3DStage},{JOURNEY_2026}] = await Promise.all([import('/src/mission-3d-stage.ts'),import('/src/reading-journeys.ts')]);
      window.missions = JOURNEY_2026.personas.flatMap(role=>role.questions.flatMap(question=>question.steps)).map(step=>step.mission);
      window.phases=[];
      document.querySelector('#fixture').addEventListener('mission-stage-phase',event=>window.phases.push(event.detail));
      window.stage=createMission3DStage(document.querySelector('#fixture'),'zh');
      window.stage.setMotion(false);
      const mission=window.missions[0];
      window.stage.update({key:mission.id,definition:mission.visual,choiceId:null,previewChoiceId:null});
    });
    await mkdir('test-results/readable-missions',{recursive:true});
    for (const [width,height] of [[318,180],[620,310]]) {
      await page.evaluate(({width,height})=>Object.assign(document.querySelector('#fixture').style,{width:`${width}px`,height:`${height}px`}),{width,height});
      await page.clock.runFor(32);
      await page.waitForFunction(width => document.querySelector('canvas')?.width === Math.floor(width * Math.min(devicePixelRatio || 1, width < 600 ? 1.25 : 1.5)),width);
      const states = await page.evaluate(() => window.missions.flatMap(mission => [null,'a','b'].map(choiceId => {
        window.stage.update({key:mission.id,definition:mission.visual,choiceId,previewChoiceId:null});
        document.querySelector('canvas').getContext('webgl2').finish();
        return {sample:'original',mission:mission.id,choiceId,...window.stage.snapshot()};
      })));
      assert.equal(states.length,144);
      const comparisons = await page.evaluate(() => window.missions.flatMap(mission => ['a','b'].flatMap(choiceId => ['before','after'].map(comparisonView => {
        window.stage.update({key:mission.id,definition:mission.visual,choiceId,previewChoiceId:null,comparisonView,animate:false});
        document.querySelector('canvas').getContext('webgl2').finish();
        return {sample:'comparison',mission:mission.id,choiceId,comparisonView,...window.stage.snapshot()};
      }))));
      assert.equal(comparisons.length,192);
      for (const state of [...states,...comparisons]) {
        assert.equal(state.mode,'webgl');
        for (const entity of state.entities.filter(entity=>entity.visible)) {
          const context=`${width}/${state.mission}/${state.choiceId}/${state.comparisonView??'original'}/${entity.id}`;
          const bounds=entity.projected;
          assert.ok(bounds.left>=-0.1 && bounds.right<=width+.1 && bounds.top>=53.9 && bounds.bottom<=height+.1,`${context} fits viewport below controls ${JSON.stringify(bounds)}`);
          const target=entity.kind==='adult'||entity.kind==='elder'?38:entity.kind==='child'?26:entity.kind==='phone'?20:0;
          if (target) assert.ok(bounds.height>=target,`${context} height ${bounds.height.toFixed(1)} >= ${target}`);
          measurements.push({viewportWidth:width,viewportHeight:height,sample:state.sample,comparisonView:state.comparisonView,mission:state.mission,choice:state.choiceId,id:entity.id,kind:entity.kind,...bounds});
        }
      }
      for (const [missionId,choiceId] of [['shared-memory-1',null],['shared-memory-1','a'],['family-trust-3','b'],['human-skill-1','a'],['creative-value-2','a']]) {
        await page.evaluate(({missionId,choiceId})=>{const mission=window.missions.find(item=>item.id===missionId);window.stage.update({key:mission.id,definition:mission.visual,choiceId,previewChoiceId:null});},{missionId,choiceId});
        const clip = await page.locator('#fixture').boundingBox();
        await page.screenshot({clip,path:`test-results/readable-missions/${width}-${missionId}-${choiceId??'initial'}.png`});
      }
    }
    await page.evaluate(()=>{window.stage.setMotion(true);const mission=window.missions.find(item=>item.id==='shared-memory-1');window.input={key:mission.id,definition:mission.visual,choiceId:null,previewChoiceId:null};window.stage.update(window.input);window.stage.update({...window.input,previewChoiceId:'b'});});
    assert.equal((await page.evaluate(()=>window.stage.snapshot())).phase,'approach');
    await page.clock.fastForward(600);
    assert.equal((await page.evaluate(()=>window.stage.snapshot())).phase,'interact');
    await page.screenshot({clip:await page.locator('#fixture').boundingBox(),path:'test-results/readable-missions/interaction.png'});
    const before=await page.evaluate(()=>window.stage.snapshot());
    await page.evaluate(()=>window.stage.update({...window.input,choiceId:'b'}));
    assert.deepEqual((await page.evaluate(()=>window.stage.snapshot())).entities,before.entities);
    assert.deepEqual(await page.evaluate(()=>window.phases.at(-1)),{phase:'interact',choiceId:'b',preview:false,comparisonView:'after'});
    await page.clock.fastForward(1700);
    const terminal=await page.evaluate(()=>window.stage.snapshot());
    assert.equal(terminal.phase,'result'); assert.equal(terminal.animating,false);
    await page.clock.fastForward(500);
    assert.equal((await page.evaluate(()=>window.stage.snapshot())).renderCount,terminal.renderCount);
    await page.evaluate(()=>window.stage.dispose());
    await writeFile('test-results/readable-missions/measurements.json',JSON.stringify(measurements,null,2));
  } finally {await browser.close();await server.close();}
});

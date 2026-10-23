import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const urls=new Map();
async function load(name) {
  if(urls.has(name))return import(urls.get(name));
  let code=ts.transpileModule(readFileSync(new URL(`../src/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const imports=[...code.matchAll(/from ['"]\.\/([^'"]+)['"]/g)];
  for(const match of imports) {await load(match[1]);code=code.replace(match[0],`from '${urls.get(match[1])}'`);}
  const url=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;urls.set(name,url);return import(url);
}
const {DATA,buildExplorerData,isExplorerCurated,initialExplorerState}=await load('explorer-data');
const {buildPathGraph,findRoute,pointOnRoute,itemPlacements,axialToWorld}=await load('explorer-graph');
const {sampleDay,activeItemIds}=await load('explorer-daycycle');
const {createSimulation}=await load('explorer-simulation');
const edition=JSON.parse(readFileSync(new URL('../public/data/2026.json',import.meta.url),'utf8'));
const data=buildExplorerData(DATA,edition),graph=buildPathGraph(data);
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('48 distinct reading placements resolve all 22 canonical articles and bilingual guides',()=>{
 assert.equal(data.islands.length,12);assert.equal(data.items.length,48);assert.equal(new Set(data.items.map(i=>i.id)).size,48);assert.equal(new Set(data.items.map(i=>i.articleId)).size,22);
 assert.equal(data.flows.length,10);assert.equal(new Set(data.roles.map(r=>r.accessory)).size,9);assert.equal(new Set(data.items.map(i=>i.model)).size,12);
 for(const i of data.items){assert.ok(edition.articles.some(a=>a.id===i.articleId));assert.ok(i.caption.zh&&i.caption.en);assert.ok(data.islands.find(s=>s.id===i.islandId).itemIds.includes(i.id));}
 assert.deepEqual(initialExplorerState('en',true).minute,600);assert.equal(initialExplorerState('en',true).reducedMotion,true);
});
test('sparse new editions never leak old article IDs; invalid input fails at boundary',()=>{
 const article={...edition.articles[0],id:'2031-custom',year:2031,order:98};const sparse=buildExplorerData(DATA,{...edition,year:2031,articles:[article]});
 assert.equal(sparse.items.length,1);assert.equal(sparse.items[0].articleId,'2031-custom');assert.equal(sparse.items[0].id,'2031-reading-01-2031-custom');assert.equal(sparse.flows.length,0);assert.doesNotThrow(()=>buildPathGraph(sparse));
 assert.throws(()=>buildExplorerData(DATA,{...edition,articles:[{...article,year:2025}]}),/another year/);
 assert.throws(()=>buildExplorerData(DATA,{...edition,articles:[edition.articles[0],edition.articles[0]]}),/duplicate/);
 const bad=structuredClone(DATA);bad.themes[0].models[0]='bad';assert.throws(()=>buildExplorerData(bad,edition),/invalid model/);
 const broken=structuredClone(DATA);broken.themes[0].axial=[99,99];assert.throws(()=>buildExplorerData(broken,edition),/disconnected/);
});
test('curation requires the exact book identity and unknown books have neutral reading placements',()=>{
 assert.equal(isExplorerCurated(DATA,edition),true);
 for(const book of [
  {...edition,title:'另一本文集'},
  {...edition,year:2027,title:'未來旅行筆記',articles:edition.articles.slice(0,2).map((article,index)=>({...article,id:`2027-unrelated-${index+1}`,year:2027,order:index+1,title:`旅行觀察 ${index+1}`}))},
 ]) {
  assert.equal(isExplorerCurated(DATA,book),false);
  const neutral=buildExplorerData(DATA,book),neutralGraph=buildPathGraph(neutral);
  assert.equal(neutral.islands.length,12);assert.equal(neutral.items.length,book.articles.length);
  assert.deepEqual(neutral.flows,[]);assert.ok(neutral.daySegments.every(segment=>segment.itemIds.length===0));
  for(const article of book.articles)assert.equal(neutral.items.filter(item=>item.articleId===article.id).length,1);
  assert.deepEqual(neutral.items.map(item=>item.articleId),[...book.articles].sort((a,b)=>a.order-b.order).map(article=>article.id));
  for(const [index,island] of neutral.islands.entries()) {
   assert.equal(island.id,`reading-${String(index+1).padStart(2,'0')}`);
   assert.equal(island.title.zh,`閱讀區 ${String(index+1).padStart(2,'0')}`);
   assert.equal(island.title.en,`Reading area ${String(index+1).padStart(2,'0')}`);
   for(const target of neutral.islands)assert.ok(Number.isFinite(findRoute(neutralGraph,island.id,target.id).length));
  }
  for(const item of neutral.items)assert.match(item.caption.zh,/^從原文開始/);
  assert.doesNotMatch(JSON.stringify({islands:neutral.islands,items:neutral.items,flows:neutral.flows}),/成長羅盤|代理商務|組織轉型|Growth compass|Agent commerce|Culture and change|策展導讀|opening|source-sequence/);
  assert.deepEqual(buildExplorerData(DATA,{...book,articles:[...book.articles].reverse()}).items,neutral.items);
 }
 const future={...edition,year:2027,title:'指定策展版本',articles:edition.articles.map(article=>({...article,year:2027,id:article.id.replace('2026','2027')}))};
 const config={...DATA,curation:{year:future.year,title:future.title}};
 assert.equal(isExplorerCurated(config,future),true);
 const custom=buildExplorerData(config,future);
 assert.equal(custom.items.length,48);assert.equal(custom.flows.length,10);assert.equal(custom.islands[0].id,'growth');
 const unbound={...DATA};delete unbound.curation;
 assert.equal(isExplorerCurated(unbound,edition),false);assert.equal(buildExplorerData(unbound,edition).items.length,22);
 assert.throws(()=>buildExplorerData({...DATA,curation:{year:2026,title:''}},edition),/invalid curation identity/);
});
test('12-node rings and adjacent-only nine-panel arch bridges produce real shortest paths',()=>{
 assert.equal(graph.nodes.length,144);assert.ok(graph.bridges.length>11);
 for(const bridge of graph.bridges) {
  assert.equal(bridge.points.length,10);assert.ok(bridge.points[4][1]>bridge.points[0][1]);
  const a=data.islands.find(i=>i.id===graph.nodes.find(n=>n.id===bridge.from).islandId),b=data.islands.find(i=>i.id===graph.nodes.find(n=>n.id===bridge.to).islandId);
  const dq=a.axial[0]-b.axial[0],dr=a.axial[1]-b.axial[1];assert.equal(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr)),1);
 }
 for(const a of data.islands)for(const b of data.islands){const route=findRoute(graph,a.id,b.id);assert.ok(Number.isFinite(route.length));assert.ok(route.length>=dist(route.points[0],route.points.at(-1))-1e-9);assert.equal(route.points.length,route.cumulative.length);assert.deepEqual(pointOnRoute(route,route.length).position,route.points.at(-1));}
 const route=findRoute(graph,'growth','human');const crossings=graph.bridges.filter(b=>route.nodeIds.includes(b.from)&&route.nodeIds.includes(b.to));assert.ok(crossings.length);for(const b of crossings)for(const p of b.points)assert.ok(route.points.some(v=>dist(v,p)<1e-8),'every arch centerline point is in route');
 const costs=new Map(graph.nodes.map(n=>[n.id,Infinity]));costs.set('growth:0',0);for(let i=0;i<graph.nodes.length;i++)for(const e of graph.edges){costs.set(e.to,Math.min(costs.get(e.to),costs.get(e.from)+e.distance));costs.set(e.from,Math.min(costs.get(e.from),costs.get(e.to)+e.distance));}
 assert.ok(Math.abs(route.length-costs.get('human:0'))<1e-9);assert.throws(()=>findRoute(graph,'bad','growth'),/unknown/);
});
test('placement geometry follows main building offset and inner radius',()=>{
 const placements=itemPlacements(data);assert.equal(placements.length,48);
 for(const island of data.islands){const center=axialToWorld(...island.axial);const first=placements.find(p=>p.id===island.itemIds[0]);assert.equal(first.scale,1.15);assert.ok(Math.abs(first.position[2]-center[2]+.58)<1e-9);for(const id of island.itemIds){const p=placements.find(p=>p.id===id);assert.ok(Math.hypot(p.position[0]-center[0],p.position[2]-center[2])<=1.36);}}
});
test('day interpolation wraps midnight, solar direction is quantized and seven segments resolve IDs',()=>{
 assert.equal(data.dayKeyframes.length,10);assert.equal(data.daySegments.length,7);
 assert.deepEqual(sampleDay(data.dayKeyframes,0),sampleDay(data.dayKeyframes,1440));assert.deepEqual(sampleDay(data.dayKeyframes,-1),sampleDay(data.dayKeyframes,1439));
 assert.deepEqual(sampleDay(data.dayKeyframes,601).sunDirection,sampleDay(data.dayKeyframes,609).sunDirection);assert.notDeepEqual(sampleDay(data.dayKeyframes,609).sunDirection,sampleDay(data.dayKeyframes,610).sunDirection);
 assert.ok(Math.abs(Math.hypot(...sampleDay(data.dayKeyframes,600).sunDirection)-1)<1e-12);
 for(const m of [0,360,480,600,840,1080,1260]){const ids=activeItemIds(data,m);assert.ok(ids.length);assert.ok(ids.every(id=>data.items.some(i=>i.id===id)));}
});
test('simulation deterministic seed, paused snapshots, manual presets, reset and slow foreground time',()=>{
 const a=createSimulation(data,graph),b=createSimulation(data,graph);assert.deepEqual(a.snapshot(),b.snapshot());const initial=a.snapshot();a.update(400,false);assert.deepEqual(a.snapshot(),initial);a.setMinute(1080);assert.equal(a.snapshot().minute,1080);a.reset();assert.deepEqual(a.snapshot(),initial);
 a.update(2,true);for(let k=0;k<25;k++)b.update(.08,true);assert.ok(Math.abs(a.snapshot().minute-620)<1e-9);assert.ok(Math.abs(b.snapshot().minute-620)<1e-8);
 a.snapshot().walkers.forEach((w,k)=>assert.ok(dist(w.position,b.snapshot().walkers[k].position)<1e-8));
 const roles=new Set(a.snapshot().walkers.map(w=>w.role));for(const role of data.roles)assert.ok(roles.has(role.id),role.id);
});
test('each endpoint visit emits arrive, then one handoff/depart after full 1.4 seconds; batches bounded',()=>{
 const sim=createSimulation(data,graph), history=new Map();let count=0,lastId=0;
 for(let k=0;k<1800;k++) {
  const events=sim.update(.1,true);assert.ok(events.length<=100);
  for(const e of events){count++;assert.ok(e.id>lastId);lastId=e.id;const prev=history.get(e.walkerId);if(e.type==='arrive'){assert.ok(!prev||prev.type==='depart');}else if(e.type==='handoff'){assert.equal(prev.type,'arrive');assert.ok(Math.abs(((e.minute-prev.minute+1440)%1440)-14)<1e-7);}else {assert.equal(prev.type,'handoff');assert.equal(prev.minute,e.minute);}history.set(e.walkerId,e);}
 }
 assert.ok(count>100);assert.ok(sim.update(1000,true).length<=100);
});

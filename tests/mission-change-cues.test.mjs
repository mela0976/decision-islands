import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/mission-change-cues.ts', import.meta.url), 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText;
const {resolveMissionChangeCue} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const text = value => ({zh:value,en:value});
const initial = {description:text('Initial'), entities:[{id:'person',kind:'adult',x:25,y:75},{id:'other',kind:'adult',x:75,y:75},{id:'phone',kind:'phone',x:50,y:60},{id:'book',kind:'book',x:60,y:60}],flows:[]};
const input = after => ({key:'fixture',definition:{title:text('Fixture'),setting:'home',initial,choices:{a:after}},choiceId:'a',previewChoiceId:null});

test('change cues ignore absent selections, equivalent defaults, metadata and unrelated actions', () => {
  const same = structuredClone(initial);
  same.description=text('Different prose');
  same.entities=same.entities.map(entity=>({...entity,scale:1,opacity:1,pose:'idle',label:text('Label')}));
  same.actions=[{actor:'missing',target:'missing-too',kind:'show'}];
  assert.deepEqual(resolveMissionChangeCue(input(same)),{entityIds:[],labels:[]});
  assert.deepEqual(resolveMissionChangeCue({...input(same),choiceId:null}),{entityIds:[],labels:[]});
  assert.deepEqual(resolveMissionChangeCue({...input(same),choiceId:'missing'}),{entityIds:[],labels:[]});
});

test('change cues name only physically changed actors and props with short bilingual categories', () => {
  const after=structuredClone(initial);
  after.entities=after.entities.map(entity=>entity.id==='person'?{...entity,x:35,pose:'work'}:entity.id==='phone'?{...entity,x:40}:entity);
  const cue=resolveMissionChangeCue(input(after));
  assert.deepEqual(cue.entityIds,['person','phone']);
  assert.deepEqual(cue.labels.map(label=>label.zh),['人物位置改變','道具位置改變']);
  assert.ok(cue.labels.every(label=>label.zh.length<=8 && label.en.length<=25));
  const before=resolveMissionChangeCue({...input(after),comparisonView:'before'});
  assert.deepEqual(before,cue,'manual comparison direction uses the same differences');
  assert.deepEqual(resolveMissionChangeCue({...input(initial),previewChoiceId:'b',definition:{...input(initial).definition,choices:{a:initial,b:after}}}),cue,'preview takes precedence');
});

test('action changes affect only participants whose terminal pose actually changes', () => {
  const after={...initial,actions:[{actor:'person',target:'other',prop:'phone',kind:'review'}]};
  const cue=resolveMissionChangeCue(input(after));
  assert.deepEqual(cue.entityIds,['person','other']);
  assert.deepEqual(cue.labels.map(label=>label.zh),['人物動作改變']);
  assert.ok(!cue.entityIds.includes('phone'),'a prop handled transiently but unchanged at rest is not marked');
  assert.deepEqual(resolveMissionChangeCue(input(after),'svg'),{entityIds:[],labels:[]},'action-only changes do not highlight unchanged SVG actors');
  const screen={...initial,entities:[...initial.entities,{id:'screen',kind:'screen',x:51,y:58}]};
  const withFlow={...screen,flows:[{id:'new-flow',from:'phone',to:'screen',kind:'share'}]};
  const screenInput=input(withFlow); screenInput.definition.initial=screen;
  assert.deepEqual(resolveMissionChangeCue(screenInput),{entityIds:[],labels:[]},'props ignore terminal joint values because they have no joints');
});

test('visibility, shape and scale changes are detected without marking invisible unused props', () => {
  const after=structuredClone(initial);
  after.entities=after.entities.filter(entity=>entity.id!=='book').map(entity=>entity.id==='phone'?{...entity,kind:'screen',scale:1.3}:entity);
  after.entities.push({id:'new',kind:'mug',x:45,y:60},{id:'hidden',kind:'shield',x:80,y:60,opacity:0});
  const cue=resolveMissionChangeCue(input(after));
  assert.deepEqual(cue.entityIds,['phone','book','new']);
  assert.deepEqual(cue.labels.map(label=>label.zh),['道具增減','道具外觀改變']);
  const hidden={...initial,entities:initial.entities.map(entity=>entity.id==='phone'?{...entity,opacity:0}:entity)};
  assert.deepEqual(resolveMissionChangeCue(input(hidden)),{entityIds:['phone'],labels:[{zh:'道具增減',en:'Props appear or disappear'}]});
});

test('specific hints describe the visible comparison direction and only real changed entities', () => {
  const after = structuredClone(initial);
  after.entities = after.entities.map(entity => entity.id === 'phone' ? {...entity,x:40} : entity);
  after.changeHints = [
    {entityIds:['phone'],before:{zh:'手機仍放在桌面中央',en:'The phone remains at the center'},after:{zh:'手機移向家長，先看內容再分享',en:'Move the phone to the parent for review'}},
    {entityIds:['book'],before:text('The book is unopened'),after:text('Read the book together')},
  ];
  const selected = input(after);
  assert.deepEqual(resolveMissionChangeCue(selected), {entityIds:['phone'],labels:[after.changeHints[0].after]});
  assert.deepEqual(resolveMissionChangeCue({...selected,comparisonView:'before'}), {entityIds:['phone'],labels:[after.changeHints[0].before]});
  assert.deepEqual(resolveMissionChangeCue({...selected,choiceId:null,previewChoiceId:'a'}).labels, [after.changeHints[0].after]);
  const unchanged = {...after,entities:initial.entities};
  assert.deepEqual(resolveMissionChangeCue(input(unchanged)), {entityIds:[],labels:[]});
});

test('specific hints include removed entities and never imply SVG action-only changes', () => {
  const removed = {...initial,entities:initial.entities.filter(entity=>entity.id!=='book'),changeHints:[{entityIds:['book'],before:text('Keep the book on the table'),after:text('Remove the book before sharing')}]};
  assert.deepEqual(resolveMissionChangeCue(input(removed),'svg'), {entityIds:['book'],labels:[removed.changeHints[0].after]});
  const action = {...initial,actions:[{actor:'person',target:'other',prop:'phone',kind:'review'}],changeHints:[{entityIds:['person'],before:text('The parent waits'),after:text('The parent reviews the shared content')}]};
  assert.deepEqual(resolveMissionChangeCue(input(action),'svg'), {entityIds:[],labels:[]});
  assert.deepEqual(resolveMissionChangeCue(input(action)).labels,[action.changeHints[0].after]);
});

test('future book visuals with a reused mission key keep their own neutral fallback', () => {
  const after = {...initial,entities:initial.entities.map(entity=>entity.id==='phone'?{...entity,x:40}:entity)};
  const future = {...input(after),key:'shared-memory-1'};
  assert.deepEqual(resolveMissionChangeCue(future), {entityIds:['phone'],labels:[{zh:'道具位置改變',en:'Props change position'}]});
});

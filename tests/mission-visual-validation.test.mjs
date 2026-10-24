import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
let validateMissionVisual;
try { ({validateMissionVisual} = await server.ssrLoadModule('/src/mission-visual-validation.ts')); }
finally { await server.close(); }
const text = value => ({zh:value,en:value});
const frame = () => ({description:text('Visible scene'),entities:[{id:'person',kind:'adult',x:30,y:75},{id:'draft',kind:'document',x:50,y:60}],flows:[{id:'review',from:'draft',to:'person',kind:'review'}]});
const definition = () => ({setting:'office',title:text('Workspace'),initial:frame(),choices:{a:frame(),b:frame()}});
test('custom book visual frames accept named props and valid handoff references', () => {
  assert.doesNotThrow(()=>validateMissionVisual(definition(),['a','b']));
  const data = definition();
  data.choices.a.actions = [{kind:'review',actor:'person',target:'draft',prop:'draft'}];
  assert.doesNotThrow(()=>validateMissionVisual(data,['a','b']));
});
test('invalid visual data is rejected before any book or stage state is installed', () => {
  for(const mutate of [
    d=>{d.setting='unknown';},d=>{d.title.en='';},d=>{delete d.choices.b;},d=>{d.choices.c=frame();},
    d=>{d.initial.description.zh='';},d=>{d.initial.entities=[];},d=>{d.initial.entities[1].id='person';},
    d=>{d.initial.entities[0].kind='html';},d=>{d.initial.entities[0].x=Infinity;},d=>{d.initial.entities[0].y=-1;},
    d=>{d.initial.entities[0].scale=0;},d=>{d.initial.entities[0].opacity=2;},d=>{d.initial.entities[0].pose='jump';},
    d=>{d.initial.entities[0].label={zh:'x',en:''};},d=>{d.initial.flows[0].to='missing';},
    d=>{d.initial.flows[0].to='draft';},d=>{d.initial.flows[0].kind='script';},d=>{d.initial.flows.push({...d.initial.flows[0]});},
    d=>{d.initial.actions='invalid';}, d=>{d.initial.actions=[{kind:'review',actor:'draft',target:'person'}];},
    d=>{d.initial.actions=[{kind:'review',actor:'person',target:'missing'}];}, d=>{d.initial.actions=[{kind:'jump',actor:'person',target:'draft'}];},
    d=>{d.initial.actions=[{kind:'review',actor:'person',target:'draft',prop:'missing'}];},
  ]) { const data=definition();mutate(data);assert.throws(()=>validateMissionVisual(data,['a','b'])); }
});

const hint = () => ({entityIds:['draft'],before:{zh:'文件留在桌上，尚未核對',en:'The draft waits on the desk for review'},after:{zh:'文件移向新人，逐項核對',en:'Move the draft to the newcomer for review'}});

test('specific hint validation accepts references to entities removed from the selected frame', () => {
  const data = definition();
  data.choices.a.entities = data.choices.a.entities.filter(entity=>entity.id!=='draft');
  data.choices.a.flows = [];
  data.choices.a.changeHints = [hint()];
  assert.doesNotThrow(()=>validateMissionVisual(data,['a','b']));
  data.choices.a.changeHints[0].entityIds = ['person','draft'];
  assert.doesNotThrow(()=>validateMissionVisual(data,['a','b']));
});

test('specific hints reject malformed references, oversized text and incomplete translations', () => {
  for (const mutate of [
    h=>{h.entityIds=[];},h=>{h.entityIds=['missing'];},h=>{h.entityIds=[''];},h=>{h.entityIds=[1];},h=>{h.entityIds='draft';},
    h=>{h.before=null;},h=>{h.after={zh:'文字'};},h=>{h.before.zh=' ';},h=>{h.after.en='';},
    h=>{h.before.zh='字'.repeat(19);},h=>{h.after.en='x'.repeat(49);},
  ]) {
    const data=definition();const value=hint();mutate(value);data.choices.a.changeHints=[value];
    assert.throws(()=>validateMissionVisual(data,['a','b']));
  }
  for (const hints of [null,{},'bad',[null],[hint(),hint(),hint()]]) {
    const data=definition();data.choices.a.changeHints=hints;
    assert.throws(()=>validateMissionVisual(data,['a','b']));
  }
  const boundary=definition();boundary.choices.a.changeHints=[{...hint(),before:{zh:'字'.repeat(18),en:'x'.repeat(48)}}];
  assert.doesNotThrow(()=>validateMissionVisual(boundary,['a','b']));
});

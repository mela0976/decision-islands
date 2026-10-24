import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
let journey, registry, resolveCue;
try {
  ({JOURNEY_2026:journey}=await server.ssrLoadModule('/src/reading-journeys.ts'));
  ({MISSION_CHOICE_HINTS:registry}=await server.ssrLoadModule('/src/mission-choice-hints.ts'));
  ({resolveMissionChangeCue:resolveCue}=await server.ssrLoadModule('/src/mission-change-cues.ts'));
} finally {await server.close();}

test('all 96 role choices have short task-specific before and after hints tied to real changes',async()=>{
  const audit=[];
  for(const role of journey.personas) for(const question of role.questions) for(const step of question.steps) {
    const mission=step.mission;
    assert.ok(registry[mission.id],mission.id);
    const alternatives=[];
    for(const choiceId of ['a','b']) {
      const frame=mission.visual.choices[choiceId];
      const hints=frame.changeHints;
      assert.ok(hints?.length>=1 && hints.length<=2,`${mission.id}/${choiceId}`);
      for(const hint of hints) for(const side of ['before','after']) {
        assert.ok(hint[side].zh.length>0 && [...hint[side].zh].length<=18,`${mission.id}/${choiceId}/${side}: ${hint[side].zh}`);
        assert.ok(hint[side].en.length>0 && [...hint[side].en].length<=36,`${mission.id}/${choiceId}/${side}: ${hint[side].en}`);
        assert.doesNotMatch(hint[side].zh,/^(人物位置改變|人物動作改變|道具位置改變|人物增減|道具增減)$/);
      }
      for(const renderer of ['webgl','svg']) {
        const labelsBySide=[];
        for(const side of ['before','after']) {
          const input={key:mission.id,definition:mission.visual,choiceId,previewChoiceId:null,comparisonView:side};
          const result=resolveCue(input,renderer);
          assert.ok(result.labels.length>=1 && result.labels.length<=2,`${mission.id}/${choiceId}/${renderer} has task-specific hints`);
          for(const label of result.labels) assert.ok(hints.some(hint=>hint[side].zh===label.zh && hint[side].en===label.en && hint.entityIds.some(id=>result.entityIds.includes(id))),`${mission.id}/${choiceId}/${renderer}/${side} binds text to a changed entity`);
          labelsBySide.push(result.labels);
          const preview=resolveCue({...input,choiceId:choiceId==='a'?'b':'a',previewChoiceId:choiceId},renderer);
          assert.deepEqual(preview.labels,result.labels,'the preview describes the viewed choice without adopting it');
        }
        assert.notDeepEqual(labelsBySide[0],labelsBySide[1],`${mission.id}/${choiceId} distinguishes the initial scene from its result`);
      }
      alternatives.push(hints.map(hint=>hint.after.zh));
      audit.push({role:role.id,question:question.id,mission:mission.id,choiceId,choice:mission.choices.find(choice=>choice.id===choiceId)?.label,initial:mission.visual.initial.description,result:frame.description,hints});
    }
    assert.notDeepEqual(alternatives[0],alternatives[1],`${mission.id} A and B explain different choices`);
  }
  assert.equal(audit.length,96);
  assert.equal(Object.keys(registry).length,48);
  await mkdir('test-results/specific-hints',{recursive:true});
  await writeFile('test-results/specific-hints/copy-audit.json',JSON.stringify(audit,null,2));
});

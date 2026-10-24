import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProgress,parseProgress} from '../public/immersive/progress.js';
const memory=()=>{const data=new Map();return{get length(){return data.size;},key(i){return [...data.keys()][i];},getItem(k){return data.get(k)??null;},setItem(k,v){data.set(k,v);}};};
test('read footprints, bookmarks, notes and recent routes survive reopening',()=>{
 const storage=memory(),p=createProgress(storage);p.toggle('read','2026-01');p.toggle('bookmarks','2026-03');p.visit('2026-03');p.state.notes['2026-03']='保留 <script>文字</script>';p.stamp('trust');p.save();
 const reopened=createProgress(storage);assert.deepEqual(reopened.state.read,['2026-01']);assert.equal(reopened.state.notes['2026-03'],'保留 <script>文字</script>');assert.deepEqual(reopened.state.stamps,['trust']);assert.deepEqual(reopened.state.routes,['2026-01>2026-03']);
});
test('legacy article notes migrate only from this exact publication identity',()=>{
 const storage=memory();const key=title=>'decision-islands-reading-note-v1:'+encodeURIComponent(JSON.stringify([title,2026,'2026-01']));
 storage.setItem(key('其他書'),JSON.stringify({text:'不要帶入'}));storage.setItem(key('決策智慧 2026｜Agentic 時代，重塑品牌與人的真實距離'),JSON.stringify({schemaVersion:1,text:'舊筆記'}));
 assert.equal(createProgress(storage).state.notes['2026-01'],'舊筆記');
});
test('unreadable existing records are never overwritten with an empty session',()=>{
 let writes=0;const storage={getItem(){throw Error('transient');},setItem(){writes++;}};const p=createProgress(storage);p.visit('2026-03');p.state.notes['2026-03']='本次草稿';assert.equal(p.save(),false);assert.equal(writes,0);assert.equal(p.state.notes['2026-03'],'本次草稿');
});
test('backup restore merges footprints and preserves existing notes',()=>{
 const p=createProgress(memory());p.state.notes['2026-01']='目前筆記';p.restore({read:['2026-02','2026-02'],notes:{'2026-01':'較舊筆記','2026-02':'另一篇'}});assert.deepEqual(p.state.read,['2026-02']);assert.equal(p.state.notes['2026-01'],'目前筆記');assert.equal(p.state.notes['2026-02'],'另一篇');assert.throws(()=>parseProgress(null));assert.equal(parseProgress({notes:{'2026-03':'a'.repeat(9000)}}).notes['2026-03'].length,8000);
});
test('opening an empty note does not hide a restored backup note',()=>{
 const p=createProgress(memory());p.state.notes['2026-01']='';p.restore({notes:{'2026-01':'從備份取回的筆記'}});assert.equal(p.state.notes['2026-01'],'從備份取回的筆記');
});
test('recent routes preserve repeated journeys in chronological order',()=>{
 const value=parseProgress({routes:['2026-01>2026-02','2026-02>2026-01','2026-01>2026-02']});assert.equal(value.routes.length,3);assert.equal(value.routes.at(-1),'2026-01>2026-02');
});

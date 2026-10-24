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
test('independent tabs preserve disjoint notes through visits and bookmarks',()=>{
 const storage=memory(),a=createProgress(storage),b=createProgress(storage);
 a.state.notes['2026-01']='甲';a.save();b.state.notes['2026-02']='乙';b.save();a.visit('2026-03');b.toggle('bookmarks','2026-04');
 const saved=createProgress(storage).state;assert.equal(saved.notes['2026-01'],'甲');assert.equal(saved.notes['2026-02'],'乙');assert.equal(saved.last,'2026-03');assert.deepEqual(saved.bookmarks,['2026-04']);
});
test('a tab explicit unbookmark survives another stale tab save',()=>{
 const storage=memory(),seed=createProgress(storage);seed.toggle('bookmarks','2026-01');
 const a=createProgress(storage),b=createProgress(storage);a.toggle('bookmarks','2026-01');b.visit('2026-02');assert.deepEqual(createProgress(storage).state.bookmarks,[]);
});
test('concurrent edits to the same note use the last successful save',()=>{
 const storage=memory(),a=createProgress(storage),b=createProgress(storage);a.state.notes['2026-01']='甲';b.state.notes['2026-01']='乙';a.save();b.save();assert.equal(createProgress(storage).state.notes['2026-01'],'乙');a.visit('2026-02');assert.equal(createProgress(storage).state.notes['2026-01'],'乙');
});
test('corruption and transient read failure preserve disk and volatile drafts',()=>{
 const storage=memory(),p=createProgress(storage);p.state.notes['2026-01']='原稿';p.save();storage.setItem('decision-immersive-progress-v1','broken');p.state.notes['2026-01']='草稿';assert.equal(p.save(),false);assert.equal(p.persistent,false);assert.equal(p.readable,false);assert.equal(storage.getItem('decision-immersive-progress-v1'),'broken');assert.equal(p.state.notes['2026-01'],'草稿');
 storage.setItem('decision-immersive-progress-v1',JSON.stringify({notes:{'2026-02':'另一頁'}}));const get=storage.getItem;storage.getItem=()=>{throw Error('temporary');};assert.equal(p.save(),false);storage.getItem=get;assert.equal(p.save(),true);assert.equal(p.persistent,true);assert.equal(p.readable,true);assert.equal(typeof p.lastSuccessfulSave,'number');assert.equal(createProgress(storage).state.notes['2026-02'],'另一頁');
});
test('quota failure retains deltas and permits a later successful retry',()=>{
 const storage=memory(),p=createProgress(storage),set=storage.setItem;storage.setItem=()=>{throw Error('quota');};p.state.notes['2026-01']='重試草稿';assert.equal(p.save(),false);assert.equal(p.persistent,false);assert.equal(p.readable,true);assert.equal(p.lastSuccessfulSave,null);storage.setItem=set;assert.equal(p.save(),true);assert.equal(createProgress(storage).state.notes['2026-01'],'重試草稿');
});
test('legacy first save retains exact-book notes and all migrated footprints',()=>{
 const storage=memory();storage.setItem('decision-islands-v1',JSON.stringify({completed:['2026-01','2026-02'],bookmarks:['2026-03'],last:'2026-02'}));storage.setItem('decision-islands-reading-note-v1:'+encodeURIComponent(JSON.stringify(['決策智慧 2026｜Agentic 時代，重塑品牌與人的真實距離',2026,'2026-04'])),JSON.stringify({text:'遷移筆記'}));
 const p=createProgress(storage);p.visit('2026-05');const saved=createProgress(storage).state;assert.deepEqual(saved.read,['2026-01','2026-02']);assert.deepEqual(saved.bookmarks,['2026-03']);assert.equal(saved.notes['2026-04'],'遷移筆記');assert.deepEqual(saved.routes,['2026-02>2026-05']);
});
test('concurrent route events append chronologically and stay bounded',()=>{
 const storage=memory(),a=createProgress(storage),b=createProgress(storage);a.visit('2026-02');b.visit('2026-03');a.visit('2026-04');assert.deepEqual(createProgress(storage).state.routes,['2026-01>2026-02','2026-01>2026-03','2026-02>2026-04']);
 for(let i=0;i<40;i++)a.visit('route-'+i);assert.equal(createProgress(storage).state.routes.length,30);assert.equal(createProgress(storage).state.routes.at(-1),'route-38>route-39');
});
test('restore preserves the latest nonempty disk note and recovers blank notes',()=>{
 const storage=memory(),a=createProgress(storage),b=createProgress(storage);a.state.notes['2026-01']='最新';a.state.notes['2026-02']=' ';a.save();b.restore({notes:{'2026-01':'備份舊稿','2026-02':'取回'}});const saved=createProgress(storage).state;assert.equal(saved.notes['2026-01'],'最新');assert.equal(saved.notes['2026-02'],'取回');
});
test('explicit restore unions bookmarks even when a stale baseline already had them',()=>{
 const storage=memory(),seed=createProgress(storage);seed.toggle('bookmarks','2026-01');const a=createProgress(storage),b=createProgress(storage);a.toggle('bookmarks','2026-01');b.restore({bookmarks:['2026-01']});assert.deepEqual(createProgress(storage).state.bookmarks,['2026-01']);
});
test('restore and failed-save retries preserve repeated ordered route events',()=>{
 const storage=memory(),p=createProgress(storage);p.visit('2026-02');p.restore({routes:['2026-01>2026-02']});assert.deepEqual(createProgress(storage).state.routes,['2026-01>2026-02','2026-01>2026-02']);
 const set=storage.setItem;storage.setItem=()=>{throw Error('quota');};for(let i=0;i<32;i++)p.visit(i%2?'2026-02':'2026-01');storage.setItem=set;p.save();const routes=createProgress(storage).state.routes;assert.equal(routes.length,30);assert.deepEqual(routes.slice(-2),['2026-02>2026-01','2026-01>2026-02']);
});
test('save merges untouched mode, read and stamp changes from another tab',()=>{
 const storage=memory(),a=createProgress(storage),b=createProgress(storage);a.state.mode='explore';a.state.introSeen=true;a.toggle('read','2026-01');a.stamp('proof');b.state.notes['2026-02']='筆記';b.save();const saved=createProgress(storage).state;assert.equal(saved.mode,'explore');assert.equal(saved.introSeen,true);assert.deepEqual(saved.read,['2026-01']);assert.deepEqual(saved.stamps,['proof']);
});
test('preview agent stamps migrate to delegation without losing other collected stamps',()=>{
 const storage=memory();storage.setItem('decision-immersive-progress-v1',JSON.stringify({stamps:['agent','trust','delegation','governance']}));const p=createProgress(storage);assert.deepEqual(p.state.stamps,['delegation','trust','governance']);p.save();assert.deepEqual(createProgress(storage).state.stamps,['delegation','trust','governance']);assert.deepEqual(parseProgress({stamps:['agent']}).stamps,['delegation']);
});

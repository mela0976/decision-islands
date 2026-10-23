import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const code = ts.transpileModule(readFileSync(new URL('../src/library.ts', import.meta.url),'utf8'), {
  compilerOptions: {module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const {findArticles, escapeHtml, readState, saveState, paths} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const articles = [
  {id:'2026-01',chapter:'people',title:'信任與 AI',authors:'甲',summary:'真實',tags:['文化'],paragraphs:['品牌的選擇'],order:1},
  {id:'2026-02',chapter:'model',title:'研究',authors:'乙',summary:'模型判斷',tags:[],paragraphs:['衡斷力'],order:2}
];
test('搜尋跨標題作者全文，所有詞均須符合且章節篩選保留',()=>{
  assert.deepEqual(findArticles(articles,'ai 文化').map(x=>x.id),['2026-01']);
  assert.equal(findArticles(articles,'乙')[0].id,'2026-02');
  assert.equal(findArticles(articles,'衡斷力')[0].id,'2026-02');
  assert.equal(findArticles(articles,'衡斷力','people').length,0);
  assert.equal(findArticles(articles,'不存在').length,0);
});
test('刊物文字轉為HTML前跳脫，保留可見文字',()=>{
  assert.equal(escapeHtml('<img onerror="x"> &'), '&lt;img onerror=&quot;x&quot;&gt; &amp;');
});
test('瀏覽器儲存失敗與不合法資料不阻止閱讀',()=>{
  globalThis.localStorage={getItem:()=>'{broken',setItem:()=>{throw new Error('denied');}};
  assert.deepEqual(readState(),{bookmarks:[],completed:[],last:null,fontSize:20});
  assert.equal(saveState(readState()),false);
  localStorage.getItem=()=>JSON.stringify({bookmarks:['good',3],completed:null,last:4,fontSize:500});
  assert.deepEqual(readState(),{bookmarks:['good'],completed:[],last:null,fontSize:20});
});
test('策展路線的串聯理由對應相鄰篇章',()=>{
  for(const path of paths)assert.equal(path.connections.length,path.orders.length-1);
});

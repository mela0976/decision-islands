import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../public/',import.meta.url));
test('每個年度、來源與獨立閱讀頁均在公開範圍內且實際存在',()=>{
  assert.equal(existsSync(path.join(root,'public')),false);
  const catalog=JSON.parse(readFileSync(path.join(root,'data/catalog.json'),'utf8'));
  assert.equal(catalog.schemaVersion,1);
  const seen=new Set();
  for(const year of catalog.years){
    const edition=JSON.parse(readFileSync(path.join(root,year.dataUrl),'utf8'));
    assert.equal(edition.year,year.year);assert.equal(edition.articles.length,year.articleCount);
    const audit=JSON.parse(readFileSync(path.join(root,`data/${year.year}-source-audit.json`),'utf8'));
    for(const article of edition.articles){
      assert.equal(seen.has(article.id),false);seen.add(article.id);
      assert.match(article.id,new RegExp(`^${year.year}-[a-zA-Z0-9_-]+$`));
      assert.ok(article.title&&article.authors&&article.summary&&article.paragraphs.length);
      const record=audit.find(item=>item.id===article.id);
      if(record){
        assert.equal(record.matched,article.paragraphs.length);
        assert.equal(record.inputParagraphs,record.matched+record.supplementary+record.unpublishedDifferences);
        assert.equal(article.paragraphSources.length,article.paragraphs.length);
      }
      for(const field of ['sourcePdf','htmlUrl']){
        const rel=article[field];assert.doesNotMatch(rel,/^(?:\w+:|\/)|\.\./);
        const target=path.resolve(root,rel);assert.ok(target.startsWith(root));assert.ok(existsSync(target));
      }
    }
  }
});

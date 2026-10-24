import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('public/fonts/manifest.json',root),'utf8'));
test('publication web fonts contain real variable WOFF2 outlines, licenses and current CJK coverage',()=>{
 const css=readFileSync(new URL('public/fonts/publication.css',root),'utf8');
 assert.match(css,/font-weight:250 900/);
 assert.match(css,/font-display:swap/);
 assert.equal(manifest.families.chinese,'Source Han Sans TW');
 assert.equal(manifest.families.latin,'Montserrat');
 assert.equal(manifest.renamedForSubsetting,true);
 assert.equal(manifest.missingCodepoints.filter(c=>/[\p{Script=Han}\p{Script=Hangul}]/u.test(String.fromCodePoint(c))).length,0);
 const urls=[...css.matchAll(/url\("([^"]+)"\)/g)].map(m=>m[1]);
 assert.ok(urls.length>=3);
 for(const url of urls){const bytes=readFileSync(new URL(`public/fonts/${url}`,root));assert.equal(bytes.subarray(0,4).toString(),'wOF2');assert.ok(bytes.length>1000);}
 for(const name of ['Montserrat-OFL.txt','SourceHanSans-LICENSE.txt'])assert.match(readFileSync(new URL(`public/fonts/${name}`,root),'utf8'),/SIL OPEN FONT LICENSE/);
});
test('every standalone article and its importer retain the same publication stylesheet',()=>{
 const pages=readdirSync(new URL('public/read/2026/',root)).filter(f=>f.endsWith('.html'));
 assert.equal(pages.length,23);
 for(const name of pages)assert.match(readFileSync(new URL(`public/read/2026/${name}`,root),'utf8'),/href="\.\.\/\.\.\/fonts\/publication\.css"/);
 assert.match(readFileSync(new URL('scripts/import_library.py',root),'utf8'),/fonts\/publication\.css/);
});

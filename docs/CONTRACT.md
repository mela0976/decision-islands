# 資料與模組契約

採靜態 Vite + TypeScript，Three.js 只負責互動場景。資料以年度 JSON 分割，並產生無 JavaScript 也能讀的 HTML 文章。離線 Python 匯入器負責解析與來源驗證。此為兩個候選的合併方向，靜態發佈保留閱讀可靠性，同時保留單頁場景轉場。

## 資料

`public/data/catalog.json` 形狀為 `{schemaVersion:1,years:[{year:2026,title:string,articleCount:number,dataUrl:'data/2026.json',coverUrl:'assets/cover-2026.webp'}]}`。

`public/data/2026.json` 形狀為 `{schemaVersion:1,year:2026,title:string,articles:Article[]}`。

Article 形狀為 `{id:'2026-01',year:2026,order:1,chapter:'intro'|'people'|'model'|'ai',title:string,authors:string,summary:string,highlights:string[],tags:string[],minutes:number,printedStart:number,printedEnd:number,sourcePdf:string,sourcePages:number[],paragraphs:string[],htmlUrl:string}`。

網址一律為相對網站根目錄的相對路徑，使用端以 Vite `BASE_URL` 組合。來源PDF採各篇專屬PDF，sourcePages為完整PDF中的1-based頁碼，需明確區別。

## 場景

`src/world.ts` 匯出 `createWorld(container:HTMLElement,options:{onChapter:(chapter:string)=>void;onArticle:(id:string)=>void;reducedMotion:boolean}):{enter:()=>Promise<void>;setChapter:(chapter:string|null)=>void;setArticles:(articles:{id:string;chapter:string;title:string}[])=>void;setMotion:(enabled:boolean)=>void;reset:()=>void;dispose:()=>void}`。

場景建構後先顯示宇宙螺旋書塔。enter在約2秒內轉至島嶼，reducedMotion直接完成。WebGL失敗仍保留DOM閱讀入口。容器尺寸及顯示變更需正確處理。暫停及背景分頁不持續render。

## 寫入責任

- 內容代理擁有 scripts/import_library.py、tests/test_import_library.py、content/、public/data/、public/sources/、public/read/、public/assets/。
- 場景代理擁有 src/world.ts 與 src/world.css。
- 主代理擁有其餘檔案與整合，不並行覆寫上述範圍。

## 驗收矩陣

內容代理核對22篇、作者、印刷頁碼、無重複ID、來源檔案存在、重跑不丟其他年份，並至少驗證三篇全文與來源PDF。場景代理檢查建立銷毀、進場、章節篩選、resize、reduced motion及fallback。主代理驗證搜尋、路線、收藏重載、鍵盤、手機與GitHub讀回。

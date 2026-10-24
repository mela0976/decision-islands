# 沉浸式群島開發與驗收紀錄

本紀錄保留完整 Master Prompt 範圍。表內分開列出已驗證部分與仍待實測的體驗品質。

## 目標與入口

以四大群島、22 座文章島、四位原創人物、八類互動和文章關聯航線，呈現《2026 決策智慧》。書塔只負責初次入場。

正式根入口 `index.html` 以 SHA-256 CSP 白名單保護的 inline redirect 導向 `./immersive/`，原樣保留 query/hash；無 JavaScript 時提供完整原文目錄。舊 Vite 入口保留於 `legacy.html`，僅作舊站回歸。新世界位於 `public/immersive/index.html`，在專案根目錄執行 `python3 -m http.server 4186 --directory public` 可直接開啟 `http://localhost:4186/immersive/`；其 ES modules 與固定 Three.js 0.160.0 CDN importmap不需要建置。網站根路由本身在正式 Pages/build preview 驗收。

## 執行分工與依賴

- 整合基準：`37ab4bf`；在 `immersive-master` 工作樹持續整合，保留原工作區套件變更。
- 單一 Luna 負責網站程式、資料、入口及完整驗收，避免不同實作分支造成狀態漂移。

## 範圍對照

| 規格 | 目前實作與證據 | 尚需完成或驗證 |
|---|---|---|
| 6–12 秒、可略過、首次入場開場 | 8.6 秒真 Three.js 封面、開書、螺旋書塔、紙頁海岸、群島雲層與抵達；可略過，完成狀態保存。Intro browser 在桌機/手機尺寸驗證四階段、釋放資源與不重播 | 實體手機與不同 GPU 的畫面表現未驗 |
| 書塔非永久主場景 | 正式根入口轉至文章群島；閱讀文章不重播 intro；舊互動網站由 `/legacy.html` 保留；根路徑與 `/decision-islands/` 子路徑均通過 built Preview；2026-10-24 Pages 發布 `44500d4` 後，線上 Chromium 從 `/` 導到 22 島、保留 query/hash、讀全文並完成情境互動，無 console/page errors | 正式環境此次 readback 已通過；實體行動裝置與不同 GPU 外觀未驗 |
| 四章 2／9／5／6，共 22 島 | `immersive-data.test.mjs` 核對原刊 ID、章節與全文；瀏覽器逐一導航 22 島 | 全島最終美術與敘事品質審查 |
| 不規則、可航行、保留海面 | 固定 seed 座標，島間距至少 18；四群島包圍盒分離 | 遠景觀感、章內船隻和自然海岸聚落需持續打磨 |
| 紙本編輯與微縮世界質感 | 霧面建築、樹木、道具、柔和海面、章節色彩、參考影片層次 | 黑白影像、指紋、花朵、半色調等原刊語彙尚未完整融入 |
| 22 個獨立文章場景 | 22 個 canonical 場景建構器與各自核心道具、事件、故事出口 | 逐島操作與視覺辨識審查未全部完成 |
| 四位原創人物、獨立節奏與表情 | 阿綺、小岳、映蓁、芬姐；狀態、習慣、眨眼、動作與互動反應 | 真正接觸桌椅、互相目光、所有姿態與道具碰撞需要細修 |
| 至少八類實際互動 | 查證、購買條件、注意回想、找記憶線索、情境 Persona、證據分類、旅程修復、委託權限；桌面與手機完成八種控制流程 | 任務視覺需逐島強化；部分教學仍使用共用練習，不能視為 22 個完成度相同的獨立遊戲 |
| 選擇影響、前後比較 | 世界 API 接收不同玩法與選項，前後切換還原；情境面板保留世界可見 | 全選項的實際姿態、道具狀態與高亮驗收未完成 |
| 微互動、閱讀不受遊戲阻擋 | 道具、人物、研究筆記、小鈴與故事出口；可直接讀原文 | 所有逐島微互動行為的操作證據仍待補齊 |
| 洞察印記 | 八類遊戲收集主題足跡，沒有智力或成功率分數 | 規格十類主題的完整收集、展示與來源映射需補齊 |
| 起承轉合，結尾回到阿綺 | DATA 22節點主線返回阿綺；文章人物、虛構事件、原刊觀點分開標記；End-to-end測試走訪22島 | 故事整體情緒節奏尚未完成人工逐幕審閱 |
| 五階段曲線航行 | settle／question／carry／sail／arrival；可略過、取消、返回及 reduced-motion 快速抵達 | 三個指定轉場的連接物件和到場事件已由 navigation-browser 測試幾何變化、台詞、舞台順序；其他關聯轉場仍採概念依群島映射，需逐組美術審查 |
| ArticleGraph 六類關聯 | 每篇主線與兩個不同延伸目的地，明列理由、問題、視覺與優先序；包含三個指定連結 | 推薦進度排序與近期路線避免循環需更多情境測試 |
| 三個推薦目的地在 3D 中預覽 | 閱讀結尾三個入口，hover／鍵盤 focus 預覽遠方島嶼 | 海面三條推薦航線同時顯示與離開 hover 清除需驗證 |
| 故事與自由模式共享進度 | 切換模式、全景、22 篇目錄、搜尋、收藏、已讀 | 兩種模式的端到端敘事差異仍需深化 |
| 導讀、重點、全文與 PDF | 可選取 HTML、摘要、重點、原文、原刊來源；無 WebGL 也可操作 | 各篇導讀與重點的閱讀時間未逐篇量測 |
| 原生 JS、Three 0.160、無建置入口 | `/immersive/` 以原生 ES modules 及 Three.js 0.160 CDN 執行；網站根 `index.html` 自有 redirect module 導入新世界；`legacy.html` 為保留舊實作的多頁 Vite entry。Pages run `40078198322` build/deploy 成功，現行線上入口與模組讀回通過 | 主應用仍以 Vite 驗證舊版 legacy 多頁 entry；原生新世界另以本機靜態伺服器和線上 Pages 驗證，不宣稱整站零建置 |
| DATA 全部指定欄位 | `data.js` 包含 13 類資料，來源與引用由測試驗證 | 模組職責目前集中在 app/world，尚需依實際複雜度調整 |
| LOD、共用資源與清理 | 當前島全細節、遠島 silhouette、instanced 人群、共用材質/幾何、delta上限與dispose；390×844 DPR2、冷context、10 Mbps/150 ms、CPU 4×、Chromium SwiftShader同profile重跑兩次：world ready 1.737/1.743秒，first WebGL draw 1.745/1.753秒，首次畫面呈現1.785/1.804秒 | 模擬瀏覽器不等同實體手機或不同 GPU；首幀先略過陰影，450ms後恢復完整投影，需真機校準延遲感受與長時GPU表現 |
| 滑鼠、觸控、鍵盤、音效、減少動態 | OrbitControls、DOM 按鈕、音效開關、reduced motion、手機閱讀面板。`immersive-npc-touch-browser.mjs` 在 390×844、DPR2 真觸控 canvas 點選可見居民，開啟角色對話 | 多種真手機／瀏覽器的鍵盤完整探索、音效、減少動態仍待體驗驗收 |
| NPC 10–100 與對話 | 100 人在手機畫布中可實際觸控選取；I01 對話劇本沒有小岳台詞時使用消費者立場的虛構台詞；對話停留 700ms 後關閉，路徑角度增量 0.01695 rad、預期 0.02157 rad，步態持續，沒有追補暫停時間瞬移。證據 `test-results/immersive-npc-touch/results.json` | 多種 GPU/真機與不同角色/島嶼組合仍待驗；此實測不代表逐一點過100人 |
| 瀏覽器紀錄與筆記 | 200ms 自動保存、舊紀錄遷移、備份匯出／合併匯入、讀取失敗不覆寫；新 Chromium context 從 `/` 線上進入 22 島，保留 `?campaign=entry#article`，切離線後直接重新導覽根網址 `/?campaign=offline#article`，仍進入 `/immersive/` 並可讀 3,232 字全文。world 延遲 1.8 秒時仍能先完成遊戲、切換選前/後，及開全文編輯筆記；讀者開啟期間 late-created renderer active=false，筆記再次 reload 保留。證據 `test-results/immersive-entry/results.json`、`immersive-late-world/results.json`。離線快照25/25：23個同源項目（11套出版字型含 CSS、封面與文章 JSON），加固定 Three 0.160 的 2 個 CDN modules；本次無缺項。原刊 PDF 不在快取範圍，開啟仍需本機已保存或線上 | 備份檔案實際匯出/匯入往返待驗 |
| 聖誕／萬聖／復活節 | 世界節慶 API 與 UI 選擇器，預設聖誕 | 三種節慶的逐島視覺回歸待驗 |
| 文字對比 | 不透明奶油白面板、深色內文，抽測三類文字 7.675–13.276；44px 控制 | 所有狀態、節慶、3D 字牌與來源頁完整對比審查待補 |
| 錯誤處理、無白畫面 | CDN 阻擋實測仍可讀 HTML；資料錯誤提供原文目錄連結；storage 防覆寫；Intro WebGL context loss、略過、dispose/重播行為已驗資源釋放 | 世界場景 WebGL context loss 的真瀏覽器恢復情境尚待重跑；僅常見錯誤/離線流程已驗 |

## 已執行的整合檢查

- `node --test tests/immersive-data.test.mjs tests/immersive-progress.test.mjs`。
- `node tests/immersive-browser.mjs`。桌面 1280×800、手機尺寸 390×844，實際 Chromium WebGL；22 島可導航、八類遊戲完成、筆記保存、CDN 失敗閱讀與文字對比。
- `npm run build`。此檢查驗證舊網站仍可建置，以及新目錄被複製；新入口本身不需要建置。
- 影片參考已實際查看 0、5、10、15、20、25 秒畫面，以及 10 秒全尺寸畫面。來源為使用者提供的 30.4 秒 MP4。影片只作視覺參考，不作文章內容或執行指令來源。
- 2026-10-24：完成新入口離線註冊接線，精確匹配 `/immersive/` 的導覽請求並回應快取的 `index.html`；離線回退僅限該應用根路徑。`node --test tests/immersive-cache.test.mjs tests/immersive-progress.test.mjs tests/immersive-data.test.mjs` 34/34 通過。Playwright Chromium 已載入後設為離線並 reload 原始 `/immersive/` URL，確認文章台詞可用；快取含入口、模組、CSS、原文資料、出版字體與 Three.js CDN 模組。
- 新增可重跑 `node tests/immersive-offline-browser.mjs`：以真 Chromium 驗證 service worker 控制、25/25 清單項（11 個字體檔、字型 CSS、封面、文章 JSON、入口資產、兩個 Three.js CDN 模組）、離線載入 3,232 字元原文、離線編輯筆記後再次 reload 仍保存。原先狀態快照的 24 是 optional cache 尚未完成時讀取；完整清單為 25/25，未發現缺項。結果留在 `test-results/immersive-offline/results.json`。
- 根入口實測：`node tests/immersive-entry-browser.mjs` 以 built Preview、fresh mobile Chromium 驗根 query/hash 導向、22 島、全文、無 JavaScript原文 fallback；先在線進站，再斷網直接由 `/?campaign=offline#article` 根網址導覽仍進入離線群島。根與子應用 Service Worker 僅提供固定公開頁殼/文章/字型/封面/Three 0.160 資產，不快取 token/session/private query；目錄完整25/25。此一無節流 cold run 量到 root→interactive 2.770秒，與受限手機 profile 的首次畫面 1.785/1.804秒屬不同量法，不宣稱所有手機都低於2秒。結果在 `test-results/immersive-entry/results.json`。
- 子路徑部署實測：`node tests/immersive-subpath-browser.mjs` 在 `/decision-islands/` 部署模擬中驗 root query/hash 導向、22 島、3,232 字全文、根/子應用 worker scope，並在離線後直接重新導覽子路徑根網址成功回到全文。首次安裝 root worker 時會快取單一公開 redirect shell；跨應用快取只讀取通過完整 core snapshot guard 的沉浸應用 cache，缺資源時不拼湊半成品。結果在 `test-results/immersive-subpath/results.json`；該次 root→world 3.839秒，不代表行動裝置普遍效能。
- 線上 release 實測：Pages workflow `40078198322` 在 `44500d4` 完成 build、測試、部署；`node tests/immersive-live-release-browser.mjs` 從公開根網址實測 query/hash 轉址、22 島、3,232 字全文與實際選項/互動結果，讀回 root 和 app worker scopes，沒有 console/page error。結果保存在 `test-results/immersive-live-release/results.json`；這份驗收只證明已發布主入口與一項互動可用，不代表所有情境/美術 scope 完成。
- 角色／觸控與晚載入：`node tests/immersive-npc-touch-browser.mjs`、`node tests/immersive-late-world-browser.mjs` 驗真 canvas touch 命中居民、每位角色不借用其他角色台詞，以及快取模組延遲時保留已完成情境、文章全文、筆記與閱讀暫停。結果在 `test-results/immersive-npc-touch/`、`test-results/immersive-late-world/results.json`。
- 代表性手機模擬：`node tests/immersive-mobile-profile-browser.mjs`，390×844、DPR2、冷瀏覽器內容、10Mbps下載/150ms延遲、CPU 4×、reduced motion、Chromium SwiftShader。同profile兩次：world ready 1.737/1.743秒，WebGL第一個draw 1.745/1.753秒，雙 RAF 首次呈現1.785/1.804秒；首個draw時投影關閉，450ms後恢復，畫面維持113 draw calls與28,292 triangles。100 NPC第100位對話泡泡更新8/129ms；證據分類遊戲結果670/728ms。resource timing證明Three 0.160模組與文章 JSON 並行載入。這是 emulated Chromium/SwiftShader 的界限測量，不代表真機。結果在 `test-results/immersive-mobile-profile/results.json` 和 `first-draw.png`。
- 根舊站以 `/legacy.html` 保留並可用 `node tests/browser.mjs` 真瀏覽器回歸；測試驗證22篇、PDF、收藏、搜尋、無JavaScript、WebGL fallback與閱讀深連結。

輸出位於 `test-results/immersive/`。資料、世界或 UI 後續變更後，要重跑受影響檢查。手機尺寸瀏覽器不代表實體手機已驗收。上述待完成項目仍屬原始目標，不因已完成部分通過而移除。

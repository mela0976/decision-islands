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
| 書塔非永久主場景 | 正式根入口轉至文章群島；閱讀文章不重播 intro；舊互動網站由 `/legacy.html` 保留；根路徑與 `/decision-islands/` 子路徑均通過 built Preview；主站 `45025f2` 於 Pages run `40080539177` 部署成功；公開 Chromium 從 `/` 保留 query/hash 導至22島，全文、任務結果、更新 worker/cache version 均讀回正常 | 實體行動裝置與不同 GPU 外觀未驗 |
| 四章 2／9／5／6，共 22 島 | `immersive-data.test.mjs` 核對原刊 ID、章節與全文；瀏覽器逐一導航 22 島 | 全島最終美術與敘事品質審查 |
| 不規則、可航行、保留海面 | 固定 seed 座標，島間距至少 18；四群島包圍盒分離 | 遠景觀感、章內船隻和自然海岸聚落需持續打磨 |
| 紙本編輯與微縮世界質感 | 霧面建築、共享細顆粒紙岸粗糙度貼圖、樹木、道具、柔和海面與章節色彩；檢視手機首屏遮疊後，390px 寬度隱藏四位角色浮動姓名牌，保留角色本體、互動泡泡與 DOM 對話 | 黑白影像、指紋、花朵、半色調等原刊語彙尚未完整融入；真機材質觀感未驗 |
| 22 個獨立文章場景 | 22 個 canonical 場景建構器、各自情境事件和核心道具；`node tests/immersive-all-island-actions-browser.mjs` 真瀏覽器逐篇完成22項情境任務並保存每篇人物、道具、互動類型和結果長度 | 場景美術與角色物理互動仍需逐島審查，瀏覽器任務通過不等於完成人工藝術校稿 |
| 四位原創人物、獨立節奏與表情 | 阿綺、小岳、映蓁、芬姐；狀態、習慣、眨眼、動作與互動反應。手機首屏不顯示互相遮住人物的姓名牌；寬畫布仍顯示姓名牌。NPC 真觸控後可對話並自然恢復移動 | P05 拿商品、P06 交應援卡、A01 接服務單已有手掌握點、雙節手臂、固定支撐面及互相目光；六組真瀏覽器接觸驗證見下方。其他逐島姿態、碰撞與敘事走位仍待審查 |
| 至少八類實際互動 | 查證、購買條件、注意回想、找記憶線索、情境 Persona、證據分類、旅程修復、委託權限八種；22 篇真瀏覽器各完成自己的情境流程與非空回饋，涵蓋八種 interaction type | 任務視覺與選項仍需逐島人工細修；部分控制形式跨文章共用，但情境、輸入、結果和來源映射依島別資料 |
| 68 個情境選項的專屬視覺後果 | `data.js` 為 22 島 68 個 scenarioChoice 指定具名人物、道具、動作與短反應；`world.js` 消費 action，建立可見 3D mesh 並移動角色。`node tests/immersive-scenario-choice.test.mjs` 覆蓋全部選項；`node tests/immersive-scenario-choice-browser.mjs` 以 Chromium WebGL/SwiftShader 固定通用玩法，實際完成 68 個選項，核對道具 geometry/position、每島不同 canvas 畫面、來源相符反應，並驗 compare、replay、離島返回及延遲 world module 載入。P06/M05/A01 另在 390×844 驗全部 10 個手機選項；結果面板 365.3px（43.3vh），截圖與 JSON 留在 `test-results/immersive-scenario-choice/`。一次 production build 後的 built Preview 再驗 P06-song，4 個 3D props、短反應與無 page error | 全島/全選項程式及瀏覽器矩陣已通過；逐島美術、姿態與道具接觸品質仍需人工審視，SwiftShader 手機尺寸不代表實體手機/GPU 驗收 |
| 選擇影響、前後比較 | 世界 API 接收不同玩法與選項，前後切換還原；完成後收合選項，手機以≤48vh面板顯示具體影響摘要，完整結果可展開；推薦島為唯一滿版主操作，其餘比較、閱讀、調整、重玩均44px。閱讀原文時保留結果對話框與比較狀態，關閉後回到同一任務；手機與桌面 UX journey 量測面板/畫布幾何與截圖 | 情境選擇視覺差異已由上方 68 選項矩陣驗證；全島藝術與實體姿態仍需人工審視 |
| 微互動、閱讀不受遊戲阻擋 | 道具、人物、研究筆記、小鈴與故事出口；可直接讀原文 | 所有逐島微互動行為的操作證據仍待補齊 |
| 洞察印記 | 十類足跡真實／信任／偏好／共同記憶／注意力／消費者洞察／衡斷力／體驗／內容治理／Agent 協作都在 `progressConfig` 定義；每島映射一類，逐島完成22個真瀏覽器情境已收集全部十類，沒有能力或成功率分數 | 仍需人工確認不同存檔／匯入往返後展示順序與完成感 |
| 起承轉合，結尾回到阿綺 | DATA 22節點主線返回阿綺；文章人物、虛構事件、原刊觀點分開標記；End-to-end測試走訪22島 | 故事整體情緒節奏尚未完成人工逐幕審閱 |
| 五階段曲線航行 | settle／question／carry／sail／arrival；可略過、取消、返回及 reduced-motion 快速抵達 | 三個指定轉場的連接物件和到場事件已由 navigation-browser 測試幾何變化、台詞、舞台順序；其他關聯轉場仍採概念依群島映射，需逐組美術審查 |
| ArticleGraph 六類關聯 | 每篇主線與兩個不同延伸目的地，明列理由、問題、視覺與優先序；包含三個指定連結 | 推薦進度排序與近期路線避免循環需更多情境測試 |
| 三個推薦目的地在 3D 中預覽 | 閱讀結尾三個入口，hover／鍵盤 focus 預覽遠方島嶼 | 海面三條推薦航線同時顯示與離開 hover 清除需驗證 |
| 故事與自由模式共享進度 | 切換模式、全景、22 篇目錄、搜尋、收藏、已讀 | 兩種模式的端到端敘事差異仍需深化 |
| 導讀、重點、全文與 PDF | 可選 HTML 摘要、重點、全文與原刊來源；無 WebGL 也可操作。UX journey 實測摘要 635 字、全文 3,232 字、關閉返回與筆記保存；從任務讀原文後仍回同一任務結果與比較狀態 | 各篇導讀與重點的閱讀時間未逐篇量測 |
| 原生 JS、Three 0.160、無建置入口 | `/immersive/` 以原生 ES modules 及 Three.js 0.160 CDN 執行；網站根 `index.html` 自有 redirect module 導入新世界；`legacy.html` 為保留舊實作的多頁 Vite entry。正式線上 `45025f2` 由 Pages run `40080539177` 部署成功 | 主應用仍以 Vite 驗證舊版 legacy 多頁 entry，不宣稱整站零建置 |
| DATA 全部指定欄位 | `data.js` 包含 13 類資料，來源與引用由測試驗證 | 模組職責目前集中在 app/world，尚需依實際複雜度調整 |
| LOD、共用資源與清理 | 當前島全細節、遠島 silhouette、instanced 人群、共享材質／幾何與紙岸粗糙度貼圖、delta 上限與 dispose。代表模擬條件為390×844 DPR2、10Mbps/150ms、CPU4×、reduced motion、冷 Chromium SwiftShader；本次world ready 1.762s、首個 WebGL draw 1.780s、雙 RAF 首次呈現1.875s、setup 158.1ms、NPC泡泡10ms、遊戲結果401ms。上一相同條件呈現2.354s；較早單次1.955s。保留變異，不外推真機或所有頁面。 | 三次 run 有兩次首次呈現超過2秒；模擬瀏覽器不等同實體手機或不同 GPU；首幀略過陰影、450ms後恢復，需真機校準延遲感受與長時 GPU 表現 |
| 滑鼠、觸控、鍵盤、音效、減少動態 | OrbitControls、DOM 按鈕、音效開關、reduced motion、44px 主操作目標。`immersive-npc-touch-browser.mjs` 在 390×844、DPR2 真觸控 canvas 點選可見居民；UX journey 真 Chromium 驗 Tab 焦點輪廓、目錄／設定互斥與 dialog 返回 | 多種真手機／瀏覽器的鍵盤完整探索、音效、減少動態仍待體驗驗收 |
| NPC 10–100 與對話 | 100 人在手機畫布中可實際觸控選取；I01 對話劇本沒有小岳台詞時使用消費者立場的虛構台詞；對話停留 700ms 後關閉，路徑角度增量 0.01695 rad、預期 0.02157 rad，步態持續，沒有追補暫停時間瞬移。證據 `test-results/immersive-npc-touch/results.json` | 多種 GPU/真機與不同角色/島嶼組合仍待驗；此實測不代表逐一點過100人 |
| 瀏覽器紀錄與筆記 | 200ms 自動保存、舊紀錄遷移、備份匯出／合併匯入、讀取失敗不覆寫；根與子路徑離線可讀全文與編輯筆記；新版 worker 下載完成後在閱讀／情境視窗提供套用按鈕，先 flush 筆記、skipWaiting、重載後保留筆記。v7→v8模擬讀者中套用更新後筆記成功；本次真實 v8→v9 worker 更新測試由目前 SW 版本動態派生，套用後新 controller 啟用且舊筆記保留，fixture 結束後復原 dist worker。e769f9b舊app/cache v3模擬：reload兩次仍由舊worker供應，關閉所有舊頁再開後換成新UI/cache v7，筆記保留。world 模組延遲5秒仍能先完成遊戲、切換選前/後及開全文編輯筆記，讀者期間renderer active=false。快照25/25：23個同源項目（11套出版字型含CSS、封面與文章JSON）+ Three0.160的2個CDN modules；本次 built Preview 另確認出版 CSS 及11個 WOFF2 皆回應 200；原刊PDF不在快取範圍，開啟需線上或本機已保存 | 2026-10-24，`tests/immersive-backup-recovery-browser.mjs` 完整往返曾完成26項、通過25項，唯一失敗是匯入後目前島的收藏按鈕仍顯示「收藏」。本次 `IMMERSIVE_BOOKMARK_REFRESH_ONLY=1 node tests/immersive-backup-recovery-browser.mjs` 在修補後通過3/3，確認下載備份含收藏、匯入後按鈕立即顯示「已收藏」、收藏清單仍列出 I01。未在同一修補版本重跑完整26項。證據 `test-results/immersive-backup-recovery/results.json`、`bookmark-refresh-results.json`、`bookmark-refresh-after-import.png` |
| 聖誕／萬聖／復活節 | 世界節慶 API 與 UI 選擇器，預設聖誕 | 三種節慶的逐島視覺回歸待驗 |
| 文字對比 | 不透明奶油白面板、深色內文，抽測三類文字 7.675–13.276；44px 控制 | 所有狀態、節慶、3D 字牌與來源頁完整對比審查待補 |
| 錯誤處理、無白畫面 | CDN 阻擋實測仍可讀 HTML；資料錯誤提供原文目錄連結；storage 防覆寫；Intro WebGL context loss、略過、dispose/重播行為已驗資源釋放。2026-10-24 真 Chromium 備份往返測試另用 `WEBGL_lose_context` 觸發世界場景失去 context，確認切換閱讀模式、全文可讀、匯入筆記可見，且 context loss 後修改的筆記可再開讀回 | 前述 26 項基準為25/26，本次僅重跑收藏刷新3/3，未以修補後版本重跑整個 WebGL context loss 與備份往返套件 |

## 已執行的整合檢查

- `node --test tests/immersive-data.test.mjs tests/immersive-progress.test.mjs`。
- `node tests/immersive-browser.mjs`。桌面 1280×800、手機尺寸 390×844，實際 Chromium WebGL；22 島可導航、八類遊戲完成、筆記保存、CDN 失敗閱讀與文字對比。
- `npm run build`。此檢查驗證舊網站仍可建置，以及新目錄被複製；新入口本身不需要建置。
- 影片參考已實際查看 0、5、10、15、20、25 秒畫面，以及 10 秒全尺寸畫面。來源為使用者提供的 30.4 秒 MP4。影片只作視覺參考，不作文章內容或執行指令來源。
- 2026-10-24：完成新入口離線註冊接線，精確匹配 `/immersive/` 的導覽請求並回應快取的 `index.html`；離線回退僅限該應用根路徑。`node --test tests/immersive-cache.test.mjs tests/immersive-progress.test.mjs tests/immersive-data.test.mjs` 34/34 通過。Playwright Chromium 已載入後設為離線並 reload 原始 `/immersive/` URL，確認文章台詞可用；快取含入口、模組、CSS、原文資料、出版字體與 Three.js CDN 模組。
- 新增可重跑 `node tests/immersive-offline-browser.mjs`：以真 Chromium 驗證 service worker 控制、25/25 清單項（11 個字體檔、字型 CSS、封面、文章 JSON、入口資產、兩個 Three.js CDN 模組）、離線載入 3,232 字元原文、離線編輯筆記後再次 reload 仍保存。原先狀態快照的 24 是 optional cache 尚未完成時讀取；完整清單為 25/25，未發現缺項。cache v7更新後需重跑。結果留在 `test-results/immersive-offline/results.json`。
- 根入口實測：`node tests/immersive-entry-browser.mjs` 以 built Preview、fresh mobile Chromium 驗 query/hash 導向、22 島、全文、無 JavaScript 原文 fallback；先在線進站，再斷網直接從根網址進入仍成功。根與子應用 Service Worker 僅提供固定公開頁殼／文章／字型／封面／Three 0.160 資產，不快取 token/session/private query；目錄完整25/25。本次無節流 cold run 的 mobile interactive 1.082秒，與受限手機 profile 的 first draw 2.230秒、雙 RAF首次呈現2.354秒為不同量法；代表模擬 profile 此次超過2秒畫面目標，記錄變異，不宣稱普遍達標。結果在 `test-results/immersive-entry/results.json`、`test-results/immersive-mobile-profile/results.json`。
- 子路徑部署實測：`node tests/immersive-subpath-browser.mjs` 在 `/decision-islands/` 部署模擬中驗 root query/hash 導向、22島、3,232字全文、根/子應用 worker scope，並在離線後直接重新導覽子路徑根網址成功回到全文。快照 guard 防止根 worker 使用不完整 app cache。此次 root→world 6.339秒，不代表手機普遍效能。結果 `test-results/immersive-subpath/results.json`。
- 線上 release 實測：Pages workflow `40080539177` 在 `45025f2` 完成 npm test、Python tests、public-data check、Vite build 與 deployment。`DEPLOYMENT_COMMIT=45025f2 node tests/immersive-live-release-browser.mjs` 從公開根網址實測 query/hash、22島、3,232字全文、任務選項與結果；root/app worker scopes正確、無 console/page error、耗時6.925秒（含完整入場）。另公開手機 Chromium實測 UI 結果面板386/844px、影響摘要與推薦主行動可見，cache為`2026-10-24.7`，證據 `test-results/immersive-live-release/results.json` 與 `ui.json`、`mobile-result.png`。此驗收不代表所有情境與美術 scope完成。
- UI/UX journey 實測：`node tests/immersive-ux-journey-browser.mjs` 在390×844手機與1280×800桌面完成首訪導引、目錄／設定互斥與ARIA、搜尋空狀態、閱讀層級切換、筆記reload、任務比較／重玩／閱讀／推薦島、閱讀返回原任務結果和鍵盤焦點。完成選擇後收合輸入，手機結果面板386/844px=45.8vh、上半畫布/角色仍見，影響摘要與唯一滿版主 CTA 清晰；截圖`test-results/immersive-ux-journey/mobile-result.png`、幾何在`results.json`。v7→v8模擬可在閱讀窗內套用並保留筆記；另以e769舊app/cache v3實測仍開頁時，單純reload兩次未套用；先等筆記已儲存，關閉該網站所有分頁再重開後新版/cache v7載入，筆記保留。舊版此次遷移的指引是「關閉所有舊頁再開網址」，不是清除瀏覽資料。證據`update.json`、`e769-update.json`。
- 逐島真瀏覽器任務：`node tests/immersive-all-island-actions-browser.mjs` 對22篇逐一完成互動並保存每項角色、核心道具、interaction type、footprint和結果，八類互動均覆蓋，22篇共收集十類足跡，無瀏覽器錯誤。結果在 `test-results/immersive-all-islands/results.json`。
- 情境因果矩陣：`node --test tests/immersive-scenario-choice.test.mjs tests/immersive-cache.test.mjs` 11/11 通過；`node tests/immersive-scenario-choice-browser.mjs` 真 Chromium/SwiftShader 對 22 島 68 選項逐一走現有 generic controls，核對實際 3D mesh/pose、差異化 canvas 與簡短反應。P06/M05/A01 另驗 390×844 手機、compare/replay/離島返回；M05 延遲 world module 3.5 秒仍可先完成互動並在載入後重建效果，無 page errors。單次 `npm run build` 後在 built Preview 定向完成 P06-song（4個 props、正確反應、0 page errors）。截圖/完整結果在 `test-results/immersive-scenario-choice/`，不納入版本控制。
- 角色／觸控與晚載入：`node tests/immersive-npc-touch-browser.mjs`、`node tests/immersive-late-world-browser.mjs` 驗真 canvas touch 命中居民、每位角色不借用其他角色台詞，以及快取模組延遲時保留已完成情境、文章全文、筆記與閱讀暫停。結果在 `test-results/immersive-npc-touch/`、`test-results/immersive-late-world/results.json`。
- 代表性手機模擬：`node tests/immersive-mobile-profile-browser.mjs`，390×844、DPR2、冷瀏覽器內容、10Mbps/150ms、CPU4×、reduced motion、Chromium SwiftShader。最新 run world ready1.762秒、first draw1.780秒、雙 RAF首次呈現1.875秒；同條件上一 run 首次呈現2.354秒。100 NPC泡泡10ms、互動結果401ms。變異仍超過2秒目標，不宣稱所有行動裝置達標；Three0.160與文章 JSON並行下載。結果 `test-results/immersive-mobile-profile/results.json`、`first-draw.png`。
- 根舊站以 `/legacy.html` 保留並可用 `node tests/browser.mjs` 真瀏覽器回歸；測試驗證22篇、PDF、收藏、搜尋、無JavaScript、WebGL fallback與閱讀深連結。

輸出位於 `test-results/immersive/`。資料、世界或 UI 後續變更後，要重跑受影響檢查。手機尺寸瀏覽器不代表實體手機已驗收。上述待完成項目仍屬原始目標，不因已完成部分通過而移除。


## 2026-10-24 人物接觸與事件切片

資料形狀是單一當前事件，包含 articleId、effectId、action、participantIds、prop、grip、support、owner 與 elapsed。`character-events.js` 負責 approach、contact、hold、release、react 五階段。`world.js` 提供既有情境具名實物、人物與 active delta，不另建計時器。新事件、比較選前、重玩、離島與 dispose 會取消前一事件。返回完成的島時直接重建相同的結果姿態。

手掌與物件握點以世界座標對準。雙節手臂保留有限長度。交接只移動同一個既有物件，owner 在兩位參與者之間切換。放下後物件仍屬當島 outcome，固定桌面提供支撐，未掛在角色根節點。說話與聆聽人物的 head 朝向另一人的 head。非參與者保留各自 idle 節奏。正常動態泡泡先呈現起因，在 react 階段顯示對應的既有短反應。

已完成並驗證的部分如下。

- `node tests/immersive-character-contact-browser.mjs` 在原生 Three 0.160、Chromium ANGLE SwiftShader，對 P05-value、P06-cheer、A01-support 各跑 1280×800 與 390×844，共六案。遊戲選項由 DOM 操作，並保存起始、接觸、反應共 18 張 PNG。P05 拿取的商品仍由 price 與 low 通用條件決定。
- 六案的接觸手掌與握點距離均小於頭寬四分之一。參與接觸的手掌量測誤差小於 0.00001，雙向目光內積為 1。P06 與 A01 的交接樣本都讀到兩位不同 owner，但每個樣本恰有一位 owner。相鄰交接樣本物件距離小於 0.2。放回桌面後 owner 為空、supported 為真、物件位置等於支撐點，後續取樣維持固定。暫停期間 elapsed 不變。
- `node tests/immersive-character-contact-lifecycle.mjs` 使用 production build 的 Preview。真 Escape 關閉閱讀後保留下層任務，閱讀期間事件暫停且恢復時不追補時間。比較選前還原 baseline 並取消事件，重玩重新起始，離島不續播，返回及 reduced motion 呈現相同的支撐面結果姿態。精確核對 built `character-events.js` 與 CacheStorage 回應，斷網 reload 後 world 仍能完成初始化。
- `node tests/immersive-scenario-choice-browser.mjs` 在本切片複驗 22 島 68 選項、八類玩法、P06、M05、A01 全十個手機選項、比較、重玩、返回及 M05 world 延遲 3.5 秒，無 page errors。此矩陣驗選項的實物差異，不能代替逐島接觸動作審查。
- `node --test tests/immersive-cache.test.mjs tests/browser-cache.test.mjs` 通過 25 項。immersive 快照升至 `2026-10-24.9`，root worker 升至 `v4`。兩層 allowlist 與完整快照檢查均納入新模組。root worker 拒絕借用缺新模組的舊完整清單，補齊新模組後才允許借用。
- `npm run build` 通過 TypeScript 與 Vite。既有出版字型 CSS build warning 保留，檔案以公開資產在執行時提供。整體 `npm test` 曾啟動，發現包含無關 legacy GPU 案例後中止，不列為本切片完整通過證據。

結果在 `test-results/immersive-character-contact/results.json`、`lifecycle.json`、18 張 PNG，以及 `test-results/immersive-scenario-choice/results.json`。這些輸出不納入版本控制。協調者另提供上一發布基準 `332537c` 的 CI `40082849441` 成功及 live release 讀回，該證據不表示本切片已部署。

仍待完成的部分如下。

- action registry 已對既有 68 個效果提供拿取、翻面、轉向、比較、放置、交接、歌唱、聆聽、聚集與路過的有限動作。其餘 19 島 I01、I02、P01、P02、P03、P04、P07、P08、P09、M01、M02、M03、M04、M05、A02、A03、A04、A05、A06，尚未逐島驗起始、接觸、反應三個時間點的動作美術與敘事。不能稱 22 段獨立生活事件全部完成。
- 代表三島已驗物理接觸與目光，完整戲劇走位仍需審視，例如 P05 回頭比較另一商品、P06 交換後共同轉向舞台、A01 接單後指向配送說明。現有有限反應姿態與台詞不等於這些逐幕演出已全部完成。
- 尚未完成全身碰撞、桌椅穿透檢查、所有手機與 GPU 的可讀性驗收、實體手機驗收，以及原刊黑白影像、花朵、指紋、半色調材質切片。

本切片採用 Model the Domain，將 owner、支撐面與階段集中於同一事件狀態。採用 Test Behavior, Not Implementation，以 DOM 選擇、畫布截圖與世界座標檢查動作。採用 Prove It Works，區分真正 Chromium 畫面、built 離線讀回與未驗證的逐島敘事品質。how 與 architect 只在本葉節點內完成架構梳理，依當次委派限制沒有再派代理或進行 arena。已讀 no-comments、technical-writing 與 unslop。deslop 外掛在當次技能安裝中未找到，未宣稱完成該外掛審查。

throughput checkpoint。先驗三個代表動作，再回歸既有 68 選項，最後核對離線模組生命週期。沒有可比對照，不宣稱時間或 token 節省比例。

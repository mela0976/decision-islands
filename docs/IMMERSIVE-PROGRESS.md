# 沉浸式群島開發與驗收紀錄

本紀錄保留完整 Master Prompt 範圍。表內分開列出已驗證部分與仍待實測的體驗品質。

## 目標與入口

以四大群島、22 座文章島、四位原創人物、八類互動和文章關聯航線，呈現《2026 決策智慧》。書塔只負責初次入場。

正式根入口 `index.html` 以自有小型 redirect module 導向 `./immersive/`，原樣保留 query/hash；無 JavaScript 時提供完整原文目錄。舊 Vite 入口保留於 `legacy.html`，僅作舊站回歸。新世界位於 `public/immersive/index.html`，在專案根目錄執行 `python3 -m http.server 4186 --directory public` 可直接開啟 `http://localhost:4186/immersive/`；其 ES modules 與固定 Three.js 0.160.0 CDN importmap不需要建置。網站根路由本身在正式 Pages/build preview 驗收。

## 執行分工與依賴

- 整合基準：`37ab4bf`；在 `immersive-master` 工作樹持續整合，保留原工作區套件變更。
- 單一 Luna 負責網站程式、資料、入口及完整驗收，避免不同實作分支造成狀態漂移。

## 範圍對照

| 規格 | 目前實作與證據 | 尚需完成或驗證 |
|---|---|---|
| 6–12 秒、可略過、首次入場開場 | 8.6 秒真 Three.js 封面、開書、螺旋書塔、紙頁海岸、群島雲層與抵達；可略過，完成狀態保存。Intro browser 在桌機/手機尺寸驗證四階段、釋放資源與不重播 | 實體手機與不同 GPU 的畫面表現未驗 |
| 書塔非永久主場景 | 正式根入口轉至文章群島；閱讀文章不重播 intro；舊互動網站由 `/legacy.html` 保留 | 正式 GitHub Pages 發布與線上新入口仍待部署/readback |
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
| 原生 JS、Three 0.160、無建置入口 | `/immersive/` 以原生 ES modules 及 Three.js 0.160 CDN 執行；網站根 `index.html` 自有 redirect module 導入新世界；`legacy.html` 為保留舊實作的多頁 Vite entry。已在 dist Preview 測根入口 | Pages 線上發布與根網址生產環境驗收仍待完成 |
| DATA 全部指定欄位 | `data.js` 包含 13 類資料，來源與引用由測試驗證 | 模組職責目前集中在 app/world，尚需依實際複雜度調整 |
| LOD、共用資源與清理 | 當前島全細節、遠島 silhouette、instanced 人群、共用材質/幾何、delta上限與dispose；手機模擬profile：390×844 DPR2、10 Mbps/150 ms、CPU 4×、Chromium SwiftShader、cold context，world ready 1.83 秒、首次 Three draw 2.83 秒 | 首次 draw 超過 2 秒目標；單次 emulator 測量且有浮動，不代表實體手機；需優化首幀工作並以真實設備校準 |
| 滑鼠、觸控、鍵盤、音效、減少動態 | OrbitControls、DOM 按鈕、音效開關、reduced motion、手機閱讀面板 | 觸控與完整鍵盤探索的實際操作證據待補 |
| NPC 10–100 與對話 | 人數控制、人物停留／面向鏡頭、泡泡與情境互動 API | 所有 NPC 逐一點選與關閉復原的實測待補 |
| 瀏覽器紀錄與筆記 | 200ms 自動保存、舊紀錄遷移、備份匯出／合併匯入、讀取失敗不覆寫；真 Chromium 離線於根網址重新導覽，進入 `/immersive/`、開完整原文（3,232 字元）、編輯筆記並再次 reload，均成功。子應用快取核對25個清單項全存在；備份檔案實際匯出/匯入往返待驗 |
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
- 根入口實測：`node tests/immersive-entry-browser.mjs` 以 built Preview、fresh mobile Chromium 驗根 query/hash 導向、22 島、全文、無 JavaScript 原文 fallback；根 service worker 僅將不影響 redirect 的根導覽 query 映射到同一靜態殼 cache key，私有資料 query 仍網路直通。確認先在線進站、後斷網直接由根 URL 導覽仍進入離線群島。結果在 `test-results/immersive-entry/results.json`。
- 代表性手機模擬：`node tests/immersive-mobile-profile-browser.mjs`，390×844、DPR2、冷瀏覽器內容、10Mbps下載/150ms延遲、CPU 4×、reduced motion、Chromium SwiftShader。一次實測 world ready 1.83秒；首個 WebGL frame 2.83秒；100位 NPC 的第100位對話泡泡更新 17ms；證據分類遊戲結果 207ms。world ready 和第一個 WebGL frame 分開量測，結果只適用於此模擬環境，首幀仍需優化。證據在 `test-results/immersive-mobile-profile/results.json` 和 `first-draw.png`。
- 根舊站以 `/legacy.html` 保留並可用 `node tests/browser.mjs` 真瀏覽器回歸；測試驗證22篇、PDF、收藏、搜尋、無JavaScript、WebGL fallback與閱讀深連結。

輸出位於 `test-results/immersive/`。資料、世界或 UI 後續變更後，要重跑受影響檢查。手機尺寸瀏覽器不代表實體手機已驗收。上述待完成項目仍屬原始目標，不因已完成部分通過而移除。

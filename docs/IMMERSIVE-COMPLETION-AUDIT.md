# 完整 Master 規格與可關閉缺口

2026-10-24。審查基準為 `0aaf946aabcd8f75673875df7ea11a60de9862a2`。唯一規格全文是 `/Users/lewis/.codex/attachments/42c074c6-3663-4e3b-8828-98eee69be234/pasted-text-1.txt`，共 655 行。本文件沿用主協調者同任務即時讀取的 Notion SOP B。後續來源變動須由整合者補記，不將本基準的結果直接套到新版。

這次只修改本文件。實際讀取上述全文、四份 IMMERSIVE 文件、現行來源、測試程式、JSON 和下列代表圖片。沒有啟動 WebGL renderer、重跑 GPU 矩陣、查 GitHub、commit、push 或部署。另執行了一次不使用 GPU 的 2D Chromium 驗證，結果直接記在本文。公開版本與本輪效能實測由主協調者整合。

未加目錄的 `app.js`、`world.js`、`data.js`、`index.html` 等來源簡稱，均指 `public/immersive/` 之下的檔案；提到根入口時另寫「根 index」。`immersive-*/*.json`、圖片簡稱均位於 `test-results/`。行號指本次凍結基準；其他實作者後續修改不倒填為已驗。

`IMMERSIVE-NEXT-ACCEPTANCE.md` 是 e617b7f 的歷史缺口；`IMMERSIVE-ARRIVAL-CONTRACT.md` 是 5c474c9 的實作契約。兩者不是目前功能未完成的證據。PROGRESS 中早期的「尚無生活事件」「尚無船」「剩餘 16 島必須逐一加入全部原刊紋理」不能直接沿用。

## 判讀方式

| 狀態 | 本文含義 |
|---|---|
| `proved` | 已直接讀到滿足該有限要求的來源、實物或行為結果。每列說明證據層級，靜態資料證明不自動升成 UI 實測。 |
| `contradicted` | 現有程式或實際結果與要求相反，附可重現的缺陷及關閉條件。 |
| `incomplete` | 已有部分必要行為，但仍缺一個可具體命名的要求。 |
| `indirect` | 有實作或較早證據，但現有證據沒有走到該完整使用者流程。不是斷言產品一定壞掉。 |
| `missing` | 在本次來源及產物中找不到所需實作或證據。 |

原 Master 要求桌面、手機、觸控、鍵盤、動畫、資料和效能實測，沒有要求所有實體手機或所有 GPU 都驗過。尚無真機結果是證據限制，不是自行新增的無限驗收條件。使用者後續追加的「所有頁面與互動 2 秒內」仍是有效目標，獨立列在本文末；它不是 Master 第 12 節的原文數字。

## 最高影響的三個產品缺口

| 優先與狀態 | 精確缺陷、依據 | 有限關閉條件 |
|---|---|---|
| G1／優先1 `contradicted`。抵達後不能返回實際來源島。 | Master 09 要求可返回當前文章的航線。`app.js:92` 保存 travelOrigin，`:299` 可返回，但 `:360` 在 arrival 隱藏整個 travel-controls。`:305` 的「上一座」只取原刊 index−1。P01→P04 後此按鈕去 P03。這次直接讀 DATA 得 66 條有向邊，其中 38 條沒有反向邊，不能假設推薦恰好可返回。 | 抵達後保有可辨識的「返回來源島」入口，原刊上一座仍維持原語意。至少以真 UI 驗 P01→P04→P01、P05→A06→P05，含閱讀／任務關閉後、reduced motion、2D。返回不重播 intro、不丟原筆記或已完成結果。 |
| G2／優先2 `contradicted`。M05 的水面上下雙層不可見。 | Master 05 明訂水面上下雙層島。`world.js:312` 的下層圓柱中心 y=.1、高 .4，位於 `:367–368` 的實心紙岸及 y=.85 草地之下；海面在 `:191` y=−.9。既有 `immersive-arrival/1280-M05-action.png` 實際只見同一實心島面、粉球與隔板，沒有可讀的水下層。入場事件及 fear/guidance/silo 已有，不可報成 M05 完全沒故事。 | 同一個 M05 畫面可辨識水線以上的上線狀態及以下的組織阻力，至少一項原有顧慮物件在對應下層，動作讓兩層關係可理解。390 與 1280 同機位圖片核對，保留既有三選項及 arrival。 |
| G3／優先3 `contradicted`。2D 留下靜默無效的重播按鈕。 | Master 14 要求所有按鈕有實際功能。`index.html:24` 永遠顯示 replay-arrival；`app.js:296` 只有 `world?.playArrival()`。本次停用 GPU/WebGL 且阻擋 world.js 的真 Chromium 中，按鈕 visible=true、enabled=true、world=false，Enter 後對白完全不變。 | 2D 將此控制轉成有用的文字事件重播，或移除／明確停用 3D 專屬控制並說明原因。全部 22 篇文章仍可讀，不能以隱藏整個故事／閱讀介面修正。 |

## 本次實際讀回的證據

所有以下 `test-results/` 是本機既有檔案。未記錄 commit 的檔案不假設一定來自本次 HEAD。本文讀 JSON 的實際欄位及測試方法，沒有只採用通過數字。

| 代號 | 實物及讀回內容 | 能證明的範圍及限制 |
|---|---|---|
| E1 | `public/immersive/data.js:1008–1203`；直接呼叫 buildData 讀取當前 `public/data/2026.json`，章節數 2/9/5/6、22 篇、66 邊。每篇有 paragraphs、sourcePages、sourcePdf；正文 3,150 至 16,541 字元，不計 HTML 段落換行。 | 當前資料形狀、文章映射、完整正文保留。不是 PDF 逐字人工校稿。 |
| E2 | `immersive-intro/results.json[0,1]` 各有 phases=`cover,tower,coasts,world`、released=true、repeated=false、errors=[]；[2] 實按略過。`intro.js:3` DURATION=8.6，`:35–44` 清理資源。 | 真 Chromium 的既有開場流程與資源釋放。圖片已抽看 `1280-coasts.png`，可見紙頁化海岸，不以靜態圖證明完整連續運動。 |
| E3 | `immersive-arrival/results.json.records` 有 27 項。桌面 22 島，手機 I01/P06/M05/A01/A06；每項 samples 為自然 active dt 到每 beat 55% 的 cause/action/reaction，final.history 三段、complete=true；errors=[]。例如 I01 action.elapsed=4.17、completed-proposal.owner=achi；A01 action.delivery-slip.owner=fenjie，contactDistance 約 3.18e−14。 | 證明每島事件有不同物件／人物狀態，並非只換文案。`tests/immersive-arrival-browser.mjs:22` 直接 API visit/playArrival，所以不能單獨證明 22 個 DOM 航行及 canvas 小鈴都已點過。 |
| E4 | `immersive-scenario-choice/results.json.matrix` 22 列、68 options，各含 choiceId/effectId/propSignature/imageHash；mobile 3 島共 10 選項。I01-speed 有 6 個 mesh，customer 有 3 個，risk 有 4 個；三者 geometry/position 不同。compareReplayReturn.beforeRestored=true；lateWorld.effectId 與所選 M05 情境一致；errors=[]。 | 減少動態模式下的 DOM 選項、3D 終態、前後比較、重玩、返回與延遲 world 同步。hash 不同本身不是藝術或自然動畫的證明。 |
| E5 | `immersive-character-contact/results.json.records` 6 項，P05-value/P06-cheer/A01-support 各兩尺寸。P06 contact.owner=yue、transferSamples 後續 owner=achi、ownerCount=1，手掌誤差約 2e−14，final.owner=null、supported=true。 | 三個代表結果動作有接觸、單一所有權、目光和支撐。不是 68 個結果動作逐一無穿透的證據。 |
| E6 | `immersive-navigation/results.json[1..3]` 保存三個指定 carry。photo-evidence-bridge 有 11 個 mesh，product-service-journey 14 個，model-limits-scale.cardFlip 約 1.177 弧度；events 五階段完整。[0] 三條推薦、hover 一個 preview、清除後全不可見。[4] cancel/skip/reduced 終態。 | 是引擎層真 GPU 結果。`tests/immersive-navigation-browser.mjs:14–20` 另建世界，`:38` 直接 focus 並注入相同問題「帶著上一幕的問題往前走」。不能當成真 ArticleGraph 文案、原 UI 和新 arrival 完整串接已驗。 |
| E7 | `immersive-editorial/after/results.json.records` 12 項，六島×兩尺寸。P01 motifs 含 flowerPaper/sourcePortrait/simulatedPortrait，finish 分別 halftone/pixel；I01 proposal 為 portrait/photo；texture keys 含 seed。 | 原刊語彙確已進入六個有敘事用途的物件。Master 不要求每島重複每一種 motif，因此「其餘 16 島沒全套紋理」不能單獨判未完成。 |
| E8 | `immersive-ux-journey/results.json.journeys` 兩尺寸。mobile summary=635、full=3232；noteSurvivesReload=true；result dialog.height=386.28125、viewportHeight=844；9 個主操作 height=44；keyboardFocus.id=only-bookmarks、outline=solid、errors=[]。 | 代表 UI、閱讀、筆記、選擇結果、焦點與觸控尺寸。沒有完整輔助技術／逐控制鍵盤測試。 |
| E9 | `immersive-arrival-startup/results.json.records` first-intro 在 10614.1ms 讀到 I01 cause、introHidden=true、elapsed=.1；returning 在 394.3ms cause；early-reader.event=null、readerOpen=true。 | 真首訪、回訪及先開閱讀的啟動時序。10.6 秒含刻意的開場，不可當作冷載入 2 秒目標的同一量測。 |
| E10 | `immersive-arrival-offline/results.json` cacheEntries=28、moduleBytes=13010，rootArrival/appArrival 均 I01 reaction、complete/skipped=true；兩個 worker scope；errors=[]。`immersive-arrival-lifecycle/results.json` before/after 保留同一結果資料，errors=[]。 | built 離線及代表結果恢復，沒有測原刊 PDF 離線。 |
| E11 | `immersive-backup-recovery/results.json` 明列 head=e617b7f、passed=false，26 checks 中一項收藏按鈕未刷新；`bookmark-refresh-results.json.checks` 3 項都 passed=true，importStatus 成功、bookmarkButton=已收藏。 | 可沿用修正項讀回，不能改寫成最新版本完整 26/26。舊 WebGL loss 後閱讀／筆記可用的 25 項不因文件舊而全部作廢。 |
| E12 | `immersive-mobile-profile/results.json` 為 390×844、DPR2、10Mbps/150ms、CPU4×、coldContext、reducedMotion、SwiftShader。firstPresentedMs=1875、worldReadyMs=1762、worldSetupMs=158.1；首幀不投影、450.5ms 後恢復；100 NPC 對話10ms，遊戲結果401ms。 | 一次舊 profile 的特定操作。不能證明所有頁面／互動兩秒，也不能以這筆覆蓋主協調者的新三次 baseline。 |
| E13 | 本次原生 static HTTP server，Chromium `--disable-gpu --disable-webgl`，world.js route.abort，390×844、reduced motion、serviceWorkers=block。22 篇逐一由目錄點選，焦點置於「閱讀原文」後 Enter，焦點置於「完整原文」後 Enter，Escape 關閉。22 次 reader.open=true，errors=[]。 | 這是當前基準的新 2D 操作證據。使用 focus() 定位後按鍵，不宣稱已完整驗證只按 Tab 的所有焦點順序。初次 Vite 嘗試遇到 431／等候逾時，改用原生 static server 後成功；未將失敗嘗試列成功。 |

E13 逐篇顯示字數。依 `2026-01` 至 `2026-22` 為 3232、3335、4458、6595、5472、4042、6571、5865、3473、5475、15896、16983、9384、5598、6867、5173、6476、6562、4927、5451、4779、6744。含 DOM 段落換行，與 E1 的純字串計數不同。最後 A06 的重播前後皆為「芬姐：可以先幫她找選項，到了健康問題我來接手」，world=false，按鈕仍 enabled。

本次實際看圖包括 `immersive-arrival/1280-M05-action.png`、`390-A06-reaction.png`、`1280-P06-action.png`、`immersive-editorial/after/1280-P01-2026-03-page.png`、`immersive-intro/1280-coasts.png`。可確認舞台、花園、編輯紋理、人物和手機閱讀面板已存在；M05 圖直接支持上列雙層缺口。

## 01｜角色與最終目標

| 明確要求 | 狀態與證據 | 可關閉的剩餘內容 |
|---|---|---|
| 瀏覽器可操作的《2026 決策智慧》3D 沉浸式互動群島。 | `proved`。入口 `index.html:7,17–29`，E3/E4 實際世界與互動，E13 無 3D 仍可閱讀。 | 最終公開 HEAD 由 root 另讀回。 |
| 居民、生活場景、故事、可發現線索、任務與知識關聯；自由探索及航向相關文章。 | `proved`。E1、E3、E4、E6，各島 sourceGrounding 和 dialogue；`world.js:346–349` 可點裝置、筆記、小鈴、出口。 | 返回來源島欠項見 G1，不以更多裝飾作驗收。 |
| 不能退回書塔主體、電子書翻頁器或靜態文章卡。 | `proved`。world.js 沒有書塔；app intro 僅初次，資料驅動場景與 68 個實物後果已存在。 | 無。 |

## 02｜空間結構

| 明確要求 | 狀態與實際依據 | 剩餘內容 |
|---|---|---|
| 首訪 6–12 秒可略過；封面、鏡頭接近、展書、書塔、紙頁舒展、海岸地形、塔消融、穿雲、落入 Intro。 | `proved`。intro.js:3、95–145、165–203，E2 四階段、E9 首訪 cause 出現時 intro 已隱藏。程序封面可在圖像失敗時替代。 | 八個細動作不是八個獨立測試，但來源明確實作；不要求重演整個開場。 |
| 入場後不再回塔、不換篇重播；釋放塔資源。 | `proved`。app.js:278、292；intro.js:35–44；E2 repeated=false/released=true。 | 無。 |
| Intro 2／People 9／Model 5／AI 6，22 個可進入獨立島。 | `proved`。E1 全映射，E3 22 個桌面事件，E4 22 個情境。 | 各島對照見 05。 |
| 四章不同地形、色彩、聲音、文化氛圍。 | `incomplete`。world.js:7–12 的章節色、219–344 的場景不同；聲音 app.js:317 永遠同三個頻率，world.js:925 永遠同一鈴聲，沒有章節分支。 | 用現有開關提供四個可辨別且低音量的環境音配置，切島更新、關閉釋放、預設不自動播放。 |
| 同一連續 3D 海面；近距離橋／棧道，章內船／平台／沿岸步道，跨章曲線；相關知識航線。 | `proved`。world.js:191、352–416、595–620；E6 coastLinks 實際含 3 條 coastal-boardwalk、15 條 coastal-boat。規格為替代連接方式，不必再加所有交通工具。 | 船目前是沿航線的靜態實物，規格沒有要求玩家操船，不能憑此重開缺口。 |
| 已探索柔光、未探索輪廓可直達，非等距網格、海岸遠近及海面空間。 | `proved`。world.js:363–384 的固定種子海岸及 exploredLight；:567–575 顯示狀態。E1 固定群聚座標，E6 exploredLightCount≥6。 | 所有草地基底用同一尺寸，外岸有種子差異；大小落差的藝術幅度為 `indirect`，不另發明量化比例。 |

## 03｜美術語言

| 明確要求 | 狀態與實際依據 | 剩餘內容 |
|---|---|---|
| 高級紙本排版材質、黑白影像／抽象人像、花朵、指紋、半色調與像素。 | `proved`。editorial-textures.js、data.js:23–48、world.js:115–172、E7；P01 圖可辨來源半色調與模擬像素人像、紙花。 | 程序圖案不是原刊照片的逐像素還原，原規格允許程序化，不能要求再逐島貼同一套圖。 |
| People 黃綠、Model 粉紅、AI 青藍；溫暖微縮、霧面、自然光、柔陰影、手工建築景觀。 | `proved`。world.js:7–12、48–55、63–98、203–217；所看圖片呈現紙岸與霧面建築。 | 各章地景同為紙岸基底，M05 的指定雙層是已識別具體例外。 |
| 造型反映概念，不能全相同場景／角色；避免霓虹、無意義資料／粒子、過度對稱。 | `proved` 基本場景差異。world.js:223–344 有花園、橋、店、舞台、街頭媒體、劇場、天平、工坊等明確不同構圖；四角色服色／髮色／速度／道具不同。 | 不能以「還可更漂亮」留下永久 open。指定概念缺口只列 M05 與 A03 的可見關係。 |

## 04｜起承轉合

| 明確要求 | 狀態與實際依據 | 剩餘內容 |
|---|---|---|
| 阿綺快速拿到提案，面對價值和相信哪個答案而停下。 | `proved`。E3 I01 cause「提案完成了，價值欄還空著」、action 搬稿、reaction 留空格；E9 首訪真正播放此 cause。 | 無。 |
| People 以人物處境呈現真實、信任、偏好、共同參與、效率與喜歡的差距，包含幽默與不同意見。 | `proved` 內容與事件。P01–P09 各 scene dialogue、lifeEvent、sourceGrounding，E3/E4 不同輸入與實物。 | 「溫度／共鳴」不是新增自動分數；不以測試綠燈代替主觀感受，也不以主觀感受永久阻擋。 |
| People 的問題走向研究、比較證據、模型邊界，不能讓模型承擔全部判斷。 | `proved`。data.js:795–800 的來源段落，M01/M03 事件翻限制、留未知；M03 分類與 M04 修復實際可做。 | 真 UI 的跨章連續性現有 E6 屬引擎證據，需在收尾導航流程核對。 |
| AI 將理解變成服務、內容、Agent 權限；結尾回阿綺提出問題、核對依據、比較取捨、決定下一步，不強迫單一答案。 | `proved`。E3 A06 cause 到 reaction，圖片390-A06-reaction；data.js:1169–1174 ending。回 I01 是自願按鈕，沒有自動付款或強制返航。 | 無需另寫第二結局。 |

## 05｜22 島逐項對照

每列都已從 E1 核對來源 articleId；從 E3 的 `records[island=ID,viewport.width=1280].samples` 讀 cause/action/reaction，final.history 三段；從 E4 的 `matrix[islandId=ID].options` 讀實物效果。下表「事件」描述對應該 JSON 的 caption/props/participants，並非只引用宣告。所有島都有主要人物、核心裝置與 story-exit，來源在 world.js:346–349。未另列時，狀態 `proved` 指基本場景、事件狀態及互動的存在，未宣稱每一張都在本輪重新人工看片。

| 島／原要求 | 當前物件與實際事件證據 | 狀態及有限缺口 |
|---|---|---|
| I01 企劃工作室，效率／價值。 | world.js:224–228。E3 completed-proposal 由 achi 持有後放到 value-sheet 旁；E4 speed/customer/risk。 | `proved`。 |
| I02 兩岸連結，接觸／理解。 | :229–232 的兩建物、橋步；E3「訊息越過橋，問題還留在這邊」，角色分岸；E4 survey/contact/conversation。 | `proved`。 |
| P01 真實／虛擬藝術花園，找來源。 | :233–255 紙花及兩種人像；E3 unmarked-photo 翻面、yingzhen 持有，芬姐勸停；E4 creator/reverse/label。 | `proved`，圖片1280-P01-2026-03-page已看。 |
| P02 商業街區，需求／體驗／行動。 | :256–258 四店面；E3 多路牌、小岳停步、芬姐先問需要；E4 discover/trust/culture。 | `proved`。 |
| P03 策略工作台，串成旅程。 | :259–261 工作台與階梯節點；E3 customer-report 翻面留未知；E4 positioning/value/culture。 | `proved`。 |
| P04 信任橋／查證室，證據影響信任。 | :262–272 橋、證據卡和指紋；E3 draft-story 移到待查盤、最後 owner=null；E4 three-sources/counterparty/hold。 | `proved`。 |
| P05 情境商店，理性與情感偏好。 | :273–276 貨架；E3 recommended-product 拿起，reaction「想起那段日子」；E5 P05 商品握點；E4 value/emotion/context。 | `proved`。 |
| P06 體育場／演唱會，共同參與。 | :277–279 看台舞台；E3 路過、停下、合唱與群體；E4 song/cheer/place/story；E5 同一應援卡交接。 | `proved`，1280-P06-action 已看。 |
| P07 社群巷弄，真實對話擴散。 | :280–284 巷弄、手機、來源紋理；E3 usage photo 與制式介紹比較；E4 detail/source/balance。 | `proved` 基本情境。對話擴散以結果物件呈現，不是可宣稱的真社群預測。 |
| P08 街頭媒體，觀看／參與。 | :285–287 三看板；E3 小岳路過、停留空位仍空；E4 glance/watch/join。 | `proved`。 |
| P09 懷舊劇場／共看廣場，共同記憶。 | :288–292 劇場座位；E3 old-radio 引出群體停留；E4 music/show/sport/talk。 | `proved`。 |
| M01 Persona 觀察室，情境探索。 | :293–300 三台與原始／模擬牌；E3 simulation-card 與 sample-scenario；E4 new-category/known-market/social-shift。 | `proved`。 |
| M02 多渠道地圖，關鍵選擇場域。 | :301–303 六個分布節點；E3 地圖缺觀察的站點；E4 video/search/experience。 | `proved`。 |
| M03 證據天平／決策桌，資料／估計／推測。 | :304–307 天平；E3 precise-forecast 翻面，未知空盤；E4 observed/estimated/unknown。 | `proved`。 |
| M04 分岔服務路徑，顧客下一步。 | :308–310 分岔階梯；E3 hidden-limit 由 fenjie 翻出，未自動修好全部障礙；E4 compare/simplify/assist。 | `proved`。 |
| M05 水上水下雙層，組織阻力。 | :311–314 球／隔板／被遮住下層；E3 上線燈、空白下一步表、芬姐聆聽；E4 fear/guidance/silo。 | `contradicted` 視覺雙層；事件與選項 `proved`。關閉方式見優先2。 |
| A01 服務街，顧客猶豫原因。 | :315–317 三服務建物；E3 delivery-slip 由小岳交芬姐；E4 before-pay/after-order/support；E5 接單。 | `proved`。 |
| A02 人與 Agent 中心，AX 信任。 | :318–320 人／工具兩側；E3 task-board 翻開缺欄；E4 draft/recommend/execute 保留人工權限。 | `proved`。 |
| A03 答案花園與知識圖譜，被理解／記住。 | :321–333 八花及一個 ring；E3 兩答案牌與 distinctive-object；E4 facts/voice/experience。 | 花園、品牌差異 `proved`。場景內「知識圖譜」`indirect`：現建構器沒有可辨識節點間語意連線；全局 ArticleGraph 不能自行當成島內圖譜。有限補法見契約。 |
| A04 創意工坊，品質檢查。 | :334–337 工坊與素材；E3 off-tone-asset 移修改盤，核准欄仍空；E4 brief/brand/reviewer。 | `proved`。 |
| A05 協作工作室，人與 AI 分工。 | :338–340 三工位；E3 local-market-asset 由 achi 交 yingzhen；E4 adapt/culture/final。 | `proved`。 |
| A06 零售／美妝／保健街，行動權限。 | :341–344 三種店面；E3 權限牌、芬姐接手、阿綺停筆；E4 retail/beauty/health。 | `proved`。 |

22 個場景不是 22 張固定資訊卡。來源 switch、arrival cast/props、68 個實物後果可核對；這個已完成部分不重新列入開發待辦。

## 06｜人物細節及對白

| 明確要求 | 狀態與證據 | 有限剩餘內容 |
|---|---|---|
| 四位跨章原創人物，各有指定性格與習慣。 | `proved`。data.js CHARACTERS；world.js:418–439 個別 pace=1.55/2.2/1.05/.7、pen/phone/note/bell；各島 dialogue 及 E3 開場／結尾。 | 無需增加新人物。 |
| 眨眼、轉頭、視線跟隨、眉／微笑／困惑、小動作。 | `proved` 基本實作。world.js:943–957；arrival-events.js:96–119 以實際 actor/prop 位置看向目標、眉及嘴；E5 gazeAlignment=1。 | E5 證明三個事件互看；未逐一測所有眼神不是要求全島再造動畫。 |
| 真實互動桌子、手機、門、椅子、道具。 | `incomplete`。桌、手機與手持道具由 E3/E5 證明；world.js 的建物沒有可操作門葉／門把，椅座只是靜態 mesh，arrival ACTIONS 沒有坐下或開門的接觸。 | 在既有合理場景各補一個門與一個坐椅動作，掌心／門把及臀部／座面有支撐，有限動畫不穿透。不是要求每島都加門椅。 |
| 人物互相目光、選擇不同反應。 | `proved`。E5 接觸時雙向 gaze；E4 68 outcomes 的 actor/prop/reactionText 差異。 | 對於未抽看的結果姿態維持 `indirect`，不把 68 hashes 當 68 次目光審查。 |
| 不同步幅／速度，自然停頓、轉身、重心與個人習慣；獨立狀態機和節奏。 | `proved` 實作。world.js 每 actor.state/stateUntil/phase；:944–957 個別 pace 和步態；arrival-events.js:107–111 walk/hesitate；contact 五階段。 | 「自然」限於已有有界過渡，未做全身碰撞引擎不是原規格要求。 |
| 對白短、具體、有情緒留白／幽默／不同意見；不輪流教條化。 | `proved` 內容抽查及全 22 event captions。例 P05「推薦的很划算，但我記得別的」、P01「先等等，別急著轉出去」、M03「數字很精確」後翻假設。 | 不另造全對白重寫任務。 |
| 虛構人物／對白與作者引言清楚區隔。 | `proved`。data.js:1073 fictional=true、1153 disclosure；index.html:24、26；app.js:355–357 顯示虛構標示，E3 圖可見。 | 原刊來源可對照的界線見11及14。 |

## 07｜八類遊戲、微互動與收藏

| 明確要求 | 狀態與證據 | 剩餘內容 |
|---|---|---|
| 真假查證。 | `proved`。app.js sourceverification 的來源選項與暫緩決策；E4 I02/P01/P04/P07/A03 不同 source props。 | 無。 |
| 購買需求／偏好改變選擇。 | `proved`。E4 P05 value/emotion/context，E5 price/low 的同一商品被拿起；不是預測真實購買。 | 無。 |
| 注意力的被動曝光／主動參與記憶比較。 | `proved`。app attention controls；E4 P08 glance/watch/join 與 M02 選擇場域。 | 這是教學模擬，不是注意力調查或真實成功率。 |
| 共同記憶尋找文化生活細節。 | `proved`。E4 P06/P09 各四選項；票根／收音機／杯子通用條件和獨立場景結果。 | sceneChoice 資料寫 multi-select 但 UI 單選是內部契約差異，Master 未強制此欄多選，不升成原規格缺陷。 |
| Persona 改情境、看模型邊界。 | `proved`。E4 M01 三情境與通勤／居家、窄／混合條件。 | 無。 |
| 衡斷分類真資料／估計／推論／未知。 | `proved`。E4 judgment 類含 I01/M03/M05/A04；每個 scene 專屬物件已不同。 | 無。 |
| 顧客旅程找猶豫點並支援。 | `proved`。E4 P02/P03/M04/A01 的 stage/support 與個別因果。 | 無。 |
| Agent 哪些自動化／哪些人工確認。 | `proved`。E4 A02/A05/A06，app 中 buy/health+auto 保留暫停及人工確認。 | 無。 |
| 所有結果回扣原刊，不捏造民意、行為預測或成功率。 | `proved` 資料連結。data.js:1046–1059 每 outcome sourceArticleId/sourceEvidence；E4 reactionText 與來源綁定，app 顯示虛構標示。 | PDF 逐字核對仍是 `indirect`，詳14；不能只因 sourceEvidence 非空就宣稱正確研究結論。 |
| 每島可發現微互動、適度 hover／環境／人物反應，不能全發光按鈕。 | `proved` 基本行為。world.js:346–349 三種實物；:638 小鈴重播當島獨立 arrival，app.js:349 筆記開原文、exit 接主線；:642 游標提示。E3/E10 事件重播。 | 筆記／出口外觀共用不違反規格；「拉窗簾、敲鈴、點手機」原文是例如，不要求七例每島全套。尚無逐島 canvas raycast 點擊矩陣，列 `indirect` 而非說每島無微互動。 |
| 十種洞察印記是足跡，非能力分數；可略過、重玩，不阻擋閱讀。 | `proved`。data.js:1183–1190、app.js:85–86；immersive-all-islands/results.json.insightFootprints 有十類、每列 stamped=true；E4 replay；E13 無 3D／無任務可直接讀全部。 | 無。 |

## 08｜電影式轉場

| 明確要求 | 狀態與證據 | 有限剩餘內容 |
|---|---|---|
| settle、question、carry、sail、arrival 五段。 | `proved` 引擎。world.js:14、933–938；E6 每條 events 五段。 | 五個 stage 名稱不等於五段人物敘事，見下列指定案例。 |
| 收束前島情緒，問未解問題，物件接線，平滑航行，目標新事件接住。 | `incomplete`。相機及 carry、arrival 已存在；focus:605 在航行前取消前一人物事件，settle 僅 emitStage，沒有要求人物完成一個與前島相關的 exit 動作。 | 在三個指定案例加有限 source exit 動作，並以真正推薦按鈕驗來源問題及目標 cause，不建立新通用劇情引擎。 |
| P01→P04。人物拿疑點影像到海岸，照片線索轉查證路線。 | carry `proved`，前島人物 exit `missing`。E6 photoScale/evidenceCards 確有變化；world.js:495 起的 carryForm 是另建 mesh，沒有由來源人物拿到海岸的接續。 | 接既有照片語意、人物短移動和 carry，目標仍查證。不可把目前 carry 全部報成未實作。 |
| P05→A06。拿商品離店，搜尋／比較／推薦／服務串到權限問題。 | carry `proved`，exit `missing`。E6 14 mesh、serviceSteps；沒有來源人物出店動作。 | 利用既有商品及短 exit，保留實際權限問題。 |
| M01→M03。研究者翻模型結果背面限制，再到天平。 | carry `proved`，來源卡／人物連續 `indirect`。E6 modelCard 翻轉；目前先取消人物事件再播放獨立 carry。 | 源島翻面動作與 carry 使用同一限制語意，真 UI 出發到天平。 |
| CatmullRom 或平滑曲線；相機位置／look target／場景狀態分開插值，連續；短1.5–2.5s、跨章3–5s。 | `proved`。world.js:617–619 duration=1.8/3.6；tick:935–937 分別位置、target、carry。 | 不是強制每條長度按直線距離重新分類。 |
| 前景／海霧／地形／物件轉化避免硬切，目標預備，無固定黑畫面／重播同效。 | `proved` 基礎。fog、獨立 carry 三例及通用 relation 類別；updateLOD(destination) 先準備完整島；無黑幕流程。 | 通用63邊不要求每條另製華麗特效。 |
| 可中止、略過、返回；reduced motion 直達但留文字。 | `proved` 航行中與 reduced 的引擎行為，E6 cancel/skip/reduced。app:298–299 有 DOM 控制。 | 抵達後返回來源缺口 G1；真 UI 的三條新事件串接為 `indirect`，不能引用 E6 假設已驗。 |
| 抵達以事件接住，不能大標題先蓋住。 | `proved` 事件立即開始，E3/E9；contrast.css:43 航行中隱藏標題。arrival 時標題在閱讀面板內恢復，未使用全螢幕標題牌。 | 手機已看 A06 人物在面板上方，不將正常文章標題本身判違反。 |

## 09｜ArticleGraph 與推薦

| 明確要求 | 狀態與證據 | 剩餘內容 |
|---|---|---|
| 原刊下一篇、主線下一篇、兩延伸、返回航線、3D 位置。 | `incomplete`。data.js:1088–1130 生 22 主線＋44延伸；主線允許與原刊順序相同，index previous/next。world 儲存每島座標。 | 返回來源 G1。Master 沒要求主線必須重新排序，不強加另一主線。 |
| ArticleGraph 七欄，六種概念關係。 | `proved`。buildGraphEdge:1004–1005 恰含七欄，SCENE handoff 與 EXTENSION_LINKS 的六類均為手寫概念連結；E1 讀回66邊。 | 無需新圖資料庫。 |
| 原文概念先行，再結合進度，不是標題關鍵字排序。 | `proved` 機制。data.js:785–806 每島段落定位與 rationale，809–898 手寫延伸理由；app.js:113–118 已讀30／近5路線50處罰。 | 理由是否被用對以真UI推薦讀回為 `indirect`。目前主線固定保留並非錯誤，規格也要求主線入口。 |
| 完成後三個目的地與海面航線；問題、理由；hover/focus 遠島亮起與獨特物件；直接出發。 | `proved` 實作與引擎讀回。app:150–160、world:550–575；E6 同時3曲線、獨特 core clone、preview 清除。 | E6 用手造目的地，不等於app三條實際graph全串；在G1既有UI驗收一併讀出目標、理由、preview即可。 |
| 記錄已讀／近期路線，優先未讀相關，可主動重訪；22目錄不孤立。 | `proved`。progress.js:93–99 routes[-30]；app:110–118 ranking，57–87 全目錄；E13 全22可達。 | 沒有保證永遠不出現已讀，不是演算法缺陷；主動重訪是要求。 |

## 10｜故事與自由閱讀

| 明確要求 | 狀態與證據 | 剩餘內容 |
|---|---|---|
| Story 用人物、情境、事件；Explore 全景、搜尋、任意閱讀；共享進度。 | `proved`。world.js:693–701 story 聚焦／explore 全景與標牌，app:306–311 同 progress；兩模式事件與任務均可用。 | 模式不是兩套互斥劇本，Master 沒要求自由模式關閉故事，不新增分支劇情。 |
| 30秒導讀、3分鐘重點、深讀原文、3D互動、相關推薦。 | `proved`。index:25 tabs；app:142 使用 summary/highlights/paragraphs；data.js:974–976 閱讀層級。E8/E13 讀到可用長文。 | 30秒／3分鐘為編輯標籤，不是使用者必須等滿的秒表；未量每人閱讀速度不構成缺陷。 |
| 正式文章 HTML、手機可讀、文字可選、輔助工具可讀；3D不取代長文。 | `proved` HTML、原生article/dialog和18px內文，E13 全文鍵盤。 | 完整螢幕閱讀器宣讀／焦點回復為 `indirect`，目前未取得此實測；可用代表一篇完成而非所有裝置。 |

## 11｜技術與資料架構

| 明確要求 | 狀態與證據 | 剩餘內容 |
|---|---|---|
| 單index入口、原生JS/CSS/ES modules、Three0.160、固定CDN importmap、無React／建置要求。 | `proved` 沉浸應用。index:8固定0.160、:29 module，E13直接static server可執行。 | 根index是redirect，legacy仍用Vite和npm Three0.180；原文「優先維持」不等於必須刪legacy與CI建置，不以package版本誤判沉浸runtime。 |
| 程序3D、Canvas貼圖、外部模型／圖像失敗仍可正常展示、固定seed mulberry32。 | `proved`。world.js:15–17、63–73、219–344；editorial-textures；intro coverTexture；沒有外部模型 loader。 | CDN失敗是2D降級，不宣稱無網首次可生3D。 |
| DATA meta/chapters/articles/islands/characters/scenes/interactions/articleGraph/storyRoutes/visualThemes/progressConfig/i18n。 | `proved`。data.js:1143–1199 以上12個根欄位俱全。原文列的是12欄，不沿用舊文件「13類」。 | 無。 |
| BookIntroTransition、ArchipelagoBuilder、IslandSceneBuilder、CharacterSystem、StoryDirector、InteractionEngine、CameraDirector、TransitionEngine、RecommendationGraph、ReadingSystem、ProgressManager、QualityManager 職責。 | `proved` 職責存在：intro.js；world buildScene/entries/actors/focus/tick；arrival/character-events；app openGame/recommend/renderReading；progress.js；data驗證與錯誤fallback。 | `indirect` 名稱對應。未以12個同名class獨立匯出，不能靠改class名字宣稱產品進步；本文不要求無必要重構。 |
| 完成intro釋放書塔資源。 | `proved` E2與intro清理。 | 無。 |

## 12｜效能、操作、錯誤處理

| 明確要求 | 狀態與實際依據 | 有限剩餘內容 |
|---|---|---|
| 遠輪廓、中簡化、當前完整三層，不22島同時最高。 | `incomplete`。world.js:567–570 僅「當前／目標detail」與「其他silhouette」兩層，沒有中距離判準。E6 detailedIslandCount=1、silhouette=21證明有降級，但不是三層。 | 沿現有同島groups加中距離模型顯示規則，量當前／近／遠各一個可讀回等級，不引入新資源管理系統。 |
| 目標先準備、遠角色不高成本動畫、重複InstancedMesh、共享材質／幾何、dt上限、離場清理。 | `proved`。world:610更新目標、全局cast只在當前島、crowd instancing、geometries/materials maps、tick dt≤.05；arrival.cancel移group；world.dispose釋放共享資源。 | E5/E10已有生命週期證據；整島共享基底保留是快取選擇，不要求每次離島重新載入。 |
| 桌機與手機獨立品質。 | `proved`。world:30 DPR上限手機1.4／桌1.8，:927 FOV手機46／桌40；不同面板。 | 新perf測試需記實際renderer DPR，不能把deviceScaleFactor當渲染pixelRatio。 |
| 滑鼠旋轉縮放點選、觸控拖曳點擊。 | `proved` 實作。OrbitControls:41–47，pointerdown/up:632–640。immersive-npc-touch/results.json encounterOpened、walkPhaseAdvanced 及真觸控NPC。 | 完整拖曳／雙指手勢結果缺明確保存，列 `indirect` 而非宣稱真機全驗。 |
| 模式切換、全景、搜尋、書籤進度、上／下一座。 | `proved`。app:57–118、300–314；E8/E13。 | 返回實際來源島另見G1。 |
| 音效開關、減少動態、手機底部閱讀面板。 | `proved`。app:313–317、index:23、style.css手機dialog；E6 reduced與E8面板。 | 四章音色缺口見02；沒有實際聽音紀錄，聲音效果為程式證據。 |
| WebGL失敗2D閱讀；初始化／CDN／storage錯誤不白畫面。 | `proved`。app:327、368–373、progress:70–86；E13全22，immersive/results[2,3] CDN/data failure文字；E11 contextLoss後可讀。 | 所有按鈕有功能仍被2D replay反證，見G3。 |
| 桌面／手機順暢互動及效能驗收。 | `indirect`。E12只一舊模擬profile，不能外推全頁。 | root整合獨佔新baseline及追加2秒門檻；真機未驗標明即可，不新增所有GPU義務。 |

## 13｜六階段交付

| 階段明確要求 | 狀態與證據 | 剩餘內容 |
|---|---|---|
| Phase1解析22原文、內容、場景、人物、故事與關係。 | `proved` E1，source JSON/body provenance，data.js各registries。 | 來源PDF人工逐字範圍見14。 |
| Phase2開場、四島海面地形天空光影、相機。 | `proved` E2、world幾何與curve；不是示意截圖。 | 無。 |
| Phase3四角色狀態動畫、22基本場景。 | `incomplete` 基本場景與角色已證，M05可見雙層、門椅細項尚缺。 | 上述有限world切片。 |
| Phase4文章、八類、微互動、收藏。 | `proved` E4/E8/E13及十印記。 | 2D無效控制修正。 |
| Phase5關係、跨島、情境銜接、主線及起承轉合。 | `incomplete` 基本全部存在；返回來源、三指定route人物exit缺口。 | 以真DOM三條路線驗物件和問題接續。 |
| Phase6桌面手機、觸控鍵盤、動畫資料效能實測。 | `incomplete` 現有真Chromium與本次2D操作皆有效；完整鍵盤、追加效能門檻、最新live證據仍未整合。 | 只補相應缺證，不把所有既有套件無差別全重跑當完成條件。 |
| 每階段可執行版本。 | `proved` 現在原生static版本可跑，歷史文件含多個切片版本及具體產物。 | 歷史每一commit的可執行性屬`indirect`，不為考古重建全部版本。 |

## 14｜正式驗收及交付

| 原規格驗收列 | 狀態及證據／缺口 |
|---|---|
| 書塔只入場、四群島22島存在。 | `proved` E1/E2/E9。 |
| 每島明確文章意義與獨特視覺。 | `incomplete`。22 scene與來源已證；M05指定雙層未可見，A03島內關係圖譜只有間接證據。 |
| 全文可讀。 | `proved` E13全22。HTML為核對後正文；supplementaryParagraphs在既有獨立閱讀頁和PDF，immersive全文窗未展示該補充區，不能宣稱還原所有圖表排版。 |
| 人物個性表情動作事件反應。 | `incomplete` 基本成立；門與椅子動作精確欠項見06。 |
| 八類可操作。 | `proved` E4/E5，沒有用文字選項數取代實際結果幾何。 |
| 完整起承轉合。 | `proved` 22節點內容與開／結尾事件；三條前島exit連續性仍是08欠項。 |
| 自然連續航行、結尾推薦、概念理由、自由／主線。 | `incomplete`。相機、推薦、模式已證；返回來源及真UI三指定路線尚需閉合。 |
| 所有資料與原刊可核對。 | `indirect`。原刊分篇PDF存在；paragraphSources保存頁碼欄位，data.js:981–1001回指精確正文。`scripts/import_library.py:354–365` 實際排除7段未核對文本、保留132段ambiguous到補充；`2026-source-audit.json` 明列各篇數字。本文沒重新解析PDF，不將 JSON 自證或舊報告當本輪逐字校稿。可核對性存在，來源語義全面正確尚非本輪已證。 |
| 虛構與證據區分。 | `proved` index:24/26、data.meta disclosure、E3圖片。 |
| 手機順暢閱讀互動。 | 閱讀`proved` E8/E13；所有頁面2秒與長時流暢`indirect`，由perf整合。 |
| 所有按鈕實際功能。 | `contradicted` G3。其餘app handlers皆可追到狀態變更，但不能據此說逐按實測完成；按鈕清單與來源在index:18–27、app:295–326。 |
| 沒有阻斷操作JS錯誤。 | `proved` 在已測路徑E3/E4/E8/E13 errors=[]；不保證所有瀏覽器所有路徑。 |
| 無3D仍2D閱讀。 | `proved` E13全部22篇。 |
| 完整可執行index、說明、驗收結果、已知限制，不以規劃冒充完成。 | `proved` 可執行入口與GUIDE、PROGRESS及本文；最新部署`indirect`由root接手。原生應用必須連同modules/data/fonts等目錄交付，單獨傳一個index不會離線自足。 |

## 15｜最高創意要求的有限判準

| 原要求 | 狀態與可審核依據 |
|---|---|
| 文章成地方、觀點成體驗、人物成朋友、知識成航線。 | 基本`proved`，以22獨立場景、68可見後果、四個跨章角色、66概念邊作具體證據。情感滿意度不偽裝成量測，也不設「永遠再打磨」關卡。 |
| 不必回目錄或每篇重開；人物疑問和未解情境可去另一篇找線索。 | `incomplete`。推薦直接focus且不重播intro已證；抵達後沒有來源返回、三指定exit不足是可修的連續性缺口。 |
| People記憶到Model再到AI應用，完整電影連續性／探索感／編輯品味／人物溫度。 | 內容路線及事件`proved`；完整真UI連續片段`indirect`。關閉方式是驗一條既有跨章線索及三指定route，不要求重新設計22島或拍整部電影。 |

## 解鎖後的兩支最小修復契約

本節依主協調者後續指示整理。必須先等其效能 baseline 結束才動網站來源。這是可執行範圍，不是本葉節點已完成的程式修改。不建立新架構或新人物。

| 分支與唯一寫入範圍 | 可開始工作、輸入與輸出 | 驗收及立即回報 |
|---|---|---|
| Luna。`public/immersive/app.js`、`index.html`、`style.css`／`contrast.css`，自己的新增定向測試。 | 保留原刊previous/next，加入抵達後「返回來源島」；2D重播提供文字事件或明確停用3D控制；沿用既有sound勾選，以current article.chapter派生四章聲音。現有world.setSound只保留互動鈴聲即可，勿同時改world。音色設定暫放app純資料，無須data.js新schema。 | 真UI P01→P04→P01與P05→A06→P05、取消／略過／reduced／2D、閱讀筆記及結果恢復。2D22全文維持。切島聲音能分辨，未勾不autoplay；開關與連續切島不累積oscillator，關音stop+disconnect，AudioContext失敗有文字。若需要world新介面先回報，不跨檔搶寫。 |
| Sol。`public/immersive/world.js`、`arrival-events.js`、`character-events.js`，自己的新增定向測試。 | M05將既有顧慮／隔板放到可見上下層；現有groups補遠／中／當前3級LOD；利用既有接觸rig在一個合理場景加門、一個合理場景加坐椅；A03以已有facts/voice/experience及sourceGrounding產生有限來源、品牌、體驗節點和可辨關係線。A03目前建構器只有八朵花與ring，沒有上述關係，不能以全局ArticleGraph補名義證據。 | 390/1280可見M05水線和兩層，既有arrival與3選項不倒退。相機由近到遠讀回三等級、當前互動仍完整、目標預備。手接門把後門轉、人物坐到座面且有支撐。A03線連到明確不同節點且與文章既有三概念一致，不杜撰事實。共用rig變更需重驗P05/P06/A01接觸及受影響arrival。 |

`data.js` 仍以單一寫入者為準。以上工作可先消費既有 scene/outcome/sourceGrounding，不必兩支同時修改資料。若門椅或章節音色確需新欄位，由 root 明確指定一位 writer 及最小欄位後才編輯。不得以本文件的建議擅自重設所有資料。

三指定轉場的來源exit是另列的有限欠項。若 root 併入 Sol，本輪只處理 P01→P04、P05→A06、M01→M03 三對，在現有settle/carry中使用既有角色與物件語意；app不用新API。若會影響Sol當前交付或效能baseline，先回報root排順序。驗收必須由真正DOM推薦入口及DATA edge出發，不沿用硬寫同一句問題的engine fixture作唯一證據。

## 尚待整合的證據，與不應重開的工作

1. 最新 source、CI、公開頁資產及真UI讀回由 root 提供。本基準不因部署pending而宣稱live已驗，也不自行重查GitHub。
2. 使用者追加「所有頁面／互動2秒」由專屬perf工作給出凍結版本、三次條件、範圍、分布及瓶頸。E12單次1.875秒不是全站達標。應區分冷啟動首可用、刻意8.6秒intro、刻意1.8/3.6秒敘事航行，以及點擊後回饋延遲。
3. 代表完整鍵盤流程仍需一條真Tab順序到目錄、閱讀、任務、推薦、返回；目前E13只證明被focus的按鈕可Enter、dialog可Escape。3D角色僅pointer可選，讀者有主任務入口；若要聲稱四位人物對話都鍵盤可選，需提供對等DOM入口，不能僅靠canvas aria-label。
4. 來源內容本次只核讀已公開正文、provenance和匯入邏輯。132段補充與7段排除的已知邊界應保留。逐字校稿及圖表語義若無新實測不得寫成完成。
5. 已完成的68選項、22三段arrival、3代表接觸、6島原刊語彙、橋／船、8類遊戲、10印記、2D22全文與離線模組不重新列開發工作。修復只重驗受影響介面與已識別缺口。

本次採 Prove It Works，將manifest宣告、JSON狀態、真UI與圖片分開。採 Explain the Number，保留profile條件、量測差異及單次限制。已讀how與unslop，在葉節點範圍直接完成，沒有再派代理或宣稱做過可選外掛審查。

throughput checkpoint: n/a, read-only investigation

本文完成的是全規格證據審查與有限修復契約。網站整體完成狀態由主協調者在缺口修復、效能與最新公開讀回後決定。

## 整合追記：8a6b542（公開部署前）

以上保留 0aaf946 歷史審查；以下只追記後續修復，不改寫基準證據。

| 有限缺口 | 修復與本機證據 |
|---|---|
| 返回實際來源島、2D 控制、四章音色、手機閱讀推薦 | 95a6f7c；navigation-ui、fallback-controls、sound browser 測試通過。手機真觸控一次啟動推薦，固定閱讀高度避免按鈕移位；不丟筆記。 |
| 三層 LOD、延後建立完整場景 | 58a6913；初始僅當前完整場景，22 島仍可達；效能三次結果另見 IMMERSIVE-PERFORMANCE.md，尚未達兩秒。 |
| M05 水面下顧慮、A03 語意節點、門與坐椅接觸 | 8a6b542；test-results/immersive-world-quality/quality.json，390 與 1280 圖片及互動讀回。 |
| 三指定航行的來源人物離場、實際推薦與返回 | 8a6b542；routes.json，真 DOM 推薦及來源返回；不是僅呼叫 world 測試。 |
| 閱讀中語意微縮預覽、資源釋放 | previews-390.json、lod.json；Tab／hover 保留捲動與筆記，停止持續繪圖；自有資源及 renderer textures 歸零。未宣稱私有 programs 陣列為零。 |
| production build、入口與離線快取 | 隔離快照 decision-integration.c7LwVK 建置通過；immersive-entry-integration-B/results.json 證明 28 項核心快取、11 字型、2 CDN、根及子路徑離線重開。測試清單補回 arrival-events.js，沒有放寬快取驗收。 |

本追記尚未代表最新公開 CI／瀏覽器驗收。兩秒啟動、完整鍵盤路徑及逐字內容校對的原有證據限制仍保留。

## 後續整合追記：鍵盤路徑與啟動等待

保留上方歷史基準及公開驗收限制，不把新證據倒填為舊版本已完成。

- 鍵盤切片 2234e93 的 390×844／1280×800 真 Tab、Shift+Tab、Enter、Space、Escape、PageDown 已完成。可在原文中段停留、記筆記、完成主角情境、推薦 P01→P04、返回 P01→I01。手機真 tap 維持相同按鈕尺寸，沒有 pageerror。證據是 test-results/immersive-keyboard-path/results.json；不是 DOM focus 或 click 代按。這補上先前 Phase6 代表完整鍵盤路徑的間接證據。所有人物名單與實體螢幕閱讀器仍不在本次驗收範圍。
- 啟動切片整合 e0351fb／557ca2b，先提交可見材質，再等待原刊字型及 redraw。獨立審查拒絕了會等待所有字型 settle 的原候選，最終修正有一字型拒絕且另一永久 pending 的真測試。四案例自有資源、listener、RAF 均釋放；見 test-results/immersive-startup-overlap-final/results.json。
- 五次反向交錯的基準首互動中位 3314 ms，候選 2948 ms，詳見 IMMERSIVE-PERFORMANCE.md 與 test-results/immersive-startup-ba-final/。這是固定模擬條件的改善，不能宣稱全站兩秒或所有操作加速。任務中位略高的旗標保留。
- 最終整合 production build 通過，built entry 離線重開通過，核心快取 28 項、字型 11、CDN 模組 2、missingOptional=[]。當前仍有完整 22 島及 3232 字代表原文；離線 P01 編輯貼圖累計 4，dispose 自有資源歸零。見 test-results/immersive-entry/results.json。該測試未限速的 1721 ms 不替代上述受限環境結果。
- intro 改為原生 modal 後，built preview 的兩尺寸 cover／tower／coasts／world、完成後釋放、不重播及真略過均通過；見 test-results/immersive-intro/results.json。手機 tower 圖已人工檢視，字幕、略過及焦點可見。
- 原生及根快取版本分別更新為 2026-10-24.14／v10；node --test tests/immersive-cache.test.mjs 9 項及 tests/browser-cache.test.mjs 18 項通過。更新不清除 localStorage 筆記。

本追記撰寫時尚未推送這批整合修改。公開 Pages／CI 由後續讀回確認；兩秒目標仍未達，不將整體目標標記完成。

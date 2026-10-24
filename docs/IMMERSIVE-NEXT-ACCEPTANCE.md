# 逐島選擇、人物事件與原刊語彙驗收

本文件是 `e617b7f9a3a2ba17492bec81063ac0d348a0c6db` 的缺口審查及下一切片契約。網站程式未在本次審查修改。公開 UI 版本 `45025f2` 是協調者提供的已發布背景，本次沒有重跑公開網站或啟動 GPU。

原規格為 `/Users/lewis/.codex/attachments/42c074c6-3663-4e3b-8828-98eee69be234/pasted-text-1.txt`。重點條款是第 03、05、06、07、08、14 節。採 SOP B，2026-10-24 由 Notion 即時讀取。模型與委派依當次 AGENTS 規則。這是葉節點 Investigation，只寫本文件，沒有再委派。

throughput checkpoint: n/a, read-only investigation

## 現況判斷

22 島的文章、主要道具、任務完成與回饋文字已存在。真正阻礙體驗的是各島選擇尚未驅動各島故事。先修復這個因果，再補上接觸、目光與原刊材質。

| 優先 | 缺口 | 目前證據 | 下一個可觀察結果 |
|---|---|---|---|
| 1 | 各島專屬選擇只改文字，生活事件尚未演出 | `app.js:189-193,236-255` 送出 `scenarioChoice`，`world.js:533-601` 完全不讀它。`lifeEvent` 只進入 DOM 文字，`finish()` 只觸發首句對話 | 固定遊戲條件，只換島內選項，人物、場景物件或動線必須產生有意義差別 |
| 2 | 人物拿物、桌面接觸與互相目光缺少空間約束 | `world.js:301-307` 道具掛在角色根節點，手臂與道具各自轉動。`629-637` 用週期搖頭，`520` 對話朝向相機 | 手能碰到物件，交接物件在兩人之間連續移動，說話和聆聽的角色看向對方 |
| 3 | 原刊黑白影像、花朵、指紋與半色調沒有成為場景線索 | `world.js:58-72` 只有紙岸粗糙度。P01 在 `145` 有花形幾何。`data.js:23-28,652` 的 visualThemes 沒有被 world 消費 | 來源照片、花瓣、指紋與印刷網點成為可辨識且有敘事用途的場景物件 |

## 優先 1 的確定缺陷與修復契約

### 八類 payload 的實際對照

`choices` 是遊戲條件。`scenarioChoice` 是每篇文章自己的問題選項。兩者都由 `app.js:255` 傳入 `world.applyInteraction()`。八類通用 `choices` 的字串大致相符，不能把這個問題報成全面的字串拼錯。確定缺陷是第二層選項遭忽略。

| 類型及島嶼 | app 實際 choices | world 目前辨識的分支 | 專屬選項失效造成的體驗 |
|---|---|---|---|
| sourceverification。I02、P01、P04、P07、A03 | `[use或hold, ...已開啟的當島option.id]`，`195-200` | `550-555` 只看第一值是否 hold 及已開啟數量。相同數量的不同證據得到相同卡片 | 原始發布者、版本比對、生成標記的差別只有文字。I02 的接觸與理解、A03 的品牌聲音也都變成同一查證桌 |
| purchase。P05 | `[price或familiar或service, low或high]`，`201-204` | `556-561` high 選熟悉商品，否則 price 選低價，其餘選服務 | value、emotion、context 不影響場景。固定 price/low 時選 emotion 仍只演低價商品 |
| attention。P08、M02 | `[passive或active, human或speed或unknown]`，`205-210` | `562-567` 判斷 active 和 human | P08 的 glance、watch、join 與後續接觸方式成為兩套脫節選擇。M02 的 video、search、experience 都是同四塊看板 |
| memory。P06、P09 | `ticket、radio、cup 的子集合`，`212-216` | `568-571` 只生成票根、收音機、杯子 | P06 的 song、cheer、place、story 沒有合唱、應援或人群反應。P09 的 music、show、sport、talk 也沒有不同共看場景 |
| persona。M01 | `[commute或home, narrow或mixed]`，`217-220` | `572-578` 產生通勤或居家背景，以及一張或三張證據 | new-category、known-market、social-shift 不改研究物件與模型限制的可見位置 |
| judgment。I01、M03、M05、A04 | 四項 `data、estimate、inference、unknown` 分類值，`221-224` | `579-584` 只將四卡放入四格 | M05 的 fear、guidance、silo 完全沒有文化阻力反應。M05 還使用 8 人到場、12 張椅子的通用題，與原場景不連續 |
| journey。P02、P03、M04、A01 | `[find或compare或confirm, ad或explain或human]`，`225-228` | `585-591` 判斷站點及是否移開障礙 | A01 選 after-order 仍只有購買前的三站。P03 定位、價值、文化與 M04 簡化流程也沒有各自道具改變 |
| delegation。A02、A05、A06 | `[draft或buy或health, suggest或confirm或auto]`，`230-232` | `592-598` auto 加非 draft 會暫停，confirm 會等待 | A02 工作可見性、A05 在地文化、A06 零售、美妝與健康場景仍是同一工作桌 |

本次把目前 `applyInteraction()` 原函式擷取至記憶體，使用位置、旋轉、縮放的替身物件求值，沒有建 renderer。對每島固定一組合法 `choices`，逐一更換其所有 `scenarioChoice`。結果為 22 島、68 種選項，每島都只有 1 種相同的 3D 狀態。此結果證明函式忽略選項，不代替瀏覽器圖像驗收。搜尋 `scenarioChoice` 在 `world.js` 亦為零筆。

現有 `tests/immersive-all-island-actions-browser.mjs:20-37` 每島點最後一個按鈕，驗證完成、回饋長度與印記。它沒有更換 `#scene-choice`，也沒有檢查世界效果，因此不能用它證明這 68 個選項有效。

### 最小資料與介面

沿用 `interaction.outcomes`。每個 outcome 加一個 `visualEffect`，不用新建通用劇情框架。`buildData()` 的 `data.js:531-535` 已展開 outcome，新增資料會傳到場景。

```js
visualEffect: {
	id: 'P06-cheer',
	actorId: 'yue',
	propId: 'cheer-card',
	action: 'exchange',
	reactionText: '小岳把應援卡交給阿綺，兩人看向舞台。'
}
```

`id` 是可讀回的效果識別。`propId` 對應當島具名物件。`action` 是該效果的可見動作，不以畫面提示字取代。`reactionText` 是虛構改編的動作描述，需和真實演出的效果一致。效果可以在現有 `world.js` 內按 islandId 與 effect.id 分支，不要求跨模組重構。

`applyInteraction(articleId, { kind, choices, scenarioChoice, before })` 保留現有介面。先還原 baseline，再套遊戲條件與專屬效果。`current.interaction` 必須保留 `scenarioChoice`、`effectId` 與目前效果狀態，因為 `placeCast()` 在 `world.js:426` 會重建已完成場景。目前 impact 在 `543-545` 丟棄 scenarioChoice，僅在首次呼叫處加入分支仍不足。

`finishGame()` 目前在 `app.js:238` 先取通用結果第一句作為人物泡泡。專屬效果完成後，泡泡改用對應 reactionText。完整來源回饋仍保留既有 outcome.text 和 sourceEvidence。比較前後、晚載入同步、離島返回都必須重建同一選項。

P06 與 P09 的 control 宣告 `multi-select`，但 `app.js:189-194` 一律做單一 select。第一切片可先完成單一專屬選擇的可見因果，必須保留「規格多選尚未完成」標記。若改成多選，另外明定 `scenarioChoices: string[]` 的取代契約後再改，不能偷偷把陣列塞進現有字串欄位。

### 22 島全部專屬選項的具體效果

下表是下一輪實作的效果契約，並非現有功能。每列只列該島的選項差別，仍保留原本八種玩法的條件與證據限制。道具增減、移動、翻面與人物位置必須在 3D 中可辨識。

| 島 | 實際 option.id 與預期可見效果 |
|---|---|
| I01 | `speed`。阿綺把完成稿疊在左側，價值檢查表維持空白。`customer`。阿綺將使用者問題卡推到桌面中央。`risk`。映蓁把來源卡與責任卡放到提案旁 |
| I02 | `survey`。調查卡放到橋的研究端。`contact`。送達紀錄疊高，對岸人物仍停下。`conversation`。兩人走到橋的兩端，面向彼此並留下問題卡 |
| P01 | `creator`。翻開照片背面的來源欄。`reverse`。兩個不同版本並列。`label`。揭開生成標記，仍保留待核對卡 |
| P02 | `discover`。入口資訊牌轉向街口顧客。`trust`。芬姐把使用條件交給顧客。`culture`。顧客走向可參與的街角活動桌 |
| P03 | `positioning`。定位卡放在工作台中央。`value`。商品價值與使用者疑問卡並列。`culture`。文化情境卡接到旅程上的具名節點 |
| P04 | `three-sources`。三張獨立來源卡並排。`counterparty`。相反立場卡放到證據桌另一側。`hold`。稿件移入待查盤，通往發布端的欄杆保留 |
| P05 | `value`。價格與用途標籤朝向小岳。`emotion`。小岳翻看商品旁的生活照片。`context`。芬姐把即時取得與服務條件放到貨架前。最後拿走的商品仍由 need/preference 決定，不把情境選項直接當成購買預測 |
| P06 | `song`。小岳停步面向舞台，旁邊居民一起抬頭唱完一段。`cheer`。小岳與阿綺交換應援卡。`place`。人群停在看台而非繞島。`story`。小岳拿照片面向阿綺重述經驗 |
| P07 | `detail`。手機的使用步驟卡展開。`source`。留言者的經驗來源卡翻面。`balance`。優點與限制卡同時出現，不能只多一張通用證據卡 |
| P08 | `glance`。小岳經過看板後繼續走。`watch`。小岳在看板前停留。`join`。小岳到攤位親手移動一塊文字板。與後續 passive/active 選擇衝突時，介面需解釋哪個是場景、哪個是實驗條件 |
| P09 | `music`。收音機旁有兩個世代的居民停下。`show`。劇場布幕拉開，居民面向螢幕。`sport`。賽事票根放上共看桌，人物交換應援。`talk`。人物面向彼此，照片在手與桌面之間移動 |
| M01 | `new-category`。新產品卡旁保留空白樣本槽。`known-market`。兩個包裝方案與既有訪談卡並列。`social-shift`。舊情境卡翻到背面並露出待更新標記。commute/home 與 narrow/mixed 仍影響場景和邊界 |
| M02 | `video`。影音場域的觀看裝置展開。`search`。搜尋桌出現問題卡。`experience`。實體體驗桌與參與人物出現。三者位於地圖不同節點，不能都用同一排看板 |
| M03 | `observed`。原始觀察紀錄放在天平一側。`estimated`。假設卡和估計卡連在一起。`unknown`。未解問題卡留在空盤，不能自動補成證據 |
| M04 | `compare`。比較與限制牌展開。`simplify`。多餘步驟板移出行進路徑。`assist`。芬姐到顧客旁並指向下一個服務站 |
| M05 | `fear`。員工顧慮卡從水面下翻出，芬姐停下聆聽。`guidance`。主管的下一步工作表維持空白，阿綺把問題卡放上去。`silo`。水面下兩個部門各自握有一半資訊，連線停在界線。分類題也改成同一虛構組織情境 |
| A01 | `before-pay`。顧客在結帳資訊板前核對條件。`after-order`。已下單包裹與配送、退貨單移到服務窗口。`support`。芬姐走到顧客旁接過服務單。ad/explain/human 仍決定問題是否被回應 |
| A02 | `draft`。草稿停在透明任務桌，來源卡可見。`recommend`。兩個建議與限制卡並排等候核對。`execute`。隱藏進度板被翻出，缺漏版本顯示為待確認。不得繞過既有 authority 所要求的人工確認 |
| A03 | `facts`。答案花園展開來源牌。`voice`。品牌獨有圖形與故事牌移到答案前景。`experience`。宣稱卡與實際使用卡並列讓小岳核對 |
| A04 | `brief`。素材疊在任務規格旁比較。`brand`。不合語氣的素材移到修改盤。`reviewer`。來源與最終核准卡放到成品前，核准鈴維持待確認狀態 |
| A05 | `adapt`。已核准版型分成多尺寸卡。`culture`。兩個市場的文化卡並列，阿綺停在需要人判斷的位置。`final`。最終內容與權利卡交到人工核准桌 |
| A06 | `retail`。購物籃與結帳權限卡出現。`beauty`。美妝資訊與門市諮詢卡出現。`health`。保健資料與人工確認卡出現。原有 buy/health 加 auto 的暫停邊界必須維持 |

### 第一個交付切片

先實作 P06、M05、A01，分別覆蓋共同參與、組織暗流、售後服務。這三島對通用模板的依賴最明顯，且三組畫面差別可以直接辨認。完成這三島不代表其餘 19 島已完成。

唯一網站寫入者持有 `public/immersive/data.js`、`public/immersive/world.js`、`public/immersive/app.js`。另一名測試工作者若被主代理指派，只寫新增的 `tests/immersive-scenario-choice-browser.mjs`，依上述現有 API 契約測試。世界檔案不可同時派角色或材質工作者寫入。主代理已將全 22 島選項因果修復交給 `scenario_visual_causality`，這三島是建議的先行驗收順序，交付範圍仍是全 22 島。

可檢查的行為驗收如下。

1. 在真瀏覽器用 DOM 控制選項，不直接呼叫 world API 作為唯一證據。P06 固定同一組記憶物件，更換 song、cheer、place、story。四次可見場景不同，且角色泡泡對得上動作。
2. M05 固定四張分類卡的分類，分別選 fear、guidance、silo。三次顯示不同組織阻力。題目不可仍是活動到場人數與椅子數量。
3. A01 固定 compare/human，分別選 before-pay、after-order、support。配送包裹只在售後情境出現，客服接手要有芬姐和顧客的位置關係。
4. 每次檢查 `getState().interaction.scenarioChoice` 和 effectId，再對照截圖或短錄影。只有 effectId 改變而人物、道具不變，仍判失敗。
5. 比較「選擇前」必須還原未完成的事件與道具。切回「選擇後」、關閉結果後重新開啟、離島返回、world 晚載入同步都不能遺失專屬選項。哪些是保留結果、哪些是開始重玩，需沿用目前按鈕語意。
6. 390×844 手機畫布與 1280×800 桌面都能看到差異。維持目前結果面板高度、44px 操作、閱讀原文和筆記返回流程。
7. reduced motion 直接呈現同一語意的結果姿態與道具。動畫中離島必須清理事件，不在下一島續播。

## 優先 2 的人物與生活事件契約

目前 22 島都有生活事件文字，但沒有逐島事件時間線。`world.js:429-432` 只取首句對話，所有角色共享 observe、walk、think、compare 的週期規則。`scene-bell` 在 `216` 被標成 event，點選後 `470` 只加通用 reaction，`app.js:335-339` 最後仍開同一任務視窗。不能將這些反應列為 22 段獨立生活事件完成。

`world.js:301-303` 的手臂與道具都是 actor.root 的直接子物件。沒有 hand anchor、grip anchor、桌面接觸點、接觸時段或放下後的支撐面。`520` 與 `630` 的朝向也沒有角色目標。此缺口套用全部 22 島。只有筆、手機、紙張、小鈴的不同轉動節奏已存在。

下一切片由同一個 world.js 寫入者處理。為既有 actor 增加左右手錨點，為會被拿取的具名道具保留握點與桌面放置點。當下事件只需要 `approach → contact → hold → release → react` 的有界狀態，不要求骨架或通用物理引擎。每個 event 指定參與 characterId、propId、對方 characterId 與有限的階段時間。非參與人物仍保留自己的 idle 節奏。

驗收先選 P05 拿商品、P06 交應援卡、A01 接過服務單。每項在接觸時讀回手錨點與物件握點距離，建議容差不超過角色頭寬的四分之一，並從鏡頭檢視穿透。交接中物件不能瞬移或重複出現在兩手。放下後不得隨角色移動。目光以對方 head 世界座標決定，在說話和回應的停頓時段互相看向對方，不能以兩人同看相機算通過。

事件至少包含一個可觀察的起因、一個動作與一個反應。例如 P06 是走過舞台、停下、交換應援、一起看台上。P05 是比較貨架、拿起、回頭看另一個選擇。A01 是顧客拿包裹返回、芬姐接單、指向配送說明。其餘 19 島以本文件選項表的動作為基礎補齊，逐島保存起始、接觸、反應三個時間點。這是全部 22 島的原規格欠項，不能只完成代表三島後刪除。

## 優先 3 的原刊語彙契約

已直接查看既有 `test-results/immersive-ux-journey/desktop-home.png`、`mobile-result.png` 與 `test-results/immersive-navigation/P01-P04-carry.png`。這些圖顯示霧面幾何島、簡化樹木與角色已成立，但來源照片多為純色幾何，P01 的花是扁球形。它們是既有截圖，沒有據此宣稱本次重新驗收線上畫面。

已查看 `public/assets/cover-2026.webp`。封面可辨識黑白抽象頭像、數位字符圖像和紙纖維。`chapter-people-2026.webp` 顯示黃綠色編輯框與紙纖維。指紋與花朵的必做依據來自原規格第 03 節，並非這兩張原刊資產都已展示這兩種圖像。

最小資料可在既有 visualThemes 加 `editorialMotifs`，每項只需 motif 名稱、配色、seed 與允許使用的場景道具。world.js 的唯一寫入者建立一次可共享的 CanvasTexture，套在已存在的照片、海報、來源牌與工作表，不讓每島都新增同一座裝置。

| 語彙 | 第一個有敘事用途的位置 | 可檢查行為 |
|---|---|---|
| 黑白影像或抽象人像 | I01 工作室提案稿、P01 來源照片、P04 版本對照 | 翻面前可辨識影像，翻面後顯示來源。原始圖像失敗仍有程序化替代 |
| 花朵 | P01 真假來源花園、A03 答案花園 | 至少可辨識花瓣、花心與紙雕層次。P01 來源牌附在花上，A03 不同品牌的花保留可見差異 |
| 指紋 | P04 來源留痕卡、P07 使用者經驗牌 | 指紋是可辨識的弧線紋理，表示來源線索，不能暗示已驗證真實身分 |
| 半色調與數位像素 | P01 不同版本的影像、M01 模擬結果卡 | 原始與模擬版本能從網點或像素排布分辨。不可只提高粗糙度冒充半色調 |

固定 seed 下輸出一致。貼圖在多島重用，dispose 後釋放。以同一鏡頭的前後圖驗收，不用渲染統計代替圖像檢查。這個切片在優先 1 和 2 的 world.js 寫入結束後開始，避免三項工作同改一個檔案。

## 已完成、未驗證與整合事項

已完成並驗證本次審查的來源讀取、22 島 68 個選項的靜態盤點、真實函式的無 GPU 求值、三份既有場景截圖與兩份原刊資產檢視。沒有修改網站程式、commit、push 或部署。

尚未完成的是本文件全部修復契約。沒有新瀏覽器或真機驗收，沒有逐島動畫錄影，沒有對原刊所有頁面的圖像做完整藝術校稿。既有截圖不代表這些修復已完成。

主代理已指定網站三檔的唯一實作者。先檢查 P06、M05、A01 的完整選項旅程，再驗全部 22 島。通過後更新 `IMMERSIVE-PROGRESS.md` 的相關列，仍保留尚未具備動作證據的生活事件、人物接觸、目光與原刊語彙欠項。

本次實際採用 Experience First 決定先修使用者選擇的可見因果。Prove It Works 使「文字變了」和「世界變了」分開驗收。Sequence Work into Verifiable Units 使第一批縮到三島後再展開。已讀 how、no-comments、technical-writing、unslop 的適用指示。葉節點依當次委派限制不啟動額外審查代理。沒有執行 deslop 或提交，不宣稱該外掛審查完成。

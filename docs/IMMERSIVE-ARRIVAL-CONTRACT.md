# 22 島入場生活事件契約

2026-10-24。基準為 `5c474c9`。本文件是完整 Master 第 04、05、06、07.2、08 節的實作與驗收契約，不是功能完成紀錄。原始規格位於 `/Users/lewis/.codex/attachments/42c074c6-3663-4e3b-8828-98eee69be234/pasted-text-1.txt`。沿用主協調者本任務已即時讀取的 Notion SOP B。資料、狀態引擎和最終畫面分別驗收。

## 現況與要補的觸發鏈

`data.js` 的 22 個 `lifeEvent` 已有不同的起因，且各自連到 `transition.question` 和 `transition.visual`。`buildData()` 現在只把 `lifeEvent` 複製為文字。不能把這些文案計為 22 段演出。

現有實際鏈如下。

| 入口 | 基準程式的行為 | 缺口 |
|---|---|---|
| 抵達島嶼 | `app.visit()` 呼叫 `world.focus()`。`finish()` 執行 `placeCast()`，再取第一句對話，讓說話者抬手 | 沒有把該島生活事件演成起因、動作與反應 |
| 點小鈴 | `world.onUp()` 先呼叫 `applyInteraction({kind:'event'})`。此 payload 沒有 choices，只給所有角色通用 reaction。`app.onObjectSelect()` 隨後落入 `openGame()` | 小鈴仍是開任務窗，不能獨立觀察故事 |
| 完成選擇 | `finishGame()` → `applyInteraction()` → `renderScenarioEffect()` → `characterEvents.start()` | 這是選擇結果。它不會在抵達時發生，不能兼任入場事件 |
| 角色接觸 | `character-events.js` 有 approach、contact、hold、release、react。大部分拿物固定在共同前方桌面，參與者推定自現有 dialogue | 不能只把 22 個入場文案傳給同一拿卡片動作。場景走位、真正物件、觀察對象和群體反應仍要來自各島 |
| 重新抵達 | `placeCast()` 用 `current.interaction` 重新套用 settled 結果 | 入場事件不得破壞此行為或讓已完成的遊戲倒退 |

`IMMERSIVE-NEXT-ACCEPTANCE.md` 記錄的 68 選項缺陷已有後續切片修復。`IMMERSIVE-PROGRESS.md` 也保留了三島接觸和六島材質的實測證據。這些既有成果是本契約必須保留的基準，並不是本次入場故事的驗收。

本次只檢視既有 `1280-P06-contact.png`、`390-A01-contact.png` 及 `390-P01-2026-03.png`。畫面可見人物、道具、手機版畫布和來源花園，也可見 P06、A01 的動作發生在任務結果窗旁。這些圖沒有證明不開任務窗的 22 島抵達事件。本契約未啟動 renderer 或新的 GPU 工作。

## 鎖定的資料形狀

沿用 `DATA.scenes`。每個 scene 多一個 `arrivalEvent`，不建立另一套文章或任務資料。這是有限的三段事件，沒有任意 JavaScript、遞迴指令、條件腳本或通用動畫語言。

```js
arrivalEvent: {
  id: 'P06-arrival',
  fictional: true,
  cause: scene.lifeEvent,
  cast: [
    { actorId: 'yue', position: [-3.6, 1.1, 3.4] },
    { actorId: 'achi', position: [1.4, 1.1, 3.1] }
  ],
  props: [
    { id: 'stage-light', kind: 'lamp', position: [0, 3.7, -1.4],
      scale: [1.1, 1.5, 1.1], label: '熟悉的副歌' },
    { id: 'entrance-route', kind: 'route', position: [-3.3, 1.15, 3.2],
      scale: [2.6, .08, .35], label: '路過的步道' }
  ],
  beats: [
    { id: 'cause', duration: 2, caption: { actorId: 'yue', text: '我只經過一下。' },
      actions: [{ action: 'walk', actorId: 'yue', to: [-1.8, 1.1, 3.4], gait: 'pass' }] },
    { id: 'action', duration: 3, caption: { actorId: 'yue', text: '等一下，這首我會。' },
      actions: [
        { action: 'walk', actorId: 'yue', to: [-.6, 1.1, 2.8], gait: 'hesitate' },
        { action: 'look', actorId: 'yue', target: { propId: 'stage-light' } },
        { action: 'crowd', mode: 'gather', targetPropId: 'stage-light', count: 4 }
      ] },
    { id: 'reaction', duration: 3, caption: { actorId: 'achi', text: '好，那就把這段唱完。' },
      actions: [
        { action: 'gesture', actorId: 'yue', gesture: 'sing' },
        { action: 'look', actorId: 'achi', target: { propId: 'stage-light' } },
        { action: 'gesture', actorId: 'achi', gesture: 'sing' },
        { action: 'crowd', mode: 'sing', targetPropId: 'stage-light', count: 4 }
      ] }
  ],
  handoff: { propId: 'stage-light', question: scene.transition.question }
}
```

以上座標是介面用例。實際資料的擺位須依既有地形與畫面調整，不能直接把範例座標複製到 22 島。

| 欄位 | 契約 |
|---|---|
| `id` | 唯一的 `${canonicalId}-arrival`。`articleId` 仍由所在 scene 提供，不把 canonical ID 當來源文章 ID |
| `fictional`、`cause` | 固定 true。cause 等於該 scene 既有 lifeEvent。改編演出不宣稱是真實調查、作者原話或預測 |
| `cast` | 只使用 `achi`、`yue`、`yingzhen`、`fenjie`。每人一次。所有 action 和 caption 的 actor 必須在 cast。可以加入原 dialogue 沒提及的這四位人物，例如 A01 的顧客小岳 |
| `props` | 當島唯一 ID，position 和 scale 都是三個有限數值。position 用島嶼 local 座標，rotation 用弧度。scale 為正。label 是可讀的短物件名稱，不承載整段故事 |
| `beats` | 恰好依序 cause、action、reaction。每段 duration 為有限正秒數，總長 6 至 12 秒。至少一段真實移動角色或物件。至少一段回應起因，不以三句台詞過場 |
| `caption` | 三段各一位現有角色的短句。經現有文字區與泡泡顯示，保留虛構情境標示。沒有聲音仍能理解 |
| `actions` | 僅接受下表判別聯集。同段可並行。相同物件的位置、所有權或相同人物的位置不可有兩個寫入者。look 和 walk 可同時使用，但目光由 look 決定 |
| `handoff` | propId 必須存在。question 沿用 scene.transition.question。實際航線仍由既有 ArticleGraph 決定，不另加 next ID 破壞推薦 |

### 固定 action 枚舉

| action | 必要欄位 | 可見動作與限制 |
|---|---|---|
| `walk` | `actorId, to:[x,y,z], gait` | gait 僅 walk、hesitate、pass。從上一段位置連續走向目標，有不同節奏及停步。不能只改 state 名稱 |
| `look` | `actorId, target` | target 恰一種 `{actorId}` 或 `{propId}`。以目標世界位置轉頭。人物互看不能以同看相機代替 |
| `gesture` | `actorId, gesture` | gesture 僅 pen-stop、mark、point、hesitate、remember、sing、listen。point 和 mark 需搭配同段或前段的 look 指向真實對象。pen-stop 保留阿綺個人習慣。不得把全部 gesture 退化成揮手 |
| `manipulate` | `actorId, propId, operation, to:[x,y,z]` | operation 僅 lift、flip、place。手掌接觸 grip 後才拿取。flip 要看得見物件翻面。place 放到真實支撐面，之後不跟手走 |
| `exchange` | `actorId, receiverId, propId, to:[x,y,z]` | 同一實物從 giver 經交接點到 receiver。兩人均須在 cast，且不能相同。最多一個 owner，不生成第二份道具冒充交接 |
| `transform` | `propId, to:[x,y,z], rotation:[x,y,z]` | 環境物件的連續變化，例如拉開布幕或轉動路牌。不能用它讓人物拿的物件離手飛行，或代替 manipulate 接觸 |
| `crowd` | `mode, targetPropId, count` | mode 僅 gather、sing、listen。count 為 3 至 6。實際居民走近、轉向或一起反應，對非參與居民保留 idle。取消時還原，不永久佔用 NPC 狀態 |

### 道具 lookup 與空間責任

`props.kind` 僅有 `paper`、`photo`、`product`、`parcel`、`phone`、`radio`、`sign`、`route`、`barrier`、`curtain`、`lamp`、`tray`。引擎為各 kind 建程序化實物，使用既有共用材質和幾何。parcel 要有立體包裹形體，radio 要有喇叭或旋鈕，product 要與紙張不同，curtain 要能分辨開合，route 要能看見路徑。不可全都生成同尺寸的平面板，再依 label 宣稱是不同物品。

`world.js` 以 `Map(prop.id → Object3D及rest/grip/support資訊)` 建立當島 lookup。任何 action 不可用 `children[0]` 或搜尋第一張卡片決定作用對象。資料驗證時找不到 ID 即報錯，不靜默退回核心道具。`handoff.propId` 與 crowd target 也走同一 lookup。

每島保有獨立 arrival group。它不加入 `island.outcome`，不進入遊戲 baseline，也不改 `island.interaction`。道具可以建在既有桌、貨架、服務窗口和地面旁。放下點必須落在看得見的表面；必要時用同島 tray 提供支撐，不能為所有事件自動生成同一座前方桌子。引擎可在入口為 prop 記錄左右 grip 和 rest transform，不要求通用物理系統。

walk 的目的地和道具的 `to` 都在島嶼 local 空間。角色身高和手臂可達距離仍由既有 rig 決定。抵達期間不改相機軌道以掩飾不合理走位。碰到建物、桌面或其他角色時，修正該島路徑與位置。不能以放大手臂或把全部角色搬到固定桌前通過距離測試。

## 每島事件和故事出口

每列必須演出起因、可見動作與回應。入場事件提出問題，不能未經讀者選擇就給遊戲勝利、印記或唯一正解。下列道具 ID 是語意建議，實作可用同義且唯一的 ID，但不得更換生活事件的因果。

| 島與原 lifeEvent | 原因 → 可見動作 → 反應 | 場景實物、角色與接續 |
|---|---|---|
| I01。阿綺收到很快完成的提案，客戶追問解決了什麼 | 提案送到工作台 → 阿綺停轉筆，拿起完成稿又放回未填價值表旁 → 映蓁先看空白欄，阿綺停住。短句「做完了。可是這一格怎麼還空著？」 | 阿綺、映蓁。`proposal`、`value-checklist`、工作台托盤。視線和放置位置須揭示效率與價值不同。價值表接 I02 的距離問題 |
| I02。訊息多次送達，仍不知道人是否被理解 | 橋上訊息牌往對岸移動 → 小岳在另一端停下，沒有接走；阿綺往橋中央走又轉頭看他 → 小岳表示「訊息有收到。你們有聽懂我嗎？」 | 阿綺、小岳。訊息 sign、bridge-route、未解問題 paper。兩岸位置必須分開，禁止兩人同站桌前。問題物件接 P01 的無來源影像 |
| P01。流傳影像沒有說明來處 | 映蓁走近來源花園 → 拿起照片、翻背面找來源 → 芬姐看向空白背面，示意先停轉發 | 映蓁、芬姐。`unattributed-photo`、來源 tray。使用既有花園影像語彙。保留未知，不把翻面視為查證完成。主線到 P02，特殊 P01→P04 以同一疑點照片交接 |
| P02。顧客被推薦包圍，芬姐先問要完成什麼 | 多塊路牌各指不同街口 → 小岳走向一塊又回頭，芬姐走到旁邊停下聽 → 小岳指眼前需求，不再往新推薦跑 | 芬姐、小岳。至少兩塊方向不同的 sign 和街道路線。芬姐「先說你今天要完成什麼。」街道路線收束成 P03 策略工作台 |
| P03。「年輕客群不買」後面仍有未定義原因 | 阿綺拿起症狀簡報 → 翻面露出幾條未接通路徑，映蓁走近圈一個未知 → 阿綺先把報告放回，不假裝已找到原因 | 阿綺、映蓁。症狀 paper、分岔 route、待查 sign。路線連到定位、價值與文化，不用三張無差異卡取代。接 P04 的可核對來源 |
| P04。材料完整但交叉核對仍缺來源 | 映蓁在橋端比對兩份資料 → 把待發布稿移入待查盤，發布欄杆保持關閉 → 阿綺停止向發布端走 | 映蓁、阿綺。來源 photo、稿件 paper、待查 tray、barrier。台詞「這句還對不上，先放這裡。」照片變商品來源標籤，接 P05 |
| P05。划算推薦與生活偏好不同 | 小岳看手機推薦 → 拿起推薦商品，回頭看另一商品旁的生活照片 → 芬姐看向他再聽，商品留在比較區，不自動結帳 | 小岳、芬姐。phone、兩件外形或色彩可分辨 product、photo。必須看見回頭比較。袋或商品接 P06 的舞台回憶，也供指定 P05→A06 商品旅程 |
| P06。路過時聽見熟悉歌，停下合唱 | 小岳沿步道經過 → 停步、轉向舞台，居民靠近 → 小岳與阿綺、居民一起完成一段合唱 | 小岳、阿綺、3 至 6 居民。舞台 lamp、入口 route。以步道與舞台構圖，不能只有兩人交換卡。無音效也能由停步、目光、嘴型、群體理解。舞台光接 P07 社群對話 |
| P07。完整產品說明不如具體使用經驗讓朋友相信 | 小岳先看制式手機介紹 → 轉向一張具體使用照片，指出使用細節給阿綺看 → 阿綺放低自己的宣傳稿，轉而看細節 | 小岳、阿綺。phone、usage-photo、宣傳 paper。兩個資訊來源可見且不同。短句「這個有講他怎麼用。」接 P08 的真正投入 |
| P08。曝光達標但少人停留回想 | 阿綺看曝光報表，小岳從看板前路過 → 小岳經過三面看板仍未停在參與區 → 阿綺看空的停留位置，再看報表，皺眉停筆 | 阿綺、小岳。多面 sign、passer-route、空參與 tray 或場地。不能自動改演主動參與成功，也不生成真實注意力百分比。空位置接 P09 共看座位 |
| P09。舊歌讓不同世代發現共同旋律 | 廣場收音機引起注意 → 小岳和不同服色、外觀的居民圍成半圈，彼此看一眼 → 有人點出同一段回憶，小岳把照片交給阿綺看 | 小岳、阿綺、3 至 6 居民。radio、old-photo、廣場位置。和 P06 的向舞台合唱不同，核心是相互辨認與分享。共看群體接 M01 的研究觀察 |
| M01。Persona 看似合理，先補樣本與情境 | 映蓁看到模擬卡 → 拿起、翻背面，將樣本和情境資料放在桌邊 → 阿綺轉向限制面而非只看正面結果 | 映蓁、阿綺。model-paper、sample-photo、context-sign。留空槽表示尚缺資料，不憑空加真實樣本。接 M02 多渠道圖；指定 M01→M03 帶背面限制 |
| M02。報表有很多渠道但不知人在哪裡注意 | 阿綺沿渠道地圖走 → 停在一個缺觀察的節點，將報表與該場域對照 → 映蓁走近指向要觀察的動作，保留其他節點未定 | 阿綺、映蓁。map-route、video-sign、search-sign、experience-sign。不同節點須有不同空間位置。未知觀察接 M03 證據天平 |
| M03。精確預測背後的假設未標明 | 阿綺想把預測放上天平 → 映蓁拿起翻面，指向假設，把未知留在空盤 → 阿綺帶著問題停下，不替預測背書 | 映蓁、阿綺。prediction-paper、assumption-paper、兩個不同 tray。卡片與天平關係要可見，保留空盤。未知成為 M04 服務岔口 |
| M04。顧客不缺推薦，卡在長流程與隱藏限制 | 小岳走一段就停 → 芬姐到旁邊，翻出被路牌遮住的限制；阿綺看見多餘路段 → 顧客表明尚未準備好，流程仍待讀者修復 | 芬姐、小岳、阿綺。長 route、遮擋牌 sign、限制 paper、barrier。不是入場就移走所有障礙。路徑下方接 M05 文化暗流 |
| M05。工具上線了，仍不知道時間要用在哪裡 | 上線燈亮，下一步表仍空白 → 阿綺站在部門隔板一側遲疑；芬姐走近，露出原本低於視線的顧慮牌 → 芬姐先聽，阿綺把未解問題留下 | 芬姐、阿綺。status-lamp、blank-plan、silo-barrier、concern-sign。水面與隔板要參與事件，不全搬上共同桌。不可把顧慮公開等同文化已修復。接 A01 現場停步 |
| A01。下單很快，兩週後配送混亂返回 | 小岳從街口帶包裹返回 → 把配送單交給芬姐，芬姐真實接住 → 芬姐指配送說明，小岳跟著看，阿綺看到售後問題 | 芬姐、小岳、阿綺。parcel、delivery-paper、delivery-sign。包裹和同一張單據全程可追蹤。芬姐「先別再下單，我們把這張對清楚。」待辦單接 A02 工作狀態 |
| A02。Agent 做完了，帳戶與版本仍不透明 | 完成燈先亮 → 阿綺翻開任務牆的遮擋牌，露出缺版本的位置 → 映蓁指出缺欄，阿綺停止交付 | 阿綺、映蓁。status-lamp、task-sign、version-paper、empty-tray。完成燈與資訊缺口同時可見。不能因演出自動放寬 delegation 權限。接 A03 內容被理解 |
| A03。答案中品牌相似，離頁後想不起特色 | 小岳在花園看相似答案 → 轉身走開又回頭，沒能立即指認；阿綺將一件帶品牌差異的物件移近 → 小岳看向差異，仍留下「我剛剛記住的是哪個？」 | 小岳、阿綺。至少兩個 answer-sign、不同形態 product 或 photo，與既有不同花朵構圖相連。不得靠更換同一牌文字當差異。接 A04 素材標準 |
| A04。生成素材完整卻不符語氣和情境 | 阿綺沿工坊看素材 → 把不合語氣的那張移到修改盤，並與規格並列 → 映蓁指檢查項，核准位置保持空白 | 阿綺、映蓁。多張可分辨 photo、brief-sign、revision-tray、approval-tray。不能在入場直接核准。檢查表筆跡接 A05 分工 |
| A05。跨市場要同時保留在地特色和一致性 | 兩個市場工位各有版本 → 阿綺在工位間比較在地符號與同一品牌元素，將一份送到映蓁 → 映蓁把需要人判斷的版本留下 | 阿綺、映蓁。兩組不同 photo、market-sign、task-route、review-tray。空間是多工位協作，不再複製 A04 同桌分類。任務路線接 A06 授權 |
| A06。願委託找商品，但付款與健康仍要知道誰負責 | 小岳帶商品走到付款與健康兩個邊界前停下 → 芬姐走到顧客旁接手，欄杆維持等待 → 阿綺回到一張呼應 I01 的價值表旁，停筆確認問題、依據和責任 | 芬姐、小岳、阿綺。product、兩塊 permission-sign、barrier、value-checklist、tray。不得替顧客付款或給醫療決定。末句可用「這次先把問題問清楚，再決定下一步。」結尾自願回 I01，不能自動強制返航 |

三條指定航線另有入口承接。P01→P04 抵達時仍是同一張有疑點的照片。P05→A06 由商品接到服務權限。M01→M03 由模擬卡背面的限制接到證據天平。沿這三條航線時，relation.question 優先於通用手寫開場提示，接著由目標事件的 cause 說明正在發生什麼。不能在抵達時用大標題蓋住動作。

## 單一生命週期與優先序

保留既有 `applyInteraction()` 結果責任。入場和結果動畫可共用接觸 rig，但不得共用一個模糊的「目前完成」欄位。引擎只用既有 active dt，不新增 setInterval 或獨立動畫時鐘。

建議公開介面為 `playArrival({source:'arrival'|'bell'})`、`skipArrival()`。既有 focus、setActive、setReducedMotion、setEncounter、applyInteraction 和 dispose 負責明確呼叫取消或暫停。實作名稱若變更，由主協調者一次更新呼叫者與契約，不長留兩套 API。

`getState().arrivalEvent` 回傳 null 或 `{id, articleId, source, phase, elapsed, complete, skipped, participants, props, caption}`。phase 是 cause、action、reaction。props 至少可讀回 id、kind、position、rotation、owner、supported。參與拿取者可讀回 hand/grip 距離。這是驗收觀測，不能取代畫面。

| 事件或狀態 | 優先規則與恢復 |
|---|---|
| `reader` 或 `document.hidden` | 暫停所有場景 active dt，保留當前 beat、物件、owner 與 caption。關閉恢復原進度，last 重設以免補跑隱藏時間。不是取消 |
| `travel` | 取消目前 arrival、result contact 和 encounter，清掉 arrival props、臨時 grip、crowd pose。只有真正完成抵達才開目標事件。略過航行到目標不略過故事。返回原島不在新島執行舊 callback |
| `result`、compare、replay | 使用者選擇結果優先。立即取消 arrival 並還原臨時狀態，再套結果或選前 baseline。不得多送印記或清除 choices/scenarioChoice |
| `encounter` 或開 game | 使用者主動人物或任務操作優先。取消 arrival，恢復正常 rig 後進 encounter。關閉 encounter 不自動從頭再播 arrival |
| `arrival` 自動開始 | 在兩模式真正抵達時播放一次，包括首次世界入場。相同島的 resize、同步、設定切換和重複 focus 不構成新抵達。已有完成結果的島自動保留 settled result，並以短文字保留入場提示 |
| `bell` 明確重播 | 獨立啟動當島事件，不開 game。正在播放時重播從 cause 開始，清掉上一輪。若該島已有完成結果，保存結果內容與視覺狀態，暫時播放 arrival，完成、skip 或被 encounter 取消後恢復 settled result。離島時不在新島還原舊人物 |
| reduced motion | 依序套用三段的最終語意，立即顯示反應與交接問題。沒有等待，也不靠動畫完成 callback 才顯示文字。mode 開關不重新開始事件 |
| `skipArrival()` | 正常模式直接得到和 reduced motion 相同的終態，complete、skipped 為 true。skip 不標記事件成功、不給洞察印記、不改遊戲結果 |
| dispose 或 WebGL loss | 取消與釋放所有入場持有資源。3D 不可用時仍顯示 cause 與 handoff，保留文章閱讀。不能將 2D fallback 計為動畫已驗 |

每次真正抵達或顯式重播給新的 generation。過期 generation 不准改 caption、cast、props、current 或 interaction。快速連續 visit 不排隊播放經過的島。世界晚載入時先讀取 app 的 gameState、reader 與目標，再同步世界；如果結果已完成，不得先播一幀入場覆蓋它。

物件 ownership 只有 null 或一個 actorId。lift、flip 在手上時保留 owner。place 後 owner 為 null，supported 為 true，位置保持在支撐面。exchange 只切一次 giver→receiver，交接前後位置連續。結束沒有結果可恢復時，可留下反應終態直到下一個操作，但 complete 事件不可阻止閱讀、轉場或新 encounter。非參與人物保留各自節奏。

## 互斥寫入與整合

schema 已先送主協調者並解鎖兩支工作。兩支實作者都以此 v1 欄位為準，不互改對方檔案。

| 分支 | 唯一寫入範圍 | 現在可開始的交付 | 立即回報條件 |
|---|---|---|---|
| Luna 資料 | `public/immersive/data.js`、新增 `tests/immersive-arrival-data.test.mjs` | 22 個 arrivalEvent、有限資料驗證、自然繁中對白、cause 與 handoff 來源一致、cast/prop refs 全解析 | 需要新增 kind/action/欄位，或既有 lifeEvent 與文章內容衝突 |
| Sol 狀態引擎 | `world.js`、`character-events.js`、`app.js`。主協調者已允許必要新引擎模組、index/style、cache 接線與定向 tests | lookup、程序實物、三段動作、priority、pause/cancel/skip、bell 接線、完成結果恢復、readback | 發現 schema 無法表達實際接觸或場景變化，或必須動 data.js |
| 本葉節點 | 僅 `docs/IMMERSIVE-ARRIVAL-CONTRACT.md` | 來源缺口、資料與狀態契約、逐島因果、驗收 | 不修改網站、不開 renderer、不委派、不 commit/push |
| 主協調者 | 整合與全體驗收，依原授權發布 | 核對 source、每島實際畫面、代表生命週期、既有結果回歸、部署讀回 | 任一入口只改文字、任一島退化成共同模板、舊結果被覆寫 |

資料先驗可解析，代表島再驗接觸與入口，之後逐島畫面驗收。代表島只是驗證順序，完整交付仍是 22 島。不能因三島漂亮或測試全綠就移除其餘故事。

## 實際驗收要求

### 代表案例先驗可用性

使用真實 DOM 導航、canvas 點選小鈴及鍵盤可達的事件控制。不可只以直接呼叫 world API 當成功證據。390×844 和 1280×800 都保存全頁及畫布畫面。

1. I01 初入場不開任務窗。看見阿綺停筆、提案和價值表的區別。Intro 已釋放後不重新播書塔。
2. P05 看見拿起、回頭比較與芬姐先聆聽，沒有自動購買。P06 看見路過、停步、轉舞台與群體合唱。兩者不可共用一段拿卡片動作。
3. M05 看見上線與未安排下一步的矛盾，低處線索進入視野，角色隔板與聆聽位置成立。不能只換 concern 字樣。
4. A01 看見包裹從街口到窗口，同一張配送單交接、放下或穩定持有。接觸 hand/grip 距離小於既有角色頭寬四分之一，物件在相鄰樣本連續、不重複 owner，手與桌面無明顯穿透。
5. A06 看見授權邊界、芬姐接手與阿綺回到問題、依據及責任。結尾不強迫付款、醫療結論或返航。
6. P01→P04、P05→A06、M01→M03 經實際推薦航線走完五階段。保存前島收束、carry、目標 cause 三張圖或連續短錄影。文字問題與目標物件必須同一因果。

### 全 22 島不開任務窗的畫面矩陣

每島至少保存 cause、action、reaction 三個可見時間點，正常動態使用短錄影或密集連續取樣確認走位與物件連續。`game.open` 和 `reader.open` 全程為 false，state.id 與 canonical 對應。每張圖旁留下 articleId、事件 id、時間、beat、實際 caption、角色位置、道具 id/kind/position/owner。至少在桌面逐島完成，再在手機逐島核對主要動作未出畫或被 UI 遮住。

人工逐島檢查本文件 22 列，而非只計算像素差異。要能從畫面說出「什麼讓他停下、他實際做了什麼、誰作了反應」。全島 id 不同、caption 不同、mesh 數量不同或 hash 不同都不足以單獨通過。P06、P09 群體要面向有意義對象，P08 路過要和 P06 停留清楚不同，M04 的問題不能在入場已被修好。

### 操作與恢復矩陣

| 測試 | 必須讀回的結果 |
|---|---|
| 小鈴與可達的重播控制 | 22 島能播自己的事件，不開 game。連點不留第二份 props，不重複 crowd，不增加印記 |
| 閱讀途中開關 | elapsed 不變、owner 和 beat 保留；關閉後連續恢復，不瞬間跳終點；文章與筆記正常 |
| 背景暫停 | document.hidden 期間不推進，恢復不補算離開時間 |
| 動作中離島、略過航行、返回 | 舊事件立即失效；目標只播一次；返回可見正確島與既有完成結果 |
| 完成遊戲後重敲小鈴 | 暫時事件結束後，原 scenarioChoice、effectId、choices、before、結果幾何與印記完全保留 |
| 事件中開人物或任務 | 新 encounter 或 game 取得控制，沒有舊泡泡改寫對話；close 不自動重播 |
| compare 與 replay | 仍符合既有選前還原、選後重建和重玩語意，不重新獲印記或留下入場 props |
| reduced motion、skip | 立即得到同一故事終態與短文字，無等待時間；核心事件雖無動畫仍可理解 |
| world 延遲載入 | app 已完成結果或已開閱讀時同步正確。讀者期間 renderer 暫停，不被到場事件蓋掉 |
| dispose、WebGL loss、離線快取 | 不繼續回呼，不遺留臨時資源。新增模組若存在，兩層 cache allowlist 與缺件拒用要同步 |

必要的資料測試驗 22 項、refs、有限 enum、三段時間、來源文案及非純台詞事件。必要的整合回歸沿用 68 個 scenarioChoice、三島手握接觸、late-world、閱讀暫停、導航與離線模組。相關程式未再變動的既有證據可以沿用，若改了共同 rig 或 applyInteraction 就重跑受影響案例。build 通過不能替代這些畫面與互動。

## 本契約完成狀態

已完成來源讀取、現有觸發鏈核對、22 個 lifeEvent 與 dialogue/handoff 盤點、三張既有圖像檢視，以及可供兩個互斥分支立即使用的資料與狀態契約。尚未實作或驗證本文件新增的入場功能，沒有宣稱發布完成。

本次實際讀取 poteto-mode、how、architect、Model the Domain、Experience First、Prove It Works 的原始 SKILL.md 及 Codex 適配。Model the Domain 使入場、結果和道具所有權分開建模。Experience First 使 22 個原生活起因維持為交付目標，未以固定拿卡片模板縮小範圍。Prove It Works 使資料、狀態和實際畫面分開驗收。依葉節點指派不再啟動 how 子代理或 arena，也不宣稱做過競賽審查。外部 deslop 非本次交付步驟且未執行，不能列為已通過檢查。

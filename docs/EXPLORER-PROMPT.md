# 決策群島探索器實作指令

本文件將使用者提供的「政策島」指令完整改寫為現有《決策智慧 2026》閱讀網站的實作規格。原文的 0 至 10 節都保留對應位置。逐項驗收與差異理由見 [EXPLORER-REQUIREMENTS.md](EXPLORER-REQUIREMENTS.md)。本文件描述目標，不表示功能已驗收。

你是資深 WebGL 與 Three.js 前端工程師兼互動設計師。請把現有「決策群島」探索區做成由六角形小島組成的 3D 閱讀城市。使用溫暖、霧面黏土玩具的微縮場景，主要入口先選行銷工作或日常生活，再選細分角色與關心問題，從一篇真實文章摘要開始，逐步理解互補觀點。十二個策展主題保留為第二層自由探索；全文、PDF、收藏與文章目錄隨時可到達。

首頁保留既有自然材質圖書館、每 150 秒旋轉一圈的中央書樹，以及圖書館、宇宙、群島三段共 6.5 秒的入口。新探索器接在入口之後。保留略過、暫停、背景分頁停止與減少動態行為。

## 0. 基本約束

- 沿用現有 Vite、TypeScript、原生 DOM 與 Three.js 0.180 系列。版本以專案 lockfile 為準。本輪不改成單一 HTML、不移除建置工具、不引入 React，也不降版或新增 CDN importmap。原指令的可直接展示意圖改由既有靜態建置與預覽達成。
- 新探索場景只使用 Three.js 核心及 OrbitControls、CSS2DRenderer、RoundedBoxGeometry、BufferGeometryUtils、SimplexNoise 這五類 addons。現有首頁的必要依賴不因本限制刪除。
- 新場景不載入外部圖片、模型或字型。幾何以程式產生，貼圖用 canvas 即時畫。保留既有文章封面、全文 HTML、來源 PDF 與閱讀資料。字型使用 `"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif` 系統字串。
- 建立單一可檢查的 `DATA` 設定，包含主題、閱讀落點、模型類型、連線、日間時段、日夜色表與布局參數。可拆成 TypeScript 模組並在載入當年文章後組成 `DATA`。建模器、卡片與搜尋從這份資料讀取，不在 renderer 寫死文章對應。
- 每個閱讀落點使用自己的 `item.id`，並以 `item.articleId` 指向當年真實文章。名稱、作者、摘要、頁碼、估計分鐘、全文與 PDF 從該文章取得。`item.model` 指定模型種類。
- 所有隨機採固定種子的 `mulberry32`。2026 預設種子為 `20261023`。SimplexNoise 的 random、樹木、雲、人物起點、配件、模型抖動都使用可重現的子序列。相同年度、資料與視窗設定必須得到相同初始場景。
- 使用真實已收錄刊物資料。不得新增虛構文章、政策、施政承諾、政黨、候選人或官方合作關係。原刊內的機構與品牌名稱屬來源內容，原樣保留。策展文字須標示為網站導讀。
- 初始化與模組載入錯誤必須被捕捉。WebGL、資料或資源載入失敗時，載入畫面顯示可理解的錯誤與 DOM 閱讀入口，不能白畫面。所有 localStorage 讀寫與 JSON 解析包 `try/catch`。
- 保留原四章節分類 `intro`、`people`、`model`、`ai`，以及既有全文、來源 PDF、作者、原刊頁碼、收藏、已讀進度、三條閱讀路線與年度匯入能力。十二主題是附加策展視角，不能改寫原刊章節。

## 1. 真實文章與策展資料

品牌為「決策群島」，英文為 `Decision Islands`。2026 有 22 篇真實文章。使用 12 主題、每主題 4 個閱讀落點，共 48 個落點，保留原指令每島 3 至 7 細項與約 50 模型的密度。跨主題重複出現的文章仍只計一篇，收藏與已讀狀態以 `articleId` 共用。介面顯示「22 篇文章 · 12 個閱讀主題」，不可顯示成 48 篇文章。

下表尾號均對應 `2026-NN`。每一篇原刊文章至少出現在一島，每島非空。`q,r` 為候選固定 axial 座標。

| 主題 ID | 中文與英文 | 文章尾號 | q,r | 主模型 |
| --- | --- | --- | --- | --- |
| growth | 成長羅盤 / Growth compass | 01, 04, 05, 14 | 0,0 | globe |
| human | 人性價值 / Human value | 02, 03, 06, 07 | 1,0 | book |
| trust | 真實信任 / Authentic trust | 03, 06, 09, 19 | 2,0 | lighthouse |
| community | 社群共鳴 / Community voices | 02, 07, 09, 11 | 2,-1 | pavilion |
| attention | 注意力記憶 / Attention and memory | 08, 10, 11, 13 | 1,-1 | stage |
| insight | 消費洞察 / Consumer insight | 05, 12, 14, 17 | 0,-1 | observatory |
| choice | 選擇場域 / Choice context | 13, 15, 18, 19 | -1,0 | bridge |
| experience | 顧客體驗 / Customer experience | 15, 17, 18, 22 | -1,1 | classroom |
| culture | 組織轉型 / Culture and change | 01, 05, 16, 21 | 0,1 | garden |
| craft | 創意製作 / Creative production | 08, 19, 20, 21 | 1,1 | studio |
| governance | 判斷治理 / Judgment and governance | 14, 16, 20, 22 | -2,1 | clock |
| agents | 代理商務 / Agent commerce | 02, 04, 07, 22 | 0,2 | workshop |

`item.id` 採 `<year>-<themeId>-<articleId>` 等穩定且唯一的字串。主題中第一個落點是主建物，其餘為較小模型。主模型和其他落點模型都由 `item.model` 決定。上表提供十二種模型的主題分配，不能以主題名稱在建模函式內分支。

每個落點包含 `id`、`articleId`、`model` 及雙語策展導讀。顯示名稱使用真實文章標題。白話說明可以引用既有摘要，或使用明確標示的導讀，不捏造文章觀點。2 至 3 個數字磚固定取自 `sourcePages.length`、`minutes`、`year`。分別標示「來源 PDF 頁數」「估計閱讀分鐘」「刊物年度」，不能把閱讀估計寫成實測時長，也不能自文章內文任意擷取數字拼成主張。`sourcePages` 是完整來源 PDF 的 1-based 頁碼，`printedStart` 與 `printedEnd` 是印刷頁碼，不能混用。

原施政時程改成閱讀軸。卡片依序顯示原刊印刷頁範圍、估計閱讀分鐘與未讀或已讀狀態，並保留「閱讀全文」「原始 PDF」「收藏」入口。策展主題、連線、時段文章與角色導讀須綁定刊物標題及年度。未編排的新書以當年真實文章產生中性閱讀區，不沿用2026的主題、連線或閱讀路線。不得將另一年度的文章誤接至 `2026-NN`。不滿足資料的主題應清楚顯示尚無內容或不列出，不新增假文章填滿模型。

建立 6 至 10 條閱讀連線。2026 使用以下 10 條。`from` 與 `to` 指主題，`articleIds` 是導讀的來源文章。`cargo` 使用 `book`、`idea`、`memory`、`data`，分別表示書本、想法、記憶、資料。`role` 指向 `DATA.roles` 的閱讀者角色。層級放在 `evidence.kind`，雙語理由放在 `evidence.rationale`，以 `src/explorer-types.ts` 為型別契約。

| 連線 | from → to | articleIds 尾號 | level | 搬運物與角色 |
| --- | --- | --- | --- | --- |
| opening | growth → human | 01,02 | source | 書本，策展員 |
| authenticity | human → trust | 03,06 | thematic | 想法 idea，研究者 |
| conversation | trust → community | 06,09 | thematic | 資料 data，讀者 |
| shared-memory | community → attention | 09,11 | thematic | 記憶 memory，通勤讀者 |
| attention-insight | attention → insight | 13,12 | thematic | 資料 data，學生 |
| source-sequence | insight → choice | 12,13 | source | 書本，家長讀者 |
| decision-experience | choice → experience | 15,17 | thematic | 想法 idea，園丁讀者 |
| experience-agents | experience → agents | 18,22 | thematic | 書本，騎車讀者 |
| craft-governance | craft → governance | 21,20 | pending | 想法 idea，讀者 |
| culture-governance | culture → governance | 16,20 | thematic | 資料 data，工作者 |

原 `official` 改為 `source`「來源串讀 / Source sequence」。它只表示文章同屬已收錄刊物且讀序與頁碼可核對，不表示官方認證、機構合作或因果證據。`thematic` 顯示「策展主題 / Curated theme」，明示為本站導讀。`pending` 顯示「待探索 / Open question」，以問題呈現可自行比較的方向，不暗示已建立的事實。連線卡必須能開啟相關原文。所有層級都不是政策或合作證據。

`dayCycle` 使用 7 個閱讀時段。午夜 00:00、清晨 06:00、通勤 08:00、白天 10:00、午後 14:00、黃昏 18:00、夜讀 21:00。每段以真實 `item.id` 指定高亮落點，不能把當下時段誤述為文章發布時間或事件時程。清晨與成長、通勤與人心、白天與洞察、午後與製作、黃昏與記憶、夜讀與治理的關聯皆屬策展導引。

## 2. 六角島布局與步行路網

- 使用 pointy-top 六角形，頂點朝 `±z`。`R=2.02`、`SPACING=2.28`、`TOP=0.65`、`WATER_Y=-0.18`。
- axial 轉世界座標為 `x=√3*SPACING*(q+r/2)`、`z=1.5*SPACING*r`。島間保留約 `0.45` 水道。十二島須形成相連的不規則輪廓，不能排成規則大六角形。
- 島面使用 `CircleGeometry(R-0.05,6).rotateZ(π/6).rotateX(-π/2)`。使用 MeshStandard、roughness `.92` 及 `256×256` 程序貼圖。磚紋、斑點、條紋三種圖案使用世界座標除以 `2.2` 的 UV，跨島連續。
- 每島有半徑 `1.8`、寬約 `.28` 的淺磚色步道環。外緣路緣為 `#e4d6c3`。頂緣有高 `.16` 的彩色圖案帶。外圈淺水環半徑 `R+.7`，白色泡沫環半徑 `R+.16`、opacity `.55`。側壁使用與水面相同的 shader。使用 polygonOffset 避免 z-fighting。
- 每對相鄰島只建一座橋。橋接兩島步道環的邊中點，以 9 片甲板組成，`sin` 拱高 `.04` 至 `.1`。
- 每島建立 12 個路網節點，分別是六角步道的 6 頂點與 6 邊中點。節點成環，橋連接相鄰島。每條閱讀連線使用 Dijkstra 取得最短可行步行路線，不能直接穿水或穿建物。
- 主建物位於島內 `(0,-.58)`，尺寸約 `1.15`。其他落點交錯放在內切半徑 `1.36` 內，格子依數量由 `.62` 縮至 `.46`。配置必須在資料更換後仍成立。

## 3. 渲染與鏡頭

- 探索器使用 WebGLRenderer，開啟 antialias、alpha、PCFSoftShadowMap，設定 SRGBColorSpace 與 ACESFilmicToneMapping，exposure 為 `1`。pixelRatio 上限桌機 `1.75`、手機 `1.4`。背景使用 `radial-gradient(#fffdf9,#edddcf)`。
- PerspectiveCamera 為 `fov=32`、`near=.3`、`far=320`。圖書館入口的既有鏡頭可維持原值，進入群島才套用探索器設定。
- OrbitControls damping `.07`，禁止平移，polar 為 `25°` 至 `70°`，距離 `3` 至 `70`。
- 全景方向為 `normalize(.24,.33,.87)`。依視窗長寬比使用距離 `28.5`、`38`、`56`。斷點必須固定且可測，例如 ratio `≥1.35` 為寬螢幕、`.9` 至 `1.35` 為中間、`<.9` 為直式。
- 選取飛行 `800ms`，使用 easeInOutCubic 同時插值 position 與 target。選島 offset 為 `(2.75,5.3,6.2)`，選落點為 `(1.6,2.5,3.2)`。桌機左卡開啟時視覺目標往右偏 `1.5`。使用者 pointerdown 立即取消飛行並交還控制。
- 鳥瞰為 `camera=target+(0.01,42,6)`。全景、鳥瞰、側欄與閱讀卡切換不可破壞入口狀態或讀者目前文章。

## 4. 環境、光線與閱讀日夜

- 天空使用 `SphereGeometry(170)` 與 BackSide ShaderMaterial，`depthWrite=false`、`fog=false`。uniforms 為 `uTop,uHorizon,uSunDir,uSun,uNight`。天空色為 `mix(horizon,top,smoothstep(-.02,.55,dir.y))`。太陽光暈為 `pow(dot,18)*.35`。夜間星星以 `floor(dir*180)` hash，值大於 `.9965` 才亮。
- 霧為 `Fog(0xf4eee3,42,150)`，顏色隨 horizon 同步。
- 半球光為 `HemisphereLight(0xeef6fa,0x8f8270,1.3)`。太陽為 `DirectionalLight(0xfff1de,2.8)`，是唯一投影光源。shadow map `2048`，shadow camera 左右 `±20`、上下 `±22`、near `1`、far `90`、bias `-.0006`、normalBias `.045`、radius `3`。補光為 `DirectionalLight(0xbfd6ff,.35)`。
- 水面使用 `CircleGeometry(160,64)` 與支援 fog 的 ShaderMaterial。淺色 `#a4d4da`、深色 `#6fa9b8`，兩組交疊正弦波產生柔和漂移。離群島越遠越深，加入微小閃光。
- 使用下列日夜 keyframes，所有色值為十六進位，數值線性插值。夜間半球光強度較高，場景仍能辨識。

| 分鐘 | skyTop | horizon | sunColor | sunI | hemiSky | hemiGround | hemiI | night | water |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1e2c58 | 3f4f80 | b4c2ff | 1.15 | 94a2d8 | 64566a | 1.85 | 1 | 5a88b2 |
| 300 | 26365f | 4c5688 | b8c4ff | 1.0 | 96a4da | 66586c | 1.85 | 1 | 5c8ab4 |
| 360 | 7f8fc4 | f6c3a6 | ffb48a | 1.3 | f3c6b5 | 6b5a5a | 1.1 | .55 | 8fb7c4 |
| 450 | a9d1ea | fbe6d3 | ffe2c4 | 2.4 | eaf2f6 | 8a7a68 | 1.25 | 0 | 9fcfd6 |
| 720 | 9fd0ec | f4eee3 | fff1de | 2.9 | eef6fa | 8f8270 | 1.35 | 0 | a9d8db |
| 960 | a6cfe6 | f8e7d2 | ffe3c0 | 2.5 | f1efe8 | 8a7a66 | 1.25 | 0 | 9fcbd2 |
| 1065 | 8b8fc4 | f7b98f | ff9f6a | 1.8 | f6d2bc | 7d6660 | 1.2 | .3 | 93a9bd |
| 1140 | 5a5e9e | d99aa6 | ff9a7a | 1.3 | c0b2e0 | 655868 | 1.35 | .75 | 6a7cab |
| 1260 | 22325f | 445488 | c0ccff | 1.2 | 98a8dc | 685a6e | 1.9 | 1 | 5a88b2 |
| 1440 | 1e2c58 | 3f4f80 | b4c2ff | 1.15 | 94a2d8 | 64566a | 1.85 | 1 | 5a88b2 |

- 太陽方位先將分鐘量化為 10 分鐘。`t=clamp((min-360)/720,0,1)`，`az=π*(.15+.7*t)`，`el=.35+sin(t*π)*.75`，`dir=normalize(cos(az)*cos(el),sin(el),.55*cos(el)+.35)`，太陽位置為群島中心加 `dir*40`。太陽維持鏡頭側上方的預設光向。
- 窗戶和燈的 emissive 為 `#ffc777`，強度 `night*3.2`。路燈的加法混合光池、島緣串燈與窗光溢出都乘上 night。
- 模擬時鐘從 `10:00` 開始，每真實秒走 `10` 分鐘，一天 `144` 秒。HUD 提供清晨 `06`、白天 `12`、黃昏 `18`、夜晚 `21` 四鈕。這是閱讀氛圍，不是現實時間或文章事件時間。
- 盆地使用 `170×170` PlaneGeometry、`160` 細分。中心低，半徑 `25` 至 `50` 用 smoothstep 隆起，疊 fbm 與梯田量化。壓低鏡頭側地形，避免遮住閱讀模型。flatShading 頂點色由河床 `8fb3ad`、沙 `d9c9a3`、田 `aec493`、草 `a3b986`、林 `6f8a62` 到岩 `b2a38d`。
- 背景樹以 InstancedMesh 放置數千棵。針葉樹合併 3 個 cone，闊葉樹合併 4 個帶固定抖動的 ico，使用 flatShading、不投影，種在半徑 `16` 至 `52`。手機依固定設定減量。
- 使用 3 圈 MeshBasic 遠山剪影，顏色向 horizon 混合。12 團球體雲沿 `+x` 慢移，超界後繞回。海上放置程序生成的小島、燈塔、帆船。

## 5. 實例化模型與環境零件

- `kit` 建模器只累積 `{kind,matrix,color}`。完成後每種幾何 kind 建一個 InstancedMesh，使用 `setColorAt`。靜態模型與家具以約 `20` 至 `30` draw calls 為驗收目標，需量測並說明包含範圍，不能把總場景 draw calls 冒充靜態零件批次數。
- 零件包含 box、rbox、cylinder、cone、sphere、ico、dome、torus、prism、hip、glowbox、glowsphere。rbox 使用 `RoundedBoxGeometry(1,1,1,2,.12)`，cylinder 為 `14` 段，ico detail `1`。hip 為 4 邊錐轉 `45°`。
- solid 使用 MeshStandard、roughness `.78`、metalness `0`，前景不用 flatShading。glow 使用 MeshStandard 與 emissive `#ffc777`。每個 instance 的縮放乘上 `1±.0072` 的固定隨機抖動。
- 十二種 archetype 在底面 `±.5`、高度 `0` 至 `1.5` 的單位空間建模，再縮放至落點。型別固定為 `book`、`pavilion`、`classroom`、`observatory`、`studio`、`bridge`、`garden`、`stage`、`clock`、`globe`、`workshop`、`lighthouse`，每種至少有一個實際落點。book 使用書屋與巨大書，書屋保留牆 `#f4ebdd`、coral 四坡屋頂、簷 `#a34e34`、窗 `#a8c4c2`。pavilion 使用亭子或攤位。classroom 有桌椅、黑板與迷你人。observatory 有觀測儀。studio 有製作桌與展示架。bridge 有河道與小橋。garden 有花圃。stage 有舞台與觀眾席。clock 有鐘塔。globe 有地球儀。workshop 有工具桌與車架。lighthouse 有燈塔與光窗。原診所、公車站、球場等公共設施示例改為對應閱讀與製作場景，保留細節密度與可辨識性。硬幣及時鐘等巨大符號仍可作為零件。這些模型都是閱讀主題象徵。
- 每島六角頂點放路燈，邊上放盆栽、灌木與花，外圈放 `4` 至 `6` 棵大樹。各島使用不同樹種，包含針葉、櫻花、果樹、棕櫚、柳樹。島內有長椅等小物。鏡頭距離 `≥26` 隱藏小物件，近距離恢復。
- 色票保留 coral `#db6a41`、ink `#211d1d`、cream `#fff8f4`、yellow `#fcea8b`、stone `#c5b5a7`、green `#71806a`。材質色為 glass `#86a8a6`、wood `#b48560`、teal `#3e7c8c`。植物色為 `#9cc27a`、`#8db86f`、`#728f5f`。粉彩點綴為 `#f2b5c6`、`#58a6a6`、`#6f7fb5`。

## 6. 閱讀者與閱讀連線

- 人物為高約 `.35`、頭占 `40%` 的 chibi。零件含腿、手臂、Capsule 身體、球頭、半球髮殼與眼睛。每種零件一個 InstancedMesh，使用 DynamicDrawUsage。腳下圓形假影 opacity `.22`。
- 原公務員改為戴識別證的策展員。角色由 `DATA.roles` 指定。九種配件型別為 `badge`、`glasses`、`cane`、`cap`、`stroller`、`bicycle`、`hat`、`helmet`、`suitcase`，對應策展員識別證、研究者眼鏡、長者拐杖、學生帽、家長推車、通勤者腳踏車、園丁斗笠、工作者安全帽、旅人行李箱。研究者可使用白色服裝。不得暗示真實機構或人員身分。
- 每條連線沿 Dijkstra 路線配置 `4` 至 `14` 人來回。一般速度 `.32` 至 `.40`，腳踏車 `.62` 至 `.70`。端點停 `1.4` 秒交接再折返。人物能在橋上通行，不能穿水或瞬間跳過轉角。
- 動畫使用 `ph=time*9+phase*20`，腿擺 `±.55`、手擺 `±.45`、上下起伏 `abs(sin(ph))*.012`。拉遠時人物縮放乘 `clamp(d/20,1,1.45)`。
- 頭上 badge 是 `128×128` canvas Sprite，白圓、coral 外環、ink 搬運物線條圖示。距離 `<16` 才顯示。
- 連線沿路網折線建立 TubeGeometry，半徑 `.035`。shader 使用 `u=vUv.x*length*5-time*1.4`。source 為實線，thematic 在 `fract(u)>.6` 時 discard，pending 在 `fract(u)>.3` 時 discard。coral、opacity `.82`，圖樣流動。
- 連線預設隱藏。選取相關島、連線或人物，或打開「閱讀連線」開關時顯示對應線與圖例。關閉選取後依開關恢復，不能因選擇殘留全部連線。

## 7. 標籤

- CSS2DRenderer 在每島前側崖邊顯示 pill，例如「01 成長羅盤」。選中島採 ink 底，其餘淡化。
- 選島後顯示各閱讀落點 `①②③④` pin，coral 細線連到模型頂部，`depthTest=false`。
- 開啟「角色標籤」時，距離 `<14` 的人物顯示「閱讀夥伴」與書本、想法等象徵圖示文字。人物是可選的場景動畫，標籤不聲稱正在進行真實搬運。英文模式使用對應英文字串。
- 每次有效畫面更新檢查與 UI 面板及其他標籤的碰撞。重疊先縮成號碼，再重疊則隱藏，採 `8px` hysteresis 防閃爍。畫面中的標籤隱藏不影響側欄與鍵盤入口。

## 8. 互動與介面

- pointerup 且移動距離 `≤6px` 才 raycast。`selectIsland`、`selectItem`、`selectWalker`、`selectFlow` 都依序執行高亮、顯示相關連線、鏡頭飛行、開啟卡片。拖曳鏡頭不能誤選。人物選取開啟所屬連線卡並標明角色、搬運物與當前目的地。
- 使用 setColorAt 將所選模型全部零件往 coral 混 `22%`。當前 dayCycle 落點往 yellow 混 `22%`。取消後由基色重新計算，不累積染色。兩種狀態的優先順序須固定。
- 左上品牌卡採毛玻璃與 `18px` 圓角，顯示「決策群島」及「閱讀探索器」。左上工具列提供全景、清單、說明 `?`。
- 左側詳細卡寬 `340px`、圓角 `22px`、多層柔和陰影、內容可捲動。島卡顯示圖示、策展摘要、真實文章列表與連線 chips。文章落點卡顯示 `160×160` 模型縮圖，必須以共用 WebGLRenderer 真正離屏渲染該模型，不能用 2D 示意圖代替。另顯示至多三個來源數字磚、閱讀軸、全文、PDF 與收藏。連線卡顯示 from、to、層級、搬運物、策展理由與原文來源。人物也必須可操作，選中後以連線卡顯示該人物的角色、搬運物與目的地。
- 右側清單寬 `318px`，半透明並使用 backdrop-filter `blur(16px)`。有搜尋框及「閱讀主題 / Reading themes」「閱讀連線 / Reading connections」兩個 tab。主題使用 details 展開落點 `①②…`。原四章節篩選、原文搜尋、收藏與既有閱讀路線仍可到達。
- HUD 收入預設關閉的「更多探索工具」，包含四個時段按鈕，以及角色標籤、閱讀夥伴、觀點關聯、暫停、鳥瞰、日誌開關。角色標籤、閱讀夥伴、全部觀點關聯與日誌預設關閉。閱讀夥伴開關控制人物展示，觀點關聯開關控制線，角色標籤開關控制近距離氣泡。暫停停止模擬時鐘、人物、雲、水與流動線條，但互動仍可使用。
- 主動開啟後，「閱讀日誌 / Reading journal」顯示 depart、arrive、handoff，具 LIVE 綠點與依連線篩選。日誌是動畫模擬紀錄，須明示「場景模擬」，不能冒稱其他真實使用者或實際合作。暫停時 LIVE 狀態同步，事件不可重複堆積或無上限增長。
- 按鈕最小高 `44px`、圓角 `9px`。hover 黃底、pressed ink 底、focus 為 `3px` coral outline。chip 半徑 `999px`、白或奶油底、陰影 `0 2px 8px #4a2a1414`。眉標為 ui-monospace、700、`10px`、字距 `2px`。大數字為 Georgia 斜體。
- 載入畫面顯示大字與「正在組合閱讀群島…」。主要入口開啟原生對話框，依序選兩大類、細分角色與關心問題；可略過問題、進入文章目錄或自由探索。導讀顯示原刊摘要、本站推薦理由及三篇可自由跳讀的互補觀點，不以已讀狀態鎖住下一篇。地圖說明只在手動要求時開啟。儲存失敗仍可使用。
- 視窗寬 `≤800px` 時工具列直排。側欄與卡片改為 bottom sheet，預設高度分別 `52%` 與 `34%`，提供拖曳把手，可擴充至全螢幕。HUD 收入「◷ 時間 / Time」按鈕。sheet 開啟後控制仍可操作，不能擋住關閉按鈕或造成頁面橫向溢出。
- 鍵盤方向鍵旋轉鏡頭，輸入欄位與原文閱讀捲動時不攔截打字。Esc 關閉卡片。所有選擇都可從 DOM 清單以鍵盤完成。tab、details、開關使用正確 aria 狀態，關閉面板恢復焦點。
- `prefers-reduced-motion` 時相機瞬移，模擬時鐘與所有自動動畫凍結，連線變為靜態虛線。監聽 media query 的 change 並即時切換。此設定同時適用首頁慢轉與入口，入口直接完成或可略過。手動選擇時段與閱讀操作仍可用。
- 預設中文，`?lang=en` 切換英文介面與策展導讀，可採 `data-en` 與 `tr()` 或等效的型別化字典。按鈕、工具提示、aria-label、錯誤、說明、日誌、圖例、空狀態及日期時間標籤都須翻譯。真實文章標題、作者、引文、全文與 PDF 保留原語文，英文介面清楚標示 `Original article in Chinese`。若另有英譯導讀，標示 `Curator guide`，不可偽裝成原刊英文全文。

## 9. 效能、時間與生命週期

- 使用 dirty 排程。有動畫、控制器阻尼或互動才要求 render。暫停、減少動態或頁面不可見時不保持無效的動畫迴圈。滑鼠、選取、resize 等仍可觸發單次更新。
- `dt≤.08` 僅用在人物走路等步進微分。使用前景實際累計時間計算 `6.5` 秒入口與 `150` 秒慢轉，不能因低幀率把入口延長。日夜時鐘依有效前景真實秒換算，暫停與背景恢復時重設時間基準，不追補背景經過時間。
- 只有太陽投影，背景樹不投影，小物依 `26` 的距離門檻做 LOD。使用 ResizeObserver 處理容器尺寸，不只監聽 window resize。
- 切換年度、離開探索器與 dispose 時釋放幾何、材質、貼圖、離屏 target、CSS2D DOM、控制器、observer 與事件訂閱。重複建立和銷毀不能留下重複標籤或持續 RAF。
- 檢查 WebGL 與資料載入失敗、禁用 localStorage、低幀率、背景恢復、窄螢幕及減少動態。報告實際環境與量測範圍，不能只以 TypeScript 或建置通過宣稱互動完成。

## 10. 分階段交付與驗收

每一階段結束時網站都可完整執行，首頁、原文與來源入口保持可用。保留版本與實際檢查證據。

1. 完成 renderer、相機、控制、天空、水、光、日夜、六角島、橋與島名標籤。驗證布局連通、首頁入口及 WebGL 失敗的 DOM 閱讀入口。
2. 完成零件庫、48 個文章落點、至少十二種模型、家具、地形、樹與雲。核對 22 篇均可由 DATA 找到，量測靜態零件批次數並檢視實際畫面。
3. 完成側欄、三類卡片、HUD、選取、高亮與飛行，全部連接 DATA。驗證全文、PDF、收藏、章節、搜尋、閱讀路線與年度切換。
4. 完成人物、Dijkstra 行走、連線、badge 與閱讀日誌。驗證三種層級、端點交接、四種選取入口與各開關。
5. 完成手機 sheet、reduced-motion、三步說明、英文介面、標籤避讓、dirty 排程與資源釋放。驗證桌面與手機實際操作、慢畫格入口及錯誤情境。

交付原始碼、可執行靜態建置、這份改寫指令與逐項驗收矩陣。逐項標記已驗證、未驗證或未完成，並附真實測試或畫面證據。部署與正式環境讀回只在授權範圍內執行，未執行時不得宣稱正式版完成。

## 11. 全站節慶切換追加

首頁與所有群島探索／遊戲狀態共用聖誕節、萬聖節、復活節三種風格，第一次進入預設聖誕節。選擇器在首頁及探索中均可鍵盤操作，手機不被工具列遮住；選擇保存在瀏覽器，儲存拒絕時仍可當次切換。季節是全站設定，不隨文章、主題或年度切換重設。

同一份HOLIDAYS資料驅動介面色票、首頁書塔裝飾及探索場景的光色與節慶物件。聖誕節保留書本聖誕樹、星燈與禮物；萬聖節有南瓜、蝙蝠與紫橘燈；復活節有彩蛋、春花或兔耳。不能只改選單文字或CSS而讓3D場景不變。保留自然圖書館的曲牆與書本質感，書樹150秒旋轉及暫停行為均沿用；不因此加入外部圖片、模型或字型。

季節與日夜是兩個獨立狀態，須能組合，切時段不能把季節重設。所有選題卡、人物卡、關係卡、閱讀彈窗與fallback介面繼承同一季節設定。英文模式翻譯三個季節名稱。驗證預設、三向切換、重載保存、年度/遊戲狀態保持、手機/鍵盤、reduced-motion與localStorage拒絕情況。

## 12. 最新入口修正。角色、問題、觀點

依使用者2026-10-24追加，初次入口先選「行銷工作」或「日常生活」，再選各類的細分角色及在意的問題，以真實文章摘要交付第一個相關觀點。每條導讀包含三篇可自由跳讀的文章與互補／取捨／背景說明。主題島是第二層地圖，原有密集工具收進「更多探索工具」，人物與日誌預設關閉。不要要求使用者先理解名牌、搬運或協作線；閱讀夥伴只是可選場景動畫，觀點關聯是編輯安排的閱讀連結。

新配置依每本書的標題、年度和canonical文章ID綁定。未知書籍顯示未編排狀態與真實文章目錄，不套用2026的推薦。全文、PDF、收藏、已讀、年份、節慶與自然圖書館入口保持可用。完整流程與J01–J10見ROLE-READING.md。

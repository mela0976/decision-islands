# 任務畫面辨識與選擇影響

2026-10-24。基準bf99099，分支feat/clearer-mission-actions。使用者要求放大人物與道具、手機清晰、互動和選擇後變化更明顯。保留8角色48回合96選項、原文、答案及其他書籍邊界。

## 工作步驟

- [x] `how` over the affected subsystem.
- [x] `architect` for parallel design exploration.
- [x] Write the throughput checkpoint as four todo items.
- [x] Delegate code-writing to a subagent using your configured feature model.
- [x] Verify on the matching surface. 本機完整3D腳本、手機與代表動畫通過。
- [x] Rebase into small, ordered commits. Stack follow-ups. 引擎/type先提交26bcdcb，wrapper/CSS後提交e093039，無衝突。
- [x] If the design is contested, `interrogate` before shipping. 固定zoom與fit方案及caption/overlay方案已依實際畫面選定，獨立審查無未解爭議。
- [x] Run Opening a PR. 沿用使用者授權直接更新既有GitHub Pages，不另造PR。

## Throughput checkpoint

- Blocking first steps. 讀Notion即時入口/SOP B+C、pstack/Orchestrator，確認現有camera以房間全景為主、人物手機偏小，固定phase事件與寫入責任。
- Independent workstreams. Sol負責scale/camera fit/有限互動及3D投影驗證；Luna負責phase提示、結果caption與手機排版。root負責整合及正式驗收。
- Shared mutable state. answers仍由readingUI擁有。engine事件只通知ready/approach/interact/result及choice/preview，wrapper不改答案、不poll。互斥檔案寫入。
- Smallest safe decomposition. 沿用既有48題資料與3D資產，不重寫模型/來源。放大與camera fitting是同一引擎不變量，交單一負責人；可獨立的回饋UI另負責人。

## 設計

比較固定zoom與依visible mesh projected bounds構圖。固定zoom會在寬/窄場景間浪費空間或裁切，採後者，環境退為背景、人物/關鍵道具優先。比較caption新增一整行和canvas overlay phase chips，採compact overlay以保留手機按鈕可見範圍。兩分支各自有獨立行為與測試，先定事件契約後並行。

Model the Domain把有限動畫狀態表示為phase與選項metadata，不以UI猜時間。Prove It Works要求實際mesh投影CSS px、手機截圖與選項前後畫格，不只看scale倍數。單一答案與預覽/採用隔離維持既有契約。正常模式最後停在結果，暫停/reduce立即呈現結果，無永續idle loop。

使用模型依當次schema，Sol gpt-6.1-sol medium、Luna gpt-6-luna xhigh。主模型未獨立讀回，不宣稱切換。先前已完整閱讀的相關leaf skills本回合沿用，新增任務已重新即時讀SOP。deslop/control-ui缺套件，不虛構執行，使用獨立審查及Chromium驗收。

## 本機檢查與審查

Sol引擎/lifecycle/fallback 2項、144frame投影檢查1項、Luna phase UI 2項，相關5項瀏覽器測試通過。TypeScript及Vite build通過，JS index-DeGivpKF.js，CSS index-C5yYF5f4.css。既有bundle大小提示保留。

實際mesh-corner投影檢查144個initial/A/B狀態各318×180及620×310，所有可見mesh均不裁切且頂端低於54px控制保留帶。手機最小CSS高度成人47.84px、長輩48.52px、孩子35.11px、phone23.96px；桌面98.58/100/72.34/49.37px。這是3D投影尺寸，不是實體手機或FPS測量。相關圖與measurements.json在test-results/readable-missions/。

Astra唯讀獨立審查camera/lifecycle/phase/cache及6張實際畫面，未發現未解P1/P2。4組近距離人物在3D adapter中推移robot，資料不變。部分robot遮住人物腿部但頭部仍可辨，不宣稱完全無遮擋。註解/suppression/MUST KILL均0，diff check通過。全96段動畫中途裁切沒有逐幀全驗，僅抽查代表情境。

全站像素比較只取54px控制帶下方的3D內容，避免將準備/操作/結果DOM overlay誤當場景差異。此輪第一次全站A→B→預覽A失敗時，實際PNG差異只在(6,6)-(116,32) phase chips，3D畫面完全一致；沒有放寬3D像素容差，改明確比較play area。phase的DOM狀態另有測試。

## 全站本機驗收

完整3d-missions-browser通過48回合96分支真WebGL結果差異、同canvas、preview/adopt/retry隔離、390×844與360×740場景及44px以上兩選項、節慶保持。三組代表動畫中間/操作/結果像素不同；figure phase在approach/interact/result時正確更新。重播、暫停、拖曳、預覽中真context loss切SVG保留採用答案及可繼續作答通過，errors空。

主代理親自檢視這次更新的3d-mobile-360.png與390.png，確認大人物、大道具、準備/操作/結果overlay、caption及兩選項沒有互相遮擋。96個靜態結果通過與3組動態抽查分開記錄，未稱96段動畫逐幀全驗。只修改3D展示及回饋，不改原任務選項、文章或其他書籍資料。

## 雲端測試排程修正

第一次發布run40055438332在npm test為58/59，失敗為mission-3d-stage.test.mjs:70的page.screenshot超過30秒；144-frame可讀性掃描與其餘58項通過，部署未執行。新增掃描與既有WebGL/截圖測試共用軟體GPU，原本Node跨檔案平行執行會同時占用該資源。將npm test改為--test-concurrency=1以序列化檔案，不略過或放寬任何斷言。修正後本機完整59/59通過，接著重新驗證雲端。應將資源競爭視為已採取措施的原因推論，不把單次逾時當作已證明所有可能原因。

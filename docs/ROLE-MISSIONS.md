# 角色情境小任務

2026-10-24。將角色入口後的文章推薦改為選擇式生活與工作情境，讓讀者先行動、比較代價，再連結原刊觀點。來源為本次使用者指示、Notion即時SOP B+C與目前程式。基準9a5a240，整合分支feat/role-situation-missions。保留原文、PDF、收藏、三季與自由探索。

## 工作步驟

- [x] Read the Principles section of the poteto-mode skill.
- [x] `how` over the affected subsystem.
- [x] `architect` for parallel design exploration.
- [x] Write the throughput checkpoint as four todo items.
- [x] Delegate code-writing to a subagent using your configured feature model.
- [x] Verify on the matching surface.
- [x] Rebase into small, ordered commits. Stack follow-ups.
- [x] If the design is contested, `interrogate` before shipping. skip: 兩名獨立設計與最終架構審查已收斂，沒有未解爭議。
- [x] Run Opening a PR. 交付沿用既有直接更新原GitHub Pages的授權，不另造不必要PR。

## Throughput checkpoint

- Blocking first steps. 固定任務資料型別、讀者選擇狀態與原文的單一來源，先完成兩種設計比較。
- Independent workstreams. 48個情境及雙語選項由內容模組負責；任務互動與樣式由UI負責。兩者以凍結型別獨立開工。
- Shared mutable state. main與journey-types/資料驗證只由主代理修改。UI獨占本次選擇紀錄，main不再保存另一份答案。內容與UI檔案互斥寫入。
- Smallest safe decomposition. 內容製作與UI有獨立完整輸出，交接只需一份型別。先兩名設計代理，再兩名實作代理，不為湊模型拆散同一狀態邏輯。

## 現行架構

reading-journeys.ts根據精確書名和年度解析8個角色、16個問題、48個canonical文章步驟。reading-journey-ui.ts擁有picker及目前路線，main.ts只負責地圖定位與既有閱讀器。選擇文章不等於完成任務，已讀狀態也不能代替任務選擇。新書沒有策展時使用中性目錄。

## 驗收

1. 所有8角色都能進入各自生活或工作情境，選項是具體行動。
2. 選擇後顯示不同模擬回饋、代價與來源觀點，可比較另一選擇、重試、跳讀。
3. 一條任務三個回合，最後回顧本次選擇；不冒稱真實預測或人格評分。
4. 原文和PDF可核對，角色與題目切換不混用答案，新書不繼承2026任務。
5. 手機、鍵盤、英文、節慶、no-WebGL、reduced-motion及全文返回保持可用。
6. 本機建置與測試通過後部署，正式站實際完成任務旅程。

## 設計比較與採用

Sol候選採每步可選mission及單一答案紀錄。另一候選把整條角色、reader與任務收進新路線引擎。Astra獨立體驗設計認為本次不需要分支引擎，但每次選擇必須實際累積成處理方案，後續回合記得前次選擇。採第一案，加入第二案的成果回顧與選擇條件。判斷依序為來源一致性、可理解的選擇差異、單一狀態擁有者、現有reader相容及新書邊界。沒有分數或選項決定文章分支，因此重建整條引擎會增加兩套導航責任。

JourneyMission為scene、goal、choices與takeaway。每choice有label、outcome、tradeoff；來源只有同step的articleId。內容由MISSION_ROUNDS問題鍵表提供，builder檢查雙語、ID唯一、選項數及每條三回合。不以文章ID記答案，因同一篇會出現在不同角色。

實作分工：Luna唯一寫入journey-mission-content.ts及其內容測試；Sol唯一寫入reading-journey-ui.ts/css與必要純狀態模組；主代理唯一寫入types、builder、main與整合旅程測試。採Separate Before Serializing Shared State原則，以互斥檔案消除共享寫入。主模型未獨立讀回，不宣稱切換聊天模型。

Model the Domain使答案成為單一紀錄並衍生方案。Prove It Works要求實際完成選擇、比較、改採、略過、reader返回及新書故障注入，不能以build取代UI驗收。

## 審查與修正

獨立Astra架構裁決支持每步mission及單一答案紀錄。UI/main/builder未發現未解P1/P2；Comment Sicko範圍審查無新增註解、抑制或MUST KILL。獨立內容審查完整讀過16題48回合96選項的雙語，以及19篇指定來源的摘要、重點及相關正文。修正三處後再獨立讀回：通勤族改為本人注意力與日用品選擇；購物第二輪以建議草案承接兩種前輪授權；家庭查證三輪統一為同場親子活動。無鄰篇主張錯掛或虛構量化成效的未解發現。

最終整合觀察到任務標頭與全域工具列重疊，已調整桌面及手機可用高度，並增加實際矩形不重疊斷言。手機初頁保留具體目標與情境，玩法及保存說明收成details，原文為選讀。第一次測試因測試程式在首頁尋找尚未顯示的「我的任務」失敗，修正測試入口後重跑，沒有用force click掩蓋產品狀態。

未安裝的deslop/control-ui不宣稱執行，採現有unslop、獨立diff/來源審查及Playwright實際UI驗收替代。沒有引入AI API、自動推斷讀者身分或對使用者人格評分。未做真實讀者研究，不宣稱已證明學習成效。


## 本機驗證

固定production preview 127.0.0.1:4174，Chromium，1280×900及390×844。npm test 35/35通過，後續內容修正再跑資料/內容8項均通過。TypeScript及Vite build通過，主bundle仍有大小提示；沒有執行新的硬體效能比較。

journey-browser.mjs已實際驗證兩尺寸的具體情境、鍵盤選擇、不同回饋、比較不改答案與改採、前輪條件、原文返回下一輪、略過與未完成、三輪方案、重走/重做、換角色隔離、節慶保持及header不被全域控件遮住。另以no-WebGL逐一操作全部16件任務48回合，確認48個不同scene與真實作答方案。英文手機可操作，重載確實清除session選擇。修正版畫面已實際檢視，手機初頁可見兩個行動選項。

book-boundaries-browser.mjs通過未知書中性閱讀、失敗載入保留現行內容、同年度異書不帶原閱讀路線、另一書可提供自己的任務且即使mission ID碰撞也不繼承舊答案，以及JS載入失敗的靜態閱讀入口。synthetic書籍僅為測試攔截資料，未公開發布。

實際結果JSON與截圖在本機test-results，測試原始碼隨提交保留；未將測試假書混入public。

原有test:e2e七組於最終production build通過，包括22篇原文、PDF、收藏、已讀、字級、歷史、手機、無JS、無WebGL與第二年度。發布與正式讀回結果續記於下節。

## 正式發布

發布程式SHA為2843c6323a8b62eb461e76fdcf259943b25ff004。GitHub Actions run40040973506的build和deploy均成功，雲端npm test35/35，check_public findings空。正式HTML讀回index-BCcfdBxD.js及index-8HkTG50e.css，與本機已驗證工件相同。

正式網址為https://mela0976.github.io/decision-islands/。正式站執行journey-browser.mjs通過1280與390尺寸的選擇、比較、改採、原文返回、略過、方案、重做與節慶保持；no-WebGL全8角色16任務48回合均可操作，英文手機與重載清除也通過。完整正式站測試結果在test-results/mission-results.json，errors為空。文件更新不改程式資產，不把文件提交SHA冒稱部署程式SHA。

## 2026-10-24 場景延伸

48 回合現在都有對應生活或工作 SVG 插畫場景與兩種實際結果。選擇會移動人物與道具、改變展示／聆聽／工作姿勢及互動路徑；比較只預覽另一場景，採用後才更新答案。舞台跨 UI 重繪保存，快速改選不會殘留舊動畫。暫停或減少動態時直接呈現結果，未設定 visual 的其他書籍仍可使用原文字任務。契約與驗收見 ANIMATED-MISSIONS.md。

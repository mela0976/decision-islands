# 選擇前後場景對照

2026-10-24。基準8657f20，分支feat/mission-before-after。

目標是選完後直接切換選擇前與選擇後，以同一個大場景看人物、物件與環境變化。答案仍由reading-journey-ui擁有，對照只改展示狀態。保留原48回合、96分支、另一選項預覽、重播、節慶及未來書籍資料邊界。

## 工作步驟

- [x] `how` over the affected subsystem.
- [x] `architect` for parallel design exploration.
- [x] Write the throughput checkpoint as four todo items.
- [x] Delegate code-writing to a subagent using your configured feature model.
- [ ] Verify on the matching surface.
- [ ] Rebase into small, ordered commits. Stack follow-ups.
- [ ] If the design is contested, `interrogate` before shipping.
- [ ] Run Opening a PR. 沿用既有直接更新GitHub Pages授權。

## Throughput checkpoint

- Blocking first steps. 已讀Notion即時入口、選擇、SOP B+C及pstack設定。固定comparisonView與animate選用契約，再派實作。
- Independent workstreams. Sol擁有3D引擎、共享型別及引擎測試；Luna擁有wrapper、SVG、CSS與介面測試。root擁有全站驗收與本紀錄。Astra唯讀審查設計。
- Shared mutable state. 不加入第二份答案。各檔案單一寫入者，對照只持有before/after展示狀態。
- Smallest safe decomposition. 沿用單canvas與現有視覺定義，不複製場景或新建WebGL context。手機分割畫面會縮小人物，因此採44px切換按鈕與固定鏡頭。

Model the Domain將展示狀態與採用答案分開。Prove It Works以真WebGL像素、手機按鈕範圍及答案不變為驗收，不能用編譯代替。沿用本次對話已讀的相關leaf skill。主模型未獨立讀回，不宣稱切換。deslop/control-ui未安裝，使用獨立審查和Chromium實測替代。

## 驗收條件

每個分支的前後像素不同，切回後精確恢復結果。採用答案、另一選項預覽與對照視圖分離。手機360及390px可直接按前後按鈕，至少44px。相同對照的鏡頭一致。重播、暫停、減少動態、SVG與context loss仍可操作。人物反應與環境提示只表示既有行動，不捏造成功、快樂、付款或政策成效。

## 驗證結果

引擎3項真WebGL測試通過，涵蓋四種寬度、相機一致、答案與預覽保持、前後像素及精確還原、無閒置RAF和同ID手機改為螢幕的合法匯入資料。獨立Astra設計審查發現此不同kind取景問題，已以正確模型分別量測修正，未限縮原匯入契約。

擴充投影檢查在318×180與620×310各檢查原144狀態及對照192狀態，共672狀態。可見人物與道具均在頂端54px控制帶下方且不裁切，成人至少38px、孩子26px、手機20px。這是瀏覽器尺寸模擬，不是實體手機驗證。第一次locator.screenshot在暫停時鐘下等待element stable逾時，改用已知fixture bounding box的page.screenshot；尺寸、像素與狀態斷言未放寬，重跑通過。

Python來源與匯入測試13項通過，check_public讀回22篇文章、22份PDF且findings空。系統Python缺pypdf，舊暫存venv連到已不存在的Python，故以本次專用/tmp/decision-islands-comparison-venv安裝鎖定requirements後測試，未變更系統Python。

完整npm test首次為59/60，仍在投影掃描後的page.screenshot逾時。新增336連續繪製狀態增加軟體GPU待處理工作是原因假設，未直接量測內部佇列。測試改在每次繪製後呼叫WebGL finish完成該次GPU工作再取下一狀態，沒有放寬截圖timeout、畫面或尺寸斷言。完整重跑60/60通過，包含最終暖色工作區提示；Linux CI待發布驗證。

SVG全站檢查初次在手動切換後立即斷言零動畫失敗，讀回17項皆為reduced-motion CSS transition的0.01ms狀態，非人物動畫。改為最多1秒等待瀏覽器下一次動畫清理，再維持零動畫斷言，完整48回合96選擇、手機、英文、減少動態及中間畫格測試通過。

最終本機build為index-D8zx1Hcf.js與index-C76R6Q75.css。完整3d-missions-browser通過48回合96分支的before/after真像素不同、切回精確還原、單一canvas、預覽不採用與retry。390×844及360×740的前後按鈕均至少44px且在螢幕內，保留節慶選擇。代表動畫有準備、操作及結果差異，重播、暫停精確終態、拖曳，以及preview+before中真context loss切SVG保留答案、預覽與before狀態通過。errors空。

主代理檢視兩張360px手機前後截圖，人物聚集、手持物件、桌面呈現均有差異，按鈕與原選項未遮擋。桌上道具的暖色工作區原被桌面遮住，移至實際支撐高度，半徑不變，owned資源仍正常回收。獨立Astra diff審查沒有未解P1/P2，另實測318px英文44px按鈕、與重播相距14.53px，以及相同target更新與模擬context loss保留before。實體手機、96段動畫每一格及GPU內部佇列未全量測量。

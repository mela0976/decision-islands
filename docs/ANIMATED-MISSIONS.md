# 任務場景與選擇動畫

2026-10-24。使用者要求八種角色有對應生活或工作場景，選不同選項能看到動畫與場景變化。基準9e9be11，分支feat/animated-role-scenes。保留16件任務48回合、選擇方案、文章、節慶與跨書邊界。

## 工作步驟

- [x] Read the Principles section of the poteto-mode skill.
- [x] `how` over the affected subsystem.
- [x] `architect` for parallel design exploration.
- [x] Write the throughput checkpoint as four todo items.
- [x] Delegate code-writing to a subagent using your configured feature model.
- [x] Verify on the matching surface. 本機完整 Chromium 場景與既有角色流程通過。
- [x] Rebase into small, ordered commits. Stack follow-ups. 依 renderer、配置、姿勢、整合提交；origin/main 基準未變，無需 rebase。
- [x] If the design is contested, `interrogate` before shipping. 兩種獨立設計一致採 SVG 舞台，無未決爭議。
- [x] Run Opening a PR. 沿用使用者更新既有GitHub Pages的授權；不另造不必要PR。

## Throughput checkpoint

- Blocking first steps. 先讀現有任務與renderRail重建行為，固定完整場景frame、角色道具catalog與舞台生命週期。Notion即時SOP B+C，poteto-mode及frontend-design。
- Independent workstreams. SVG場景/動畫renderer與48回合視覺配置各有完整輸出，可依凍結型別獨立實作。
- Shared mutable state. UI仍是answers唯一擁有者。renderer只接受目前答案/預覽，不修改答案。主代理獨占UI、main、builder、共用型別與整合驗收，兩代理互斥新檔案。
- Smallest safe decomposition. Sol負責8場景、道具與有限動畫生命週期，Luna負責48回合的明確前後frame。避免把同一個UI狀態拆給多人。

## 架構與視覺決策

既有world獨占WebGL及RAF，任務UI獨占答案，renderRail會替換innerHTML。比較Three任務世界與獨立SVG 2.5D舞台後，初步採SVG完整frame。所有環境包含no-WebGL可使用同一舞台，不建立第二套RAF或答案。有限Web Animations完成後保留terminal狀態；快速點選、暫停、減少動態與背景隱藏都必須收斂到目前選項。舞台host跨UI重建保存，不能每次重繪重播。

Model the Domain使場景以entities、flows和完整結果frame表示。Prove It Works要求真實看見動畫中間畫格與A/B不同結果，而非只驗證caption或資料屬性。frontend-design使情境舞台成為主視覺，文字說明退為次要，保留本站情境推演及來源邊界。

## 驗收

- 八角色場景有可辨認的不同環境與人物/道具。
- 48回合每個選項都有與該具體動作一致的視覺結果，兩選項有結構/位置/流程差異，不能只換字或顏色。
- 正常選擇可見有限動畫，結果持續保留；比較只預覽，關閉回原選擇，改採才寫答案。
- 重做、重走、跳輪、換角色、換書、原文返回與快速切換不殘留另一選項或失效動畫。
- 暫停、reduced-motion與背景隱藏停止動畫並顯示正確結果；no-WebGL、英文、節慶和手機都可操作。
- 圖像不宣稱成功率、信任分數或已證實因果。來源仍為該回合canonical articleId。
- 本機與正式站實際操作、截圖及必要測試通過，再交付。

## 設計與獨立審查

Sol 與 Astra 各自比較擴充 Three 世界及 SVG 舞台，皆建議 SVG，以免引入第二套 WebGL、RAF 與答案狀態。Sol 實作 renderer，Luna 實作完整視覺配置，再由 Luna 細化四類人物的五種手腳姿勢。Astra 獨立核對 48 題、144 frames、96 分支雙語語意與來源選項，修正缺席主管、使用者、飲品道具及可見停止控制；任務場景依實際情境選擇，角色可以出現在家中或工作中。程式審查確認舞台跨 renderRail 保存、快速 retarget 正確、預覽與採用隔離。

沒有捏造分數、轉換率或學習成效。插畫是情境示意，沒有把有條件授權畫成成功付款。正式來源仍使用原回合 articleId。未安裝 deslop/control-ui，以獨立審查、diff 檢查與真實 Chromium 操作驗收，未宣稱執行不存在的工具。

## 本機驗證

- npm test：43/43 通過；原有非此次新增的 Vite 測試仍有無害 HMR 24678 警告。
- npm run build：TypeScript 與 Vite 通過，38 modules。JS index-DdCOv7Pk.js 963.99 kB／gzip 283.07 kB，CSS index-ChIBTdtm.css。保留原有 bundle 大小提示，沒有宣稱效能改善。
- 原系統 Python 缺 pypdf，改用 /tmp/decision-islands-visual-venv 安裝 requirements.txt，13/13 通過，公開範圍檢查22文章/22 PDF，findings空。
- animated-missions-browser：全部48回合96個實際 SVG 結果，8環境；390×844、360×740 初頁場景與44px按鈕，英文、節慶、預覽/採用/重做、快速切換、有限動畫結束、暫停與即時 reduced-motion 通過。比較中間計算座標與實際截圖像素，非只看文字或dataset。
- journey-browser：1280與390真實WebGL，鍵盤、原文返回下一輪、跳過、方案、重做、角色隔離、節慶；no-WebGL全部48回合及英文session清除通過。文字情境改為details，測試實際展開核對前輪方案。
- book-boundaries-browser：未知書、同年異書、中性目錄、載入失敗、明確自訂無visual任務與相同ID不混答案、JS失敗fallback通過。
- 實際檢視手機場景與A結果截圖。產物在test-results/animated-mission-results.json、mission-results.json與role-stage-*.png。

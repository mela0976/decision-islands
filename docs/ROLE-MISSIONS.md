# 角色情境小任務

2026-10-24。將角色入口後的文章推薦改為選擇式生活與工作情境，讓讀者先行動、比較代價，再連結原刊觀點。來源為本次使用者指示、Notion即時SOP B+C與目前程式。基準9a5a240，整合分支feat/role-situation-missions。保留原文、PDF、收藏、三季與自由探索。

## 工作步驟

- [x] Read the Principles section of the poteto-mode skill.
- [x] `how` over the affected subsystem.
- [ ] `architect` for parallel design exploration.
- [x] Write the throughput checkpoint as four todo items.
- [ ] Delegate code-writing to a subagent using your configured feature model.
- [ ] Verify on the matching surface.
- [ ] Rebase into small, ordered commits. Stack follow-ups.
- [ ] If the design is contested, `interrogate` before shipping.
- [ ] Run Opening a PR. 交付沿用既有直接更新原GitHub Pages的授權，不另造不必要PR。

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

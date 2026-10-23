# 決策群島指令改寫與套用

## 目標與完成條件

依使用者附件把政策島完整改寫為決策群島閱讀世界，交付改寫指令、原0–10要求對照、可使用網站與正式部署驗證。保留首頁自然圖書館、150秒旋轉書樹、6.5秒宇宙入口、真實文章/PDF/收藏/跨年度。12主題、48模型落點共用22篇canonical文章，不創造48篇假文章。

本目標開始時工作樹乾淨，基準634c633，正式網站的上一版已部署。本目標首回合重新讀附件及現況，沒有把上一版完成當成本目標完成。

## 工作流程

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame. 已讀原文及目前來源，固定真實內容與入口不變條件。
- [x] Phase B: Design the workflow. 已比較共用場景與獨立Explorer Scene，採後者且共享單一renderer/RAF。
- [ ] Phase C: Run the loop. 依下列單位實作、驗證、保留或修正。
- [ ] Phase D: Keep the audit trail. 逐階段更新本檔與需求矩陣，未驗不得寫通過。
- [ ] Phase E: Verify and hand back. 全部需求須有對應現行工件及執行證據，正式網址讀回後才完成goal。

1. 固定types、改寫指令與驗收矩陣，建置保持原網站可用。
2. 平行交付DATA/graph/time/simulation、12原型instance kit、獨立scene、DOM UI。
3. 整合world生命週期與main閱讀事件，刪除舊四島場景，不留兩套互相競爭的selection。
4. 順序驗證正常入口、四種selection、日夜與步行/連線/日誌、縮圖、暫停/即時減少動態、鍵盤、手機sheet、英文、no-WebGL及第二年度。
5. 獨立審查、完整矩陣逐項稽核、推送原GitHub與Pages，正式工件及旅程讀回。

## Throughput checkpoint

- Blocking first steps. 先讀貼文完整0–10、保護真實22篇內容、固定48落點與文章ID的差別、共同API與渲染權責。
- Independent workstreams. 純資料/路網/時間/步行、幾何kit、scene、DOM UI有獨立檔案與介面，採工作樹隔離後再依序整合。
- Shared mutable state. 主代理獨占main.ts/world.ts與共享types。Scene不建立renderer或RAF，UI只發intent，唯一controller套用selection/state。
- Smallest safe decomposition. 每分支有實質功能與定向檢查；先兩個程式代理，再擴至其餘已解鎖分支。不為湊模型另寫重複verifier。

## 權責與驗收

src/explorer-types.ts為凍結契約。純模組維持domain資料，不含DOM/Three物件；engine與kit介面型別可引用Three但不持有renderer。模型落點id與articleId不可互換。使用者主模型未由執行期資訊獨立讀回，不宣稱skill切換主模型。

分支寫入者與實際檢查於派出後更新。官方與歷史查核仍以現有原刊PDF與來源紀錄為準，新增連線只是策展閱讀關係。沒有實測就不宣稱draw call或速度數字。

# 角色任務專屬差異提示

2026-10-24，基準c10a53f。將泛稱人物／道具位置改變的提示，改為每個任務和選項專屬的短句，說清楚選了什麼與可見變化。前後兩側各有文案，保留原高亮、計時、答案與預覽隔離。

## 工作步驟

- [x] `how` over the affected subsystem.
- [x] `architect` for parallel design exploration.
- [x] Write the throughput checkpoint as four todo items.
- [x] Delegate code-writing to a subagent using your configured feature model.
- [x] Verify on the matching surface. 本機與正式站中英文各96選擇的前後提示完整可讀。
- [x] Rebase into small, ordered commits. Stack follow-ups. 文案7f9f483、綁定及排版e66999c、驗證efeb29e。
- [x] If the design is contested, `interrogate` before shipping. 兩次Astra全文審查，語意問題已修正，沒有未解P1/P2。
- [x] Run Opening a PR. 沿用直接更新既有GitHub Pages授權，不另建PR。

## Throughput checkpoint

- Blocking first steps. 讀Notion即時入口與SOP B+C、pstack設定。查現有48任務96分支與畫面。先定MissionChangeHint及exact-book綁定，避免通用helper依mission ID套舊書文案。
- Independent workstreams. Sol擁有型別、選項綁定、驗證、resolver與手機排版；Luna一位負責日常4角色24任務，另一位負責行銷4角色24任務。root擁有全量覆蓋、手機與正式驗收。新增第三分支是另一半獨立文案資料，無共享檔案寫入。
- Shared mutable state. changeHints放在選項visual frame，各hint含entityIds及before/after雙語短文。高亮仍由實際renderer差異決定，文字只在參照實體有變動時出現。
- Smallest safe decomposition. 不改場景幾何、題目、答案或書中觀點。沿用2.2秒提示與最多兩則，改成全寬短句並在需要時自然換行，避免側排截掉意思。

Model the Domain把任務語意放在選項資料，與幾何判斷分開。Prove It Works要求96分支皆覆蓋、前後及預覽文字正確、手機完整可讀、原高亮和答案不變。主模型未獨立讀回，不宣稱切換。沿用本對話已讀leaf skills；deslop/control-ui未安裝，以獨立審查與Chromium驗收替代。

原目錄三個套件升級修改保留，以/tmp/decision-islands-specific-hints乾淨worktree安裝鎖定依賴。管理工具在repo外cwd無法建立worktree的既有條件未變，採明確git worktree路徑。

## 驗收

兩份資料共48任務96分支，每分支目前一則提示，前後雙語共384則短文。CPU全量覆蓋確認每個3D與SVG分支皆有專屬文案、方向及預覽正確、參照真實變動實體、A/B結果不同，沒有只剩泛稱位置改變。原有高亮程式與計時不改。

Astra讀完96分支，核對選項、場景描述、實際實體及opacity。修正客服自動回覆漏掉「已核准」範圍；修正試行初始描述宣稱兩張可見案件卡而第二張實際隱藏的既有文字，改成不計數的案件卡／規則說明；並改善三處容易誤解的原狀用語，未改場景幾何或任務選項。

首次360px中文全96分支前後、8角色與預覽完整可讀。英文在shared-memory-3/a/before比可用寬度多4px，未放寬完整文字斷言，改將英文短句再精簡至36字元內後重測。單則caption保持44px，兩則才使用60px兩行；保留可見Preview標記，不以省略號隱藏關鍵意思。

精簡後英文預覽在experience-value-1仍因Preview欄位占寬而截字，證明只限字元不足以保證實際可讀。caption改為最小44px、必要時自然增高並允許短句換行；兩則最小60px，不縮字、不加卡片、不使用省略號。中文目前每則最多17字，仍可一行顯示。英文最多36字元，保持一個選擇與一個可見變化。

本機完整Node測試72/72通過，包含96分支雙語方向與實體綁定、外部新書沿用相同mission key不套用2026文案、移除實體參照、長文／空翻譯拒絕，以及原有3D材質還原、生命周期和672個投影狀態。此後只精簡英文資料，最終文字另做全量覆蓋及手機驗收，雲端發布仍會重跑完整套件。

最終英文192句皆不超過36字元，中文與實體ID未因精簡改動。第二次Astra讀完96分支最新英文，找出「等核准」被縮成「已核准」的shopping-help-2/a，已改回adult reviews並讀回確認，沒有未解P1/P2。未把審閱等同核准，也不將核准FAQ擴成所有訊息自動送出。

自動換行後，360px英文SVG全96分支前後、預覽、字級及完整文字檢查通過；中文全96分支先前兩次通過。最新caption／方向／高亮／全量內容4項定向測試通過。最終建置index-DNU1OAis.js及index-6LdFliIG.css，只有既有bundle大小提示。未知書籍、同年其他書籍、同ID任務的來源隔離與載入失敗保留閱讀入口之瀏覽器回歸通過。

最終本機specific-hints-browser再次完整通過360px中文真WebGL及英文SVG各96分支，包含before/after精確專屬文案、8角色截圖、文字完整不截斷、12px字級、提示實際在視窗內、預覽維持原採用答案及可見標記。主代理檢視家長與行銷人手機截圖，短句和高亮同時可見。實體手機未測。

## 正式發布與保存

efeb29e092bbbd36020161ace9953e35cd96832e已推送main。GitHub Actions run40063147890的最終72項Node測試及build/deploy全部成功。正式HTML讀回index-DNU1OAis.js與index-6LdFliIG.css，與本機最終資產一致。

正式站specific-hints-browser再次通過360px中文WebGL及英文SVG各96選擇，共384個方向／語言組合。每則實際文字與各選項before/after一致，字級至少12px、完整不截斷、在視窗內、預覽保留原採用答案及可見標記；8角色手機截圖保存。browser-results.json的base指向正式站?v=efeb29e，errors空。

證據與最終建置保存回原網站test-results/specific-hints及dist，原有三個套件升級修改原樣保留。本次preview服務停止，獨立worktree在提交與證據保存後回收，分支歷史保留。

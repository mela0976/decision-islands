# 場景差異提示

2026-10-24，基準8a743ba。切換選擇前後時，短暫高亮真正變動的人物與道具，手機用最多兩則短提示指出差異，不新增長文卡片。

## 工作步驟

- [x] `how` over the affected subsystem.
- [x] `architect` for parallel design exploration.
- [x] Write the throughput checkpoint as four todo items.
- [x] Delegate code-writing to a subagent using your configured feature model.
- [x] Verify on the matching surface. 本機真WebGL、SVG、手機及66項完整測試通過。
- [x] Rebase into small, ordered commits. Stack follow-ups. 引擎f80bc40、介面e361b5c、整合驗證0884b10。
- [x] If the design is contested, `interrogate` before shipping. 兩次Astra獨立審查，誤判與清理問題已修正，沒有未解P1/P2。
- [x] Run Opening a PR. 沿用直接更新既有GitHub Pages授權，不另建PR。

## Throughput checkpoint

- Blocking first steps. 讀Notion即時入口、SOP選擇與B+C、pstack設定及技能。確認答案不由stage擁有、對照共用鏡頭且原始材料有alpha。先固定純差異資料與cue command。
- Independent workstreams. Sol負責差異模型、3D高亮與相應測試；Luna負責wrapper提示、SVG與手機介面；root負責整合驗收。Astra唯讀設計審查。
- Shared mutable state. comparisonCue含token、entityIds及durationMs。展示端獨立2200ms暫態，不進answers。單檔單一寫入者，初次兩個實作代理。
- Smallest safe decomposition. 沿用單canvas、既有實體與比較架構。純差異函式讓3D與SVG共用，不以各頁文案猜動作，不新增計分或永續動畫。

## 共同契約

resolveMissionChangeCue比較initial與previewChoiceId或choiceId對應結果，輸出entityIds及最多兩則I18nText提示。比較位置、姿態、種類、可見度，以及會改變互動的action參與。沒有選擇或沒有變化時不提示。

只有手動切換至不同側時啟動。相同按鈕不重啟，快速切換只保留最後一次。高亮只施加於該側可見且變動的模型；消失物件由短文描述，在仍存在的一側可高亮。2200ms後恢復原材質與caption。改選、預覽切換、重試、離開、隱藏、context loss及dispose不能留下過期提示。減少動態模式使用靜態高亮，沒有閃爍。

Model the Domain將差異資料和短暫展示狀態分開。Prove It Works要求實際模型像素不同且到期精確還原，不能只查data attribute。主模型未獨立讀回，不宣稱切換。沿用本對話已讀leaf skills，deslop/control-ui缺套件，用獨立審查與Chromium替代。

## 隔離與驗證

原目錄package.json、package-lock.json及requirements.txt已有非本次升級修改，原樣保留。managed create_worktree回覆Not a git repository，因聊天cwd在repo外，改以git worktree於/tmp/decision-islands-change-cues建立乾淨分支，從已發布commit實作並以鎖檔npm ci安裝。

獨立Astra設計審查比較固定物件旁文字、所有物件變暗、只畫底圈與靜態暖色材質。採暖色材質及原caption內最多兩個chip，避免手機標籤遮擋，也區別於既有持續action-focus底圈。共享terminal pose抽出後與8a743ba原函式逐項比較，888個實體姿態無差異。另修正道具無關節卻被flow標記的誤判，SVG採其實際呈現的欄位，命令移除即清除高亮而不等待舊timer。

Sol的4個純差異與4個WebGL測試通過，涵蓋未變道具不亮、缺少ID排除、2200ms精確恢復像素及alpha、相同畫面取消、最後token優先、減少動態、隱藏、context loss和dispose。Luna備援測試2項通過，318px最多兩則12px短字可讀，預覽/答案不變，離開或隱藏清除。

本機change-cues-browser從網站入口通過390px家長3D、360px行銷人3D與360px家長SVG。高亮期間的實際場景像素與到期後不同，切回after並到期後精確還原原結果；同按鈕不續期，快速切換舊timer不清新提示，改選立即清除。preview+before真context loss後答案、預覽、視圖保持且無過期提示。errors空。

主代理檢視360px行銷與390px家庭高亮截圖，暖色人物及有變動道具可辨，未變家具維持原色。兩個短提示在原caption內顯示，沒有另加長文卡片。實體手機與全96種高亮逐張人工目視未執行，手機為Chromium尺寸模擬。

完整npm test通過66/66，包含672個既有及對照狀態的投影界線檢查。最終建置為index-W3wfJT-g.js與index-CqNSIHr-.css，保留既有bundle大小提示。獨立Astra最終diff審查沒有未解P1/P2，確認沒有答案寫入邏輯變更，production wrapper切換與清除SVG時一律animate:false。

隔離worktree沒有原始整本PDF，Python10項通過且原刊來源類別略過1組。原目錄以同一鎖定依賴環境重跑完整13項通過，來源相關程式未改。公開邊界讀回22篇文章、22份PDF，findings空。未把略過的原刊檢查說成worktree已通過。

最終本機完整3d-missions-browser通過48回合96分支、8角色、360/390px、預覽/答案隔離、重試、節慶、代表動畫、重播、暫停、拖曳及真context loss。基準像素比較先以安裝的Playwright clock快轉2300ms讓cue自然到期，再維持原本精確還原斷言，沒有移除高亮或放寬像素差異；高亮期間另由change-cues-browser驗證真實畫面。

## 正式發布

0884b10fe0da3c77abd4157817b383d954d7fe88推送main，GitHub Actions run40060716187的66項Node測試及build/deploy全部成功。正式HTML讀回index-W3wfJT-g.js和index-CqNSIHr-.css，與本機最終資產一致。

正式站change-cues-browser再次通過390px家庭3D、360px行銷3D及360px家庭SVG，高亮與無高亮的真實像素不同，2200ms後精確還原，短字12px以上且在螢幕內、最多兩則，同視圖不續期、快速切換與改選清理正確、答案保持、真context loss備援保持視圖與預覽。results.json的base指向正式站?v=0884b10，errors空。

證據保存到原網站目錄test-results/change-cues，原有三個套件升級修改保持原樣。本次preview服務停止，獨立worktree在提交與證據保存後回收，整合分支及Git歷史保留。

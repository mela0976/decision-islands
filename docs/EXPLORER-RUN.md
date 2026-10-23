# 決策群島指令改寫與套用

## 目標與完成條件

依使用者附件把政策島完整改寫為決策群島閱讀世界，交付改寫指令、原0–10要求對照、可使用網站與正式部署驗證。保留首頁自然圖書館、150秒旋轉書樹、6.5秒宇宙入口、真實文章/PDF/收藏/跨年度。12主題、48模型落點共用22篇canonical文章，不創造48篇假文章。

本目標開始時工作樹乾淨，基準634c633，正式網站的上一版已部署。本目標首回合重新讀附件及現況，沒有把上一版完成當成本目標完成。

## 工作流程

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame. 已讀原文及目前來源，固定真實內容與入口不變條件。
- [x] Phase B: Design the workflow. 已比較共用場景與獨立Explorer Scene，採後者且共享單一renderer/RAF。
- [x] Phase C: Run the loop. 依下列單位實作、驗證、保留或修正。
- [x] Phase D: Keep the audit trail. 逐階段更新本檔與需求矩陣，未驗不得寫通過。
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

## 同一目標中的使用者追加

2026-10-24使用者要求首頁與所有遊戲頁面加入聖誕/萬聖/復活切換，預設聖誕。完整目標不替換：原0–10探索功能繼續，另加H01–H08。季節單一設定驅動首頁和探索，與日夜分開。src/season.ts為共用palette與保護storage入口，state加season與season command。角色卡透過onResolveWalker取得真snapshot，不解析walker ID。

## 2026-10-24 整合紀錄（尚未正式部署）

已合併核心資料/圖路/日夜/步行、12原型kit與環境、圖書館三季、DOM UI、獨立scene及main/world整合。實際分工：Luna負責kit/environment、library holidays及UI，Sol負責core、scene和main整合；Astra獨立需求審查。每個檔案同時只有一位寫入者，後續定向修正另開新代理。

- `npm test` 首次完整整合24/24通過，含真正Chromium/WebGL的scene probe；後續修改仍須重跑。
- `node tests/holidays-browser.mjs` 通過1440×1000與390×844：首次聖誕、三季首頁canvas確有差異、storage重載、探索器同步、原文閱讀；英文與storage拒絕情境也通過。截圖及結果在 `test-results/holiday-*`、`holiday-results.json`。
- 獨立Astra source review找到並修正world排程每frame重設時鐘、UI遮擋標記、畫布Esc、探索章節開錯drawer、shadow target回收、首次模組失敗閱讀入口及步進≤.08；焦點/人物卡片與journal reduced-motion由UI後續修正。
- 針對static batches進行實作：三種島面texture batch、側壁/環/橋板instances；側壁直接共享環境水材質。一次scene probe實測完整畫面69 draw calls、484650 triangles（1280×800 Chromium SwiftShader、鳥瞰、paused、非完整FPS測量）。此數字包含環境/角色/裝飾，不能當作20–30 static item子集已通過。
- `test:e2e` 曾因開發中HMR重載造成進場click timeout，該次不算通過；最終需以固定production preview重跑，不能用舊結果代替。

尚待：修正後全套production旅程、完整矩陣判定、正式GitHub Pages部署與讀回。沒有宣稱本機CPU/GPU等同真實手機效能，也沒有平行化節省比例的對照實測。

## 使用者追加。角色與問題成為主要入口

2026-10-24使用者指出主題島、搬運、名牌與協作線容易造成理解負擔，希望從角色/生活處境與在意的議題開始，再逐步理解相關內容。本次修改沿用同一goal並優先採用最新指示。原12主題幾何地圖保留為第二層自由探索；舊矩陣要求「所有工具首先攤開、人物和日誌預設顯示、主題先行」的部分由此追加明確取代，不能繼續當作首屏KPI。

- 使用者結果。進入後先選角色，再選一個問題，看到一篇有明確推薦理由的真實文章。完成或繼續後補上第二、第三個觀點，顯示它們的互補或取捨，避免誤把策展關聯寫成必然因果。
- 內容邊界。當前為《決策智慧》品牌、人與AI閱讀，不套用政策或投票說服文案。家長、轉換人生階段等入口不聲稱書中提供個人理財、退休或育兒建議。原文/PDF是來源，新增導讀明示為本站策展。
- Throughput checkpoint。先固定每書persona/question/step/articleId資料形狀與多書回退，再並行製作角色入口/導讀rail和進階UI減法；main唯一整合者連結書籍、閱讀、地圖、完成狀態及節慶。每檔一位owner，最多先兩個代理。
- 最小可驗證單位。資料與真實來源對帳；角色/問題/第一篇keyboard旅程；三步內容與關聯可開原文；切角色與切年度；舊目錄自由探索；三節慶與手機/減少動態保持可用；正式部署讀回。
- 決策依據。採SOP B+C，沿用同goal已讀Notion即時規則。poteto Subtract Before You Add使工具退到進階；Redesign From First Principles使角色成為入口而非另加一個篩選器。未安裝的deslop/control-ui仍不宣稱執行，替以獨立審查與可重跑瀏覽器測試。

2026-10-24後續澄清。使用者要求角色先分「行銷人員相關」與「一般人」，再依兩大類細分。入口更新為marketing/everyday兩大類，每類四角色，再選問題；先前六角色混列和最多兩次選擇由這次明確指示取代。JourneyAudience與persona.audienceId是唯一類別來源，UI不另寫角色ID分類表。未知書籍無策展資料時兩個陣列皆空，維持真實目錄回退。


## 最終本機驗證（2026-10-24）

固定 production preview 127.0.0.1:4174，Chromium/SwiftShader。下列為實際執行，非只讀程式碼：

- `npm test`：32/32通過，含真實WebGL scene probe、三季圖書館資源回收、路網/日夜/步行與每書策展邊界。
- `npm run build`：TypeScript及Vite通過；主bundle約805kB，仍有chunk大小提示。
- 隔離Python環境：13/13測試通過；check_public核對22篇文章、22個PDF，findings為空。
- `tests/browser.mjs`：7組舊閱讀旅程通過，包括原文/PDF/收藏/完成/字級/歷史/搜尋/無JS/無WebGL/第二年度。
- `tests/journey-browser.mjs`：1280×900與390×844兩大類各四角色、問題略過、三步跳讀、原摘要、全文next/Back同步、自由探索、英文與fallback通過。
- `tests/book-boundaries-browser.mjs`：未知2027書只有真實新文章與12個中性閱讀區、無舊連線；載入失敗保留當前書及節慶；同年度異書不帶舊路線；JS失敗仍有靜態入口。
- `tests/explorer-browser.mjs`：12島/48落點/10連線、時鐘及即時減少動態、縮圖、鍵盤選取、進階開關、日夜與節慶、實際WebGL context loss回退通過。
- `tests/explorer-mobile-browser.mjs`：390×844 sheet的52%高度、四章節篩選、拖曳展開/收合、焦點與inert、無橫向溢出通過。
- `tests/holidays-browser.mjs`：1440×1000與390×844，預設聖誕、三種實際canvas、重載保存、閱讀器/探索器同步、英文與storage拒絕通過。
- 上述測試結果JSON及實際截圖位於本機test-results（不納入公開內容）。

Static islands/bridges/models/furniture在鳥瞰28 calls、近距離29 calls；排除環境、人物、連線及選取覆蓋線。完整示範畫面69 calls、510918 triangles。這是1280×800軟體WebGL的渲染計數，不是實體手機FPS或速度改善實驗。

獨立審查修正：時鐘RAF重設、焦點恢復、即時reduced-motion、shadow回收、縮圖renderer狀態、房屋/教室原型、reader返回與路線同步、新書主題/角色策展滲漏。Comment Sicko清除3處無必要註解，無抑制註解及MUST KILL項目。未安裝的deslop/control-ui未宣稱執行；以獨立來源審查、diff和真實瀏覽器驗收替代。

尚未驗證：真實手機硬體效能、一般讀者理解率、完整十年PDF（目前只有2026）、每個暫存整合commit可獨立展示。保留最終分模組交付與可重跑檢查，不能把中途commit冒稱五個已發布demo。正式部署另記下節。

- `tests/visual-motion.mjs`：5項通過；13秒後仍慢轉、暫停畫面固定、恢復動畫、略過入口、220ms慢RAF下入口仍在12秒內完成。

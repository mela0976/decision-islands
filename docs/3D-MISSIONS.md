# 3D 角色任務

2026-10-24。基準34cd824，分支feat/3d-role-missions。使用者要求任務場景跟島嶼一致的3D風格，人物互動自然，選項影響明顯且有遊戲感。保留8角色、16任務、48回合、96選項、書籍來源與答案邊界。

## 工作步驟

- [x] `how` over the affected subsystem.
- [x] `architect` for parallel design exploration.
- [x] Write the throughput checkpoint as four todo items.
- [x] Delegate code-writing to a subagent using your configured feature model.
- [ ] Verify on the matching surface.
- [x] Rebase into small, ordered commits. Stack follow-ups. 資料、模型、引擎、整合與鏡頭依序提交，origin/main仍為基準34cd824，無衝突亦無需重寫歷史。
- [x] If the design is contested, `interrogate` before shipping. 兩候選架構一致，獨立審查確認後整合，無未決設計爭議。
- [ ] Run Opening a PR. 沿用既有更新GitHub Pages授權。

## Throughput checkpoint

- Blocking first steps. 即時讀Notion入口、選擇、SOP B+C，pstack設定及skills，核對現有程式與兩種3D架構候選。
- Independent workstreams. 固定3D資產與rig介面後，房間/人物/道具模型可與renderer/有限動作排程獨立實作。
- Shared mutable state. UI保持答案唯一擁有者。3D只接收目前frame和預覽；房間模型與排程器不同檔案，各自唯一寫入者。
- Smallest safe decomposition. Luna負責8個環境與25種可辨道具/人物rig；Sol負責渲染與走近/操作/交付動畫生命週期。主代理負責wrapper、UI整合與實機瀏覽器驗收，不重寫書籍內容。

## 現有架構

world.ts擁有圖書館入口與島嶼WebGL renderer、phase和RAF。explorer-scene擁有島嶼camera/controls與靜態instancing。任務SVG目前為獨立stage，reading-journey-ui跨重建保存stage host，answers與compare仍由UI擁有。MissionVisualDefinition已具有完整initial、各choice實體與share/review/handoff/pause關係。下一書可沒有visual，保留原文字任務。

## 驗收

- 真實WebGL 3D模型、光影與立體房間，視覺承接島嶼的圓角低多邊形、奶油/珊瑚/木色與藍綠。
- 八種可辨環境，人物分節手腳、朝向互動對象，移動時步態而非整塊滑動。
- 同題A/B有不同物件與互動結果，實際動作與最後場景清晰保留，不宣稱成功率。
- 有限動作序列、快速改選從目前畫面轉向；預覽不改答案。暫停/背景/減少動態保留terminal frame。
- 手機390及360場景與選項可用。無WebGL與context loss可讀且可作答，不建立重複render loop。
- 本機完整測試與真實畫格/3D讀回，發布後從正式網址讀回再驗收。

## 架構決定

Sol 與 Astra 分別提出整體候選，一致採獨立compact Three舞台。共用world viewport會跨越entrance/islands phase、scissor、OrbitControls與thumbnail renderer狀態，因此不採。共享視覺palette和圓角造型，不搬移靜態instancing來假裝關節人物。正常路徑只有3D canvas，SVG只在WebGL失敗後建立。背景world在guidedReading期間停止持續動態。

Model the Domain讓每個frame的actions明確指定actor、target、prop及show/review/operate/handoff/pause。Luna逐一校對96選項，renderer不讀中文猜動作。Prove It Works要求真WebGL讀回關節、位置與畫格像素；原noWebGL測試保留為fallback驗收，不能代替3D驗收。

目前聊天主模型未獨立讀回，不宣稱切換。實際工具派發Sol gpt-6.1-sol medium負責engine，Luna gpt-6-luna xhigh分別負責模型與明確動作資料。兩個設計候選使用Sol與Astra，模型可用性依本次工具schema。缺deslop/control-ui套件，改用獨立diff審查與實際Chromium操作，不聲稱執行不存在能力。

## 介面與檔案責任

mission-stage-types維持既有完整frame並加入可選actions；mission-3d-types固定資產factory、關節與stage snapshot。Luna模型檔只建立room/entity與擁有資源，Sol engine只處理camera/render/有限動作/lifecycle。主代理wrapper保持createMissionStage四方法，正常不建立SVG，context loss才切換並帶入目前input。SVG移到mission-svg-stage，為明確fallback，不是正常3D證據。所有外部actions由mission-visual-validation驗證actor/target/prop可見及存在。

重播只重演initial到目前結果，不能新增答案或改讀完狀態。動作完成之後停住；拖曳視角只在pointermove時render。三種節慶保留全域切換與答案，場景沿用群島造型。

## 審查與修正

Astra獨立審查wrapper、main、validator，未發現未解P1/P2。第二次獨立審查親自查看3D畫格與執行20項相關測試，發現放大鏡快取會把原.42透明鏡片重設為不透明。已用material→原始opacity/transparent/depthWrite Map修正，補上回歸測試。審查者再以真WebGL讀回跨任務返回相同畫面的SHA256完全相同。engine在移除entity時還原原材質、釋放clone，避免前個frame隱藏狀態滲入新任務。

終態直接copy精確位置與關節角度，避免從不同起點lerp到1產生浮點差異。全站截圖曾把311.59375px canvas外緣多取成312px，誤包含預覽caption的1px紅邊；比對改為canvas內縮2px，只比較真實渲染區，不放寬像素容差。中間動畫抽查使用Playwright受控時鐘，避免軟體GPU截圖時間超過2.1秒而誤把終態當中間態。這些測試不宣稱硬體FPS或學習成效。

新增註解與安全suppressions審查無需刪除，MUST KILL為0。deslop/control-ui本機缺少，實際使用獨立審查、git diff --check與Chromium驗收。

## 已完成本機檢查

- npm test 56/56通過，包含真WebGL關節、中間位置、持物、交付、retarget、重播、cache返回、精確終態、背景/暫停/reduced-motion/context loss/dispose及停住後無idle render loop。原有Vite HMR port訊息非失敗。
- npm run build通過TypeScript及Vite，42modules。JS index-kTRwd8ff.js 1011.86kB，gzip297.55kB；CSS index-XZ7VXsfG.css。仍有原有chunk大小提示。
- animated-missions-browser以noWebGL驗證全部48回合96選項SVG備援、390/360手機、英文、預覽/採用/重做、節慶、有限動畫/暫停/reduced-motion。
- book-boundaries-browser驗證未知書、同年異書、明確自訂任務、mission ID碰撞不混答案、載入失敗及JS失效閱讀入口。

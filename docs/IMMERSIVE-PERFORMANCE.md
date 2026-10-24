# 手機效能量測

## 量測條件

2026-10-24 基準程式為 `0aaf946`。執行 `node tests/immersive-performance-series.mjs`，每次使用新的 Chromium 與瀏覽器內容，依序量測三次。條件為 390×844、DPR 2、10 Mbps、150 ms 延遲、CPU 4 倍節流、ANGLE SwiftShader、減少動態效果。Service Worker 封鎖，從開啟網站根網址之前開始計時。

此情境測一般場景載入，不包含刻意設計的 8.6 秒首次書本開場。模擬瀏覽器不是實體手機。

## 修正後的基準

| 指標 | 第一次 | 第二次 | 第三次 |
|---|---:|---:|---:|
| World API 可用 | 3028 ms | 3071 ms | 3080 ms |
| RAF 觀察到場景已繪出一幀 | 3718 ms | 3794 ms | 3790 ms |
| 場景已繪出且互動按鈕可用 | 3753 ms | 3828 ms | 3826 ms |
| 100 人居民對話狀態就緒 | 84 ms | 11 ms | 11 ms |
| 任務結果及六個場景物件就緒 | 541 ms | 622 ms | 598 ms |

三次沒有頁面、console、請求或 HTTP 錯誤。一般冷載入尚未達到使用者提出的兩秒目標；上述兩項進站後互動在這三次樣本中均低於一秒。

截圖工具於 5670、5676、5898 ms 完成，畫面非空白。這是工具完成擷取的時間，不能稱為首次呈現。此次未使用 compositor trace，因此 RAF 數字也不是精確的螢幕呈現時刻。

原始資料、請求時序與截圖在 `test-results/immersive-performance-series/`。舊版 1.875 秒數字採文件提交後才建立的起點，漏算最初導覽，不再作為現行達標證據。

## 已確認的工作與歸因限制

基準 `createWorld` 會同步建立 22 島完整細節，再隱藏非當前場景。Canvas 貼圖亦同步生成。基準讀到七張共用編輯貼圖及 35 張自有貼圖。

`setupMs` 約 1337–1441 ms，包含字型載入等待，不能當作純 CPU 時間。Three.js 模組下載約 1025–1358 ms，原文 JSON 約 600–614 ms。沒有分別量到 shader 編譯或每座島的建構耗時，不能把全部延遲歸給其中一項。

第一項改善為延後建立遠方完整場景，保留全部島嶼輪廓，並提供遠、中、近三層細節。改善後數字必須以凍結版本重新量測，尚不能宣稱兩秒內或特定改善比例。

## 延後建立場景後的三次量測

版本 `58a6913` 以 Git archive 建立隔離快照，再執行 production build 與同一量測器。快照不含同時開發中的導覽或音效修改。原始資料另存於 `test-results/immersive-performance-series-after-lod/`，未覆寫基準。

| 指標 | 中位數 | 三次範圍 |
|---|---:|---:|
| World API 可用 | 2216 ms | 2210–2251 ms |
| RAF 觀察到場景已繪出一幀 | 3121 ms | 3116–3164 ms |
| 場景已繪出且互動按鈕可用 | 3153 ms | 3149–3200 ms |
| 雙 RAF 代理時間 | 3149 ms | 3139–3190 ms |
| 100 人居民對話狀態就緒 | 74 ms | 65–75 ms |
| 任務結果及場景物件就緒 | 534 ms | 493–537 ms |

三次沒有頁面、console、請求或 HTTP 錯誤。畫面保持 22 島、目前文章、居民與六個任務物件；當前場景只需一張編輯貼圖、自有貼圖七張。`setupMs` 為 655.5–657.9 ms，但仍包含等待，並非純 CPU 計時。

本組未達兩秒目標。前後各三次且未交錯執行，背景系統負載也不是固定值；沒有依五次交錯試驗建立普遍加速結論，不宣稱固定改善比例。截圖工具完成於 4916–5001 ms，仍不等於首次螢幕呈現。

## 整合版單次啟動診斷（不列入速度成績）

`tests/immersive-startup-diagnostic.mjs` 對 8a6b542 production build 以相同手機視窗／網路／CPU 條件執行一次 CDP Profiler 取樣，結果在 `test-results/immersive-startup-diagnostic-B/`。取樣本身有額外負擔，不可與上述三次延遲比較。22 島、實際繪圖與無頁面錯誤檢查通過。

取樣加權中 Three.js r160 `onFirstUse` 約 997 ms，`createWorld` 約 6 ms。這不是精確函式計時，也不代表 997 ms 全部是 GLSL 編譯；首用還包含程式診斷、uniform／attribute 初始化。下一步應針對程式首次使用及可重疊等待做有限實驗，不能只憑此關閉錯誤檢查。

官方固定版本來源：[WebGLProgram r160](https://github.com/mrdoob/three.js/blob/r160/src/renderers/webgl/WebGLProgram.js)、[WebGLRenderer r160](https://github.com/mrdoob/three.js/blob/r160/src/renderers/WebGLRenderer.js)。`compileAsync` 可等待平行編譯完成，但若沒有與其他工作重疊，單純搬動等待不保證降低首可用時間。

## 同步提交材質與字型等待重疊

先前取樣使候選聚焦在首用 program。實作只提前提交初始可見材質的 shader/link 工作，與原字型等待重疊；首畫面仍在字型成功且 label redraw 後，原有 shader diagnostics 保留。沒有改 pixel ratio、陰影、材質、文章或島數。未使用有內部 readiness polling 的 compileAsync。

探索批次以 87b205a 對 92f7502，前後各五次 AB 交錯，首互動中位 4392→3349 ms，範圍 3636–5196→2915–4279 ms；任務中位 770→998 ms。五對首互動都縮短，但分布重疊、背景負載變化，不作穩定加速結論。獨立審查另外發現一份字型拒絕、另一份仍 pending 時，allSettled 不會 fail-fast，故原樣候選未被接受。

最終候選 b07732a 恢復 fail-fast 並立即處理聚合結果。四個真 r160 案例包含正常延遲字型、字型拒絕、單一拒絕加另一份永久 pending、初始化途中 context loss。均完成對應清理；自有資源、listener 與 pending RAF 歸零。證據為 test-results/immersive-startup-overlap-final/results.json。SwiftShader 同 canvas 讀回 KHR_parallel_shader_compile=false，不能宣稱真驗有該擴充裝置的失連分支。

修正後另預先固定五組反向 BA，先候選、再基準，完整執行後才判讀，不追加個別樣本直到出現理想結果。原計時器與條件不變，量測器 SHA-256 為 881bcea46a53ea90a09837f66d08c9f4bc280f5866b99910da4a4d3ea7d17bc0。

| 指標 | 基準中位與範圍 | 候選中位與範圍 |
|---|---|---|
| 首畫面已繪出且可互動 | 3314 ms，3268–3581 | 2948 ms，2805–3282 |
| World API 就緒 | 2328 ms，2304–2369 | 2357 ms，2350–2683 |
| 100 人對話狀態就緒 | 82 ms，12–84 | 82 ms，13–82 |
| 任務結果與場景物件就緒 | 559 ms，357–674 | 610 ms，518–823 |

兩批各十次都保有 22 島、100 人、6 個真任務物件與 loaded Publication FontFaces；page、console、requestfailed、HTTP error 都為零。最終反向批次五對首互動也都縮短；任務中位較高，不省略這個觀察，也不單憑此判定回歸。背景其他專案無法隔離，hostLoadAtStart 已記錄，所以數字只適用本模擬條件，不能承諾所有實體手機固定改善幅度。

原始探索批次在 test-results/immersive-startup-ab/，最終反向批次在 test-results/immersive-startup-ba-final/。探索批次的五張候選代表畫面與基準 RGB 像素及 PNG SHA 相同，見 visual-parity.json；不把一個代表畫面外推成全島藝術驗收。

可重跑反向比較（兩個目錄須先各自 production build）：

```sh
PERF_FIRST=after PERF_OUTPUT=test-results/immersive-startup-ba-final node tests/immersive-performance-ab.mjs /tmp/decision-startup-baseline-87b205a /tmp/decision-startup-candidate-b07732a
```

另一次不列入成績的 post-profile 仍見 onFirstUse 取樣約 517 ms，見 test-results/immersive-startup-diagnostic-after-overlap/summary.json。不能直接把與先前取樣的差當成 shader 加速比例。首次載入仍未達兩秒，且 API 之前的下載／初始化與之後的首用 program 都仍有等待；NPC API 狀態及一項任務不代表全站每個按鈕延遲已驗。

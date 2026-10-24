# 沉浸式群島互動延遲量測

這份量測逐一使用目錄按鈕開啟 22 座島，測原文、完整原文、情境互動與實際場景回應。量測從世界已載入、字型就緒且至少畫出一個 frame 後開始。它不包含冷啟動時間。

## 執行

先建置 production bundle，再從 repo 根目錄執行：

```sh
npm run build
node tests/immersive-all-island-latency-browser.mjs
```

預設使用本機 production preview。量測結果寫入 `test-results/immersive-interaction-latency/results.json`。完成 22 座島後，fixture 只擷取兩張代表畫面。最終部署後要測 GitHub Pages，從 repo 根目錄執行：

```sh
PERF_BASE_URL=https://mela0976.github.io/decision-islands/ node tests/immersive-all-island-latency-browser.mjs
```

`PERF_BASE_URL` 可包含站點子路徑，但不能包含帳密、query 或 hash。Fixture 會正規化結尾斜線，並保留子路徑開啟 `immersive/`。

## 條件與門檻

Fixture 使用 390×844 viewport、DPR 2、150 ms 網路延遲、10 Mbps 下載、5 Mbps 上傳、CPU 4×、reduced motion、新 Chromium context 與封鎖的 service worker。它只執行一次連續的 warm-world 操作，不是 A/B 或重複試驗。

每座島記錄目錄開啟與選島、原文開啟、完整原文選取、閱讀器關閉回呼、情境開啟、每個遊戲操作、最後提交，以及情境關閉回呼。每一步從真實 DOM 按鈕或 Escape 開始，等到可見 UI 狀態完成。最後提交還要等到世界 state 出現該島的互動結果與 props，並觀察到新繪製 frame。

每個量測步驟都須在 2,000 ms 內完成。超時門檻不會放寬。若某步超過門檻，fixture 仍會跑完其餘島並輸出全部延遲與違規項目。若功能步驟失敗，fixture 立即保存部分結果並停止。

結果檔列出 22 個 article 與 island ID、8 種互動、10 種印記、每篇完整原文字元數、每島 props、每步延遲，以及 page、console、HTTP、requestfailed 錯誤。完整原文字元數以段落文字串接後的 Unicode code point 計算，不含段落間分隔符。

Reduced motion 會略過開場和刻意設計的航行動畫。若初始抵達事件仍顯示略過按鈕，fixture 會在量測前用該按鈕略過。這些動畫不屬於按鈕回應時間，也不算性能失敗。單次 warm-world 結果只描述這一輪操作，不能代表重複測試的中位數、速度優勢或 cold-start 結果。

## 2026-10-24 單次紀錄

在 `bd31886` production preview 執行一次。22 島、8 種互動、10 種印記都完成，202 個步驟均未超過 2,000 ms，且沒有瀏覽器錯誤。最慢步驟是 I01 的目錄開啟，1,493.1 ms；遊戲提交最慢為 I01，326.3 ms。完整結果位於 `test-results/immersive-interaction-latency/results.json`。

執行前 `uptime` 顯示負載 2.01、1.69、2.65，共 10 個邏輯 CPU。背景有一個長時間執行的 Chromium headless process，約使用 51.5% CPU，LINE 約 13.6%。這是單次驗收紀錄，不代表穩定延遲或速度優勢。

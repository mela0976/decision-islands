# 沉浸式群島鍵盤驗收

## 操作改善

開場使用原生 modal dialog，略過後焦點回到目錄控制。原文區可用 Tab 聚焦，並有清楚的焦點外框。既有「走進情境」保留任務用途，同時顯示目前主角的既有情境台詞及虛構標示；資料仍來自同一份場景與角色記錄。關閉對話框後，依原生 close 事件清除 world encounter 與 speech。

## 可重跑命令

```sh
npm run build
node tests/immersive-keyboard-path-browser.mjs
```

腳本使用一個 Chromium，依序驗證 390×844 與 1280×800。實際操作 Tab、Shift+Tab、Enter、Space、Escape、PageDown 與鍵盤輸入。沒有用 DOM script 設定焦點或代按控制。選擇器只用於觀察焦點與狀態。手機另外使用真正的觸控 tap。

## 兩尺寸通過的流程

1. Tab 到開場略過按鈕，以 Enter 離開，焦點回目錄。原生 modal 的單一按鈕循環會短暫報告 BODY，再回略過；沒有落到背景可操作控制，不加自製焦點陷阱。
2. 用 Enter、Space 開啟設定並啟用減少動態，再由目錄搜尋 P01，鍵盤選取文章。
3. 開啟閱讀，以 Space 選完整原文，Tab 到文章區並以 PageDown 捲到中段。真正 scrollport 是 overflow-y:auto 的 #reader。手機 scrollTop 由 261 到 3650，停在 60 段中的第 23–25 段；桌面由 288 到 2550，停在第 23–30 段。等待實際捲動完成才取樣，沒有把 Tab 跳到筆記造成的自動捲動當成逐段閱讀證據。
4. Tab 到筆記並輸入，以 Escape 關閉。經推薦返回後重新開啟，筆記仍在。
5. Space 開啟 P01 情境，顯示映蓁的既有台詞「這張圖很真，但我還沒找到它從哪裡來。」及虛構標示。鍵盤完成查證任務並展開完整結果。Escape 關閉後焦點回任務入口，等待原生 close 事件後確認 encounter 與 speech 清空。
6. Enter 前往推薦 P04，再返回 P01。下一個返回來源仍是 I01，可繼續返回。
7. 手機推薦按鈕在 pointerdown 到 click 的尺寸相同，高度至少 44px；閱讀窗維持 58dvh。兩尺寸 page errors 都為零。

完整焦點、捲動、觸控和狀態記錄位於忽略追蹤的 test-results/immersive-keyboard-path/results.json。代表圖片包括 [手機原文中段](../test-results/immersive-keyboard-path/390-reader-page-down.png)、[桌面原文中段](../test-results/immersive-keyboard-path/1280-reader-page-down.png)、[角色台詞](../test-results/immersive-keyboard-path/390-character-dialogue.png)、[完整任務結果](../test-results/immersive-keyboard-path/390-task-result.png)。

## 範圍與限制

production build 通過。Vite 仍有既存的 publication.css build-time warning；檔案由 public/fonts/publication.css 在 runtime 提供。

本入口涵蓋當前場景主角，沒有新增所有 3D 人物的鍵盤名單。本次未重跑未受影響的 68 選項矩陣，不把手機尺寸 Chromium 當成實體手機或螢幕閱讀器驗收。此分支交付時沒有推送或部署；公開驗收由整合者補記。

# 沉浸式導覽、備援與手機操作修正

## 修正內容

- P01 的 ArticleGraph 推薦可前往 P04，再用「返回來源島 · P01」回到實際出發島。手動目錄跳島也保留來源；上一篇／下一篇仍依原刊順序移動。來源堆疊存在 sessionStorage，頁面重載時先恢復 session 歷史，若沒有則從閱讀紀錄中的 routes 反推。來源不明時不顯示返回控制。
- 2D 備援和 WebGL context loss 共用固定提示；提示不受一般狀態訊息覆寫。隱藏無法作用的島上事件回放，停用只適用 3D 的島上人數與節慶控制；搜尋、目錄、全文、收藏、筆記、2D 情境、減少動態與音效仍可使用。
- 四章各有低音量音色與和弦設定。音效只在勾選後建立；換章、關閉音效或建立失敗都會停止並 disconnect nodes。音效失敗在設定面板保留可讀訊息。
- 手機故事卡把文字放在可捲動區，主要情境／閱讀操作固定可見。390×844 實測卡片高 329px（39%），上方保留 61% 畫面。
- 手機 reader 固定 58dvh 高度，預覽時僅調淡 backdrop 並取消模糊；保留文章捲動與筆記。這避免觸控後合成的 mouseenter 在 pointerup 與 click 之間改變 reader 高度、把目標移出視窗。已聚焦的推薦按鈕不會由 app 的 mouseleave handler 清除預覽；blur 仍會清除。
- `onObjectSelect` 遇到 `kind === 'microevent'` 立即返回，交由 world 處理，不會開啟情境遊戲。

## 定向驗證

以下均只執行所列 Playwright 瀏覽器腳本，沒有執行完整 `npm test`。

| 命令 | 結果 | 證據／界線 |
| --- | --- | --- |
| `node tests/immersive-navigation-ui-browser.mjs` | 通過 | 真 DOM＋CPU world stub：ArticleGraph P01→P04、返回來源、目錄跳島、清除 sessionStorage 後由 routes 恢復、原刊上一篇／下一篇；桌面滑鼠與手機觸控均以一次輸入抵達 P04。stub 不驗證曲線航行。 |
| `node tests/immersive-fallback-controls-browser.mjs` | 通過 | 實際阻擋 Three.js CDN 冷啟與 SwiftShader `WEBGL_lose_context.loseContext()`；兩者皆切至 2D。全文 3,232 字、筆記／收藏／目錄跳島／2D 情境可用；設定狀態及提示通過，`errors=[]`。 |
| `node tests/immersive-sound-browser.mjs` | 通過 | 真 app DOM、mock AudioContext：四章 profile 不同；啟動前無 AudioContext／node；換章與 mute 時停止並 disconnect；AudioContext 建立失敗後仍能閱讀，錯誤在設定面板可見，`errors=[]`。 |

導覽測試的 390×844 reader 高 489.52px（58dvh），preview 前後高度相同，scroll range 為 11,062px，筆記仍保留。滑鼠 pointerdown／pointerup／click 全落在同一個推薦按鈕，preview=true 時按鈕位置不變。觸控 pointerdown／pointerup／click 也全落在同一按鈕並一次抵達 P04；點擊前 preview=true，但 reader 與按鈕位置不變。

觸控問題的重現紀錄：在固定高度修正前，touchend 後 Chromium 合成 `mouseover`／`mouseenter`，preview 同步把 reader 從 734.27px 縮到 405.11px；推薦按鈕由 y=502.47–652.23 移到 y=831.63–981.39，離開視窗，接著 preview 清除、reader 展開，最終 click 落在父 `#recommendations` section，沒有導航。固定 58dvh 後，同一觸控輸入的 down／up／click 都落回推薦按鈕，reader 維持 489.52px。

已保存的畫面證據：

- `test-results/immersive-navigation-ui/recommended-arrival.png`
- `test-results/immersive-navigation-ui/mobile-actions-visible.png`
- `test-results/immersive-navigation-ui/mobile-reader-preview.png`
- `test-results/immersive-fallback-controls/cold-cdn-fallback.png`
- `test-results/immersive-fallback-controls/fallback-reading-and-interaction.png`
- `test-results/immersive-fallback-controls/webgl-context-lost.png`

## 範圍限制

此處的導覽 UI 測試使用 CPU world stub，只證明 app 的選島、歷史、來源返回、手機 DOM、滑鼠／觸控和 CSS 行為，不證明真實曲線航行或 named route 的 3D 呈現；真 world 路線由 `tests/immersive-world-quality-browser.mjs` 的獨立驗收負責。效能量測、完整測試套件與正式部署不在這些定向命令的驗證範圍。

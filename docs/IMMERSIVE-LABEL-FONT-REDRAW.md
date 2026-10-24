# 晚生 Canvas 文字的字型完成重畫

此修正從 root `46e9ba3` 建立。它是字型正確性切片 C，不包含已被正式 A/B 否決的 per-label readiness 候選 B，也沒有加速宣稱。

原 label 工廠立即 fillText 形成 bitmap。初始與全島核心字串的背景 preload 各做一次 redraw，但這兩次完成後才產生的新 speech／牌示沒有自己的字型完成回呼。原生字型稍後載入不會自動重畫既有 Canvas，故可永久保留最初的 fallback bitmap。

修正只替每個 label 補上字型 load 完成後的 redraw。Promise 從建立時就掛 catch，包含同步 load 例外；成功回呼先檢查 disposed 與 labels.has。hidden label 也更新 bitmap，才能在日後顯示時使用已完成的字型，但不為 hidden label 補 render。原 startup fail-fast barrier、背景 preload 順序、業務 visible、材質與文字內容都不變。

inactive 且 sprite 沿可見父鏈連到 scene、已有 scene frame 時，字型完成會補一個 frame。原 tick 的 sizing 公式抽為共用小 helper，使用兩個 world-local scratch Vector3。新的 inactive speech 先套相同 screenWidth 比例再補繪，沒有建立渲染狀態機或搬動 tick／startup 邊界。

字型載入失敗由 catch 吸收，沒有假造 WebGL 錯誤或角色台詞。限制是失敗的 3D label 可能保留原 fallback；本修正只保證可成功載入的 publication 字型完成後一定重畫。DOM 台詞／閱讀層不受此 callback 失敗影響，本 fixture 只驗閱讀按鈕仍存在，完整 app 閱讀流程由 root 整合驗收。

## 真 r160 定向證據

`node tests/immersive-label-font-redraw-browser.mjs` 使用新 UI 字型資產與正式 buildData。先等原 background preload 完成，再挑選真正尚未載入、已存在 publication 字碼的文字。此次選到 `旨 ABC 26`，U+65E8 由 `publication-tw-variable-8-7a1dc60589.woff2` 提供。fixture 攔住該 WOFF 請求與 per-label load Promise，以證明不是只等待一個虛構計時器。

五段全部通過，errors=[]。

- Cold active 首次 fillText 的 native fonts.check 為 false；釋放真字型請求與 Promise 後再次 fillText，native check 為 true。真 Canvas descriptor 同時包含 Publication Latin 與 Publication Sans TW。對應『旨』所在 unicodeRange 的 TW FontFace.status 為 loaded，Latin 實際 FontFace 亦 loaded。
- Inactive 新 speech 完成後恰好增加一個 scene frame。scale.x 為 7.2346065，依實際 camera distance／父比例反推 screenWidth 為 170，與宣告值一致。
- Hidden speech 完成後更新 bitmap，但 scene frame 數不增加。
- 故意拒絕新 label font 沒有 uncaught／console error，world 未 dispose，DOM 閱讀按鈕仍存在。
- Dispose 前 pending、之後才釋放的 callback 沒有 redraw、沒有改 texture version、沒有新增 frame；自有 geometry／material／texture 全為 0。

結果在 `test-results/immersive-label-font-redraw/results.json`。這是故意延遲的正確性 fixture，不是性能成績。

原 `node tests/immersive-startup-overlap-browser.mjs` 四案例也通過，errors=[]，保留 startup 字型成功／拒絕、mixed pending fail-fast 與真 context loss 清理證據。未重跑不變的大矩陣。

node --check、git diff --check、npm run build 通過。source 差異為 28 行觸及，淨增加 10 行。所有 browser/server 已關閉。未 push／deploy。最終 built／offline／22 島與公開行為仍由 root 驗收。

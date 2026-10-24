# 初始字型與 program preparation 重疊實驗

本分支的最終候選是同步 `renderer.compile` 提前提交初始可見材質的 shader/link，再等待原始字型。定向行為通過，正式速度尚待 root 交錯量測。沒有改善比例或兩秒達標結論。完整 Master 的 22 島、8 玩法、68 選項、人物、arrival、門椅及三層 LOD 不變。

## How

原路徑先等待兩個 `document.fonts.load`，才建立 renderer、scene 與 canvas labels。初始 focus 後排首個 RAF。首 render 進入 program 首次使用。

root 提供的 `8a6b542` 診斷中，r160 `onFirstUse` 取樣加權約 997 ms。這不是精確函式計時，含 diagnostics、uniform 與 attribute 初始化，不能全部稱為 GLSL 編譯。這是實驗動機，不是本分支新量測。

固定來源是 [WebGLRenderer r160](https://github.com/mrdoob/three.js/blob/r160/src/renderers/WebGLRenderer.js) 與 [WebGLProgram r160](https://github.com/mrdoob/three.js/blob/r160/src/renderers/webgl/WebGLProgram.js)。renderer 的 `compile` 使用 `traverse` 蒐集材質。直接預編整個 scene 會包含被隱藏的 LOD、carry 等物件。getProgram 建立或快取 program 與材質 light 狀態。WebGLProgram constructor 提交 attachShader/linkProgram。shader log、LINK_STATUS、uniform 與 attribute 讀回則在 onFirstUse。同步 compile 仍有 JavaScript 與 GL 提交成本，沒有宣稱其絕不阻塞。

## Architect

單一假說是字型等待可與初始必要場景建構及 shader/link 工作重疊。

候選一只把 font await 移到 scene 完成後，僅重疊場景 JavaScript 建構。初版候選使用 `compileAsync` readiness barrier。審查發現 r160 自帶 10ms readiness polling，沒有取消介面。在有 KHR_parallel_shader_compile 的裝置若 context lost 導致 readiness 一直不成立，app timeout 不能取消內部 polling。此本機 SwiftShader 真 probe 讀到 extension=false，無法重現有 extension 裝置的問題，因此此風險是固定來源推論。沒有以未驗證的 Promise.race 掩蓋它。

最終只保留同步 `compile` 提交候選，沒有 compileAsync polling。原有 `await createWorld(options)` 介面不變，字型成功後 redraw，首 render 仍由原本的 onFirstUse 確認 program 並保留 diagnostics。

資料形狀是初始 font loads 的 fail-fast outcome 及原有資源 ownership collections。Promise.all 立即掛上成功與失敗 handler，讓建構期間的拒絕受到觀察；一個字型拒絕即釋放場景，不等待其他字型 settle。採 Model the Domain 原則，沿用 `disposed` 與共用 `dispose`，沒有另添必須同步的生命週期布林值。startupObjects 是可見 material object 的 shallow clones，保留 Sprite／InstancedMesh 類型，共享 geometry／material。真實 scene 作第三參數提供光線、fog 與 environment。提交後字型 barrier 結束即清空 clone 容器。scope 不納入隱藏物件，但可能包含 frustum 外可見輪廓及 r160 為雙面材質準備的 variants。

## 不變量

- 首 render 與 API 公開都在初始字型成功後，與原字型限制相同。
- 初始化期間 canvas label 可離屏生成，首次上傳前全部 redraw，保留 Publication Sans TW。
- 遠方 label 的原有完整字串載入與後續 redraw 保留。
- 不新增 compile readiness timer。字型拒絕或 compile 同步例外使用既有 disposal 釋放已建場景。
- 外部 pointer／visibility／resize listener 與 RAF 在 barrier 成功後才註冊。OrbitControls 自有 listener 在建構時註冊，dispose 移除。
- dispose 仍可重複呼叫。字型 pending 時未公開 API，沒有新增取消介面。原有字型永不 settle 的限制沒有擴大為 GPU polling。
- shader diagnostics、材質、抗鋸齒、pixel ratio、陰影恢復與內容不變。

## 實際檢查

`node tests/immersive-startup-overlap-browser.mjs` 通過 4 個真 r160、390×844 案例，errors=[]。fixture 用正式 `buildData(raw)` 轉換資料。

1. 延遲前兩個字型 Promise 時，compile 已完成提交，API 尚未公開且未 render。字型釋放後首次 render 有實際 loaded Publication Sans TW FontFace。每一段初始 canvas text 的最後一次 draw 都在 barrier 釋放後。22 島及材質 ownership 保留。
2. 字型拒絕後 renderer 已 dispose，未 render，world／OrbitControls 的 canvas/window/document listener 與 pending RAF 均為 0。
3. compile 完成後以真 WEBGL_lose_context 失去 context，釋放字型後 API 仍可返回並 dispose。world／OrbitControls listener 及 pending RAF 均為 0。

成功案例重複 dispose 後兩個 RAF 內 renderedFrames 不再增加，自有 texture/material/geometry 均為 0。初版 listener 追蹤包含 Playwright 自身 listener，已限來源 stack 為 world.js／OrbitControls.js 後重跑通過。原始結果在 `test-results/immersive-startup-overlap/results.json`。診斷 wrapper、人工等待與 fixture 不可當速度成績。

`tests/immersive-compile-context-loss-browser.mjs` 是固定 r160 readiness probe。本機讀回 WEBGL_lose_context=true、KHR_parallel_shader_compile=false，無法驗證具 extension 裝置的 polling 失效。該差異是放棄 async 候選的證據缺口，不是已重現結論。

其他檢查包含 world 與測試的 node --check、git diff --check、npm run build，以及 publication-fonts／editorial-textures／arrival-data 共 7 項通過。Build 保留既有 publication.css runtime resolution 提示。

正式接受由 root 對凍結版本做至少五次 A/B 交錯，含實際首互動、錯誤數及內容完整性。若首用 uniform／attribute 初始化仍是主要成本，或字型等待與 shader 提交成本不能有效重疊，本候選不一定改善使用者首互動。

## Fail-fast 回歸修正

獨立審查指出初版 allSettled 會在一個字型拒絕、另一個永遠 pending 時卡住。已恢復 Promise.all 的 fail-fast 語意，並立即轉成 fulfilled／rejected outcome，避免同步建構失敗後字型拒絕成為 unhandled rejection。新增第四個 mixed-font-failure 案例，以 2 秒有界觀察要求 world reject，且另一個初始字型確實保持 pending。失敗案例另外讀回自有 geometry/material/texture 為 0。本輪真 r160 四案例全部通過，errors=[]。混合案例讀回 fontKeptPending=true、renderer disposed=true、未 render、自有 geometry/material/texture=0、listeners=[]、pending RAF=0。成功案例的同一 canvas GL 讀回 KHR_parallel_shader_compile=false，限制仍是本機無法驗證具 extension 裝置的 polling 分支。原始結果已更新於同一 results.json；所有 browser/server 已關閉。

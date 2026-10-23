# 決策群島

《2026 決策智慧》的互動閱讀網站。首頁以首爾星空圖書館為靈感，中央是由書本堆疊成的聖誕樹書塔。鏡頭靠近書塔，穿過宇宙螺旋，抵達閱讀群島。讀者可依原刊章節或策展路線閱讀。現在收錄 2026，歷年刊物取得後可沿用匯入管線加入。

## 在本機使用

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run dev
```

開啟終端機顯示的本機網址。點「啟程」觀看進場，或點「直接開始閱讀」。搜尋支援標題、作者、摘要與全文。讀者可收藏文章、調整字級、標記讀完。這些資料只留在該瀏覽器，清除瀏覽器資料後會消失。

每篇都有獨立 HTML 閱讀頁與原刊 PDF。瀏覽器不支援 WebGL 時仍可使用目錄。停用 JavaScript 時可開啟 `read/2026/index.html`。系統設定減少動態時不播放書塔轉場。

## 驗證及建置

```sh
npm test
npm run build
npm run dev -- --port 4173
```

另開終端機執行 `npm run test:e2e`。瀏覽器測試需要 Playwright Chromium，首次可執行 `npx playwright install chromium`。產物在 `dist`。GitHub Actions 在 main 更新時建置並發布 GitHub Pages。

執行 `node tests/visual-motion.mjs`，驗證首頁閒置後持續慢轉、暫停、恢復、略過轉場，以及慢畫格仍能完成進場。兩個瀏覽器腳本均接受 `TEST_URL` 環境變數，可驗證正式網站。首頁書樹每150秒旋轉一圈，進場約6.5秒；系統減少動態與畫面上的動態按鈕可停止動畫。

## 內容與出處

刊物及原作者保有內容著作權。2026 標題、作者、摘要與導讀來自使用者提供的刊物及編輯目錄。策展路線與文章間串聯理由由本作品編輯。全文為刊物轉錄，圖表及原始版面請以各篇 PDF 為準。

- [比賽規則](https://dentsupro.com.tw/decision-wisdom-2026-event/)。規則允許公開刊物內容，禁止客戶資料、個資、帳密及金鑰。
- [HEART 政策島](https://puma.taipei/heart-island)。參考可探索島嶼及旁側索引的互動概念。
- [螺旋書塔](https://bass-ccc.github.io/decision-intelligence-2026/tower/)。參考書頁螺旋及進場概念。
- [首爾星空圖書館](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=60729)。依使用者追加指示，首頁以其挑高書牆與中庭空間為靈感，中央聖誕樹改用書本構成。

互動場景為本作品以 Three.js 建立的原創幾何，沒有複製參考網站程式或政治內容。未將原始 Excel、InDesign、工作檔或商業字型上傳。

製作、部署與資安說明見 [參賽交付說明](docs/SUBMISSION.md)。

## 匯入其他年度

將來源 PDF 保留在網站儲存庫以外，在 `content` 新增年度 manifest。穩定文章 ID、作者、標題、摘要、原刊頁碼與 PDF 檔案頁碼必須先核對。PDF 文字無法正確抽取時，先提供校對後段落；掃描版 PDF 需要另外 OCR 及人工校對。

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/import_library.py --manifest content/2026.json --project-root .. --website-root .
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
.venv/bin/python scripts/check_public.py
```

範例命令重建本次2026內容，需要使用者提供的來源目錄。GitHub上的產物已經生成，不必取得來源即可建置網站。新年度可使用PDF及manifest內的metadata，不要求另外提供Excel或InDesign。匯入不會替你判斷公開權限或自動完成內容校對。

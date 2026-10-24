# 決策群島

《2026 決策智慧》的互動閱讀網站。首頁以首爾星空圖書館為靈感，中央是由書本堆疊成的聖誕樹書塔。鏡頭靠近書塔，穿過宇宙螺旋，抵達閱讀群島。進入後先選「行銷工作」或「日常生活」，再選細分角色與在意的問題。接著進入對應的生活或工作小任務，透過三輪選擇比較影響與代價，組成自己的處理方案，再選讀相關原文。主題地圖與原刊章節目錄仍可自由探索。現在收錄 2026，歷年刊物取得後可沿用匯入管線加入。

## 在本機使用

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run dev
```

開啟終端機顯示的本機網址。點「開始我的情境任務」觀看進場並選擇角色，或點「直接開始閱讀」開啟目錄。任務搭配家庭、社區、辦公室、通勤、品牌工作室、會議室、拍攝現場與研究室等 3D 小場景，沿用島嶼的圓角模型與色調。人物與道具採用較大的近景比例，手機會優先看清互動。選擇後，畫面依序標示準備、操作、結果，人物會轉身、操作或交付物件，保留關鍵物件提示與不同結果；可拖曳查看場景，動態開啟時可重播動作。WebGL 不可用時會改用可作答的插畫備援。可以比較、改選、略過與重做，不給正誤分數。選擇只在目前頁面保存，重新載入會清除。搜尋支援標題、作者、摘要與全文。讀者可收藏文章、調整字級、標記讀完。這些資料只留在該瀏覽器，清除瀏覽器資料後會消失。

任務結果出現後，點場景左上「選擇前／選擇後」直接對照，同一鏡頭保留完整人物與道具大小。切換時，有變化的人物與道具會短暫高亮，提示依各角色任務及選項說明，例如「播放熟悉歌單，家人靠近共聽」。前後兩側各有短句，最多兩則，約2.2秒後恢復。切換只影響畫面，不會改掉已選答案；「比較另一種做法」仍可預覽另一選項。手機與插畫備援也可切換，減少動態時使用靜態高亮。契約與驗收見 [前後場景對照](docs/MISSION-COMPARISON.md)、[差異提示](docs/MISSION-CHANGE-CUES.md) 與 [角色專屬短句](docs/MISSION-SPECIFIC-HINTS.md)。

每篇都有獨立 HTML 閱讀頁與原刊 PDF。瀏覽器不支援 WebGL 時仍可使用目錄。停用 JavaScript 時可開啟 `read/2026/index.html`。系統設定減少動態時不播放書塔轉場。

## 驗證及建置

```sh
npx playwright install chromium
npm test
npm run build
npm run preview -- --port 4174
```

另開終端機執行下列驗證。測試會操作真實 Chromium，依序執行可避免軟體 GPU 同時負載。產物在 `dist`，畫面與結果在 `test-results`。GitHub Actions 在 main 更新時建置並發布 GitHub Pages。

```sh
TEST_URL=http://127.0.0.1:4174/ npm run test:e2e
TEST_URL=http://127.0.0.1:4174/ node tests/journey-browser.mjs
TEST_URL=http://127.0.0.1:4174/ node tests/book-boundaries-browser.mjs
TEST_URL=http://127.0.0.1:4174/ node tests/explorer-browser.mjs
TEST_URL=http://127.0.0.1:4174/ node tests/explorer-mobile-browser.mjs
TEST_URL=http://127.0.0.1:4174/ node tests/holidays-browser.mjs
TEST_URL=http://127.0.0.1:4174/ node tests/visual-motion.mjs
```

執行 `node tests/visual-motion.mjs`，驗證首頁閒置後持續慢轉、暫停、恢復、略過轉場，以及慢畫格仍能完成進場。瀏覽器腳本均接受 `TEST_URL` 環境變數，可驗證正式網站。首頁書樹每150秒旋轉一圈，進場約6.5秒；系統減少動態與畫面上的動態按鈕可停止動畫。

全站共用聖誕、萬聖、復活三種節慶。首次預設聖誕，瀏覽器會保存選擇。「更多探索工具」提供日夜、閱讀夥伴與觀點關聯，預設收合。角色導讀與每本書的設定見 [角色閱讀說明](docs/ROLE-READING.md)，選擇式任務契約與驗收見 [角色情境任務](docs/ROLE-MISSIONS.md)，場景與動畫契約見 [任務場景](docs/ANIMATED-MISSIONS.md) 與 [3D 任務](docs/3D-MISSIONS.md)。

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

角色導讀與地圖策展都綁定書名及年度。未編排的新書使用中性閱讀區與真實文章目錄，不套用2026的主題、關聯或策展路線。年度 JSON 可另外加入經校對的 `journeys` 設定。

# Immersive 字型涵蓋範圍

`public/immersive/index.html` 載入 `public/fonts/publication.css`。字型產生器會把 immersive 介面的 Han 與 Hangul 字元納入 Publication 字型子集，避免 CSS 宣告載入成功後仍由系統字型補字。

## 語料與補充字型

`scripts/build_publication_fonts.py` 會掃描 `public/immersive` 下所有 `.js` 與 `.html` 檔案。它以 Python Unicode 名稱辨識 CJK 統一漢字、相容漢字與 Hangul 字元，並把來源路徑和字碼寫入 `public/fonts/manifest.json` 的 `corpora.immersive`。

產生器保留原刊的九個 TW chunk 與 TC 補字分組。它只把既有字型 shard 尚未涵蓋的 immersive Han 與 Hangul 字元放入獨立的 `Publication Sans TW` shard。這個 shard 使用 Source Han Sans TW Variable，CSS 字重範圍為 250 到 900。CSS 的 `unicode-range` 只列出該 shard 實際收錄的字碼。

重跑產生器時，如果原始字型雜湊、manifest 字集、CSS family、weight、Unicode range、檔案內部 family、variable weight 軸、WOFF2 cmap 與檔名 hash 都吻合，產生器會重用既有檔案。其他情況會重建所需字型，並刪除未被新 CSS 引用的舊 shard。檔名後十碼是 WOFF2 內容 SHA-256。

目前來源快照含 927 個不同的 immersive Han 與 Hangul 字碼，其中 25 個不在基準 CSS range 和 WOFF2 cmap 內。`publication-tw-ui` shard 收錄這 25 個字碼。

## 驗證

`tests/test_publication_immersive_fonts.py` 讀取原始 immersive 語料、CSS `unicode-range` 與每個 WOFF2 的 cmap。測試也核對 manifest 的來源檔清單、字碼與 Latin cmap。`tests/publication-fonts.test.mjs` 驗證既有 Publication 字型、授權檔與原刊頁面連結。

在已安裝 `fonttools[woff]` 的隔離 Python 環境中執行產生器：

```sh
python scripts/build_publication_fonts.py --source-dir /absolute/path/to/authorized-font-sources
python -m unittest tests/test_publication_immersive_fonts.py
node --test tests/publication-fonts.test.mjs
```

來源目錄須包含 manifest 所列的三個字型來源，以及兩份授權文字。正式頁面不需要原始字型檔。

## 字型未涵蓋的字元

`manifest.json` 的 `missingCodepoints` 列出 Source Han Sans TW Variable 與 Source Han Sans TC Light 的 cmap 都無法提供的請求字元。這個欄位不是發佈產物的 coverage 報告。回歸測試會用原始語料逐字核對實際 CSS range 與 WOFF2 cmap。U+200B 是零寬空白。下列 15 個介面符號沒有收入字型，沿用平台符號 fallback：

`U+21BA ↺`、`U+21BB ↻`、`U+2301 ⌁`、`U+2302 ⌂`、`U+2304 ⌄`、`U+2315 ⌕`、`U+2316 ⌖`、`U+25F7 ◷`、`U+2637 ☷`、`U+263C ☼`、`U+263E ☾`、`U+2659 ♙`、`U+265F ♟`、`U+270E ✎`、`U+2726 ✦`。

這份字型清單只涵蓋 manifest 記錄的原刊與 immersive 語料。它不代表完整 Unicode 字型。

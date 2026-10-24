# Publication typefaces

The original 2026 publication primarily uses SourceHanSansTW Light, Normal, Medium and Bold for Chinese, and Montserrat for Latin text. The website uses those open font families, not a browser's approximate serif replacement.

Sources:

- Source Han Sans TW variable. https://github.com/adobe-fonts/source-han-sans/tree/release/Variable/OTF/Subset
- Source Han Sans TC Light supplement for rare kanji and Hangul. https://github.com/adobe-fonts/source-han-sans/tree/release/OTF/TraditionalChinese
- Montserrat variable. https://github.com/google/fonts/tree/main/ofl/montserrat

Both upstream licenses are included. Subsets have renamed internal font families to respect reserved font names. `manifest.json` records source hashes, included codepoints and emitted sizes. Original outline designs are retained. The Chinese variable font supports weights 250 through 900, including the publication's 300, 350, 500 and 700 weights. Latin supports weights 100 through 900. Unicode chunks load only when their glyphs appear; font-display swap keeps reading available during downloads. Decorative interface symbols can use the platform's symbol fallback.

To regenerate after new books or UI text, download the three named upstream font files and both license texts into a local source directory, install `fonttools[woff]` in an isolated Python environment, then run `python scripts/build_publication_fonts.py --source-dir /absolute/font/source/directory`. Source font binaries are not required at runtime or during the normal production build.

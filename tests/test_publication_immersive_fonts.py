import json
import re
import unicodedata
import unittest
from pathlib import Path

from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]


def is_han_or_hangul(character):
    name = unicodedata.name(character, "")
    return name.startswith(
        (
            "CJK UNIFIED IDEOGRAPH-",
            "CJK COMPATIBILITY IDEOGRAPH-",
            "HANGUL ",
        )
    )


def css_codepoints(value):
    result = set()
    for token in value.split(","):
        start, separator, end = token.strip().removeprefix("U+").partition("-")
        low = int(start, 16)
        high = int(end, 16) if separator else low
        result.update(range(low, high + 1))
    return result


class PublicationImmersiveFontCoverageTest(unittest.TestCase):
    def test_native_immersive_han_and_hangul_have_css_ranges_and_woff2_glyphs(self):
        source_files = sorted(
            path
            for path in (ROOT / "public/immersive").rglob("*")
            if path.suffix in {".html", ".js"}
        )
        requested = {
            ord(character)
            for path in source_files
            for character in path.read_text(encoding="utf-8")
            if is_han_or_hangul(character)
        }
        css = (ROOT / "public/fonts/publication.css").read_text(encoding="utf-8")
        faces = []
        for body in re.findall(r"@font-face\{([^}]+)\}", css):
            family = re.search(r'font-family:"([^"]+)"', body)
            source = re.search(r'url\("([^"]+)"\)', body)
            codepoints = re.search(r"unicode-range:([^}]+)", body)
            if not family or family.group(1) != "Publication Sans TW":
                continue
            self.assertIsNotNone(source)
            self.assertIsNotNone(codepoints)
            font = TTFont(ROOT / "public/fonts" / source.group(1))
            faces.append((css_codepoints(codepoints.group(1)), set(font.getBestCmap())))

        declared = set().union(*(ranges for ranges, _ in faces))
        outlines = set().union(*(cmap for _, cmap in faces))
        self.assertEqual(
            sorted(requested - declared),
            [],
            "native immersive Han and Hangul characters need Publication CSS ranges",
        )
        self.assertEqual(
            sorted(requested - outlines),
            [],
            "native immersive Han and Hangul characters need WOFF2 glyph outlines",
        )

        manifest = json.loads((ROOT / "public/fonts/manifest.json").read_text(encoding="utf-8"))
        corpus = manifest["corpora"]["immersive"]
        self.assertEqual(corpus["files"], [str(path.relative_to(ROOT)) for path in source_files])
        self.assertEqual(corpus["codepoints"], sorted(requested))


if __name__ == "__main__":
    unittest.main()

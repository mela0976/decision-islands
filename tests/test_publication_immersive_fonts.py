import json
import re
import unicodedata
import unittest
from collections import Counter
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
        html = (ROOT / "public/immersive/index.html").read_text(encoding="utf-8")
        self.assertIn('href="../fonts/publication.css"', html)
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
            weight = re.search(r"font-weight:([^;]+)", body)
            self.assertIsNotNone(weight)
            font = TTFont(ROOT / "public/fonts" / source.group(1))
            faces.append(
                {
                    "file": source.group(1),
                    "family": family.group(1),
                    "weight": weight.group(1).strip(),
                    "ranges": css_codepoints(codepoints.group(1)),
                    "cmap": set(font.getBestCmap()),
                }
            )
        self.assertEqual(
            [
                (face["file"], sorted(face["ranges"] - face["cmap"]))
                for face in faces
                if face["ranges"] - face["cmap"]
            ],
            [],
            "each Publication Sans TW CSS range must point to outlines in its WOFF2 file",
        )

        declared = set().union(*(face["ranges"] for face in faces))
        outlines = set().union(*(face["cmap"] for face in faces))
        occurrences = Counter(codepoint for face in faces for codepoint in face["ranges"])
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
        self.assertEqual(
            sorted(codepoint for codepoint, count in occurrences.items() if count > 1),
            [],
            "Publication Sans TW CSS ranges must not overlap",
        )

        manifest = json.loads((ROOT / "public/fonts/manifest.json").read_text(encoding="utf-8"))
        corpus = manifest["corpora"]["immersive"]
        self.assertEqual(corpus["files"], [str(path.relative_to(ROOT)) for path in source_files])
        self.assertEqual(corpus["codepoints"], sorted(requested))
        supplemental = set(corpus["supplementalCodepoints"])
        self.assertTrue(supplemental)
        ui_entries = [face for face in manifest["files"] if set(face["codepoints"]) == supplemental]
        self.assertEqual(len(ui_entries), 1)
        ui_entry = ui_entries[0]
        self.assertEqual(ui_entry["file"], corpus["supplementalFile"])
        self.assertEqual(str(ui_entry["weight"]), "250 900")
        ui_face = next(face for face in faces if face["file"] == ui_entry["file"])
        self.assertEqual(ui_face["family"], "Publication Sans TW")
        self.assertEqual(ui_face["weight"], "250 900")
        self.assertEqual(ui_face["ranges"], supplemental)
        self.assertTrue(supplemental <= ui_face["cmap"])
        ui_font = TTFont(ROOT / "public/fonts" / ui_entry["file"])
        self.assertEqual(ui_font.flavor, "woff2")
        self.assertEqual(ui_font["name"].getDebugName(1), "Decision Publication Sans TW")
        ui_axes = {axis.axisTag: (axis.minValue, axis.maxValue) for axis in ui_font["fvar"].axes}
        self.assertEqual(ui_axes["wght"], (250.0, 900.0))
        other_ranges = set().union(*(face["ranges"] for face in faces if face["file"] != ui_entry["file"]))
        self.assertFalse(supplemental & other_ranges)

        latin_css = re.search(r'@font-face\{([^}]*font-family:"Publication Latin"[^}]+)\}', css)
        self.assertIsNotNone(latin_css)
        latin_file = re.search(r'url\("([^"]+)"\)', latin_css.group(1)).group(1)
        self.assertIn('font-weight:100 900', latin_css.group(1))
        self.assertIn('unicode-range:U+20-FF', latin_css.group(1))
        latin_font = TTFont(ROOT / "public/fonts" / latin_file)
        self.assertEqual(latin_font.flavor, "woff2")
        self.assertEqual(latin_font["name"].getDebugName(1), "Decision Publication Latin")
        latin_axes = {axis.axisTag: (axis.minValue, axis.maxValue) for axis in latin_font["fvar"].axes}
        self.assertEqual(latin_axes["wght"], (100.0, 900.0))
        latin_cmap = set(latin_font.getBestCmap())
        self.assertEqual(manifest["latinCodepoints"], sorted(latin_cmap))
        sample = set(map(ord, "I01 P05 Publication Sans TW 0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz"))
        self.assertTrue(sample <= latin_cmap)


if __name__ == "__main__":
    unittest.main()

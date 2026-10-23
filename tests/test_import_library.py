"""Behavior tests for the offline, manifest-driven content importer."""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/import_library.py"
spec = importlib.util.spec_from_file_location("import_library", SCRIPT)
importer = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(importer)


class ImportLibraryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.website = self.root / "site"
        self.website.mkdir()
        self.pdf_path = self.root / "book.pdf"
        writer = PdfWriter()
        pages = [writer.add_blank_page(width=200, height=100) for _ in range(3)]
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
        pages[1][NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
        stream = DecodedStreamObject()
        stream.set_data(b"BT /F1 12 Tf 20 50 Td (PDF body text) Tj ET")
        pages[1][NameObject("/Contents")] = writer._add_object(stream)
        with self.pdf_path.open("wb") as f:
            writer.write(f)
        self.cover_path = self.root / "cover.png"
        Image.new("RGB", (4, 4), "#336699").save(self.cover_path)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def manifest(self, **article_overrides):
        article = {
            "id": "2027-01", "order": 1, "chapter": "intro",
            "printedStart": 2, "printedEnd": 3, "sourcePages": [2],
            "metadata": {"title": "離線測試文章", "authors": "測試作者", "summary": "測試摘要", "highlights": ["一", "二", "三"]},
        }
        article.update(article_overrides)
        return {
            "schemaVersion": 1, "year": 2027, "title": "測試版",
            "fullBookPdf": "book.pdf", "coverSource": "cover.png",
            "maxSourcePage": 2, "articles": [article],
        }

    def write_manifest(self, data) -> Path:
        path = self.root / "manifest.json"
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return path

    def test_pdf_only_year_preserves_existing_catalog_and_reruns_idempotently(self):
        public = self.website / "public"
        (public / "data").mkdir(parents=True)
        previous = {"schemaVersion": 1, "year": 2026, "title": "既有年度", "articles": [{"id": "2026-01"}]}
        (public / "data/2026.json").write_text(json.dumps(previous), encoding="utf-8")
        (public / "data/catalog.json").write_text(json.dumps({"schemaVersion": 1, "years": [{"year": 2026, "title": "既有年度", "articleCount": 1, "dataUrl": "data/2026.json", "coverUrl": "assets/cover-2026.webp"}]}), encoding="utf-8")
        manifest = self.write_manifest(self.manifest())

        result = importer.run_import(manifest, self.root, self.website)
        first_catalog = json.loads((public / "data/catalog.json").read_text(encoding="utf-8"))
        first_edition = json.loads((public / "data/2027.json").read_text(encoding="utf-8"))
        self.assertEqual(result["articles"], 1)
        self.assertEqual([year["year"] for year in first_catalog["years"]], [2026, 2027])
        self.assertEqual(json.loads((public / "data/2026.json").read_text(encoding="utf-8")), previous)
        article = first_edition["articles"][0]
        self.assertEqual(article["sourcePages"], [2])
        self.assertEqual(article["paragraphs"], ["PDF body text"])
        self.assertTrue((public / "read/2027/index.html").exists())
        self.assertTrue((public / "read/2027/2027-01.html").exists())
        self.assertIn('href="2027-01.html"', (public / "read/2027/index.html").read_text(encoding="utf-8"))
        self.assertEqual(len(PdfReader(public / "sources/2027-01.pdf").pages), 1)
        self.assertIn("原始 PDF 文字擷取", (public / "read/2027/2027-01.html").read_text(encoding="utf-8"))
        expected = {p.relative_to(public).as_posix(): p.read_bytes() for p in public.rglob("*") if p.is_file()}

        importer.run_import(manifest, self.root, self.website)
        second_catalog = json.loads((public / "data/catalog.json").read_text(encoding="utf-8"))
        actual = {p.relative_to(public).as_posix(): p.read_bytes() for p in public.rglob("*") if p.is_file()}
        self.assertEqual(second_catalog, first_catalog)
        self.assertEqual(actual, expected)

    def test_duplicate_ids_are_rejected_before_any_output(self):
        data = self.manifest()
        duplicate = dict(data["articles"][0])
        duplicate["order"] = 2
        data["articles"].append(duplicate)
        manifest = self.write_manifest(data)
        with self.assertRaisesRegex(importer.ImportErrorDetail, "duplicate or invalid article ID"):
            importer.run_import(manifest, self.root, self.website)
        self.assertFalse((self.website / "public/data/catalog.json").exists())

    def test_invalid_printed_range_is_rejected(self):
        manifest = self.write_manifest(self.manifest(printedStart=4, printedEnd=3))
        with self.assertRaisesRegex(importer.ImportErrorDetail, "invalid printed page range"):
            importer.run_import(manifest, self.root, self.website)
        self.assertFalse((self.website / "public/data/2027.json").exists())

    def test_source_pages_cannot_exceed_manifest_boundary(self):
        manifest = self.write_manifest(self.manifest(sourcePages=[3]))
        with self.assertRaisesRegex(importer.ImportErrorDetail, "maxSourcePage 2"):
            importer.run_import(manifest, self.root, self.website)
        self.assertFalse((self.website / "public/data/catalog.json").exists())

    def test_real_2026_catalog_has_all_articles_and_clean_pdf_boundary(self):
        project_root = SCRIPT.parents[2]
        website_root = SCRIPT.parents[1]
        edition = json.loads((website_root / "public/data/2026.json").read_text(encoding="utf-8"))
        catalog = json.loads((website_root / "public/data/catalog.json").read_text(encoding="utf-8"))
        self.assertEqual(len(edition["articles"]), 22)
        self.assertEqual(catalog["years"][0]["articleCount"], 22)
        self.assertEqual(len({a["id"] for a in edition["articles"]}), 22)
        self.assertEqual(edition["articles"][0]["sourcePages"], [5, 6, 7])
        self.assertEqual(edition["articles"][-1]["sourcePages"][-1], 99)
        self.assertTrue(all(100 not in a["sourcePages"] for a in edition["articles"]))
        index = (website_root / "public/read/2026/index.html").read_text(encoding="utf-8")
        self.assertEqual(index.count("2026-"), 22)
        for article in edition["articles"]:
            self.assertTrue((website_root / "public" / article["htmlUrl"]).is_file())
            self.assertTrue((website_root / "public" / article["sourcePdf"]).is_file())
            self.assertGreater(len(article["paragraphs"]), 0)


if __name__ == "__main__":
    unittest.main()

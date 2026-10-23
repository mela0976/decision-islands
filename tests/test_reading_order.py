import json
from collections import Counter
from pathlib import Path
import sys
import unittest

from pypdf import PdfReader

WEBSITE = Path(__file__).resolve().parents[1]
ROOT = WEBSITE.parent
sys.path.insert(0, str(WEBSITE / "scripts"))
from reading_order import reconcile_reading_order
from import_library import _extract_idml


class Page:
    def __init__(self, chunks):
        self.chunks = chunks

    def extract_text(self, visitor_text):
        for text, x, y in self.chunks:
            visitor_text(text, [1, 0, 0, 1, 0, 0], [1, 0, 0, 1, x, y], None, 12)


class Reader:
    def __init__(self, *pages):
        self.pages = list(pages)


class ReadingOrderTests(unittest.TestCase):
    def test_columns_precede_vertical_position_and_text_is_preserved(self):
        paragraphs = ["Right column second paragraph.", "Left column second paragraph!",
                      "Right column first paragraph.", "Left column first paragraph!"]
        reader = Reader(Page([(paragraphs[0], 300, 500), (paragraphs[1], 50, 100),
                              (paragraphs[2], 300, 600), (paragraphs[3], 50, 200)]))
        ordered, audit = reconcile_reading_order(paragraphs, reader, [1])
        self.assertEqual(ordered, [paragraphs[3], paragraphs[1], paragraphs[2], paragraphs[0]])
        self.assertEqual(Counter(ordered), Counter(paragraphs))
        self.assertTrue(all(record["status"] == "matched" for record in audit))

    def test_unlocated_paragraph_is_reported_and_prevents_guessing(self):
        paragraphs = ["Missing original text", "Known original text"]
        ordered, audit = reconcile_reading_order(paragraphs, Reader(Page([(paragraphs[1], 50, 100)])), [1])
        self.assertEqual(ordered, paragraphs)
        self.assertEqual(audit[0]["status"], "unmatched")

    def test_repeated_label_is_explicitly_ambiguous(self):
        paragraphs = ["Repeated label"]
        ordered, audit = reconcile_reading_order(paragraphs, Reader(Page([
            (paragraphs[0], 50, 100), (paragraphs[0], 300, 200)])), [1])
        self.assertEqual(ordered, paragraphs)
        self.assertEqual(audit[0]["status"], "ambiguous")

    def test_full_run_disambiguates_label_from_prose(self):
        paragraphs = ["Label", "A Label appears in prose"]
        ordered, audit = reconcile_reading_order(paragraphs, Reader(Page([
            (paragraphs[1], 50, 100), (paragraphs[0], 50, 200)])), [1])
        self.assertEqual(ordered, paragraphs)
        self.assertTrue(all(record["status"] == "matched" for record in audit))

    def test_complete_citation_disambiguates_a_shared_long_prefix(self):
        prefix = "A research source with an unusually long title describing source materials and methods "
        paragraphs = [prefix + "second study", prefix + "first study"]
        ordered, audit = reconcile_reading_order(paragraphs, Reader(Page([
            (paragraphs[0], 50, 100), (paragraphs[1], 50, 200)])), [1])
        self.assertEqual(ordered, list(reversed(paragraphs)))
        self.assertTrue(all(record["status"] == "matched" for record in audit))


class PublicationSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((WEBSITE / "content/2026.json").read_text())
        pdf_path = ROOT / cls.manifest["fullBookPdf"]
        if not pdf_path.exists():
            raise unittest.SkipTest("Original publication PDF is not installed")
        cls.reader = PdfReader(pdf_path)

    def reconcile(self, index):
        spec = self.manifest["articles"][index - 1]
        paragraphs = _extract_idml(ROOT / spec["idmlSource"], self.manifest["paragraphStylePrefixes"])
        pages = list(range(spec["printedStart"] // 2 + 2, spec["printedEnd"] // 2 + 3))
        ordered, audit = reconcile_reading_order(paragraphs, self.reader, pages)
        self.assertEqual(Counter(ordered), Counter(paragraphs))
        self.assertEqual(len(audit), len(paragraphs))
        return paragraphs, ordered, audit

    def test_article_one_challenges_precede_conclusion(self):
        _, ordered, audit = self.reconcile(1)
        self.assertTrue(all(record["status"] == "matched" for record in audit))
        positions = {prefix: next(i for i, p in enumerate(ordered) if p.startswith(prefix))
                     for prefix in ["第一個挑戰", "第二個挑戰", "第三個挑戰", "但興奮，不能取代警覺"]}
        self.assertLess(positions["第一個挑戰"], positions["第二個挑戰"])
        self.assertLess(positions["第二個挑戰"], positions["第三個挑戰"])
        self.assertLess(positions["第三個挑戰"], positions["但興奮，不能取代警覺"])

    def test_article_twelve_repeated_diagram_labels_require_review(self):
        original, ordered, audit = self.reconcile(12)
        self.assertTrue(any(record["status"] == "ambiguous" for record in audit))
        self.assertEqual(ordered, original)

    def test_article_twenty_two_has_unique_source_anchors(self):
        _, _, audit = self.reconcile(22)
        self.assertTrue(all(record["status"] == "matched" for record in audit))


if __name__ == "__main__":
    unittest.main()

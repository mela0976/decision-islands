"""Locate IDML paragraphs in PDF columns without changing their text.

The returned audit has one record per input paragraph. A caller must treat any
status other than ``matched`` as unverified. In that case the original sequence
is returned intact, rather than guessing a position for missing source text.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import unicodedata


def _normalized(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKC", text) if c.isalnum())


@dataclass
class _PageText:
    number: int
    text: str
    positions: list[tuple[float, float]]
    columns: list[float]
    boundaries: set[int]


def _page_text(page, number: int) -> _PageText:
    pieces: list[str] = []
    positions: list[tuple[float, float]] = []
    starts: list[float] = []
    boundaries = {0}

    def visit(text, cm, tm, font, size):
        normalized = _normalized(text)
        if not normalized:
            return
        x = float(tm[4] * cm[0] + tm[5] * cm[2] + cm[4])
        y = float(tm[4] * cm[1] + tm[5] * cm[3] + cm[5])
        pieces.append(normalized)
        positions.extend([(x, y)] * len(normalized))
        boundaries.add(len(positions))
        if len(normalized) >= 12 and x > 0 and y > 0:
            starts.append(x)

    page.extract_text(visitor_text=visit)
    bins = Counter(round(x / 10) * 10 for x in starts)
    clusters: list[list[tuple[float, int]]] = []
    for x, count in sorted(bins.items()):
        if clusters and x - clusters[-1][-1][0] <= 30:
            clusters[-1].append((x, count))
        else:
            clusters.append([(x, count)])
    threshold = max(2, max((sum(n for _, n in group) for group in clusters), default=0) * .12)
    columns = [sum(x * n for x, n in group) / sum(n for _, n in group)
               for group in clusters if sum(n for _, n in group) >= threshold]
    return _PageText(number, "".join(pieces), positions, columns, boundaries)


def reconcile_reading_order(paragraphs: list[str], reader, source_pages: list[int]) -> tuple[list[str], list[dict]]:
    """Return original strings sorted by PDF page, column, then vertical position.

    ``source_pages`` uses one-based physical PDF page numbers. Matching ignores
    whitespace, punctuation and full-width variants, but output text is exact.
    An unresolved or repeated anchor prevents reordering the entire article.
    """
    if source_pages != sorted(set(source_pages)) or any(
        not isinstance(n, int) or n < 1 or n > len(reader.pages) for n in source_pages
    ):
        raise ValueError("source_pages must be unique ascending physical PDF pages")
    pages = [_page_text(reader.pages[n - 1], n) for n in source_pages]
    audit: list[dict] = []
    for index, paragraph in enumerate(paragraphs):
        normalized = _normalized(paragraph)
        lengths = sorted({len(normalized), *(min(len(normalized), n) for n in (64, 48, 32, 20, 12, 8))}, reverse=True)
        candidates: list[tuple[_PageText, float, float]] = []
        anchor_length = 0
        for length in lengths:
            if not length:
                continue
            candidates = []
            boundary_scores: list[int] = []
            anchor = normalized[:length]
            for page in pages:
                offset = page.text.find(anchor)
                while offset >= 0:
                    position = next(((x, y) for x, y in page.positions[offset:offset + length]
                                     if x > 0 and y > 0), None)
                    if position is not None:
                        candidate = (page, *position)
                        if not any(p.number == page.number and x == position[0] and y == position[1]
                                   for p, x, y in candidates):
                            candidates.append(candidate)
                            boundary_scores.append(int(offset in page.boundaries) + int(
                                length == len(normalized) and offset + length in page.boundaries))
                    offset = page.text.find(anchor, offset + 1)
            if candidates:
                if length == len(normalized) and max(boundary_scores) == 2:
                    candidates = [candidate for candidate, score in zip(candidates, boundary_scores) if score == 2]
                anchor_length = length
                break
        record = {"inputIndex": index, "status": "unmatched", "anchorLength": anchor_length}
        if len(candidates) == 1:
            page, x, y = candidates[0]
            column = min(range(len(page.columns)), key=lambda i: abs(page.columns[i] - x)) if page.columns else 0
            record.update(status="matched", sourcePage=page.number, column=column, x=round(x, 3), y=round(y, 3))
        elif candidates:
            record.update(status="ambiguous", candidateCount=len(candidates))
        audit.append(record)
    if any(record["status"] != "matched" for record in audit):
        return list(paragraphs), audit
    indices = sorted(range(len(paragraphs)), key=lambda i: (
        audit[i]["sourcePage"], audit[i]["column"], -audit[i]["y"], i))
    return [paragraphs[i] for i in indices], audit

# NPC article explorer and manual zoom

## Scope and contracts

- Adjustable island NPC population: integer 10–100, default 30. Existing NPC identities, routes and topics remain stable when retained. Nine visual roles; pooled rendering capacity 100.
- NPC dialogue uses current edition articles only. Structured questions reveal site summaries, reading notes and actual publication metadata, with an original article entry. This is authored conversation, not an open-ended AI service.
- Accessible role-grouped NPC chooser on mobile and without WebGL. A removed NPC or new book clears the old conversation; population persists within the session.
- Island OrbitControls retains existing zoom. Mission scenes gain wheel zoom 0.65–2.4, keyboard +/-/0 and double-click reset. Camera fitting stays separate from user zoom; comparisons retain the factor and never change the answer.
- Guided task comparison stays deterministic; island walking resumes on free exploration or NPC selection.

## Ownership and dependency checkpoint

Independent owners: population/simulation/rendering (Sol), dialogue/UI (Luna), mission wheel/lifecycle (Luna). Root owns integration, browser acceptance and publication; Astra reviews source boundaries and lifecycle. Core roster API precedes dialogue integration. Each file has one writer.

Feature checklist: [x] define contracts; [x] core population; [x] zoom implementation; [x] dialogue integration; [x] independent review; [x] browser acceptance; [x] full checks; [ ] publish and live readback.

Throughput checkpoint: population and zoom focused suites finished before dialogue integration. Root prepared integration acceptance while UI work continued. No comparable serial control or token/time saving percentage is claimed.

## Acceptance evidence

Local acceptance:

- `npm test`: 82/82 pass, including real WebGL population pooling/picking/disposal, wheel lifecycle and 672 mission readability frames.
- `npm run build`: pass; existing large-chunk advisory remains.
- `tests/npc-zoom-browser.mjs`: actual canvas population 10/100, stable retained topics, removed selection cleanup, nine-role chooser, distinct summary/reading-note replies and correct reader, real context loss retaining dialogue, 360px mobile touch sizes/no overflow, future-book reset and source boundary, trusted mouse-wheel island and mission zoom, comparison/answer preservation and reset.
- `tests/explorer-mobile-browser.mjs`: existing 390px chapter filters, sheet drag/focus/inert and overflow checks pass.
- Python import/order checks: 10 pass; one original-PDF class skipped in isolated checkout. `check_public.py`: 22 articles, 22 PDFs, zero findings.
- Independent source review: no remaining P1/P2. Review caught mobile expanded-sheet specificity; actual browser caught desktop chooser close-button overlap. Both fixed and read back.

Live deployment and final expanded NPC-sheet browser assertion pending.

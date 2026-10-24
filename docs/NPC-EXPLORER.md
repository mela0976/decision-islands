# NPC article explorer and manual zoom

## Scope and contracts

- Adjustable island NPC population: integer 10–100, default 30. Existing NPC identities, routes and topics remain stable when retained. Nine visual roles; pooled rendering capacity 100.
- NPC dialogue uses current edition articles only. Structured questions reveal site summaries, reading notes and actual publication metadata, with an original article entry. This is authored conversation, not an open-ended AI service.
- Accessible role-grouped NPC chooser on mobile and without WebGL. A removed NPC or new book clears the old conversation; population persists within the session.
- Island OrbitControls retains existing zoom. Mission scenes gain wheel zoom 0.65–2.4, keyboard +/-/0 and double-click reset. Camera fitting stays separate from user zoom; comparisons retain the factor and never change the answer.
- Guided task comparison stays deterministic; island walking resumes on free exploration or NPC selection.

## Ownership and dependency checkpoint

Independent owners: population/simulation/rendering (Sol), dialogue/UI (Luna), mission wheel/lifecycle (Luna). Root owns integration, browser acceptance and publication; Astra reviews source boundaries and lifecycle. Core roster API precedes dialogue integration. Each file has one writer.

Feature checklist: [x] define contracts; [x] core population; [x] zoom implementation; [x] dialogue integration; [x] independent review; [x] browser acceptance; [x] full checks; [x] publish and live readback.

Throughput checkpoint: population and zoom focused suites finished before dialogue integration. Root prepared integration acceptance while UI work continued. No comparable serial control or token/time saving percentage is claimed.

## Acceptance evidence

Local acceptance:

- `npm test`: 82/82 pass, including real WebGL population pooling/picking/disposal, wheel lifecycle and 672 mission readability frames.
- `npm run build`: pass; existing large-chunk advisory remains.
- `tests/npc-zoom-browser.mjs`: actual canvas population 10/100, stable retained topics, removed selection cleanup, nine-role chooser, distinct summary/reading-note replies and correct reader, real context loss retaining dialogue, 360px mobile touch sizes/no overflow, future-book reset and source boundary, trusted mouse-wheel island and mission zoom, comparison/answer preservation and reset.
- `tests/explorer-mobile-browser.mjs`: existing 390px chapter filters, sheet drag/focus/inert and overflow checks pass.
- Python import/order checks: 10 pass; one original-PDF class skipped in isolated checkout. `check_public.py`: 22 articles, 22 PDFs, zero findings.
- Independent source review: no remaining P1/P2. Review caught mobile expanded-sheet specificity; actual browser caught desktop chooser close-button overlap. Both fixed and read back.

Additional checks passed: existing desktop explorer regression, book identity/load-failure boundaries, and 390/360px WebGL/SVG change-cue regressions. The 360px NPC sheet expansion assertion also passed after waiting for the browser to apply the layout. Original checkout with the publication PDF passed all 13 Python tests; the Python sources and publication content are unchanged by this feature.

Implementation commits: `590fb80` (population), `96006d9` (zoom), `8b05752` (dialogue and integrated acceptance). First GitHub run `40065465394` passed 81/82 tests and blocked deployment. The single failure was an asynchronous reduced-motion media event: one legitimate settle render arrived after the test baseline. It was reproduced locally. Test-only commit `e807be5` initializes reduced motion before stage creation, retaining the exact no-idle-RAF assertion; its focused test passed. No production behavior was relaxed. Replacement [GitHub run 40065868471](https://github.com/mela0976/decision-islands/actions/runs/40065868471) completed successfully: 82/82 JavaScript tests, 10 Python checks with the absent-original-PDF class explicitly skipped, public-content check and production build, followed by successful Pages deployment.

## Published acceptance

- Published code head: `e807be5`. [Open the verified site](https://mela0976.github.io/decision-islands/?v=e807be5).
- HTTP 200 HTML references `index-12ziCRw7.js` and `index-tTr5nnug.css`, matching the verified local build.
- The complete `tests/npc-zoom-browser.mjs` passed again against the public Pages URL, including 10/100 actual canvas population, nine-role chooser, current-article conversation and reader, retained/removed selections, real context-loss fallback, 360px touch/overflow/expanded dialogue sheet, synthetic future-book reset, trusted wheel zoom and unchanged mission answers/comparison scale. No page errors.
- Local and public evidence: `test-results/npc-explorer/local-results.json`, `results.json`, and desktop/mobile screenshots. Evidence and built output copied back to the original checkout.
- Original checkout's pre-existing package.json/package-lock.json/requirements.txt modifications were preserved. No package upgrades or production settings were included in this feature.

Browser acceptance uses Chromium desktop and mobile viewport/touch emulation, not a physical phone benchmark.

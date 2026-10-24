# NPC encounters, mobile interaction and browser reading records

## Scope and source

2026-10-24. User requests NPCs to stop and face the player, speak in a bubble, react naturally and explain articles through each role's life/work. Later requests add all mobile page interaction/loading within two seconds, publication typefaces, browser caching and persistent reading/notes. Notion live SOP B+C read for this task, last edited 2026-10-23. poteto Feature and Perf playbooks apply. Main chat model has not been independently read back; dispatched roles use the available configured Sol, Luna and Astra models.

Original checkout has unrelated package.json/package-lock.json/requirements.txt upgrades. These stay untouched. Integration worktree is `/tmp/decision-islands-npc-encounters`, base `02fb46b`.

## Feature checklist

1. `how` over the affected subsystem. Done. Selection and detail visibility are separate; closing a detail retains selection. Walking simulation owns distance/wait/gait; scene owns rendering; UI owns dialogue; main/world bridge them.
2. `architect` for parallel design exploration. Done. Sol and Astra independently compared simulation-owned encounter state with per-update hold input and visual-only freezing. Chosen setter preserves exact route/wait/gait; visual freezing alone would teleport.
3. Write the throughput checkpoint as four todo items.
   - Blocking first steps. Grounding, live SOP and shared types settled before implementation.
   - Independent workstreams. Sol simulation/rendering, Luna conversation UI, Luna scenario content, Sol measured mobile startup, Luna notes/cache; root owns shared types, publication fonts, integration and acceptance. Astra reviews without writes.
   - Shared mutable state. Disjoint source owners. Root finished main/world bridges before handing those files to performance owner. GPU profiling and GPU tests take exclusive windows.
   - Smallest safe decomposition. Simulation and its tests stay together; UI and its lifecycle stay together; authored scenario tables and provenance tests stay together. No nested agents.
4. Delegate code-writing to a subagent using your configured feature model. Done, file scopes recorded above; complex simulation and performance use Sol.
5. Verify on the matching surface. Done. Local and public Chromium acceptance covers real NPC motion state, bubbles, fonts and browser persistence.
6. Rebase into small, ordered commits. Done. Typeface unit ca6e319, integrated encounters/persistence a40eda7, mobile and dialogue follow-up 19fd1c8.
7. If the design is contested, `interrogate` before shipping. Skip, both design candidates agree on the final ownership and invariants.
8. Run Opening a PR. Skip, this existing project uses the user's authorized direct GitHub Pages publication path.

## Contracts and decisions

- `NpcSpeechCue` holds walkerId, monotonically increasing token, short text and one finite reaction. Existing selection plus detail visibility determines engagement. Other NPCs continue; closing/list/reader/book/removal releases the held route exactly.
- `ExplorerData.bookTitle` comes from the current edition and guards authored 2026 scenarios, together with article ID/title. Role situations are illustrative applications. Authored actions/costs are not attributed to the author.
- Short bubble text and full conversational answer are separate. Same-NPC reopening re-arms one greeting. Paused/reduced layouts invalidate once on panel changes and do not create an idle loop.
- The original PDF font audit identified SourceHanSansTW Light/Normal/Medium/Bold and Montserrat as primary families. Open upstream font outlines are self-hosted as renamed OFL subsets; one variable face covers all Chinese weights, unicode chunks load on demand, and a SourceHanSansTC supplement covers rare kanji/Hangul. Static reading pages and future importer output use the same CSS. Icons may use symbol fallback.
- Performance claims require production artifacts, explicit network/CPU profile, real visible results, errors counted, repeated runs and separate profile traces. Headless GPU results do not establish physical phone performance. Two-second cold loading cannot be promised independently of network transfer volume.
- Existing completed/bookmark browser storage remains. Notes use full book title/year/article ID and a separate versioned local key. Cache updates must preserve local records and keep first-load work nonblocking.

## Acceptance

Pending. Leaf results are provisional until integrated acceptance. Engine CPU hold tests 6/6 and real WebGL tests 2/2 passed before async warmup lifecycle follow-up. Content scenarios/dialogue 10/10 passed, including current-book guards and role situations. Original five cold baseline runs at 1.6 Mbps down, 750 Kbps up, 150 ms RTT, CPU x4 measured median 8.916 seconds to real article controls; details live in test-results/mobile-performance artifacts. No physical phone timing has been claimed.

Unavailable upstream deslop/control-ui capabilities are replaced by independent source/comment review and actual Chromium acceptance, not claimed as executed tools.


## Final verified delivery

- Code head `19fd1c8`. [Published site](https://mela0976.github.io/decision-islands/?v=19fd1c8).
- [GitHub Pages run 40069795684](https://github.com/mela0976/decision-islands/actions/runs/40069795684) passed all 114 JavaScript tests, Python checks, public-content boundary, production build and deployment. Python ran 10 tests with the absent-original-PDF class explicitly skipped; original source-PDF verification was read from the provided publication during this task.
- HTTP 200 live HTML references `index-DVSviRK9.js`, `index-DreIlNmY.css` and the self-hosted publication font sheet, matching the verified local build.
- Local and published `tests/npc-encounter-browser.mjs` passed at 1280px and 390px. Actual instance positions stay fixed while talking, body faces camera, questions change bubble text, close/reopen preserves history and re-greets, paused expanded mobile sheet repositions/hides bubbles, reading the source releases the NPC, and CDP reports actual custom font rendering.
- Local and published `tests/reading-persistence-browser.mjs` passed. Actual note entry, close/reload, bookmarks/completion, CacheStorage, offline reload and offline note editing survive another reload. User markup remains plain textarea text. Tests use isolated browser profiles and fictional notes.
- All 96 English choice-specific before/after hints passed at 360px with the new typefaces; complete words fit at 12px and preview leaves the adopted answer unchanged.
- Root focused real-WebGL mission/encounter suite passed 7/7. Root CPU cache, notes, scenarios, population, typography and camera suite passed 44/44. CI ran the full 114-test suite afterward.

## Measured two-second target

Final code was measured five times under 390x844 Chromium mobile emulation, 10 Mbps download, 150ms latency and CPU x4. HTTP cache and service workers were disabled for cold-run fairness. The report records exact asset SHA256 and all raw runs.

| User-visible operation | Median | Range or maximum |
| --- | --- | --- |
| Real article controls after cold navigation | 1.364s | 1.343–1.388s |
| Initial publication fonts ready | 1.366s | 1.345–1.390s |
| Click entry to actual rendered island | 1.384s | 1.345–1.440s |
| NPC selection and response | 0.644s | below 2s in all five |
| Open full article and finish its fonts | 0.543s | 0.540–0.598s |
| Open a mission | 0.601s | 0.596–0.694s |
| Choice to final physical result | 1.522s | maximum 1.544s |

All measured named interactions met two seconds in that profile, with zero page/HTTP errors. Absolute navigation to the initial complete island frame remained 2.749s, range 2.712–2.786s. This is a visible remaining gap if the requirement means every 3D frame must be fully initialized within two seconds of cold navigation. Physical phones, every role, arbitrary networks, DNS/TLS and CDN delays were not measured. No universal two-second claim or cross-network speedup percentage is made.

Evidence is preserved in `test-results/mobile-performance-19fd1c8-10mbps/REPORT.md`, `raw-runs.json`, `summary.json` and failure-recovery.json. Earlier 1.6Mbps and prefetch experiments remain experimental and must not be substituted for final-code measurements. Prefetch-before-readiness was rejected because GPU work delayed usable controls. Mobile skips the extra cosmos transition, while desktop retains the 900ms camera path. Both retain the library and island geometry.

## Review corrections and limitations

Independent reviews identified and owners fixed same-NPC reentry, paused-sheet layout invalidation, authored-action attribution, pending shader/resource lifetime, initial instance-color shader variants, and lost article fallback on optional-module failure. Cache review reproduced 100 parallel writes exceeding 80 entries and historical pages evicting shell dependencies; mutation serialization and active-dependency priorities now have regression tests. A temporary storage read failure no longer creates a blank draft that could overwrite an existing note.

The first CI run 40069353330 blocked publication because a motion-phase assertion retained the old 2800ms timing after the action was shortened to 1400ms. The assertion now samples the corresponding 600ms interaction phase; no coverage was removed. A local lifecycle race also exposed an unnecessary render after a queued media change while hidden, fixed at the render boundary. Final CI is green.

Notes, bookmarks and read status live in this browser. They do not sync between devices. Cache is bounded to 80 resources and progressively stores visited public content; this does not promise every PDF or never-visited article offline. Updates preserve user local storage. Source package upgrades already present in the original checkout remain untouched. No comparable parallel/serial control or token saving is claimed.

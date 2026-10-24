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
5. Verify on the matching surface. Pending integrated browser, fonts, cache and notes acceptance.
6. Rebase into small, ordered commits. Pending.
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

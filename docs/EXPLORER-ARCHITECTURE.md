# Decision Islands explorer architecture

Design only. Source inspected on 2026-10-23. No implementation, browser run, performance measurement, commit or deployment is represented by this document.

## Grounding and constraints

At the initial baseline, `src/world.ts` owned one renderer, one RAF, visibility and resize observers, a library scene group, cosmos group, four hand-built chapter islands, an orthographic explorer camera, manual pointer rotation, manual projected DOM labels and a WebGL fallback. `src/main.ts` owns the current Edition, history/deep links, reader dialog, bookmarks, search and year changes. `src/library.ts` owns four original chapters, three editorial reading paths and protected localStorage access. `src/types.ts` already describes real Article content and Edition. These content types should remain authoritative.

`src/entrance.ts` defines a 6.5-second entrance and a separate `treeRotationForElapsed` function with a 150-second full rotation. Preserve this distinction. The requested 150 seconds belongs to tree rotation, not entrance duration. Preserve `library-scene.ts`, `library-materials.ts`, the natural library, its rotating tree and cosmos passage.

The pasted reference is a policy-city demo with fictional institutions. This project instead presents real published articles. Reuse its geometry, navigation, walking simulation and interaction richness. Do not import its policy names, invented facts, milestones, evidence claims or fictional publication content. Retain the current Vite/TypeScript application and installed Three.js version. Do not downgrade to the reference's CDN importmap or single HTML structure.

## Two structural candidates

| Concern | A. Separate explorer scene, shared renderer | B. Replace islands inside existing scene |
| --- | --- | --- |
| Scene ownership | Explorer owns its Scene, PerspectiveCamera, OrbitControls and CSS2DRenderer. world remains the renderer and entrance host. | New islands replace the old `world` group. Existing scene also contains library and cosmos. |
| Library preservation | Library scene environment, cameras and lighting stay isolated. | Explorer fog, environment, sky and shared scene background must be restored correctly for every entrance frame. |
| Input | Explorer controls connect only in the islands phase. | Manual world rotation must be deleted and OrbitControls carefully gated against entrance camera logic. |
| Cleanup | Explorer disposes only its resources; world disposes the shared renderer. | Generic scene traversal risks disposing shared kit geometry/materials repeatedly and touching library-owned resources. |
| Draw loop | One world RAF calls the active scene adapter. No second RAF. | One existing RAF with more phase branches and settings mutations. |
| Cost | Explicit scene switch and renderer settings ownership are required. Two scene objects are lightweight; scene memory needs lifecycle policy. | Smaller initial integration diff, but more hidden coupling across lighting, labels, camera and teardown. |
| Failure | Explorer failure can retain entrance plus accessible content UI. | Partial construction can contaminate the common scene and failure cleanup. |

Recommend A. The library is an existing, visually sensitive experience, while the new explorer replaces nearly all old explorer behavior. One new module can own that behavior without introducing a second renderer or altering library internals. Candidate B remains viable only if scene-global settings, controls and resource ownership are extracted first. That extraction erases much of its apparent simplicity.

Design screening found two risks in A. Passing the entire world object would leak internals; inject only canvas/invalidation and pass the renderer at render time. Splitting state between scene and UI would create competing writers; centralize user intent in one controller and keep simulation state private to its engine.

## Caller shape

The intended caller is the application controller in main.ts, with world bridging lifecycle and rendering.

```ts
const data = buildExplorerData(DATA, edition);
const explorer = createExplorerEngine({
  data, canvas: renderer.domElement, labelHost,
  invalidate: wake,
  onSelection: selection => applySelection(selection, 'scene'),
  onEvents: events => explorerUI.appendEvents(events),
});
const explorerUI = createExplorerUI(uiHost, data, {
  onSelection: selection => applySelection(selection, 'ui'),
  onReadArticle: id => { activePath = null; openArticle(id); },
  onCommand: command => applyCommand(command),
});
function applySelection(selection: ExplorerSelection, origin: SelectionOrigin) {
  explorerState = { ...explorerState, selection };
  explorer.setSelection(selection, { focus: origin !== 'reader' });
  explorerUI.render(explorerState);
}
```

This is a usage sketch, not an instruction to expose renderer locals from world to main. In final wiring world constructs the engine with its private renderer canvas and exposes controlled explorer methods. Callbacks may close over the UI after both constructors finish. Constructors must not emit selection callbacks synchronously. A single `applySelection` path handles scene hits, label buttons, list entries, flow chips and journal events. `setSelection` applies state without re-emitting it. Reading remains an explicit action; selection opens an explorer detail card, not the reader dialog.

## Data and selection contract

Place shared contracts in `src/explorer-types.ts`. Domain types contain no Three.js objects or DOM nodes.

```ts
import type { Article, Edition } from './types';

export type I18nText = { zh: string; en: string };
export type IslandId = string;
export type ItemId = string;
export type FlowId = string;
export type WalkerId = string;
export type Vec3 = readonly [number, number, number];
export type ModelKind =
  | 'book' | 'pavilion' | 'classroom' | 'observatory'
  | 'studio' | 'bridge' | 'garden' | 'stage'
  | 'clock' | 'globe' | 'workshop' | 'lighthouse';

export interface ExplorerIsland {
  id: IslandId;
  title: I18nText;
  description: I18nText;
  axial: readonly [q: number, r: number];
  color: string;
  ground: 'brick' | 'speckle' | 'stripe';
  tree: 'pine' | 'blossom' | 'fruit' | 'palm' | 'willow';
  itemIds: readonly ItemId[];
}
export interface ExplorerItem {
  id: ItemId;
  islandId: IslandId;
  articleId: Article['id'];
  model: ModelKind;
  // Text below is editorial navigation, never replacement article content.
  caption: I18nText;
}
export type FlowEvidence =
  | { kind: 'thematic'; rationale: I18nText }
  | { kind: 'source'; rationale: I18nText }
  | { kind: 'pending'; rationale: I18nText };
export interface ExplorerFlow {
  id: FlowId;
  from: IslandId;
  to: IslandId;
  articleIds: readonly string[];
  cargo: 'book' | 'idea' | 'memory' | 'data';
  role: string; // Resolves one of the nine DATA.roles entries.
  evidence: FlowEvidence;
  walkerCount: number;
}
export interface DaySegment {
  id: string;
  title: I18nText;
  startMinute: number;
  endMinute: number;
  itemIds: readonly ItemId[];
}
export interface DayKeyframe {
  minute: number;
  skyTop: string; horizon: string; sunColor: string; sunIntensity: number;
  hemiSky: string; hemiGround: string; hemiIntensity: number;
  night: number; water: string;
}
export interface ExplorerData {
  schemaVersion: 1;
  year: number;
  title: string;
  seed: number;
  articles: readonly Article[];
  islands: readonly ExplorerIsland[];
  items: readonly ExplorerItem[];
  flows: readonly ExplorerFlow[];
  daySegments: readonly DaySegment[];
  dayKeyframes: readonly DayKeyframe[];
}
export type ExplorerSelection =
  | null
  | { kind: 'island'; islandId: IslandId }
  | { kind: 'item'; itemId: ItemId }
  | { kind: 'walker'; walkerId: WalkerId }
  | { kind: 'flow'; flowId: FlowId };
export type SelectionOrigin = 'scene' | 'ui' | 'reader';
```

`DATA` owns twelve theme definitions, their axial layout, model choices, editorial grouping rules, six to ten curated relationships, five to eight reading-time segments and environmental keyframes. `buildExplorerData(DATA, edition)` is the only bridge to Article records. A typed raw config can use article order selectors for the known 2026 curation, but must resolve them against the current Edition and emit actual current-year IDs. Do not interpolate `2026-${order}` in the renderer or UI.

An item is a model placement, not a second Article. The approved 2026 layout contains 48 placements, four per theme, referring to 22 canonical articles. Article titles, text, bookmarks, completion and PDF links remain keyed by canonical articleId. Placement IDs should be stable strings such as `growth:01`; selecting `growth:01` and another theme's placement of the same article may focus different models but must open the same canonical reader and bookmark. Do not report 48 articles. An article-to-placement lookup returns multiple items; reader-origin synchronization should retain a currently selected matching placement, otherwise choose the first matching placement by stable theme order. A theme does not replace Article.chapter, and original chapters remain available for reading and filters.

Approved 2026 theme order selectors live only in DATA.

| Theme | Article orders |
| --- | --- |
| growth | 1, 4, 5, 14 |
| human | 2, 3, 6, 7 |
| trust | 3, 6, 9, 19 |
| community | 2, 7, 9, 11 |
| attention | 8, 10, 11, 13 |
| insight | 5, 12, 14, 17 |
| choice | 13, 15, 18, 19 |
| experience | 15, 17, 18, 22 |
| culture | 1, 5, 16, 21 |
| craft | 8, 19, 20, 21 |
| governance | 14, 16, 20, 22 |
| agents | 2, 4, 7, 22 |

The union of these selectors covers orders 1 through 22. Check 48 unique placement IDs and 22 unique canonical article references for the supplied edition. No empty article placeholders or fictional policy-item expansion. Non-2026 editions use explicitly declared year curation if present. Otherwise resolve available orders against that edition and omit missing placements, with deterministic chapter/order grouping for any unmapped actual articles. Empty themes may be visible as unavailable navigation but never get invented articles. Relationships with missing endpoints or source articles are omitted. Six to ten flows is the acceptance target for the supplied 2026 data, not an excuse to fabricate relationships for unknown editions.

Do not silently mark a connection `official`. Editorial links are labeled “Editorial connection / 策展連結”. A `source` relationship requires real supporting article IDs and a truthful explanation of what those articles support. It still must not imply an official institution or policy endorsement. Line treatment derives from evidence kind. If no directly supported numeric fact exists, item cards use real reading minutes, printed page range and article order rather than fabricated metrics. Do not regex-mine unrelated years or page numbers into impressive factual claims. English UI uses translated editorial chrome; real article titles and bodies remain original unless an actual translation exists.

At the data boundary check unique IDs, valid article references, valid registry model kinds, all item ownership, connected axial layout, finite time/keyframe numbers, nonnegative edge weights, and valid segment ranges. Emit a useful data error and retain normal article reading if validation fails. Internals use the validated shape without repeating guards.

The sketches below explain ownership; the final source contract in `src/explorer-types.ts` and complete specification in `EXPLORER-PROMPT.md` take precedence over any omitted fields.

## State and commands

```ts
export type ExplorerCommand =
  | { type: 'overview' }
  | { type: 'birdseye'; enabled: boolean }
  | { type: 'minute'; minute: number }
  | { type: 'paused'; paused: boolean }
  | { type: 'toggle'; key: 'names' | 'walkers' | 'flows' | 'journal'; value: boolean }
  | { type: 'query'; query: string }
  | { type: 'tab'; tab: 'themes' | 'connections' }
  | { type: 'panel'; panel: 'list' | 'detail'; open: boolean }
  | { type: 'journalFilter'; flowId: FlowId | null };
export interface ExplorerState {
  selection: ExplorerSelection;
  language: 'zh' | 'en';
  query: string;
  tab: 'themes' | 'connections';
  minute: number;
  paused: boolean;
  reducedMotion: boolean;
  names: boolean;
  walkers: boolean;
  flows: boolean;
  journal: boolean;
  journalFilter: FlowId | null;
  birdseye: boolean;
  listOpen: boolean;
  detailOpen: boolean;
}
export interface ExplorerEvent {
  id: number;
  type: 'depart' | 'arrive' | 'handoff';
  flowId: FlowId;
  walkerId: WalkerId;
  islandId: IslandId;
  minute: number;
}
```

Application controller owns the canonical UI state. Engine owns simulation cursors, paths, camera interpolation and render buffers. UI owns only ephemeral DOM focus and sheet dragging. Engine reports clock and bounded event batches through callbacks so UI minute and journal reflect simulation. Limit journal to the latest 100 events. Initialization and resets do not fabricate departure history. Unavailable selections clear on edition replacement before UI renders the new data.

`paused`, user motion preference and OS reduced-motion are distinct. Effective motion requires user motion enabled, OS reduction disabled, paused false, active phase, document visible and host intersecting. The OS `MediaQueryList.change` listener must update immediately. Freeze simulation, clock, shader movement, cloud drift, orbit damping motion and camera flights together. Time preset buttons and selection still work and render one frame. Flow display becomes static dashed paths. On resume reset previous tick time, avoiding accumulated hidden-tab catch-up.

## Engine, UI and kit API

```ts
import type * as THREE from 'three';

export interface ExplorerEngineOptions {
  data: ExplorerData;
  canvas: HTMLCanvasElement;
  labelHost: HTMLElement;
  invalidate(): void;
  onSelection(selection: ExplorerSelection): void;
  onMinute(minute: number): void;
  onEvents(events: readonly ExplorerEvent[]): void;
}
export interface ExplorerEngine {
  setData(data: ExplorerData): void;
  setSelection(selection: ExplorerSelection, options?: { focus?: boolean }): void;
  setState(state: Readonly<ExplorerState>): void;
  setActive(active: boolean): void;
  resize(width: number, height: number): void;
  update(dtSeconds: number): { dirty: boolean; continuous: boolean };
  render(renderer: THREE.WebGLRenderer): void;
  dispose(): void;
}
export interface ExplorerUICallbacks {
  onSelection(selection: ExplorerSelection): void;
  onReadArticle(articleId: Article['id']): void;
  onCommand(command: ExplorerCommand): void;
}
export interface ExplorerUI {
  setData(data: ExplorerData): void;
  render(state: Readonly<ExplorerState>): void;
  appendEvents(events: readonly ExplorerEvent[]): void;
  clearEvents(): void;
  dispose(): void;
}
```

The usage sketch omits `onMinute` and initial `setState` for brevity. Production construction supplies both. `setState` changes clock only when the controller minute actually differs from the engine minute; an onMinute notification must not restart simulation each frame. Prefer emitting clock notifications at whole-minute boundaries. Never feed the journal back into simulation.

`setData` rebuilds explorer resources atomically, clears walkers/events/camera flight and retains current view settings. Construct the replacement before releasing the old data; invalid replacement leaves the old valid edition visible until controller reports the error. `setActive(false)` disconnects OrbitControls and hides/inerts label DOM. When active, connect controls once. This prevents library entrance drags and stale hidden labels receiving input.

The kit lives in `src/explorer-modelkit.ts`. Export a total `Record<ModelKind, ModelBuilder>` and a batch factory. A builder receives a seeded random function and a placement writer and appends `{kind, matrix, color, owner}` records. No builder creates lights, DOM, RAF or renderer. Static batches use one InstancedMesh per geometry/material family. Glow and transparent parts have explicit separate families. Store `owner -> instance references` and `(mesh, instanceId) -> selection` maps so highlighting updates every component of the selected model, then sets `instanceColor.needsUpdate`. Keep original colors so minute/selection changes never progressively tint already tinted colors. Tint order is base, time yellow, selection coral.

Animated walker batches use DynamicDrawUsage, a stable walker-index-to-ID table and the same hit contract. Hit priority resolves the nearest meaningful item/walker/flow before its island base. Pointer-down records coordinates and cancels camera flight; pointer-up raycasts only if total movement is at most 6 CSS pixels and no control drag/cancel occurred. Raycast uses the active camera and canvas bounding rectangle, including instanced hits. CSS label buttons dispatch the identical selection union. A reset in the middle of a pointer gesture cancels the gesture.

Required model thumbnails render the actual model through the existing shared renderer into a 160 by 160 render target on demand. Restore render target, viewport, scissor, clear state, exposure and shadow mode. Do not allocate a second WebGL context or thumbnail RAF. Without WebGL, show an explicitly labeled unavailable preview while preserving reading.

## Rendering and resources

world is the exclusive owner of WebGLRenderer, canvas attachment, global pixel ratio, one RAF, ResizeObserver, IntersectionObserver, document visibility and context-loss handling. At each frame it selects either existing entrance/library/cosmos rendering or explorer rendering. It invokes explorer update only during active exploration. Clamp dt to 0.08 seconds and reset dt on reactivation. Schedule RAF only while transition, actual motion, control damping or camera flight requires it; otherwise render on invalidation. CSS2D labels render on the same invalidation cycle.

Explorer owns scene, fov 32 camera, OrbitControls, CSS2DRenderer, lights, sky/water shaders, terrain, model kit, texture registry and selection maps. Own shader fog uniforms explicitly. It applies exposure 1 and its scene fog/background when rendered. Existing library exposure/environment logic stays in the entrance branch. No global scene environment setting crosses branches. world applies renderer-wide shadow settings at each branch boundary if incompatible. Use PCFSoftShadowMap for the explorer and preserve the library's existing intended shadow behavior. Render target and viewport changes must always be restored.

The explorer camera uses the reference's 25 to 70 degree polar limits, no pan, distance 3 to 70 and 800 ms cubic flights. Camera controls mutate camera/target, not the world group. Landscape/portrait overview distances and left-card compensation use actual available viewport and UI rectangles. Birdseye is a state command. Labels use CSS2D objects anchored to models, plus projection/collision filtering against measured UI panels with 8px hysteresis. UI must not position scene labels itself.

One disposal owner exists for each geometry, material, canvas texture, CSS2D element and InstancedMesh. Kit geometry/material caches dispose once per kit lifetime, not once per mesh traversal. Engine must never call `renderer.dispose()`. world calls engine disposal before its own renderer disposal. Context loss cancels WebGL updates, disables controls, exposes fallback and keeps accessible reading controls. Keep a renderer reference for proper teardown; do not simply set it to undefined and lose resource ownership. Restoration may rebuild the engine explicitly, or stay in fallback with a retry control.

Numerical acceptance targets from the reference, such as 20 to 30 static draw calls, are targets only. Transparent layers, labels, terrain, walkers, flow tubes and shadows add calls. Use `renderer.info` in later verification before claiming a measured budget. Seed every random source, including noise and walker phases, with mulberry32. Use derived per-entity seeds so adding a tree does not reshuffle article placement or walker paths.

## Pure modules

`explorer-graph.ts` consumes axial islands and constants R 2.02, spacing 2.28, top 0.65, water -0.18. Generate each island's twelve ring nodes and two directed adjacency entries per undirected edge. Bridge only axial neighbors, once per pair, joining facing edge-midpoint nodes. Nine arch segments and logical bridge traversal share the same centerline elevations. Dijkstra returns ordered node IDs and cumulative arc lengths. No direct over-water shortcuts. Tie-break equal distances by stable node ID for repeatability. A disconnected relation is a configuration error, not a teleported walker.

`explorer-daycycle.ts` interpolates keyframes including midnight wrap, resolves half-open reading segments and quantizes sun orientation to 10-minute steps. Segment labels describe suggested reading times, not claims about the articles' actual activity. All highlighted IDs come from data. Initialize 10:00 and advance 10 simulated minutes per actual second only when effective motion allows.

`explorer-simulation.ts` owns path progress, directed travel, end waits and bounded events. A walker is a discriminated phase of moving, arriving/waiting or returning. Resolve distance from cumulative path lengths rather than node-index interpolation, so long bridges do not change walking speed. Emit arrive once on reaching the endpoint, handoff once after the 1.4-second wait, then depart for the reverse leg. Define endpoint semantics in focused tests before wiring journal text. Walker position sampling and flow path sampling share graph geometry. Carrying a book is a visual reading metaphor; the journal must identify itself as a simulation.

## Accessible UI and fallback

`explorer-ui.ts` and `explorer.css` own the brand card, detail cards, searchable themes/connections tabs, HUD, journal, onboarding and mobile sheets. Scope selectors under a unique explorer root. Existing reading directory tabs have their own role=tablist. Do not reuse main.ts's current global `[role=tab]` update, which would corrupt new explorer tab aria-selected values. Update that existing selector to its own directory root during integration.

Keep Article titles/authors/summary and source-PDF links derived from the current Article. Item detail offers “Read article”, real metadata, bookmark status if supplied by the application, and original chapter. Flow details explain editorial basis and link to actual articles. Island detail lists only assigned items. Walker detail routes through its flow and its genuine associated articles. Reader dialog continues owning its focus, history, completion and bookmarks. Notify explorer state after bookmark changes if the cards show bookmark status; do not write a second bookmark store.

For width at most 800px, list and detail become bottom sheets with handles, visible close controls and bounded scrolling. Detail default height is 34%, list 52%. Sheet expansion must not make the background focusable behind a modal sheet. Use pointer capture for dragging handles and distinguish scroll from drag. Buttons are at least 44px. Escape closes detail before deselecting; reader's Escape remains reader-owned. Arrow keys operate camera only when canvas/explorer navigation owns focus and never steal text-input keys. Query `?lang=en` before creating chrome and update labels, controls, descriptions, accessibility text, onboarding, empty states and journal templates. Protect localStorage onboarding reads/writes and keep the established reading storage key unchanged.

No-WebGL does not import or call a partial engine. world returns a consistent no-op engine façade or branches to a dedicated DOM map, driven by the same ExplorerData and Selection. Render all twelve theme buttons, actual item buttons, flow list, meaningful cards, search, presets and journal explanation. Skip animated walkers and simulated live events rather than presenting a fictitious live feed. Reader/PDF/bookmark/year features remain usable. A failed Three module import requires dynamic import and a caught application boundary to preserve reading UI; a constructor try/catch alone cannot catch a static import failure. The bundled application normally has no runtime CDN, but missing JS bundles still need the existing independent static reading index.

## Parallel implementation scopes and integration

Freeze `explorer-types.ts` and config shape before starting these four independent tracks. Only main integrator changes shared existing files.

| Owner | Exclusive write scope | Deliverable and checks |
| --- | --- | --- |
| Data and behavior track | `explorer-data.ts`, `explorer-graph.ts`, `explorer-daycycle.ts`, `explorer-simulation.ts`, focused pure tests | Current-year ID resolution, 48 placements referencing all 22 canonical articles, twelve themes, six to ten truthful flows, connected graph, deterministic routes, time wrapping and exactly-once events. |
| Model kit track | `explorer-modelkit.ts`, kit-specific test/helper files | Twelve model registry entries, static and dynamic batch ownership, owner/hit maps, deterministic assembly, cleanup. Uses frozen contracts only. |
| Scene track | `explorer-scene.ts`, `explorer-scene.css` | Camera/controls/render lifecycle, environment, islands/bridges, labels, selection and resource ownership. Can build against stubbed pure-module APIs and kit factories, with no changes to their files. |
| UI track | `explorer-ui.ts`, `explorer.css` | DATA-driven chrome/cards/tabs/HUD/journal, bilingual strings, accessible bottom sheets, callback-only reading integration, DOM fallback. |

Main integrator owns `world.ts`, `main.ts`, existing `world.css`/`style.css`, shared types if necessary, dependencies and `tests/browser.mjs`. Do not let scene and model workers both change an instancing helper. Select one ownership path before dispatch. If only three workers are useful, combine kit and scene rather than adding an adapter layer solely to create parallel work. Actual delegated implementation must follow the user's role/model routing; this document itself does not spawn further agents.

Integration order is data/types, model kit, scene and UI, then world lifecycle and main callbacks, then end-to-end verification. Remove the old four-island meshes/manual rotation/projected article labels in the same integration wave, preserving only the entrance code. Keep no competing legacy explorer reachable.

## Acceptance plan and unresolved risks

The existing browser suite already covers 22 articles, source PDF response, bookmarks/completion/font persistence, curated next, Escape, 390px layout, no-JavaScript index, forced no-WebGL and a synthetic second-year catalog. Preserve these behaviors, but replace four-chapter scene assertions with twelve-theme explorer assertions. Keep reading directory chapter filters intact where they remain visible.

Add focused checks for all four selection kinds reaching the same detail pipeline, drag threshold and flight cancellation, flow visibility, timestamp presets, day-segment highlighting, pause/resume, journal filtering, English UI, immediate OS reduced-motion change, keyboard access and mobile sheet focus/overflow. A static screenshot cannot prove these transitions. Confirm library initial appearance and tree rotation samples separately from explorer replacement. Verify skip entrance both during library and cosmos stages.

Extend synthetic 2027 coverage by changing IDs and also removing/reordering a source article. Assert no 2026 item/article ID survives, no missing reference reaches a card, original PDFs resolve from the selected article, and cross-year Back/deep-link reload still read the correct year. Synthetic copied content proves annual plumbing only; it is not evidence of a published second edition.

Known integration risks are current global tab selectors, previous-frame dt jumps after idle, listener leaks on repeated year switching, object/instance hit maps becoming stale after rebuild, duplicate kit disposal, reduced-motion disabling controls rather than only movement, and partial WebGL construction leaving hidden overlay labels intercepting input. Verify repeated year switching and context loss after successful construction as well as initial WebGL denial. API sketches here have not been typechecked against an implementation. Rendering feasibility and draw-call targets remain unmeasured.

The applied Model the Domain principle shaped the selection union, total model registry and walker phase state. Boundary Discipline shaped validated ExplorerData and pure graph/time/simulation modules. The task's leaf-scope restriction replaces further architect/how agent spawning with the two written structural candidates above.

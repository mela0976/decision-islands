import type { Object3D, Group, InstancedMesh, WebGLRenderer } from 'three';
import type { Article, Chapter, Edition } from './types';
import type { Season } from './season';

export type I18nText = { zh: string; en: string };
export type Vec3 = readonly [number, number, number];
export type ModelKind = 'book' | 'pavilion' | 'classroom' | 'observatory' | 'studio' | 'bridge' | 'garden' | 'stage' | 'clock' | 'globe' | 'workshop' | 'lighthouse';
export type GeometryKind = 'box' | 'rbox' | 'cylinder' | 'cone' | 'sphere' | 'ico' | 'dome' | 'torus' | 'prism' | 'hip' | 'glowbox' | 'glowsphere';
export type TreeKind = 'pine' | 'blossom' | 'fruit' | 'palm' | 'willow';
export type AccessoryKind = 'badge' | 'glasses' | 'cane' | 'cap' | 'stroller' | 'bicycle' | 'hat' | 'helmet' | 'suitcase';
export type CargoKind = 'book' | 'idea' | 'memory' | 'data';
export interface ExplorerRole { id: string; title: I18nText; accessory: AccessoryKind; color: string; skin: string }
export interface ExplorerIsland {
  id: string; title: I18nText; description: I18nText; axial: readonly [number, number];
  color: string; ground: 'brick' | 'speckle' | 'stripe'; tree: TreeKind; itemIds: readonly string[];
}
export interface ExplorerItem {
  id: string; islandId: string; articleId: string; model: ModelKind; caption: I18nText;
}
export type FlowEvidence = { kind: 'source' | 'thematic' | 'pending'; rationale: I18nText };
export interface ExplorerFlow {
  id: string; from: string; to: string; articleIds: readonly string[]; cargo: CargoKind;
  role: string; evidence: FlowEvidence; walkerCount: number;
}
export interface DaySegment { id: string; title: I18nText; startMinute: number; endMinute: number; itemIds: readonly string[] }
export interface DayKeyframe {
  minute: number; skyTop: string; horizon: string; sunColor: string; sunIntensity: number;
  hemiSky: string; hemiGround: string; hemiIntensity: number; night: number; water: string;
}
export interface ExplorerLayout { radius: number; spacing: number; top: number; waterY: number }
export interface ExplorerData {
  schemaVersion: 1; year: number; title: I18nText; seed: number; layout: ExplorerLayout;
  articles: readonly Article[]; islands: readonly ExplorerIsland[]; items: readonly ExplorerItem[];
  flows: readonly ExplorerFlow[]; roles: readonly ExplorerRole[];
  daySegments: readonly DaySegment[]; dayKeyframes: readonly DayKeyframe[];
}
export interface ThemeDefinition extends Omit<ExplorerIsland, 'itemIds'> {
  orders: readonly number[]; models: readonly ModelKind[]; captions: readonly I18nText[];
}
export interface FlowDefinition extends Omit<ExplorerFlow, 'articleIds'> { articleOrders: readonly number[] }
export interface ExplorerConfig {
  curation?: { year: number; title: string };
  seed: number; title: I18nText; layout: ExplorerLayout; themes: readonly ThemeDefinition[];
  flows: readonly FlowDefinition[]; roles: readonly ExplorerRole[];
  daySegments: readonly (Omit<DaySegment, 'itemIds'> & { islandIds: readonly string[] })[];
  dayKeyframes: readonly DayKeyframe[];
}
export interface ExplorerNpc { id: string; roleId: string; flowId: string | null; homeIslandId: string; articleIds: readonly string[] }
export type ExplorerSelection = null | { kind: 'island'; islandId: string } | { kind: 'item'; itemId: string } | { kind: 'walker'; walkerId: string } | { kind: 'flow'; flowId: string };
export type ExplorerCommand = { type: 'overview' } | { type: 'birdseye'; enabled: boolean } | { type: 'minute'; minute: number } | { type: 'paused'; paused: boolean }
  | { type: 'population'; count: number } | { type: 'season'; season: Season } | { type: 'chapter'; chapter: Chapter | null }
  | { type: 'toggle'; key: 'names' | 'walkers' | 'flows' | 'journal'; value: boolean }
  | { type: 'query'; query: string } | { type: 'tab'; tab: 'themes' | 'connections' }
  | { type: 'panel'; panel: 'list' | 'detail'; open: boolean } | { type: 'journalFilter'; flowId: string | null };
export interface ExplorerState {
  selection: ExplorerSelection; language: 'zh' | 'en'; query: string; tab: 'themes' | 'connections';
  season: Season; population: number;
  minute: number; paused: boolean; reducedMotion: boolean; names: boolean; walkers: boolean; flows: boolean;
  journal: boolean; journalFilter: string | null; birdseye: boolean; listOpen: boolean; detailOpen: boolean;
  chapter: Chapter | null; completedArticleIds: readonly string[]; bookmarkedArticleIds: readonly string[];
}
export interface ExplorerEvent { id: number; type: 'depart' | 'arrive' | 'handoff'; flowId: string; walkerId: string; islandId: string; minute: number }
export interface DaySnapshot {
  minute: number; skyTop: string; horizon: string; sunColor: string; sunIntensity: number;
  hemiSky: string; hemiGround: string; hemiIntensity: number; night: number; water: string; sunDirection: Vec3;
}
export interface PathNode { id: string; islandId: string; position: Vec3 }
export interface PathEdge { from: string; to: string; distance: number; bridge: boolean }
export interface BridgePath { id: string; from: string; to: string; points: readonly Vec3[] }
export interface PathGraph { nodes: readonly PathNode[]; edges: readonly PathEdge[]; bridges: readonly BridgePath[] }
export interface RoutePath { nodeIds: readonly string[]; points: readonly Vec3[]; cumulative: readonly number[]; length: number }
export interface WalkerSnapshot {
  id: string; flowId: string; role: string; cargo: CargoKind; position: Vec3; heading: number; phase: number;
  direction: 1 | -1; status: 'moving' | 'waiting';
}
export interface SimulationSnapshot { minute: number; day: DaySnapshot; activeItemIds: readonly string[]; walkers: readonly WalkerSnapshot[] }
export interface ExplorerSimulation {
  update(dtSeconds: number, moving: boolean): readonly ExplorerEvent[];
  setPopulation(count: number): void; setMinute(minute: number): void; snapshot(): SimulationSnapshot; reset(): void;
}
export interface ModelPlacement { id: string; model: ModelKind; position: Vec3; scale: number; color: string; rotation?: number }
export interface ModelKit {
  group: Group; hitMeshes: readonly InstancedMesh[];
  resolveHit(object: Object3D, instanceId?: number): string | null;
  highlight(selected: ReadonlySet<string>, active: ReadonlySet<string>): void;
  setNight(night: number): void; dispose(): void;
}
export interface ExplorerEngineOptions {
  data: ExplorerData; canvas: HTMLCanvasElement; labelHost: HTMLElement; invalidate(): void;
  onSelection(selection: ExplorerSelection): void; onMinute(minute: number): void; onEvents(events: readonly ExplorerEvent[]): void;
}
export interface ExplorerEngine {
  setData(data: ExplorerData): void;
  setSelection(selection: ExplorerSelection, options?: { focus?: boolean }): void;
  setState(state: Readonly<ExplorerState>): void; setActive(active: boolean): void;
  resize(width: number, height: number): void; update(dtSeconds: number): { dirty: boolean; continuous: boolean };
  render(renderer: WebGLRenderer): void; thumbnail(itemId: string, renderer: WebGLRenderer): string | null;
  getWalkers(): readonly WalkerSnapshot[]; dispose(): void;
}
export interface ExplorerUICallbacks {
  onSelection(selection: ExplorerSelection): void; onReadArticle(articleId: string): void; onCommand(command: ExplorerCommand): void;
  onThumbnail(itemId: string): string | null;
  onResolveWalker(walkerId: string): WalkerSnapshot | undefined;
}
export interface ExplorerUI {
  setData(data: ExplorerData): void; render(state: Readonly<ExplorerState>): void;
  appendEvents(events: readonly ExplorerEvent[]): void; clearEvents(): void;
  setActive(active: boolean): void; setFallback(fallback: boolean, message?: string): void; dispose(): void;
}
export type EditionBuilder = (config: ExplorerConfig, edition: Edition) => ExplorerData;

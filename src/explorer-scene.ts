import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ExplorerData, ExplorerEngine, ExplorerEngineOptions, ExplorerSelection, ExplorerState, WalkerSnapshot, ModelKit, Vec3, NpcSpeechCue } from './explorer-types';
import { initialExplorerState } from './explorer-data';
import { axialToWorld, buildPathGraph, findRoute, itemPlacements } from './explorer-graph';
import { createNpcRoster } from './explorer-npcs';
import { createSimulation } from './explorer-simulation';
import { createModelKit } from './explorer-modelkit';
import { createExplorerEnvironment } from './explorer-environment';
import { hashSeed, mulberry32 } from './explorer-random';
import { HOLIDAYS } from './season';
import './explorer-scene.css';

const v3 = (p: Vec3) => new T.Vector3(...p);
const ink = '#211d1d', coral = '#db6a41';
class RouteCurve extends T.Curve<T.Vector3> {
  constructor(private points: readonly Vec3[], private cumulative: readonly number[], private length: number) { super(); }
  getPoint(t: number, target = new T.Vector3()): T.Vector3 {
    const d = t * this.length; let i = 1;
    while (i < this.cumulative.length - 1 && this.cumulative[i] < d) i++;
    const a = this.points[i - 1], b = this.points[i], span = this.cumulative[i] - this.cumulative[i - 1];
    return target.copy(v3(a)).lerp(v3(b), span ? (d - this.cumulative[i - 1]) / span : 0).add(new T.Vector3(0, .035, 0));
  }
}
interface Label { object: CSS2DObject; element: HTMLButtonElement; full: string; short: string; selection: ExplorerSelection; hidden: boolean; compact: boolean; type: 'island' | 'item' | 'walker'; owner: string }
interface Part { mesh: T.InstancedMesh; offset: T.Vector3; scale: T.Vector3; swing?: number; filter?: string; rotation?: number }
function cargoTexture(kind: string): T.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d')!; c.fillStyle = '#fff8f4'; c.strokeStyle = coral; c.lineWidth = 7; c.beginPath(); c.arc(64, 64, 56, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = ink; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
  if (kind === 'book') { c.strokeRect(32, 35, 64, 56); c.beginPath(); c.moveTo(64, 35); c.lineTo(64, 91); c.stroke(); }
  else if (kind === 'idea') { c.beginPath(); c.arc(64, 54, 23, 0, Math.PI * 2); c.stroke(); c.strokeRect(54, 77, 20, 12); }
  else if (kind === 'memory') { c.beginPath(); c.arc(64, 64, 28, 0, Math.PI * 2); c.moveTo(64, 44); c.lineTo(64, 65); c.lineTo(81, 72); c.stroke(); }
  else { for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(64, 40 + i * 22, 29, 11, 0, 0, Math.PI * 2); c.stroke(); } }
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
}
function groundTexture(kind: string, seed: number): T.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; const c = canvas.getContext('2d')!;
  c.fillStyle = '#ded9bb'; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#c5baa3'; c.lineWidth = 2;
  if (kind === 'brick') for (let y = 0; y < 256; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); for (let x = (y / 32 % 2) * 32; x < 256; x += 64) { c.moveTo(x, y); c.lineTo(x, y + 32); } c.stroke(); }
  else if (kind === 'stripe') for (let x = -256; x < 512; x += 28) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 256, 256); c.stroke(); }
  else { const random = mulberry32(seed); c.fillStyle = '#b4b89c'; for (let i = 0; i < 900; i++) c.fillRect(random() * 256, random() * 256, 2, 2); }
  const texture = new T.CanvasTexture(canvas); texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.colorSpace = T.SRGBColorSpace; return texture;
}

export function createExplorerEngine(options: ExplorerEngineOptions): ExplorerEngine {
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(32, 1, .3, 320);
  const originalTabindex = options.canvas.getAttribute('tabindex');
  if (originalTabindex === null) options.canvas.tabIndex = 0;
  const controls = new OrbitControls(camera, options.canvas); controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = .07;
  controls.minPolarAngle = T.MathUtils.degToRad(25); controls.maxPolarAngle = T.MathUtils.degToRad(70); controls.minDistance = 3; controls.maxDistance = 70;
  controls.enabled = false; controls.disconnect();
  const labels = new CSS2DRenderer(); labels.domElement.className = 'explorer-scene-labels'; options.labelHost.append(labels.domElement);
  let state = initialExplorerState(), active = false, disposed = false, dirty = true, width = 1, height = 1, elapsed = 0;
  let selection: ExplorerSelection = null, pointer: { x: number; y: number; id: number; moved: boolean } | null = null;
  let flight: { time: number; from: T.Vector3; to: T.Vector3; fromTarget: T.Vector3; target: T.Vector3 } | null = null;
  let targetRT: T.WebGLRenderTarget | null = null;
  let encounter: string | null = null, speech: NpcSpeechCue | null = null, reactionTime = 1.2;
  const speechTokens = new Map<string, number>();
  const bubbleElement = document.createElement('div'); bubbleElement.className = 'explorer-npc-speech'; bubbleElement.setAttribute('aria-hidden', 'true'); bubbleElement.hidden = true;
  const bubble = new CSS2DObject(bubbleElement); bubble.center.set(.5, 1); scene.add(bubble);
  const invalidate = () => { if (!disposed) { dirty = true; options.invalidate(); } };
  const moving = () => active && !state.paused && !state.reducedMotion;
  const onChange = () => invalidate(); controls.addEventListener('change', onChange);
  function build(data: ExplorerData) {
    const group = new T.Group(), owned = new Set<{ dispose(): void }>(), dom: Label[] = [], hits: T.Object3D[] = [];
    const islandHits = new Map<T.Object3D, { mode: 'instance' | 'face'; ids: readonly string[] }>();
    let kit: ModelKit | undefined, environment: ReturnType<typeof createExplorerEnvironment> | undefined;
    const own = <A extends { dispose(): void }>(value: A): A => { owned.add(value); return value; };
    const geometry = <A extends T.BufferGeometry>(g: A): A => own(g);
    const material = (color: T.ColorRepresentation, extra: T.MeshStandardMaterialParameters = {}) => own(new T.MeshStandardMaterial({ color, roughness: .92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, ...extra }));
    const mesh = (g: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0) => { const value = new T.Mesh(g, m); value.position.set(x, y, z); value.receiveShadow = true; group.add(value); return value; };
    const addLabel = (position: T.Vector3, full: string, short: string, sel: ExplorerSelection, type: Label['type'], owner: string) => {
      const element = document.createElement('button'); element.type = 'button'; element.className = `explorer-scene-label explorer-scene-label--${type}`; element.textContent = full;
      element.addEventListener('pointerdown', e => e.stopPropagation()); element.addEventListener('click', e => { e.stopPropagation(); dispatch(sel); });
      const object = new CSS2DObject(element); object.position.copy(position); group.add(object); dom.push({ object, element, full, short, selection: sel, hidden: false, compact: false, type, owner });
    };
    try {
      const graph = buildPathGraph(data), simulation = createSimulation(data, graph, state.population), placements = itemPlacements(data);
      let lastSeason = state.season;
      const builtKit = createModelKit(placements, data.seed); kit = builtKit; group.add(builtKit.group); hits.push(...builtKit.hitMeshes);
      environment = createExplorerEnvironment(data); environment.setSeason(state.season); group.add(environment.group);
      const textures = new Map(['brick', 'speckle', 'stripe'].map(kind => [kind, own(groundTexture(kind, hashSeed(data.seed, kind)))]));
      const wall = environment.waterMaterial;
      const roadMat = material('#dfc8ac'), curbMat = material('#e4d6c3');
      type StaticInstance = { matrix: T.Matrix4; color?: string; islandId?: string };
      const batch = (name: string, g: T.BufferGeometry, m: T.Material, records: StaticInstance[]) => {
        const value = own(new T.InstancedMesh(g, m, records.length)); value.name = name; value.receiveShadow = true;
        records.forEach((record, index) => { value.setMatrixAt(index, record.matrix); if (record.color) value.setColorAt(index, new T.Color(record.color)); });
        value.instanceMatrix.needsUpdate = true; if (value.instanceColor) value.instanceColor.needsUpdate = true;
        group.add(value);
        if (records.some(record => record.islandId)) { islandHits.set(value, { mode: 'instance', ids: records.map(record => record.islandId!) }); hits.push(value); }
        return value;
      };
      const walls: StaticInstance[] = [], roads: StaticInstance[] = [], curbs: StaticInstance[] = [], bands: StaticInstance[] = [], shallows: StaticInstance[] = [], foams: StaticInstance[] = [];
      const surfaces = new Map<string, { parts: T.BufferGeometry[]; ids: string[] }>();
      const at = (x: number, y: number, z: number, islandId?: string, color?: string): StaticInstance => ({ matrix: new T.Matrix4().makeTranslation(x, y, z), islandId, color });
      const r = data.layout.radius, top = data.layout.top;
      for (const [index, island] of data.islands.entries()) {
        const [x, , z] = axialToWorld(...island.axial, data.layout.spacing);
        walls.push(at(x, (top + data.layout.waterY) / 2, z, island.id));
        const topGeometry = geometry(new T.CircleGeometry(r - .05, 6).rotateZ(Math.PI / 6).rotateX(-Math.PI / 2));
        const pos = topGeometry.attributes.position, uv = topGeometry.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + x) / 2.2, (pos.getZ(i) + z) / 2.2);
        topGeometry.translate(x, top + .002, z);
        let surface = surfaces.get(island.ground); if (!surface) { surface = { parts: [], ids: [] }; surfaces.set(island.ground, surface); }
        surface.parts.push(topGeometry); for (let triangle = 0; triangle < topGeometry.index!.count / 3; triangle++) surface.ids.push(island.id);
        roads.push(at(x, top + .009, z)); curbs.push(at(x, top + .012, z)); bands.push(at(x, top - .08, z, undefined, island.color));
        shallows.push(at(x, data.layout.waterY + .008, z)); foams.push(at(x, data.layout.waterY + .014, z));
        addLabel(new T.Vector3(x, top + .1, z + r * .88), `${String(index + 1).padStart(2, '0')} ${island.title[state.language]}`, String(index + 1).padStart(2, '0'), { kind: 'island', islandId: island.id }, 'island', island.id);
      }
      batch('explorer-island-walls', geometry(new T.CylinderGeometry(r, r * .97, top - data.layout.waterY, 6)), wall, walls);
      for (const [ground, surface] of surfaces) {
        const merged = mergeGeometries(surface.parts, false); if (!merged) throw new Error('Could not merge island surfaces');
        for (const part of surface.parts) { owned.delete(part); part.dispose(); }
        const face = mesh(geometry(merged), material('#ffffff', { map: textures.get(ground) })); face.name = `explorer-island-surface-${ground}`;
        islandHits.set(face, { mode: 'face', ids: surface.ids }); hits.push(face);
      }
      batch('explorer-island-paths', geometry(new T.RingGeometry(1.66, 1.94, 6).rotateZ(Math.PI / 6).rotateX(-Math.PI / 2)), roadMat, roads);
      batch('explorer-island-curbs', geometry(new T.RingGeometry(r - .07, r, 6).rotateZ(Math.PI / 6).rotateX(-Math.PI / 2)), curbMat, curbs);
      batch('explorer-island-bands', geometry(new T.CylinderGeometry(r + .008, r + .008, .16, 6, 1, true)), material('#ffffff', { map: textures.get('stripe') }), bands);
      batch('explorer-island-shallows', geometry(new T.RingGeometry(r, r + .7, 64).rotateX(-Math.PI / 2)), own(new T.MeshBasicMaterial({ color: '#bce3d9', transparent: true, opacity: .2, depthWrite: false })), shallows);
      batch('explorer-island-foam', geometry(new T.RingGeometry(r + .11, r + .16, 64).rotateX(-Math.PI / 2)), own(new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55, depthWrite: false })), foams);
      const smallObjects = new T.Group(); smallObjects.name = 'explorer-small-furniture'; group.add(smallObjects);
      const decorGeometry = {
        box: geometry(new T.BoxGeometry(1, 1, 1)), cylinder: geometry(new T.CylinderGeometry(1, 1, 1, 10)),
        cone: geometry(new T.ConeGeometry(1, 1, 10)), sphere: geometry(new T.SphereGeometry(1, 10, 8)), pool: geometry(new T.CircleGeometry(1, 16).rotateX(-Math.PI / 2)),
      };
      type DecorKind = keyof typeof decorGeometry;
      const decorBatches = new Map<string, { kind: DecorKind; small: boolean; glow: boolean; records: { matrix: T.Matrix4; color: string }[] }>();
      const decoration = (kind: DecorKind, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, small = false, glow = false, ry = 0, rz = 0) => {
        const key = `${kind}-${small}-${glow}`; let batch = decorBatches.get(key); if (!batch) { batch = { kind, small, glow, records: [] }; decorBatches.set(key, batch); }
        const object = new T.Object3D(); object.position.set(x, y, z); object.scale.set(sx, sy, sz); object.rotation.set(0, ry, rz); object.updateMatrix(); batch.records.push({ matrix: object.matrix.clone(), color });
      };
      for (const island of data.islands) {
        const [x, , z] = axialToWorld(...island.axial, data.layout.spacing), top = data.layout.top, random = mulberry32(hashSeed(data.seed, `decor-${island.id}`));
        for (let i = 0; i < 6; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / 3, lx = x + Math.cos(angle) * 1.87, lz = z + Math.sin(angle) * 1.87;
          decoration('cylinder', lx, top + .24, lz, .014, .48, .014, '#65594e'); decoration('box', lx, top + .5, lz, .09, .09, .09, '#ffc777', false, true);
          decoration('pool', lx, top + .016, lz, .23, 1, .23, '#ffc777', false, true);
          const px = x + Math.cos(angle + Math.PI / 6) * 1.44, pz = z + Math.sin(angle + Math.PI / 6) * 1.44;
          decoration('cylinder', px, top + .07, pz, .09, .14, .09, '#c5b5a7', true); decoration('sphere', px, top + .18, pz, .11, .11, .11, '#8db86f', true);
          decoration('sphere', px + .045, top + .26, pz, .028, .028, .028, '#f2b5c6', true);
        }
        const treeCount = 4 + Math.floor(random() * 3);
        for (let i = 0; i < treeCount; i++) {
          const angle = i / treeCount * Math.PI * 2 + .22, tx = x + Math.cos(angle) * 1.48, tz = z + Math.sin(angle) * 1.48, size = .85 + random() * .24;
          decoration('cylinder', tx, top + .27 * size, tz, .034, .54 * size, .034, '#b48560');
          if (island.tree === 'pine') for (let tier = 0; tier < 3; tier++) decoration('cone', tx, top + (.34 + tier * .17) * size, tz, (.23 - tier * .047) * size, .42 * size, (.23 - tier * .047) * size, tier % 2 ? '#728f5f' : '#9cc27a');
          else if (island.tree === 'palm') for (let leaf = 0; leaf < 6; leaf++) { const a = leaf * Math.PI / 3; decoration('box', tx + Math.cos(a) * .12, top + .64 * size, tz + Math.sin(a) * .12, .36, .035, .085, '#8db86f', false, false, -a, -.22); }
          else {
            const foliage = island.tree === 'blossom' ? '#f2b5c6' : island.tree === 'willow' ? '#9cc27a' : '#8db86f';
            for (let lobe = 0; lobe < 4; lobe++) { const a = lobe * Math.PI / 2; decoration('sphere', tx + Math.cos(a) * .10, top + (.53 + random() * .09) * size, tz + Math.sin(a) * .10, .19 * size, (island.tree === 'willow' ? .31 : .21) * size, .19 * size, foliage); }
            if (island.tree === 'fruit') for (let fruit = 0; fruit < 3; fruit++) decoration('sphere', tx + (random() - .5) * .3, top + .5 + random() * .18, tz + .15, .035, .035, .035, '#db6a41');
          }
        }
        decoration('box', x - .85, top + .14, z - .45, .4, .045, .14, '#b48560', true); decoration('box', x - .85, top + .26, z - .51, .4, .16, .035, '#b48560', true);
        for (const side of [-1, 1]) decoration('box', x - .85 + side * .15, top + .07, z - .45, .035, .14, .11, '#65594e', true);
      }
      const decorGlow: T.MeshStandardMaterial[] = [], decorPools: T.MeshBasicMaterial[] = [];
      for (const batch of decorBatches.values()) {
        let mat: T.Material;
        if (batch.kind === 'pool') { const pool = own(new T.MeshBasicMaterial({ color: '#ffc777', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })); decorPools.push(pool); mat = pool; }
        else { const solid = material('#ffffff', batch.glow ? { emissive: '#ffc777', emissiveIntensity: 0 } : {}); if (batch.glow) decorGlow.push(solid); mat = solid; }
        const mesh = own(new T.InstancedMesh(decorGeometry[batch.kind], mat, batch.records.length)); mesh.castShadow = !batch.small && !batch.glow; mesh.receiveShadow = true;
        batch.records.forEach((part, index) => { mesh.setMatrixAt(index, part.matrix); mesh.setColorAt(index, new T.Color(part.color)); }); (batch.small ? smallObjects : group).add(mesh);
      }
      const plank = geometry(new T.BoxGeometry(.39, .07, 1));
      const boards: StaticInstance[] = [];
      for (const bridge of graph.bridges) for (let i = 0; i < 9; i++) {
        const a = v3(bridge.points[i]), b = v3(bridge.points[i + 1]), board = new T.Object3D(); board.position.copy(a).lerp(b, .5); board.scale.z = a.distanceTo(b) + .012;
        board.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), b.sub(a).normalize()); board.updateMatrix(); boards.push({ matrix: board.matrix.clone() });
      }
      batch('explorer-bridge-boards', plank, roadMat, boards);
      const flows = data.flows.map(flow => {
        const route = findRoute(graph, flow.from, flow.to), shader = own(new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { time: { value: 0 }, color: { value: new T.Color(HOLIDAYS[state.season].accent) }, length: { value: route.length }, kind: { value: flow.evidence.kind === 'source' ? 0 : flow.evidence.kind === 'thematic' ? 1 : 2 }, motion: { value: 1 } }, vertexShader: 'varying vec2 uvFlow;void main(){uvFlow=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'varying vec2 uvFlow;uniform vec3 color;uniform float time;uniform float length;uniform float kind;uniform float motion;void main(){float u=uvFlow.x*length*5.-time*1.4;float limit=kind<.5?(motion<.5?.65:1.):(kind<1.5?.6:.3);if(fract(u)>limit)discard;gl_FragColor=vec4(color,.82);}' }));
        const tube = mesh(geometry(new T.TubeGeometry(new RouteCurve(route.points, route.cumulative, route.length), Math.max(32, route.points.length * 8), .035, 5, false)), shader); tube.userData.flowId = flow.id; hits.push(tube); return { flow, tube, shader };
      });
      for (const p of placements) {
        const item = data.items.find(i => i.id === p.id)!, island = data.islands.find(i => i.id === item.islandId)!, n = island.itemIds.indexOf(p.id) + 1;
        addLabel(v3(p.position).add(new T.Vector3(0, p.scale * 1.55 + .16, 0)), ['①', '②', '③', '④', '⑤', '⑥', '⑦'][n - 1] ?? String(n), String(n), { kind: 'item', itemId: p.id }, 'item', p.id);
        const line = new T.Line(geometry(new T.BufferGeometry().setFromPoints([v3(p.position).add(new T.Vector3(0, p.scale * .9, 0)), v3(p.position).add(new T.Vector3(0, p.scale * 1.5, 0))])), own(new T.LineBasicMaterial({ color: coral, depthTest: false }))); line.userData.pinIsland = island.id; group.add(line);
      }
      const roster = createNpcRoster(data, 100), capacity = 100, parts: Part[] = [], walkerGroup = new T.Group(); walkerGroup.name = 'explorer-walkers'; group.add(walkerGroup);
      const sphere = geometry(new T.SphereGeometry(1, 10, 8)), box = geometry(new T.BoxGeometry(1, 1, 1)), cylinder = geometry(new T.CylinderGeometry(1, 1, 1, 10)), torus = geometry(new T.TorusGeometry(1, .16, 5, 12)), capsule = geometry(new T.CapsuleGeometry(.5, .5, 3, 8));
      const addPart = (g: T.BufferGeometry, offset: number[], scale: number[], color: string, swing?: number, filter?: string, rotation?: number) => {
        const m = own(new T.InstancedMesh(g, material(color), capacity)); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; walkerGroup.add(m); hits.push(m); parts.push({ mesh: m, offset: new T.Vector3(...offset), scale: new T.Vector3(...scale), swing, filter, rotation }); return m;
      };
      addPart(capsule, [0, .14, 0], [.105, .14, .085], '#ffffff');
      addPart(sphere, [0, .28, 0], [.07, .07, .065], '#ffffff');
      addPart(geometry(new T.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), [0, .29, 0], [.073, .064, .069], '#4a3531');
      for (const sign of [-1, 1]) { addPart(box, [sign * .027, .056, 0], [.025, .09, .035], '#3f505b', sign * .55); addPart(box, [sign * .073, .153, 0], [.022, .105, .027], '#e6b38e', sign * -.45); addPart(sphere, [sign * .022, .28, .061], [.007, .008, .004], ink); }
      addPart(box, [0, .16, .048], [.035, .043, .01], '#fff8f4', undefined, 'badge');
      for (const sign of [-1, 1]) addPart(torus, [sign * .027, .28, .063], [.024, .024, .02], ink, undefined, 'glasses');
      addPart(cylinder, [.095, .085, .04], [.007, .18, .007], '#795c43', undefined, 'cane');
      addPart(sphere, [0, .328, 0], [.076, .033, .071], coral, undefined, 'cap'); addPart(box, [0, .325, .056], [.1, .012, .06], coral, undefined, 'cap');
      addPart(box, [0, .115, .17], [.14, .09, .12], '#e4ad88', undefined, 'stroller');
      for (const sign of [-1, 1]) { addPart(torus, [sign * .07, .05, .17], [.043, .043, .043], ink, undefined, 'stroller', Math.PI / 2); addPart(torus, [0, .055, sign * .105], [.058, .058, .058], ink, undefined, 'bicycle', Math.PI / 2); }
      addPart(box, [0, .105, 0], [.025, .025, .23], '#56a3a3', undefined, 'bicycle'); addPart(cylinder, [0, .14, .1], [.009, .15, .009], '#56a3a3', undefined, 'bicycle');
      addPart(geometry(new T.ConeGeometry(1, 1, 12)), [0, .345, 0], [.115, .065, .115], '#d7b879', undefined, 'hat');
      addPart(sphere, [0, .33, 0], [.078, .044, .073], '#fcea8b', undefined, 'helmet'); addPart(box, [0, .35, 0], [.02, .025, .12], '#e2bc58', undefined, 'helmet');
      addPart(box, [.105, .07, 0], [.07, .12, .055], '#a97f65', undefined, 'suitcase'); addPart(torus, [.105, .15, 0], [.022, .03, .01], ink, undefined, 'suitcase');
      const shadow = own(new T.InstancedMesh(geometry(new T.CircleGeometry(.09, 12).rotateX(-Math.PI / 2)), own(new T.MeshBasicMaterial({ color: '#211d1d', transparent: true, opacity: .22, depthWrite: false })), capacity)); shadow.instanceMatrix.setUsage(T.DynamicDrawUsage); shadow.frustumCulled = false; walkerGroup.add(shadow);
      const cargos = new Map(['book', 'idea', 'memory', 'data'].map(kind => [kind, own(new T.SpriteMaterial({ map: own(cargoTexture(kind)), depthTest: false, transparent: true }))]));
      const walkerLabels: Label[] = [];
      const sprites = roster.map(npc => { const sprite = new T.Sprite(cargos.get('book')); sprite.scale.setScalar(.24); sprite.visible = false; walkerGroup.add(sprite); addLabel(new T.Vector3(), '', '', { kind: 'walker', walkerId: npc.id }, 'walker', npc.id); walkerLabels.push(dom.at(-1)!); return sprite; });
      const matrix = new T.Matrix4(), object = new T.Object3D(), rootMatrix = new T.Matrix4(), localMatrix = new T.Matrix4(), q = new T.Quaternion(), scale = new T.Vector3();
      const headPivot = new T.Vector3(0, .235, 0), xAxis = new T.Vector3(1, 0, 0), yAxis = new T.Vector3(0, 1, 0);
      const headings = new Map<string, number>();
      function updateWalkers(snapshot: readonly WalkerSnapshot[], animate: boolean, dt = 0) {
        options.canvas.dataset.npcPopulation = String(snapshot.length);
        for (const part of parts) part.mesh.count = snapshot.length;
        shadow.count = snapshot.length;
        sprites.forEach((sprite, index) => { if (index >= snapshot.length) sprite.visible = false; });
        if (!state.walkers) return;
        const seasonalAccent = new T.Color(HOLIDAYS[state.season].accent);
        snapshot.forEach((w, index) => {
          const role = data.roles.find(r => r.id === w.role) ?? { accessory: 'badge', color: '#547d8a', skin: '#dbac8a' }, distance = camera.position.distanceTo(v3(w.position)), size = T.MathUtils.clamp(distance / 18, 1.15, 1.65) * (1 + (index % 5 - 2) * .035), phase = w.phase * 20, bob = w.status === 'moving' ? Math.abs(Math.sin(phase)) * .012 : 0;
          const talking = w.status === 'talking', targetHeading = talking ? Math.atan2(camera.position.x - w.position[0], camera.position.z - w.position[2]) : w.heading;
          const previousHeading = headings.get(w.id) ?? w.heading, delta = Math.atan2(Math.sin(targetHeading - previousHeading), Math.cos(targetHeading - previousHeading));
          const heading = talking && animate ? previousHeading + delta * (1 - Math.exp(-dt * 12)) : targetHeading;
          headings.set(w.id, heading);
          const reacting = talking && speech?.walkerId === w.id && reactionTime < 1.2 && animate;
          const envelope = reacting ? Math.sin(Math.PI * reactionTime / 1.2) ** 2 : 0;
          const nod = envelope * Math.sin(reactionTime * (speech?.reaction === 'nod' ? 12 : 7)) * (speech?.reaction === 'reflect' ? .12 : .22);
          const gesture = envelope * (speech?.reaction === 'explain' ? .65 : speech?.reaction === 'greet' ? .45 : .16);
          q.setFromAxisAngle(yAxis, heading); rootMatrix.compose(v3(w.position).add(new T.Vector3(0, bob, 0)), q, scale.setScalar(size));
          if (talking) { options.canvas.dataset.npcHeading = String(heading); options.canvas.dataset.npcFacingTarget = String(targetHeading); options.canvas.dataset.npcPosition = JSON.stringify(w.position); }
          for (const part of parts) {
            const walking = w.status === 'moving', arm = part.offset.y === .153, leg = part.offset.y === .056;
            let swing = walking && part.swing ? Math.sin(phase) * part.swing : 0;
            if (arm && (role.accessory === 'stroller' || role.accessory === 'bicycle')) swing = -.7;
            else if (arm && part.offset.x > 0 && role.accessory !== 'cane' && role.accessory !== 'suitcase') swing -= gesture;
            if (leg && role.accessory === 'bicycle') swing = -.45 + (walking ? Math.sin(phase) * (part.swing ?? 0) * .55 : 0);
            object.position.copy(part.offset);
            if (arm || leg) { const pivot = arm ? .21 : .105, length = pivot - part.offset.y; object.position.y = pivot - Math.cos(swing) * length; object.position.z -= Math.sin(swing) * length; }
            object.rotation.set(swing, part.rotation ?? 0, 0); object.scale.copy(part.scale);
            if (part.offset.y >= .28) { object.position.sub(headPivot).applyAxisAngle(xAxis, nod).add(headPivot); object.rotation.x += nod; }
            if (arm && role.accessory !== 'stroller' && role.accessory !== 'bicycle') object.rotation.z = Math.sign(part.offset.x) * gesture * .28;
            if (part.filter && role.accessory !== part.filter) object.scale.setScalar(0);
            object.updateMatrix(); localMatrix.copy(object.matrix); matrix.multiplyMatrices(rootMatrix, localMatrix); part.mesh.setMatrixAt(index, matrix);
            if (!part.filter && part.offset.y === .14) part.mesh.setColorAt(index, new T.Color(role.color).lerp(seasonalAccent, .22));
            if (!part.filter && part.offset.y === .056) part.mesh.setColorAt(index, new T.Color(['#3f505b', '#6c4e44', '#354d46', '#6b607a'][index % 4]));
            if (!part.filter && part.offset.y === .28 && part.offset.z === 0) part.mesh.setColorAt(index, new T.Color(role.skin));
          }
          object.position.copy(v3(w.position)).add(new T.Vector3(0, .006, 0)); object.rotation.set(0, 0, 0); object.scale.setScalar(size); object.updateMatrix(); shadow.setMatrixAt(index, object.matrix);
          sprites[index].material = cargos.get(w.cargo)!; sprites[index].position.copy(v3(w.position)).add(new T.Vector3(0, .49, 0)); sprites[index].visible = distance < 16;
          const label = walkerLabels[index]; label.object.position.copy(v3(w.position)).add(new T.Vector3(0, .68, 0));
          const cargo = { book: ['書本', 'books'], idea: ['想法', 'ideas'], memory: ['記憶', 'memories'], data: ['資料', 'data'] }[w.cargo]; label.full = state.language === 'en' ? `Reading companion · ${cargo[1]}` : `閱讀夥伴 · ${cargo[0]}`;
        });
        for (const part of parts) { part.mesh.instanceMatrix.needsUpdate = true; part.mesh.boundingSphere = null; if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true; } shadow.instanceMatrix.needsUpdate = true;
      }
      return { data, group, walkerGroup, smallObjects, decorGlow, decorPools, get lastSeason() { return lastSeason; }, set lastSeason(value) { lastSeason = value; }, kit: builtKit, environment, graph, simulation, placements, dom, hits, islandHits, parts, flows, wall, updateWalkers, dispose() { kit!.dispose(); environment!.dispose(); for (const label of dom) label.element.remove(); for (const resource of owned) resource.dispose(); group.clear(); } };
    } catch (error) { kit?.dispose(); environment?.dispose(); for (const label of dom) label.element.remove(); for (const resource of owned) resource.dispose(); throw error; }
  }
  let resources: ReturnType<typeof build>;
  try { resources = build(options.data); } catch (error) { controls.dispose(); labels.domElement.remove(); if (originalTabindex === null) options.canvas.removeAttribute('tabindex'); throw error; }
  const pendingPreparations = new Map<ReturnType<typeof build>, number>();
  const retiredResources = new Set<ReturnType<typeof build>>();
  function retire(value: ReturnType<typeof build>) {
    for (const label of value.dom) label.element.remove();
    if (pendingPreparations.has(value)) retiredResources.add(value);
    else value.dispose();
  }
  scene.add(resources.group); scene.fog = resources.environment.fog;
  function selectedIsland(): string | null {
    const current = selection;
    if (current?.kind === 'island') return current.islandId;
    if (current?.kind === 'item') return resources.data.items.find(i => i.id === current.itemId)?.islandId ?? null;
    return null;
  }
  function syncEncounter() {
    const current = selection;
    const next = active && state.walkers && state.detailOpen && !state.listOpen && current?.kind === 'walker' && resources.simulation.snapshot().walkers.some(w => w.id === current.walkerId) ? current.walkerId : null;
    if (next !== encounter) { speech = null; reactionTime = 1.2; }
    encounter = next; resources.simulation.setEncounter(next);
    options.canvas.dataset.npcEncounter = next ?? '';
    options.canvas.dataset.npcReaction = speech && reactionTime < 1.2 && moving() ? speech.reaction : '';
    bubbleElement.hidden = !speech || speech.walkerId !== next;
    if (!bubbleElement.hidden) { const walker = resources.simulation.snapshot().walkers.find(w => w.id === next)!; bubble.position.copy(v3(walker.position)).add(new T.Vector3(0, .75, 0)); bubbleElement.textContent = `「${speech!.text}」`; }
  }
  function refresh() {
    syncEncounter();
    const snap = resources.simulation.snapshot(), ids = new Set<string>(); const island = selectedIsland();
    resources.walkerGroup.visible = state.walkers;
    if (selection?.kind === 'item') ids.add(selection.itemId);
    else if (island) resources.data.islands.find(i => i.id === island)?.itemIds.forEach(id => ids.add(id));
    resources.kit.highlight(ids, new Set(snap.activeItemIds)); resources.kit.setNight(snap.day.night); resources.environment.applyDay(snap.day); if (resources.lastSeason !== state.season) { resources.environment.setSeason(state.season); resources.lastSeason = state.season; }
    for (const glow of resources.decorGlow) glow.emissiveIntensity = snap.day.night * 3.2;
    for (const pool of resources.decorPools) pool.opacity = snap.day.night * .18;
    const current = selection;
    const selectedFlow = current?.kind === 'flow' ? current.flowId : current?.kind === 'walker' ? snap.walkers.find(w => w.id === current.walkerId)?.flowId : null;
    for (const { flow, tube, shader } of resources.flows) { tube.visible = state.flows || flow.id === selectedFlow || flow.from === island || flow.to === island; shader.uniforms.motion.value = moving() ? 1 : 0; shader.uniforms.color.value.set(HOLIDAYS[state.season].accent); }
    for (const l of resources.dom) {
      if (l.type === 'island') { const i = resources.data.islands.find(i => i.id === l.owner)!; l.full = `${l.short} ${i.title[state.language]}`; l.element.classList.toggle('is-selected', island === l.owner); l.element.classList.toggle('is-muted', !!island && island !== l.owner); }
      l.element.setAttribute('aria-label', l.full); l.element.setAttribute('aria-pressed', String(JSON.stringify(l.selection) === JSON.stringify(selection)));
    }
    resources.group.traverse(o => { if (o.userData.pinIsland) o.visible = o.userData.pinIsland === island; });
    invalidate();
  }
  function flyTo(target: T.Vector3, offset: T.Vector3) {
    if (state.detailOpen && width > 800) target.x += 1.5;
    const to = target.clone().add(offset);
    if (!moving()) { flight = null; controls.target.copy(target); camera.position.copy(to); camera.lookAt(target); controls.update(); }
    else flight = { time: 0, from: camera.position.clone(), to, fromTarget: controls.target.clone(), target };
    invalidate();
  }
  function overview() { const distance = width / height >= 1.35 ? 28.5 : width / height >= .9 ? 38 : 56; flyTo(new T.Vector3(0, .65, 1), new T.Vector3(.24, .33, .87).normalize().multiplyScalar(distance)); }
  function focusSelection() {
    const current = selection;
    if (!current) { overview(); return; }
    if (current.kind === 'island') { const island = resources.data.islands.find(i => i.id === current.islandId); if (island) flyTo(v3(axialToWorld(...island.axial, resources.data.layout.spacing)).setY(resources.data.layout.top), new T.Vector3(2.75, 5.3, 6.2)); }
    else if (current.kind === 'item') { const p = resources.placements.find(p => p.id === current.itemId); if (p) flyTo(v3(p.position), new T.Vector3(1.6, 2.5, 3.2)); }
    else { const walker = current.kind === 'walker' ? resources.simulation.snapshot().walkers.find(w => w.id === current.walkerId) : null; const flowId = current.kind === 'flow' ? current.flowId : walker?.flowId; const flow = resources.data.flows.find(f => f.id === flowId); if (walker) flyTo(v3(walker.position), new T.Vector3(1.6, 2.5, 3.2)); else if (flow) { const a = resources.data.islands.find(i => i.id === flow.from)!, b = resources.data.islands.find(i => i.id === flow.to)!; flyTo(v3(axialToWorld(...a.axial)).lerp(v3(axialToWorld(...b.axial)), .5), new T.Vector3(2.75, 5.3, 6.2)); } }
  }
  function setSelection(value: ExplorerSelection, focus = true) {
    const valid = !value || value.kind === 'island' && resources.data.islands.some(i => i.id === value.islandId) || value.kind === 'item' && resources.data.items.some(i => i.id === value.itemId) || value.kind === 'flow' && resources.data.flows.some(i => i.id === value.flowId) || value.kind === 'walker' && resources.simulation.snapshot().walkers.some(i => i.id === value.walkerId);
    selection = valid ? value : null; refresh(); if (focus) focusSelection(); }
  function dispatch(value: ExplorerSelection) { if (!active) return; setSelection(value); options.onSelection(value); }
  const down = (e: PointerEvent) => { if (!active) return; options.canvas.focus({ preventScroll: true }); flight = null; pointer = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }; invalidate(); };
  const move = (e: PointerEvent) => { if (pointer && Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 6) pointer.moved = true; };
  const cancel = () => { pointer = null; };
  const up = (e: PointerEvent) => {
    const p = pointer; pointer = null; if (!active || !p || p.id !== e.pointerId || p.moved || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) return;
    const rect = options.canvas.getBoundingClientRect(), ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera); scene.updateMatrixWorld(true);
    const intersections = ray.intersectObjects(resources.hits.filter(o => { let current: T.Object3D | null = o; while (current) { if (!current.visible) return false; current = current.parent; } return true; }), false);
    for (const hit of intersections) {
      const itemId = resources.kit.resolveHit(hit.object, hit.instanceId); if (itemId) { dispatch({ kind: 'item', itemId }); return; }
      if (resources.parts.some(p => p.mesh === hit.object) && hit.instanceId !== undefined) { const walker = resources.simulation.snapshot().walkers[hit.instanceId]; if (walker) { dispatch({ kind: 'walker', walkerId: walker.id }); return; } }
      if (hit.object.userData.flowId) { dispatch({ kind: 'flow', flowId: hit.object.userData.flowId }); return; }
    }
    const island = intersections.map(hit => {
      const mapping = resources.islandHits.get(hit.object); if (!mapping) return undefined;
      const index = mapping.mode === 'instance' ? hit.instanceId : hit.faceIndex;
      return index === undefined || index === null ? undefined : mapping.ids[index];
    }).find(Boolean); dispatch(island ? { kind: 'island', islandId: island } : null);
  };
  const keydown = (e: KeyboardEvent) => {
    if (!active || document.activeElement !== options.canvas || !e.key.startsWith('Arrow')) return;
    e.preventDefault(); flight = null; const offset = camera.position.clone().sub(controls.target), spherical = new T.Spherical().setFromVector3(offset);
    if (e.key === 'ArrowLeft') spherical.theta -= .12; if (e.key === 'ArrowRight') spherical.theta += .12; if (e.key === 'ArrowUp') spherical.phi -= .08; if (e.key === 'ArrowDown') spherical.phi += .08;
    spherical.phi = T.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle); camera.position.copy(controls.target).add(offset.setFromSpherical(spherical)); camera.lookAt(controls.target); invalidate();
  };
  options.canvas.addEventListener('pointerdown', down); options.canvas.addEventListener('pointermove', move); options.canvas.addEventListener('pointerup', up); options.canvas.addEventListener('pointercancel', cancel); options.canvas.addEventListener('keydown', keydown);
  function collideLabels() {
    const viewport = options.canvas.getBoundingClientRect(), panels = Array.from(document.querySelectorAll<HTMLElement>('[data-explorer-panel]')).filter(e => !e.hidden && getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect());
    const occupied: DOMRect[] = [], snap = resources.simulation.snapshot(), island = selectedIsland();
    if (!bubbleElement.hidden) {
      const projected = bubble.getWorldPosition(new T.Vector3()).project(camera);
      bubbleElement.style.translate = '0px 0px';
      bubbleElement.style.visibility = projected.z < -1 || projected.z > 1 ? 'hidden' : 'visible';
      const rect = bubbleElement.getBoundingClientRect();
      const xs = [0, viewport.left + 8 - rect.left, viewport.right - 8 - rect.right, ...panels.flatMap(p => [p.left - 10 - rect.right, p.right + 10 - rect.left])];
      const ys = [0, viewport.top + 8 - rect.top, viewport.bottom - 8 - rect.bottom, ...panels.flatMap(p => [p.top - 10 - rect.bottom, p.bottom + 10 - rect.top])];
      let placement: { x: number; y: number; cost: number } | null = null;
      for (const x of xs) for (const y of ys) {
        if (rect.left + x < viewport.left + 7 || rect.right + x > viewport.right - 7 || rect.top + y < viewport.top + 7 || rect.bottom + y > viewport.bottom - 7) continue;
        if (panels.some(p => rect.left + x < p.right + 6 && rect.right + x > p.left - 6 && rect.top + y < p.bottom + 6 && rect.bottom + y > p.top - 6)) continue;
        const cost = x * x + y * y + Math.max(0, y) * 20;
        if (!placement || cost < placement.cost) placement = { x, y, cost };
      }
      if (placement) { bubbleElement.style.translate = `${placement.x}px ${placement.y}px`; occupied.push(bubbleElement.getBoundingClientRect()); }
      else bubbleElement.style.visibility = 'hidden';
    }
    for (const label of resources.dom) {
      const walker = label.type === 'walker' ? snap.walkers.find(w => w.id === label.owner) : null;
      const eligible = label.type === 'island' || label.type === 'item' && resources.data.items.find(i => i.id === label.owner)?.islandId === island || label.type === 'walker' && state.names && state.walkers && !!walker && camera.position.distanceTo(v3(walker.position)) < 14;
      const projected = label.object.getWorldPosition(new T.Vector3()).project(camera);
      if (!eligible || projected.z < -1 || projected.z > 1) { label.element.hidden = true; continue; }
      label.element.hidden = false; label.element.style.visibility = 'visible'; label.element.textContent = label.full;
      const overlaps = (rect: DOMRect, padding: number) => [...panels, ...occupied].some(r => rect.left < r.right + padding && rect.right > r.left - padding && rect.top < r.bottom + padding && rect.bottom > r.top - padding) || rect.right < viewport.left || rect.left > viewport.right || rect.bottom < viewport.top || rect.top > viewport.bottom;
      let rect = label.element.getBoundingClientRect(); const margin = label.hidden || label.compact ? 8 : 0;
      label.compact = false;
      if (overlaps(rect, margin)) { label.element.textContent = label.short || label.full; label.compact = true; rect = label.element.getBoundingClientRect(); }
      label.hidden = overlaps(rect, label.hidden ? 8 : 0); label.element.style.visibility = label.hidden ? 'hidden' : 'visible'; if (!label.hidden) occupied.push(rect);
    }
  }
  overview(); refresh(); options.labelHost.hidden = true; options.labelHost.inert = true;
  return {
    async prepare(renderer: T.WebGLRenderer) {
      if (disposed) return;
      const preparing = resources;
      pendingPreparations.set(preparing, (pendingPreparations.get(preparing) ?? 0) + 1);
      try {
        preparing.updateWalkers(preparing.simulation.snapshot().walkers, moving());
        scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
        await renderer.compileAsync(scene, camera);
      } finally {
        const remaining = pendingPreparations.get(preparing)! - 1;
        if (remaining) pendingPreparations.set(preparing, remaining);
        else { pendingPreparations.delete(preparing); if (retiredResources.delete(preparing)) preparing.dispose(); }
      }
    },
    setData(data) { if (disposed) return; const next = build(data); const old = resources; resources = next; scene.add(next.group); scene.remove(old.group); scene.fog = next.environment.fog; selection = null; pointer = null; flight = null; elapsed = 0; speech = null; speechTokens.clear(); reactionTime = 1.2; next.simulation.setMinute(state.minute); next.environment.setMobile(width <= 800); retire(old); refresh(); },
    setNpcSpeech(cue) { if (disposed) return; if (!cue) { speech = null; reactionTime = 1.2; refresh(); return; } if (cue.walkerId !== encounter || !Number.isSafeInteger(cue.token) || typeof cue.text !== 'string' || !['greet', 'nod', 'explain', 'reflect'].includes(cue.reaction) || cue.token <= (speechTokens.get(cue.walkerId) ?? -Infinity)) return; speechTokens.set(cue.walkerId, cue.token); speech = { ...cue }; reactionTime = moving() ? 0 : 1.2; refresh(); },
    setSelection(value, config) { if (!disposed) setSelection(value, config?.focus !== false); },
    setState(next) {
      if (disposed) return; const previous = state; state = { ...next };
      if (!moving()) reactionTime = 1.2;
      if (next.population !== previous.population) resources.simulation.setPopulation(next.population);
      if (Math.abs(next.minute - resources.simulation.snapshot().minute) > .00001) resources.simulation.setMinute(next.minute);
      controls.enableDamping = moving(); controls.minPolarAngle = next.birdseye ? 0 : T.MathUtils.degToRad(25);
      if (!moving() && flight) { camera.position.copy(flight.to); controls.target.copy(flight.target); camera.lookAt(controls.target); flight = null; }
      if (JSON.stringify(selection) !== JSON.stringify(next.selection)) setSelection(next.selection);
      else if (selection && next.detailOpen !== previous.detailOpen) focusSelection();
      if (next.birdseye !== previous.birdseye) { if (next.birdseye) flyTo(controls.target.clone(), new T.Vector3(.01, 42, 6)); else overview(); }
      refresh();
    },
    setActive(value) { if (disposed || active === value) return; active = value; pointer = null; options.labelHost.hidden = !value; options.labelHost.inert = !value; controls.enabled = value; controls.enableDamping = moving(); if (value) controls.connect(options.canvas); else { controls.disconnect(); flight = null; speech = null; reactionTime = 1.2; } refresh(); },
    resize(w, h) { width = Math.max(1, w); height = Math.max(1, h); camera.aspect = width / height; camera.updateProjectionMatrix(); labels.setSize(width, height); resources.environment.setMobile(width <= 800); if (!selection && !state.birdseye) overview(); invalidate(); },
    update(dtSeconds) {
      if (disposed || !active) return { dirty: false, continuous: false };
      const motion = moving(), dt = Number.isFinite(dtSeconds) ? Math.max(0, dtSeconds) : 0;
      if (motion) reactionTime = Math.min(1.2, reactionTime + dt);
      else reactionTime = 1.2;
      if (motion) { elapsed += dt; const events = resources.simulation.update(dt, true); if (events.length) options.onEvents(events.slice(-100)); const snapshot = resources.simulation.snapshot(); options.onMinute(snapshot.minute); resources.environment.update(dt); for (const flow of resources.flows) flow.shader.uniforms.time.value = elapsed; refresh(); }
      else resources.environment.update(0);
      if (flight && motion) { flight.time += dt; const p = Math.min(1, flight.time / .8), ease = p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2; camera.position.copy(flight.from).lerp(flight.to, ease); controls.target.copy(flight.fromTarget).lerp(flight.target, ease); camera.lookAt(controls.target); if (p === 1) flight = null; dirty = true; }
      else if (motion) controls.update();
      resources.updateWalkers(resources.simulation.snapshot().walkers, motion, dt);
      return { dirty, continuous: motion || !!flight };
    },
    render(renderer) { if (disposed) return; renderer.toneMappingExposure = 1; resources.updateWalkers(resources.simulation.snapshot().walkers, moving()); resources.smallObjects.visible = camera.position.distanceTo(controls.target) < 26; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); renderer.render(scene, camera); if (active) { labels.render(scene, camera); collideLabels(); } dirty = false; },
    thumbnail(itemId, renderer) {
      if (disposed) return null; const item = resources.data.items.find(i => i.id === itemId); if (!item) return null;
      let preview: ModelKit | undefined;
      const previousTarget = renderer.getRenderTarget(), viewport = renderer.getViewport(new T.Vector4()), scissor = renderer.getScissor(new T.Vector4()), scissorTest = renderer.getScissorTest(), clearColor = renderer.getClearColor(new T.Color()), clearAlpha = renderer.getClearAlpha(), autoClear = renderer.autoClear, exposure = renderer.toneMappingExposure, shadowEnabled = renderer.shadowMap.enabled, shadowAuto = renderer.shadowMap.autoUpdate, cubeFace = renderer.getActiveCubeFace(), mipmap = renderer.getActiveMipmapLevel();
      try {
        targetRT ??= new T.WebGLRenderTarget(160, 160); targetRT.texture.colorSpace = T.SRGBColorSpace; preview = createModelKit([{ id: item.id, model: item.model, position: [0, 0, 0], scale: 1, color: resources.data.islands.find(i => i.id === item.islandId)!.color }], resources.data.seed);
        const previewScene = new T.Scene(); previewScene.add(preview!.group, new T.HemisphereLight('#fff8ee', '#8f8270', 2)); const sun = new T.DirectionalLight('#fff1de', 3); sun.position.set(3, 5, 4); previewScene.add(sun);
        const previewCamera = new T.PerspectiveCamera(32, 1, .1, 30); previewCamera.position.set(2.4, 2, 3); previewCamera.lookAt(0, .65, 0);
        renderer.setRenderTarget(targetRT); renderer.setViewport(0, 0, 160, 160); renderer.setScissorTest(false); renderer.setClearColor('#fff8f4', 1); renderer.autoClear = true; renderer.toneMappingExposure = 1; renderer.shadowMap.enabled = false; renderer.render(previewScene, previewCamera);
        const pixels = new Uint8Array(160 * 160 * 4); renderer.readRenderTargetPixels(targetRT, 0, 0, 160, 160, pixels);
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 160; const context = canvas.getContext('2d'); if (!context) return null; const image = context.createImageData(160, 160); for (let y = 0; y < 160; y++) image.data.set(pixels.subarray(y * 640, (y + 1) * 640), (159 - y) * 640); context.putImageData(image, 0, 0); return canvas.toDataURL('image/png');
      } catch { return null; }
      finally { preview?.dispose(); renderer.setRenderTarget(previousTarget, cubeFace, mipmap); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest); renderer.setClearColor(clearColor, clearAlpha); renderer.autoClear = autoClear; renderer.toneMappingExposure = exposure; renderer.shadowMap.enabled = shadowEnabled; renderer.shadowMap.autoUpdate = shadowAuto; }
    },
    getWalkers() { return resources.simulation.snapshot().walkers; },
    dispose() { if (disposed) return; disposed = true; active = false; controls.removeEventListener('change', onChange); controls.dispose(); retire(resources); targetRT?.dispose(); labels.domElement.remove(); options.labelHost.hidden = true; options.labelHost.inert = true; options.canvas.removeEventListener('pointerdown', down); options.canvas.removeEventListener('pointermove', move); options.canvas.removeEventListener('pointerup', up); options.canvas.removeEventListener('pointercancel', cancel); options.canvas.removeEventListener('keydown', keydown); scene.clear(); if (originalTabindex === null) options.canvas.removeAttribute('tabindex'); }
  };
}

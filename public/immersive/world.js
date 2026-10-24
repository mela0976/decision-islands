import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addContactRig, createCharacterEvents } from './character-events.js';

const CHAPTERS = {
  intro: { color: '#d8cdb8', sea: '#f4eee1' },
  people: { color: '#c8d263', sea: '#e8ead5' },
  model: { color: '#dc9eb3', sea: '#efdee4' },
  ai: { color: '#85c9ce', sea: '#daebeb' },
};
const CANONICAL = ['I01', 'I02', ...Array.from({ length: 9 }, (_, i) => `P0${i + 1}`), ...Array.from({ length: 5 }, (_, i) => `M0${i + 1}`), ...Array.from({ length: 6 }, (_, i) => `A0${i + 1}`)];
const STAGES = ['settle', 'question', 'carry', 'sail', 'arrival'];
export function mulberry32(seed) {
  return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export async function createWorld({ canvas, data, onIslandSelect = () => {}, onObjectSelect = () => {}, onTransitionStage = () => {}, reducedMotion = false }) {
  if (!canvas || !data?.islands?.length) throw new Error('缺少群島畫布或內容資料。');
  const setupStartedAt = performance.now();
  const initialArticleId = data.islands[0].articleId || data.articles?.[0]?.id;
  const initialScene = data.scenes?.find(item => item.articleId === initialArticleId);
  const initialFontText = `${data.islands[0].id} · ${initialScene?.coreDevice?.label || data.articles?.[0]?.title || ''} 阿綺小岳映蓁芬姐`;
  if (document.fonts) await Promise.all([
    document.fonts.load('600 42px "Publication Sans TW"', initialFontText),
    document.fonts.load('600 28px "Publication Sans TW"', '阿綺小岳映蓁芬姐'),
  ]);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.4 : 1.8));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .94;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b8d6d9');
  scene.fog = new THREE.Fog('#b8d6d9', 155, 290);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  camera.position.set(31, 28, 39);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 9;
  controls.maxDistance = 160;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.target.set(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#fff7e6', '#566764', 1.3));
  const sunlight = new THREE.DirectionalLight('#fff0d3', 2.5);
  sunlight.position.set(-25, 55, 30);
  sunlight.castShadow = false;
  sunlight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunlight.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
  sunlight.shadow.bias = -0.001;
  scene.add(sunlight, sunlight.target);
  const geometries = new Map();
  const materials = new Map();
  const textures = new Set();
  const labels = new Set();
  const random = mulberry32(202601);
  function editorialRoughness() {
    const surface = document.createElement('canvas'); surface.width = 64; surface.height = 64;
    const context = surface.getContext('2d'); const image = context.createImageData(64, 64);
    const grain = mulberry32(2026);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = Math.round(198 + grain() * 57);
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value; image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(surface); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3); textures.add(texture); return texture;
  }
  const paperRoughness = editorialRoughness();
  const paperCoastMaterial = new THREE.MeshStandardMaterial({ color: '#e6dcc7', roughness: .96, metalness: 0, roughnessMap: paperRoughness });
  materials.set('paper-coast', paperCoastMaterial);
  function geometry(type) {
    if (!geometries.has(type)) geometries.set(type, type === 'ball' ? new THREE.SphereGeometry(1, 12, 8) : type === 'cylinder' ? new THREE.CylinderGeometry(1, 1, 1, 12) : type === 'cone' ? new THREE.ConeGeometry(1, 1, 8) : type === 'ring' ? new THREE.TorusGeometry(1, 0.12, 6, 28) : new THREE.BoxGeometry(1, 1, 1));
    return geometries.get(type);
  }
  function material(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.02 }));
    return materials.get(color);
  }
  function mesh(parent, type, color, position, scale, rotation = 0) {
    const object = new THREE.Mesh(geometry(type), material(color));
    object.position.set(...position); object.scale.set(...scale); object.rotation.y = rotation;
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function label(text, color = '#263f42', width = 144, speech = false) {
    const lines = String(text).match(/.{1,12}/gu)?.slice(0, 4) || [''];
    const surface = document.createElement('canvas'); surface.width = 512; surface.height = speech ? 32 + lines.length * 51 : 128;
    const context = surface.getContext('2d');
    const draw = () => {
      context.clearRect(0, 0, surface.width, surface.height);
      context.fillStyle = '#fff9ed'; context.beginPath(); context.roundRect(4, 4, 504, surface.height - 8, 24); context.fill();
      context.strokeStyle = '#b5ad97'; context.lineWidth = 4; context.stroke();
      context.fillStyle = color; context.font = `600 ${!speech && String(text).length <= 3 ? 88 : 42}px "Publication Sans TW", sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle';
      if (speech) lines.forEach((line, i) => context.fillText(line, 256, 40 + i * 51, 468));
      else context.fillText(text, 256, 64, 466);
    };
    draw();
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false }); materials.set(`label-${materials.size}`, mat);
    const sprite = new THREE.Sprite(mat); sprite.userData.screenWidth = width; sprite.userData.aspect = surface.height / surface.width; sprite.userData.redraw = () => { draw(); texture.needsUpdate = true; }; sprite.renderOrder = 3; labels.add(sprite); return sprite;
  }
  const sea = mesh(scene, 'cylinder', '#79b9bd', [0, -0.9, 0], [230, 0.35, 230]);
  sea.receiveShadow = true;
  const waterLines = new THREE.Group(); scene.add(waterLines);
  for (let i = 0; i < 45; i++) mesh(waterLines, 'box', '#d0e0de', [(random() - .5) * 190, -.68, (random() - .5) * 150], [2 + random() * 6, .025, .09], random() * .4);
  const islands = new Map();
  const pickables = [];
  const defaults = { intro: [-49, -18], people: [-18, 10], model: [28, -22], ai: [41, 26] };
  const chapterIndex = {};
  function identify(entry, index) { return CANONICAL.includes(entry.id) ? entry.id : entry.sceneId || CANONICAL[index]; }
  function tag(object, island, kind = 'device', objectId = 'core-device', characterId = null) {
    object.userData.pick = { articleId: island.articleId, objectId, characterId, kind }; pickables.push(object);
  }
  function building(parent, x, z, w, h, d, color, roof = '#d5baa4') {
    mesh(parent, 'box', color, [x, 1 + h / 2, z], [w, h, d]);
    mesh(parent, 'box', roof, [x, 1 + h, z], [w + .35, .24, d + .35]);
    for (let j = -1; j <= 1; j += 2) mesh(parent, 'box', '#40585b', [x + j * w * .26, 1.3 + h * .48, z + d / 2 + .025], [.35, .65, .06]);
  }
  function table(parent, x = 0, z = 0) {
    const top = mesh(parent, 'box', '#c8a98b', [x, 1.9, z], [3.6, .2, 2]);
    for (const dx of [-1.4, 1.4]) mesh(parent, 'box', '#74766a', [x + dx, 1.4, z], [.14, 1, 1.3]);
    return top;
  }
  function tree(parent, x, z, color) {
    mesh(parent, 'cylinder', '#a88e74', [x, 1.8, z], [.14, 1.8, .14]);
    mesh(parent, 'ball', color, [x, 3, z], [1, 1.3, .9]);
    mesh(parent, 'ball', color, [x + .5, 2.8, z + .2], [.7, .8, .7]);
    mesh(parent, 'ball', color, [x - .45, 2.9, z - .1], [.7, .9, .65]);
  }
  function buildScene(island, index) {
    const { detail: g, color, canonical: id } = island;
    const accent = color;
    let core;
    switch (id) {
      case 'I01':
        building(g, -2, -2, 5, 3.8, 3, '#f2eadd'); table(g, 1, 1);
        core = mesh(g, 'box', '#414d51', [1, 2.7, .8], [1.5, 1.3, .15], -.2);
        for (let n = 0; n < 7; n++) mesh(g, 'box', '#fffaf0', [-3 + n * .55, 1.2 + n * .18, 2.5], [.45, .12, 1.4], n * .08); break;
      case 'I02':
        building(g, -4, -1, 2.2, 2.4, 2, '#efe5d7'); building(g, 4, 1, 2.2, 3.6, 2, '#d7ddd4');
        core = mesh(g, 'ring', '#8a9f9b', [0, 3, 0], [2, 2, 2]);
        for (let n = -3; n <= 3; n++) mesh(g, 'box', '#f5edde', [n, 1.2 + .25 * Math.cos(n), 0], [.8, .2, 1.2]); break;
      case 'P01':
        for (let n = 0; n < 7; n++) { const a = n * .9; mesh(g, 'cylinder', '#9caa78', [Math.cos(a) * 3.5, 1.5, Math.sin(a) * 3.5], [.07, 1, .07]); mesh(g, 'ball', n % 2 ? '#e7bfaa' : '#e3e2ce', [Math.cos(a) * 3.5, 2.2, Math.sin(a) * 3.5], [.75, .25, .75]); }
        core = mesh(g, 'box', '#f5f0df', [0, 2.5, 0], [2, 2.6, .18], -.3); break;
      case 'P02':
        for (let n = 0; n < 4; n++) building(g, -4 + n * 2.5, -2, 1.8, 2 + n % 2, 2, ['#d9ac8c', '#e7d5b7', '#bec39b', '#d3aab0'][n]);
        core = mesh(g, 'box', '#b4c45e', [1, 1.6, 2], [2, 1.2, 1]); break;
      case 'P03':
        table(g); for (let n = 0; n < 5; n++) mesh(g, 'box', n % 2 ? '#e4b3a7' : accent, [-3 + n * 1.5, 2.3 + n * .35, 0], [1.1, .65 + n * .2, 1.2]);
        core = mesh(g, 'ring', '#53645a', [0, 4.3, 0], [1.2, 1.2, 1.2]); break;
      case 'P04':
        building(g, 3, -2, 3, 2.5, 2.8, '#eee7d9');
        for (let n = -4; n <= 2; n++) { mesh(g, 'box', '#bb9e7d', [n, 1.35 + .55 * Math.sin((n + 4) / 6 * Math.PI), 1], [.85, .18, 1.6]); mesh(g, 'box', '#7b8d8a', [n, 2, 1.9], [.09, 1.3, .09]); }
        core = mesh(g, 'box', '#e2dcae', [-2, 2.7, 1], [1.2, 1.4, .12]); break;
      case 'P05':
        building(g, 0, -2, 6, 3, 2.7, '#efd7bc'); mesh(g, 'box', '#b9c66d', [0, 3.5, -.3], [6.3, .35, 1.4]);
        for (let n = -2; n < 3; n++) mesh(g, 'box', n % 2 ? '#e8a99b' : '#d4c66b', [n, 1.65, 1.3], [.6, 1, .65]);
        core = mesh(g, 'box', '#bd7163', [0, 2.5, 1.5], [.8, .9, .7]); break;
      case 'P06':
        for (let n = 0; n < 14; n++) { const a = n / 14 * Math.PI * 2; mesh(g, 'box', '#e1d6ba', [Math.cos(a) * 4, 1.5, Math.sin(a) * 3], [1, .7 + n % 3 * .3, 1], -a); }
        core = mesh(g, 'cylinder', '#9eac68', [0, 1.15, 0], [2.8, .2, 2]); mesh(g, 'box', '#5d6962', [0, 2.4, -2], [3.3, 2.6, .2]); break;
      case 'P07':
        for (let n = 0; n < 5; n++) building(g, n % 2 ? 3 : -3, -3 + n * 1.5, 2, 2 + n % 3 * .6, 1.1, '#d7c9ae');
        core = mesh(g, 'box', '#516461', [0, 2, 0], [.8, 1.5, .18], .3);
        for (let n = 0; n < 4; n++) mesh(g, 'ball', '#d6bd93', [Math.sin(n) * 1.8, 2.7 + n * .4, -1], [.35, .23, .18]); break;
      case 'P08':
        for (let n = -1; n <= 1; n++) { mesh(g, 'box', '#7d8780', [n * 3, 2.5, -1], [.16, 3, .16]); mesh(g, 'box', n ? '#d8c6a1' : '#d4a1a3', [n * 3, 4, -1], [2.3, 2.6, .2], n * .15); }
        core = mesh(g, 'cylinder', accent, [0, 1.3, 2], [1.5, .5, 1.5]); break;
      case 'P09':
        building(g, 0, -2, 6, 3.5, 2.8, '#d8b49b', '#7b7470');
        mesh(g, 'box', '#453f43', [0, 2.6, -.5], [3.5, 2.4, .1]);
        for (let n = 0; n < 9; n++) mesh(g, 'box', '#b8a170', [(n % 3 - 1) * 1.4, 1.3, 1 + Math.floor(n / 3)], [.85, .55, .7]);
        core = mesh(g, 'cylinder', '#d3b774', [-3, 1.8, 1], [.6, 1.5, .6]); break;
      case 'M01':
        for (let n = 0; n < 3; n++) { table(g, -3 + n * 3, 0); mesh(g, 'box', '#b7c4bc', [-3 + n * 3, 2.7, -1], [2.4, 2, .12]); }
        core = mesh(g, 'ball', accent, [0, 3.2, 1], [.8, .9, .8]); break;
      case 'M02':
        for (let n = 0; n < 6; n++) { const a = n * Math.PI / 3; mesh(g, 'box', '#f5e7df', [Math.cos(a) * 3, 1.3, Math.sin(a) * 3], [1.5, .45, 1.5], a); mesh(g, 'box', accent, [Math.cos(a) * 1.4, 1.14, Math.sin(a) * 1.4], [2.5, .08, .12], -a); }
        core = mesh(g, 'cone', '#70697b', [0, 2, 0], [.65, 1.6, .65]); break;
      case 'M03':
        table(g); mesh(g, 'cylinder', '#81747a', [0, 3, 0], [.1, 2.4, .1]);
        core = mesh(g, 'box', '#ab8291', [0, 4.2, 0], [5, .15, .2]);
        for (const x of [-2.1, 2.1]) { mesh(g, 'cylinder', '#84747e', [x, 3.5, 0], [.03, 1.4, .03]); mesh(g, 'cylinder', '#e5c4b7', [x, 2.8, 0], [.8, .12, .8]); } break;
      case 'M04':
        for (let n = 0; n < 7; n++) for (const side of [-1, 1]) mesh(g, 'box', side < 0 ? '#d4b29e' : accent, [side * n * .55, 1.15 + n * .12, -3 + n], [1, .2, .8], side * .3);
        core = mesh(g, 'ring', '#9d8491', [0, 3, -2], [1.1, 1.1, 1.1]); break;
      case 'M05':
        mesh(g, 'cylinder', '#8f9ea3', [0, .1, 0], [5.2, .4, 4.2]);
        for (let n = 0; n < 7; n++) mesh(g, 'box', '#bba6b3', [-3 + n, .6, 0], [.2, 1 + n % 3 * .5, 4], .3);
        core = mesh(g, 'ball', '#e6c3cf', [0, 2.8, 0], [1.6, 1.6, 1.6]); break;
      case 'A01':
        for (let n = 0; n < 3; n++) building(g, -3 + n * 3, -2, 2.4, 2 + n * .5, 2.3, '#d4e2d9');
        core = mesh(g, 'box', '#65999d', [0, 2.2, 1], [1.5, 2.2, .3]); mesh(g, 'box', '#e7ba98', [-2, 1.2, 2], [2, .2, 1]); break;
      case 'A02':
        table(g); mesh(g, 'ring', accent, [0, 3.5, 0], [2.4, 1.8, 1.8]);
        core = mesh(g, 'ball', '#d3c5a5', [-2, 2.6, 0], [.65, .65, .65]); mesh(g, 'box', '#73939b', [2, 2.7, 0], [1.1, 1.3, 1.1]); break;
      case 'A03':
        for (let n = 0; n < 8; n++) { const a = n * .785; mesh(g, 'cylinder', '#809d91', [Math.cos(a) * 3, 2, Math.sin(a) * 3], [.07, 2, .07]); mesh(g, 'ball', n % 2 ? '#d4dbb6' : accent, [Math.cos(a) * 3, 3, Math.sin(a) * 3], [.65, .45, .65]); }
        core = mesh(g, 'ring', '#6d9198', [0, 2.6, 0], [1.4, 1.4, 1.4]); break;
      case 'A04':
        building(g, -2, -2, 4.5, 2.8, 2.8, '#d5dace'); table(g, 1, 1);
        for (let n = 0; n < 4; n++) mesh(g, 'box', ['#d1b7b8', accent, '#d6cb9d', '#c1c8ad'][n], [-2.5 + n * 1.7, 2.5, -1], [1.3, 1.7, .1], n * .1);
        core = mesh(g, 'cylinder', '#486f76', [2, 2.4, 1], [.45, .9, .45]); break;
      case 'A05':
        for (let n = 0; n < 3; n++) { const a = n * 2.094; table(g, Math.cos(a) * 2.5, Math.sin(a) * 2.5); }
        core = mesh(g, 'ring', accent, [0, 4, 0], [2, 2, 2]); core.rotation.x = Math.PI / 2; break;
      default:
        for (let n = 0; n < 3; n++) building(g, -3 + n * 3, -2, 2.3, 2 + n % 2, 2.4, ['#e4ceba', '#d7bfc5', '#bdd2c3'][n]);
        for (let n = 0; n < 5; n++) mesh(g, 'box', accent, [-3 + n * 1.5, 1.12, 2], [1, .1, .7]);
        core = mesh(g, 'box', '#4f7e83', [2, 2.4, 1], [.8, 1.3, .3]);
    }
    island.core = core; island.coreRest = core.position.clone(); tag(core, island, 'device', island.sceneData?.coreDevice?.id || 'core-device');
    const note = mesh(g, 'box', '#fbf6df', [4.5, 1.6, 2], [.75, 1.1, .1], -.3); tag(note, island, 'note', 'research-note');
    const bell = mesh(g, 'cone', '#b79962', [-4, 1.8, 2], [.35, .5, .35]); tag(bell, island, 'event', 'scene-bell');
    const exit = mesh(g, 'box', color, [4.8, 1.3, -2.8], [.6, .6, 1.6], .5); tag(exit, island, 'exit', 'story-exit');
    for (let n = 0; n < 3; n++) tree(g, -4 + n * 4, -3.5 + (index % 2), n % 2 ? '#adb78c' : '#c1c6a1');
  }
  data.islands.forEach((entry, index) => {
    const canonical = identify(entry, index);
    const chapter = entry.chapterId || entry.chapter || (canonical.startsWith('I') ? 'intro' : canonical.startsWith('P') ? 'people' : canonical.startsWith('M') ? 'model' : 'ai');
    const theme = CHAPTERS[chapter] || CHAPTERS.intro;
    const localIndex = chapterIndex[chapter] || 0; chapterIndex[chapter] = localIndex + 1;
    const origin = defaults[chapter] || [0, 0];
    const angle = localIndex * 2.399;
    const radius = Math.sqrt(localIndex) * 18;
    const x = Number.isFinite(entry.position?.x) ? entry.position.x : origin[0] + Math.cos(angle) * radius;
    const z = Number.isFinite(entry.position?.z) ? entry.position.z : origin[1] + Math.sin(angle) * radius;
    const root = new THREE.Group(); root.position.set(x, 0, z); scene.add(root);
    const shape = new THREE.Shape(); const rng = mulberry32(1103 + index * 691);
    for (let n = 0; n <= 18; n++) { const a = n % 18 / 18 * Math.PI * 2; const r = 6.9 + rng() * 1.2; const px = Math.cos(a) * r, py = Math.sin(a) * r * .82; if (!n) shape.moveTo(px, py); else shape.lineTo(px, py); }
    const coastGeometry = new THREE.ExtrudeGeometry(shape, { depth: .9, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .4, bevelThickness: .3 });
    geometries.set(`coast-${index}`, coastGeometry);
    const coast = new THREE.Mesh(coastGeometry, paperCoastMaterial); coast.rotation.x = -Math.PI / 2; coast.position.y = .25; coast.receiveShadow = true; root.add(coast);
    const lawn = mesh(root, 'cylinder', theme.color, [0, .85, 0], [6.5, .18, 5.1]);
    const detail = new THREE.Group(); root.add(detail);
    const article = data.articles?.find(a => a.id === entry.articleId);
    const sceneData = data.scenes?.find(s => s.articleId === entry.articleId);
    const sign = label(`${canonical} · ${(sceneData?.coreDevice?.label || article?.title || '').slice(0, 11)}`); sign.position.set(0, 6, -1); root.add(sign);
    const silhouette = new THREE.Group(); root.add(silhouette);
    const outcome = new THREE.Group(); detail.add(outcome);
    const decorations = new THREE.Group(); root.add(decorations);
    const island = { ...entry, canonical, chapter, articleId: entry.articleId || article?.id || canonical, root, detail, silhouette, outcome, decorations, sign, sceneData, color: theme.color, reactionUntil: 0, visited: false };
    tag(coast, island, 'island', 'coast'); tag(lawn, island, 'island', 'ground');
    islands.set(island.articleId, island); buildScene(island, index); detail.visible = false;
    const landmarks = detail.children.filter(o => o.isMesh).sort((a, b) => b.scale.x * b.scale.y * b.scale.z - a.scale.x * a.scale.y * a.scale.z).slice(0, 5);
    for (const landmark of new Set([island.core, ...landmarks])) { const clone = landmark.clone(); silhouette.add(clone); tag(clone, island, 'island', 'landmark'); }
    island.baseline = capture(detail);
    island.baseline[0].visible = true;
    island.highlight = mesh(root, 'ring', '#aa7948', [0, 1.08, 0], [7.6, 6.3, 7.6]); island.highlight.rotation.x = Math.PI / 2; island.highlight.visible = false;
    island.exploredLight = mesh(root, 'ball', '#f2dcaa', [0, 2.1, 4.9], [.22, .22, .22]); island.exploredLight.visible = false;
  });
  const routes = new THREE.Group(); scene.add(routes);
  const entries = [...islands.values()];
  function seaCurve(a, b, height = .3) {
    const direction = b.clone().sub(a).setY(0).normalize();
    const coastA = a.clone().addScaledVector(direction, 6.7).setY(height);
    const coastB = b.clone().addScaledVector(direction, -6.7).setY(height);
    const bend = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(Math.min(7, a.distanceTo(b) * .12));
    return new THREE.CatmullRomCurve3([coastA, coastA.clone().lerp(coastB, .5).add(bend), coastB]);
  }
  const coastLinks = [];
  for (let n = 1; n < entries.length; n++) {
    const a = entries[n - 1], b = entries[n];
    const curve = seaCurve(a.root.position, b.root.position);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(32)); geometries.set(`route-${n}`, geo);
    const mat = new THREE.LineDashedMaterial({ color: a.color, dashSize: .8, gapSize: .6, transparent: true, opacity: .48 }); materials.set(`route-${n}`, mat);
    const line = new THREE.Line(geo, mat); line.computeLineDistances(); routes.add(line);
    const distance = a.root.position.distanceTo(b.root.position);
    if (a.chapter === b.chapter && distance <= 23) {
      const steps = Math.ceil((distance - 13.4) / .6);
      for (let step = 0; step < steps; step++) {
        const t = (step + .5) / steps, point = curve.getPoint(t), tangent = curve.getTangent(t);
        mesh(routes, 'box', '#c8b699', [point.x, .45, point.z], [1.25, .16, .65], Math.atan2(tangent.x, tangent.z));
      }
      coastLinks.push({ from: a.articleId, to: b.articleId, kind: 'coastal-boardwalk', distance });
    } else if (a.chapter === b.chapter) {
      const point = curve.getPoint(.55), tangent = curve.getTangent(.55);
      const boat = new THREE.Group(); boat.position.copy(point); boat.rotation.y = Math.atan2(tangent.x, tangent.z); routes.add(boat);
      mesh(boat, 'box', '#b99170', [0, .15, 0], [1.5, .35, 2.5]); mesh(boat, 'box', '#efe6cd', [0, .5, .1], [1.2, .15, 1.5]);
      coastLinks.push({ from: a.articleId, to: b.articleId, kind: 'coastal-boat', distance });
    }
  }
  const cast = new THREE.Group(); scene.add(cast);
  const profiles = [
    { id: 'aqi', name: '阿綺', color: '#737b59', skin: '#e7baa2', hair: '#383737', pace: 1.55, habit: 'pen' },
    { id: 'xiaoyue', name: '小岳', color: '#d5977c', skin: '#dba989', hair: '#4b3c32', pace: 2.2, habit: 'phone' },
    { id: 'yingzhen', name: '映蓁', color: '#9b829b', skin: '#e6bfa4', hair: '#3e363c', pace: 1.05, habit: 'note' },
    { id: 'fenjie', name: '芬姐', color: '#779c99', skin: '#c99576', hair: '#514039', pace: .7, habit: 'bell' },
  ];
  const actors = profiles.map((profile, i) => {
    const root = new THREE.Group(); cast.add(root);
    const body = mesh(root, 'cylinder', profile.color, [0, .7, 0], [.29, .72, .23]);
    const head = new THREE.Group(); head.position.y = 1.3; root.add(head);
    mesh(head, 'ball', profile.skin, [0, 0, 0], [.29, .32, .26]);
    mesh(head, 'ball', profile.hair, [0, .16, -.06], [.3, .22, .25]);
    const eyes = [-.1, .1].map(x => mesh(head, 'ball', '#373b38', [x, .02, .235], [.027, .037, .025]));
    const brows = [-.1, .1].map(x => mesh(head, 'box', profile.hair, [x, .1, .24], [.09, .015, .025]));
    const mouth = mesh(head, 'box', '#a86b60', [0, -.12, .245], [.09, .018, .02]);
    const arms = [-1, 1].map(side => mesh(root, 'cylinder', profile.color, [side * .34, .75, 0], [.08, .65, .08]));
    const legs = [-1, 1].map(side => mesh(root, 'cylinder', '#58625e', [side * .14, .2, 0], [.095, .55, .1]));
    const prop = mesh(root, 'box', i === 0 ? '#a68459' : i === 1 ? '#4c5c62' : i === 2 ? '#f5e8ca' : '#d8b67a', [.4, 1.04, .2], i === 0 ? [.04, .35, .04] : [.22, .3, .04]);
    const name = label(profile.name, '#263f42', 76); name.position.y = 2.12; name.visible = canvas.clientWidth >= 700; root.add(name);
    root.scale.setScalar(1.4);
    const configured = data.characters?.find(c => c.name === profile.name || c.id === profile.id);
    return { ...profile, id: configured?.id || profile.id, root, nameLabel: name, body, head, eyes, brows, mouth, arms, legs, prop, phase: i * 1.7, state: 'observe', stateUntil: 2 + i, base: new THREE.Vector3(...[[-2.4, 1.1, 2.2], [1, 1.1, 3.1], [-.7, 1.1, -.8], [3.3, 1.1, 1.4]][i]), reaction: 0, expression: 'neutral' };
  });
  actors.forEach(actor => addContactRig(actor, mesh));
  const characterEvents = createCharacterEvents({ actors, cast, mesh, onStart: text => setSpeech(text), onReaction: () => { if (current.interaction?.reactionText) setSpeech(current.interaction.reactionText); } });
  const crowd = new THREE.InstancedMesh(geometry('cylinder'), material('#ffffff'), 100); crowd.count = 24; crowd.castShadow = true; cast.add(crowd);
  const crowdHeads = new THREE.InstancedMesh(geometry('ball'), material('#d4b397'), 100); crowdHeads.count = crowd.count; crowdHeads.castShadow = true; cast.add(crowdHeads);
  const crowdHair = new THREE.InstancedMesh(geometry('ball'), material('#514136'), 100); crowdHair.count = crowd.count; cast.add(crowdHair);
  const crowdEyes = new THREE.InstancedMesh(geometry('ball'), material('#293934'), 200); crowdEyes.count = crowd.count * 2; cast.add(crowdEyes);
  const dummy = new THREE.Object3D();
  const crowdSeeds = Array.from({ length: 100 }, (_, i) => { crowd.setColorAt(i, new THREE.Color(['#ac6750', '#8d9b5b', '#5d8995', '#b6898b', '#686b76', '#d0a95f'][i % 6])); return { angle: random() * Math.PI * 2, radius: 4 + random() * 1.7, speed: .02 + random() * .045, scale: .18 + random() * .08, pausedTotal: 0, pauseStartedAt: null }; });
  let scenarioCrowdPose = null;
  function updateCrowd(elapsed) {
    for (let i = 0; i < crowd.count; i++) {
      const seed = crowdSeeds[i], effectiveElapsed = seed.pauseStartedAt === null ? Math.max(0, elapsed - seed.pausedTotal) : Math.max(0, seed.pauseStartedAt - seed.pausedTotal), joinedScene = scenarioCrowdPose?.articleId === current?.articleId && i < scenarioCrowdPose.count, angle = joinedScene ? seed.angle : encounter?.npcIndex === i ? encounter.angle : seed.angle + effectiveElapsed * seed.speed;
      dummy.position.set(Math.cos(angle) * seed.radius, 1.45, Math.sin(angle) * seed.radius); dummy.rotation.y = joinedScene ? Math.atan2(-dummy.position.x, -2 - dummy.position.z) : -angle; dummy.scale.set(seed.scale, .65 + Math.sin(effectiveElapsed + i) * .025, seed.scale); dummy.updateMatrix(); crowd.setMatrixAt(i, dummy.matrix);
      dummy.position.y += joinedScene ? .68 : .5; dummy.scale.setScalar(seed.scale * .85); dummy.updateMatrix(); crowdHeads.setMatrixAt(i, dummy.matrix);
      dummy.position.y += .09; dummy.position.z -= .025; dummy.scale.set(seed.scale * .87, seed.scale * .48, seed.scale * .83); dummy.updateMatrix(); crowdHair.setMatrixAt(i, dummy.matrix);
      const facing = encounter?.npcIndex === i ? Math.atan2(camera.position.x - cast.position.x - Math.cos(angle) * seed.radius, camera.position.z - cast.position.z - Math.sin(angle) * seed.radius) : 0;
      for (let side = 0; side < 2; side++) { const lateral = side ? .07 : -.07; dummy.position.set(Math.cos(angle) * seed.radius + lateral * Math.cos(facing) + seed.scale * .75 * Math.sin(facing), 1.95, Math.sin(angle) * seed.radius + seed.scale * .75 * Math.cos(facing) - lateral * Math.sin(facing)); dummy.rotation.y = facing; dummy.scale.set(.022, .025, .022); dummy.updateMatrix(); crowdEyes.setMatrixAt(i * 2 + side, dummy.matrix); }
    }
    for (const object of [crowd, crowdHeads, crowdHair, crowdEyes]) object.instanceMatrix.needsUpdate = true;
  }
  const carry = new THREE.Group(); scene.add(carry); carry.visible = false;
  const carryForms = new Map();
  function carryForm(kind) { const group = new THREE.Group(); group.visible = false; carry.add(group); carryForms.set(kind, group); return group; }
  const evidence = carryForm('photo-evidence-bridge');
  const photo = mesh(evidence, 'box', '#fff2d2', [0, 0, 0], [1.5, 1.1, .08]);
  mesh(photo, 'ball', '#758b79', [-.18, .05, .65], [.2, .24, .1]); mesh(photo, 'cone', '#829b9a', [.15, -.16, .65], [.45, .3, .1]);
  const evidenceMarks = Array.from({ length: 4 }, (_, i) => mesh(evidence, 'ring', '#aa7948', [-.55 + i * .36, -.32, .08], [.09, .09, .09]));
  const evidenceCards = Array.from({ length: 4 }, (_, i) => mesh(evidence, 'box', '#f4e4c4', [0, 0, 0], [.65, .5, .05]));
  const shopping = carryForm('product-service-journey');
  const product = mesh(shopping, 'cylinder', '#8bbab2', [-.5, 0, 0], [.32, .8, .32]);
  mesh(product, 'cylinder', '#e6c991', [0, .58, 0], [.75, .2, .75]);
  const list = mesh(shopping, 'box', '#fff3d7', [.5, 0, 0], [.7, 1, .06]);
  for (let i = 0; i < 3; i++) mesh(list, 'box', '#7b8d7d', [.05, .28 - i * .24, .65], [.65, .055, .08]);
  const serviceSteps = Array.from({ length: 4 }, (_, i) => { const g = new THREE.Group(); shopping.add(g); mesh(g, 'box', ['#a7bba0', '#9bbec3', '#cdb585', '#d5a598'][i], [0, 0, 0], [.7, .16, .65]); mesh(g, i === 3 ? 'cone' : 'ring', '#f5ead1', [0, .35, 0], [.18, .18, .18]); return g; });
  const judgment = carryForm('model-limits-scale');
  const modelCard = mesh(judgment, 'box', '#e5c2d0', [0, 0, 0], [1.4, .95, .07]);
  for (let i = 0; i < 3; i++) mesh(modelCard, 'box', '#73898c', [-.35 + i * .35, -.05, .65], [.12, .3 + i * .15, .1]);
  for (let i = 0; i < 3; i++) mesh(modelCard, 'box', '#b27765', [0, .26 - i * .25, -.65], [.7 - i * .12, .07, .08]);
  const scaleFrame = new THREE.Group(); judgment.add(scaleFrame);
  const glass = new THREE.MeshStandardMaterial({ color: '#d0e8e1', transparent: true, opacity: .45, roughness: .3 }); materials.set('transition-glass', glass);
  for (const x of [-1.2, 1.2]) { const pillar = mesh(scaleFrame, 'box', '#d0e8e1', [x, 0, 0], [.08, 2.4, .1]); pillar.material = glass; }
  const beam = mesh(scaleFrame, 'box', '#d0e8e1', [0, .9, 0], [2.5, .1, .1]); beam.material = glass;
  for (const x of [-.8, .8]) { mesh(scaleFrame, 'cylinder', '#c3a978', [x, -.3, 0], [.45, .06, .45]); mesh(scaleFrame, 'box', '#9db6ac', [x, .25, 0], [.025, 1.05, .025]); }
  for (const [kind, type, color] of [['research-instrument', 'ring', '#d3a8bc'], ['conversation-thread', 'ball', '#c5d184'], ['memory-lantern', 'cone', '#d7b77e'], ['action-tool', 'cylinder', '#94c1c0']]) {
    const g = carryForm(kind);
    for (let i = 0; i < 3; i++) mesh(g, type, color, [-.65 + i * .65, 0, 0], [.32, .45, .32]);
    mesh(g, 'box', '#e7d8ba', [0, -.5, 0], [2.1, .1, .35]);
  }
  let carryKind = null, carryMorph = 0;
  function selectCarry(destination, relation) {
    const pair = `${current.canonical}-${destination.canonical}`;
    const kind = pair === 'P01-P04' ? 'photo-evidence-bridge' : pair === 'P05-A06' ? 'product-service-journey' : pair === 'M01-M03' ? 'model-limits-scale' : /research|validation|研究|驗證/.test(relation?.relationType || '') || destination.chapter === 'model' ? 'research-instrument' : /reflection|反思/.test(relation?.relationType || '') ? 'memory-lantern' : /application|應用/.test(relation?.relationType || '') || destination.chapter === 'ai' ? 'action-tool' : 'conversation-thread';
    carryKind = kind; carryMorph = 0; for (const [key, form] of carryForms) form.visible = key === kind;
  }
  function animateCarry(t) {
    const morph = THREE.MathUtils.smoothstep(t, .35, .8); carryMorph = morph;
    carry.visible = t > .26 && t < .94;
    carry.position.copy(camera.position).lerp(controls.target, .33); carry.rotation.set(.08, camera.rotation.y, .08); carry.scale.setScalar(1.3);
    photo.scale.set(1.5 * (1 - morph * .75), 1.1 * (1 - morph * .75), .08);
    evidenceMarks.forEach((mark, i) => { mark.position.set(-.55 + i * .36 + morph * (i - 1.5) * .65, -.32 + morph * .35, .1 + morph * .2); });
    evidenceCards.forEach((card, i) => { card.visible = morph > .05; card.position.set((i - 1.5) * .75 * morph, -.65 * morph, .3 + i * .2 * morph); card.rotation.x = -morph * Math.PI / 2; card.scale.set(.65, .5 + morph * .2, .05); });
    product.scale.set(.32 * (1 - morph * .7), .8 * (1 - morph * .7), .32 * (1 - morph * .7)); list.rotation.x = -morph * Math.PI / 2; list.scale.set(.7 + morph * 2.5, 1, .06);
    serviceSteps.forEach((step, i) => { step.visible = morph > .05; step.position.set((i - 1.5) * morph * .85, -.35 + morph * i * .12, morph * .3); step.scale.setScalar(morph); });
    modelCard.rotation.y = morph * Math.PI; modelCard.position.z = .4; scaleFrame.scale.setScalar(morph); scaleFrame.position.z = -.4 - morph;
    const form = carryForms.get(carryKind); if (form && !['photo-evidence-bridge', 'product-service-journey', 'model-limits-scale'].includes(carryKind)) form.rotation.y = morph * .7;
  }
  const recommendationGroup = new THREE.Group(); scene.add(recommendationGroup);
  let recommendations = [], recommendationObjects = [];
  let current = entries[0], journey = null, disposed = false, mode = 'story', frame = 0, time = 0, last = performance.now(), hover = null, audio = null, sound = false, active = !document.hidden, externallyActive = true, renderedFrames = 0, shadowRestoreTimer, firstDrawAt = null, firstDrawShadowCasting = null, shadowRestoredAt = null;
  let previewed = null, encounter = null, speech = null, season = 'christmas', interactionPose = null;
  updateCrowd(0);
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  function clearRecommendations() {
    for (const object of recommendationObjects) {
      if (object.isLine) object.geometry.dispose();
      const index = pickables.indexOf(object); if (index >= 0) pickables.splice(index, 1);
    }
    recommendationGroup.clear(); recommendationObjects = []; recommendations = [];
  }
  function setRecommendations(edges = []) {
    clearRecommendations(); previewed = null;
    const selected = new Set();
    for (const edge of edges) {
      if (recommendations.length === 3) break;
      const from = islands.get(edge.sourceArticleId) || entries.find(i => i.canonical === edge.sourceArticleId);
      const destination = islands.get(edge.targetArticleId) || entries.find(i => i.canonical === edge.targetArticleId);
      if (from !== current || !destination || destination === current || selected.has(destination.articleId)) continue;
      selected.add(destination.articleId);
      const curve = seaCurve(current.root.position, destination.root.position, .65);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      const key = `recommendation-line-${recommendations.length}`;
      if (!materials.has(key)) materials.set(key, new THREE.LineDashedMaterial({ color: destination.color, dashSize: 1.2, gapSize: .55, transparent: true, opacity: .68 }));
      materials.get(key).color.set(destination.color);
      const line = new THREE.Line(geo, materials.get(key)); line.computeLineDistances(); recommendationGroup.add(line); recommendationObjects.push(line);
      const marker = mesh(recommendationGroup, 'ring', destination.color, destination.root.position.clone().add(new THREE.Vector3(0, 1.3, 0)).toArray(), [7.8, 6.5, 7.8]); marker.rotation.x = Math.PI / 2; tag(marker, destination, 'island', 'recommended-destination'); recommendationObjects.push(marker);
      const object = destination.core.clone(); object.position.copy(destination.root.position).add(new THREE.Vector3(0, 5, 0)); object.scale.multiplyScalar(1.3); object.visible = false; recommendationGroup.add(object); tag(object, destination, 'island', 'destination-preview'); recommendationObjects.push(object);
      recommendations.push({ ...edge, sourceArticleId: current.articleId, targetArticleId: destination.articleId, canonical: destination.canonical, curve, object, marker });
    }
    updateLOD(journey?.destination); return recommendations.length;
  }
  function updateLOD(target = null) {
    for (const island of entries) {
      island.detail.visible = island === current || island === target;
      island.silhouette.visible = !island.detail.visible;
      island.sign.visible = mode === 'explore' || island === current || island === target || island.articleId === previewed;
      island.highlight.visible = island.articleId === previewed;
      island.exploredLight.visible = island.visited;
    }
    for (const route of recommendations) route.object.visible = route.targetArticleId === previewed;
  }
  function placeCast() {
    characterEvents.cancel();
    cast.position.copy(current.root.position);
    interactionPose = null; scenarioCrowdPose = null; encounter = null; setSpeech('');
    const protagonist = current.sceneData?.protagonistId;
    for (const actor of actors) {
      actor.base.set(...[[-2.8, 1.1, 2], [-.4, 1.1, 3.7], [1.7, 1.1, 1.4], [3.6, 1.1, 3.2]][actors.indexOf(actor)]);
      if (actor.id === protagonist) actor.base.set(current.coreRest.x - 1.5, 1.1, Math.max(1.4, current.coreRest.z + 1.6));
      actor.root.position.copy(actor.base); actor.state = 'arrive'; actor.expression = 'neutral'; actor.stateUntil = time + 1; actor.reaction = time + 1.4;
    }
    sunlight.position.copy(current.root.position).add(new THREE.Vector3(-25, 55, 30)); sunlight.target.position.copy(current.root.position);
    if (current.interaction) applyInteraction(current.articleId, { ...current.interaction, settled: true });
  }
  function emitStage(stage, destination, relation) { onTransitionStage(stage, { articleId: destination.articleId, question: relation?.transitionQuestion || '', visual: relation?.transitionVisual || '', arrivalLine: destination.sceneData?.dialogue?.[0]?.text || '', arrivalEvent: stage === 'arrival' && destination.canonical === 'A06' ? { kind: 'ending-return-achi', characterId: 'achi', line: destination.sceneData?.dialogue?.find(line => line.characterId === 'achi')?.text || '' } : null, carryKind, relation }); }
  function finish(destination) {
    current = destination; current.visited = true; journey = null; carry.visible = false; controls.enabled = true; updateLOD(); placeCast();
    const dialogue = destination.sceneData?.dialogue?.[0];
    const restoredEffect = destination.interaction && !destination.interaction.before && destination.interaction.effectId;
    if (!restoredEffect && dialogue) { setEncounter(dialogue.characterId || destination.sceneData?.protagonistId); setSpeech(dialogue.text); const actor = actors.find(a => a.id === dialogue.characterId); if (actor) { actor.state = 'arrive'; actor.expression = 'thoughtful'; actor.stateUntil = time + 4; actor.arms[1].rotation.x = -.9; } }
  }
  function focus(articleId, { animate = true, relation = null } = {}) {
    const destination = islands.get(articleId) || entries.find(i => i.canonical === articleId);
    if (!destination || disposed) return false;
    scene.fog.near = 155; scene.fog.far = 340; camera.far = 700; camera.updateProjectionMatrix();
    characterEvents.cancel();
    journey = null; controls.enabled = true; carry.visible = false; previewed = null; hover = null; clearRecommendations(); setEncounter(null); selectCarry(destination, relation);
    const portrait = canvas.clientWidth < 700;
    const endTarget = destination.root.position.clone().add(new THREE.Vector3(0, portrait ? -3.2 : 1.2, 0));
    const endPosition = destination.root.position.clone().add(portrait ? new THREE.Vector3(19, 23, 30) : new THREE.Vector3(12.5, 12, 17));
    updateLOD(destination);
    if (!animate || reducedMotion) {
      for (const stage of STAGES.slice(0, 4)) emitStage(stage, destination, relation);
      camera.position.copy(endPosition); controls.target.copy(endTarget); finish(destination); emitStage('arrival', destination, relation); controls.update(); return true;
    }
    const start = camera.position.clone(), startTarget = controls.target.clone();
    const middle = start.clone().lerp(endPosition, .5); middle.y += current.chapter === destination.chapter ? 6 : 15; middle.x += 4;
    journey = { destination, relation, elapsed: 0, duration: current.chapter === destination.chapter ? 1.8 : 3.6, phase: -1,
      position: new THREE.CatmullRomCurve3([start, start.clone().lerp(middle, .5), middle, endPosition]),
      target: new THREE.CatmullRomCurve3([startTarget, startTarget.clone().lerp(endTarget, .3).add(new THREE.Vector3(0, 2, 0)), endTarget]) };
    controls.enabled = false; return true;
  }
  function pick(event) {
    const bounds = canvas.getBoundingClientRect(); pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const visible = object => { for (let node = object; node; node = node.parent) if (!node.visible) return false; return true; };
    const actorTargets = actors.flatMap(actor => { actor.root.traverse(object => { if (object.isMesh) object.userData.pick = { articleId: current.articleId, objectId: `character-${actor.id}`, characterId: actor.id, kind: 'character' }; }); return actor.root.children.flatMap(c => c.isMesh ? [c] : c.children.filter(n => n.isMesh)); });
    const hit = raycaster.intersectObjects([...pickables, ...actorTargets, crowd, crowdHeads], false).find(hit => visible(hit.object));
    if (hit?.object === crowd || hit?.object === crowdHeads) { const npcIndex = hit.instanceId; const actor = actors[npcIndex % actors.length]; return { articleId: current.articleId, objectId: `resident-${npcIndex}`, characterId: actor.id, npcIndex, kind: 'character' }; }
    return hit?.object.userData.pick;
  }
  let press = null;
  function onDown(event) { press = { x: event.clientX, y: event.clientY }; }
  function onUp(event) {
    const start = press; press = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) return;
    const hit = pick(event); if (!hit) return;
    if (hit.kind === 'island' || hit.articleId !== current.articleId) onIslandSelect(hit.articleId);
    else { applyInteraction(hit.articleId, { kind: hit.kind }); onObjectSelect(hit); }
    chime();
  }
  function onMove(event) { if (press || journey) return; const hit = pick(event); const next = hit?.articleId || null; if (next !== hover) { hover = next; canvas.style.cursor = hit ? 'pointer' : 'grab'; preview(recommendations.some(route => route.targetArticleId === next) ? next : null); for (const island of entries) island.sign.visible = mode === 'explore' || island === current || island.articleId === hover; } }
  function onLeave() { press = null; hover = null; canvas.style.cursor = 'grab'; preview(null); }
  function capture(group) {
    const snapshot = [];
    group.traverse(object => { if (!object.isSprite) snapshot.push({ object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), visible: object.visible, material: object.material }); });
    return snapshot;
  }
  function restore(snapshot) {
    for (const item of snapshot) { const object = item.object; object.position.copy(item.position); object.quaternion.copy(item.quaternion); object.scale.copy(item.scale); object.visible = item.visible; if (item.material) object.material = item.material; }
  }
  function matches(snapshot) { return snapshot.every(s => s.object.position.equals(s.position) && s.object.quaternion.equals(s.quaternion) && s.object.scale.equals(s.scale) && s.object.visible === s.visible && s.object.material === s.material); }
  function preview(articleId) { previewed = islands.has(articleId) ? articleId : entries.find(i => i.canonical === articleId)?.articleId || null; updateLOD(journey?.destination); return previewed; }
  function setSeason(value = 'christmas') {
    season = ['christmas', 'halloween', 'easter', 'none'].includes(String(value).toLowerCase()) ? String(value).toLowerCase() : 'christmas';
    for (const island of entries) {
      const g = island.decorations; g.clear();
      if (season === 'christmas') {
        mesh(g, 'cylinder', '#7b5943', [-4.8, 1.5, -1], [.13, 1, .13]);
        for (let n = 0; n < 3; n++) mesh(g, 'cone', ['#547953', '#3f6949', '#62894f'][n], [-4.8, 1.9 + n * .6, -1], [1.05 - n * .2, 1.3, 1.05 - n * .2]);
        mesh(g, 'ball', '#d7a34f', [-4.8, 3.9, -1], [.16, .2, .16]);
        mesh(g, 'box', '#b96353', [-4.1, 1.2, -.4], [.65, .5, .6]); mesh(g, 'box', '#d5ab60', [-5.1, 1.25, .1], [.55, .6, .55]);
      } else if (season === 'halloween') {
        for (let n = 0; n < 3; n++) { const x = -5 + n * .65; mesh(g, 'ball', n % 2 ? '#d3883f' : '#b85e35', [x, 1.4, -1 + n % 2], [.45, .4, .42]); mesh(g, 'cylinder', '#5b6c46', [x, 1.85, -1 + n % 2], [.06, .22, .06]); for (const side of [-1, 1]) mesh(g, 'box', '#443c36', [x + side * .14, 1.45, -.64 + n % 2], [.08, .09, .04]); }
      } else if (season === 'easter') {
        mesh(g, 'cylinder', '#b39066', [-4.4, 1.2, -.5], [.9, .4, .65]); mesh(g, 'ring', '#a98157', [-4.4, 1.8, -.5], [.9, .75, .7]);
        for (let n = 0; n < 3; n++) mesh(g, 'ball', ['#c889a5', '#8dab7b', '#e1b567'][n], [-5 + n * .6, 1.7, -.4], [.25, .38, .25]);
      }
    }
    return season;
  }
  function setSpeech(text = '') {
    if (speech) { speech.removeFromParent(); textures.delete(speech.material.map); speech.material.map.dispose(); speech.material.dispose(); labels.delete(speech); for (const [key, value] of materials) if (value === speech.material) materials.delete(key); speech = null; }
    if (!text || !encounter) return;
    speech = label(String(text), '#253e36', canvas.clientWidth < 700 ? 170 : 220, true); cast.add(speech);
    if (Number.isInteger(encounter.npcIndex)) { const seed = crowdSeeds[encounter.npcIndex]; speech.position.set(Math.cos(encounter.angle) * seed.radius, 3.7, Math.sin(encounter.angle) * seed.radius); }
    else { const actor = actors.find(a => a.id === encounter.characterId); if (actor) speech.position.copy(actor.root.position).add(new THREE.Vector3(0, 4.3, 0)); }
    speech.userData.text = String(text);
  }
  function setEncounter(characterId = null, npcIndex = null) {
    setSpeech('');
    if (Number.isInteger(encounter?.npcIndex)) {
      const previous = crowdSeeds[encounter.npcIndex];
      if (previous.pauseStartedAt !== null) previous.pausedTotal += Math.max(0, time - previous.pauseStartedAt);
      previous.pauseStartedAt = null;
    }
    encounter = characterId ? { characterId, npcIndex: Number.isInteger(npcIndex) && npcIndex >= 0 && npcIndex < crowd.count ? npcIndex : null } : null;
    if (encounter && Number.isInteger(encounter.npcIndex)) { const seed = crowdSeeds[encounter.npcIndex]; seed.pauseStartedAt = time; encounter.angle = seed.angle + Math.max(0, time - seed.pausedTotal) * seed.speed; }
    if (encounter && encounter.npcIndex === null) { const actor = actors.find(a => a.id === characterId); if (actor) { actor.state = 'conversation'; const cameraLocal = camera.position.clone().sub(cast.position); actor.root.rotation.y = Math.atan2(cameraLocal.x - actor.root.position.x, cameraLocal.z - actor.root.position.z); actor.head.rotation.set(0, 0, 0); } }
    return encounter;
  }
  function setMode(value) {
    mode = value === 'explore' ? 'explore' : 'story';
    if (mode === 'story') { focus(current.articleId, { animate: !reducedMotion }); return; }
    journey = null; controls.enabled = true; carry.visible = false; clearRecommendations(); previewed = null; setEncounter(null);
    const bounds = new THREE.Box3(); for (const island of entries) bounds.expandByPoint(island.root.position);
    const center = bounds.getCenter(new THREE.Vector3()); const extent = bounds.getSize(new THREE.Vector3());
    const distance = Math.max(extent.z + 20, (extent.x + 20) / Math.max(.4, camera.aspect)) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.1;
    controls.maxDistance = Math.max(210, distance * 1.5); camera.far = Math.max(500, distance * 3); scene.fog.near = distance * 1.5; scene.fog.far = distance * 3.5; camera.updateProjectionMatrix();
    controls.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(distance * .18, distance * .83, distance * .7)); controls.update(); updateLOD();
  }
  function renderScenarioEffect(island, effect, poseActor) {
    const g = island.outcome;
    const paper = '#f7eedb', ink = '#485b5b', accent = island.color;
    const mark = (object) => { object.userData.scenarioVisualEffectId = effect.id; object.userData.scenarioPropId = effect.propId; object.userData.scenarioAction = effect.action; return object; };
    const panel = (x, y, z, width = 1.25, height = 1.45, color = paper, rotation = 0) => mark(mesh(g, 'box', color, [x, y, z], [width, height, .12], rotation));
    const stripe = (x, y, z, width, color = ink, rotation = 0) => { const object = mark(mesh(g, 'box', color, [x, y, z], [width, .09, .06], rotation)); return object; };
    const peg = (x, y, z, color = '#c38c52') => mark(mesh(g, 'ball', color, [x, y, z], [.22, .22, .22]));
    const post = (x, y, z, height = 1.8, color = ink) => mark(mesh(g, 'cylinder', color, [x, y, z], [.09, height, .09]));
    switch (effect.action) {
      case 'stack':
        for (let i = 0; i < 3; i++) { panel(-2.3 + i * .12, 1.65 + i * .34, 3.8 + i * .04, 1.25, 1.1, i === 2 ? accent : paper, -.16 + i * .06); stripe(-2.65 + i * .12, 1.72 + i * .34, 3.9 + i * .04, .55); }
        break;
      case 'center':
      case 'present':
      case 'place':
      case 'face':
        panel(0, effect.action === 'present' ? 2.65 : 2.1, 3.6, effect.action === 'present' ? 1.6 : 1.35, effect.action === 'present' ? 1.8 : 1.35, accent);
        stripe(0, 2.15, 3.69, .72, paper); peg(.76, 2.95, 3.62);
        if (effect.action === 'face' || effect.action === 'present') post(-.8, 1.7, 3.55, .85);
        break;
      case 'pair':
      case 'compare':
      case 'opposite':
        panel(-1.15, 2, 3.6, 1.25, 1.45, '#d7e2d3', -.1); panel(1.15, 2, 3.6, 1.25, 1.45, effect.action === 'opposite' ? '#d9b7ab' : '#e2d0b9', .1);
        stripe(-1.15, 2, 3.68, .72); stripe(1.15, 2, 3.68, .72, '#785d59');
        if (effect.action === 'compare') peg(0, 2, 3.7, '#b57958');
        if (effect.action === 'opposite') mark(mesh(g, 'box', '#a87162', [0, 1.8, 3.55], [.18, 1.35, .8]));
        break;
      case 'shield':
        mark(mesh(g, 'ring', '#4f827a', [0, 2.2, 3.55], [1.05, 1.05, .16])); panel(0, 2.2, 3.6, .75, 1.05, paper); peg(0, 2.65, 3.7, '#78966e');
        break;
      case 'connect':
        mark(mesh(g, 'ring', '#6d9591', [-1.4, 2, 3.6], [.62, .62, .12])); mark(mesh(g, 'ring', '#bd8c61', [1.4, 2, 3.6], [.62, .62, .12]));
        mark(mesh(g, 'box', '#b99770', [0, 2, 3.6], [1.7, .16, .13])); panel(0, 2.75, 3.6, .85, .72, paper); break;
      case 'flip':
        panel(-.2, 2.1, 3.65, 1.35, 1.65, paper, -.3); panel(.55, 2.25, 3.72, .75, 1.45, accent, .38); stripe(-.2, 2.2, 3.76, .68); peg(.98, 2.9, 3.7);
        break;
      case 'reveal':
        panel(0, 2.1, 3.65, 1.55, 1.65, paper, -.08); panel(.62, 2.2, 3.74, .45, 1.3, '#d2ae74', .42); peg(.95, 2.95, 3.75, '#9d7654');
        break;
      case 'turn':
        post(-.72, 1.75, 3.6, 1.6); panel(.2, 2.4, 3.6, 1.35, .9, '#d7e3d5', .35); mark(mesh(g, 'cone', '#bf8f57', [1.05, 2.4, 3.63], [.3, .48, .3], Math.PI / 2));
        break;
      case 'exchange':
      case 'handoff':
        panel(-1.15, 1.9, 3.9, .8, .85, '#d6c092', -.22); panel(1.15, 1.9, 3.9, .8, .85, '#c8d5c2', .22);
        mark(mesh(g, 'ring', '#c18659', [0, 2.05, 3.9], [.42, .42, .12])); mark(mesh(g, 'box', '#b8a27d', [0, 1.75, 3.9], [1.45, .12, .12]));
        if (effect.action === 'handoff') panel(0, 2.8, 3.7, 1.05, .7, paper);
        break;
      case 'gather':
        mark(mesh(g, 'cylinder', '#9b9a69', [0, 1.25, 3.5], [2.15, .18, 1.15]));
        for (let i = 0; i < 5; i++) peg(-1.2 + i * .6, 1.85 + (i % 2) * .1, 3.4 + (i % 2) * .35, ['#b17f67', '#738f82', '#c7a85f'][i % 3]);
        break;
      case 'line-up':
        for (let i = 0; i < 3; i++) { panel(-1.55 + i * 1.55, 2, 3.6, 1.05, 1.45, ['#d8e2d4', '#e4d0b4', '#d7c2c4'][i]); stripe(-1.55 + i * 1.55, 2, 3.68, .55); }
        break;
      case 'pause':
        panel(-1.35, 1.75, 3.7, 1.35, .8, '#e4d2b5'); mark(mesh(g, 'box', '#b76f5c', [0, 1.9, 3.6], [.18, 1.35, .35])); post(1.35, 1.8, 3.6, 1.1);
        break;
      case 'photo':
        panel(0, 2.1, 3.65, 1.55, 1.45, paper, -.12); mark(mesh(g, 'box', '#8da5a0', [0, 2.25, 3.73],  [.9, .72, .04])); peg(-.42, 2.49, 3.8, '#d1a86a'); stripe(0, 1.75, 3.73, .72);
        break;
      case 'front':
        mark(mesh(g, 'box', '#b59676', [0, 1.45, 3.55], [3.5, .18, 1.1])); panel(0, 2.35, 3.65, 1.3, 1.25, '#e4d7bf'); post(-1.25, 1.95, 3.55, .8); stripe(0, 2.45, 3.72, .72);
        break;
      case 'sing':
      case 'listen':
        mark(mesh(g, 'box', '#5b7068', [0, 1.35, -1.25], [3.5, .35, 1.4])); mark(mesh(g, 'box', '#b58b57', [0, 2.35, -1.85], [3.2, 2.1, .18]));
        mark(mesh(g, 'ring', '#c48c55', [0, 3.6, -.55], [1.05, .7, .12])); mark(mesh(g, 'ring', '#81988b', [0, 3.6, -.55], [1.6, 1.1, .12]));
        if (effect.action === 'listen') mark(mesh(g, 'cylinder', '#8e7158', [-1.2, 1.9, 2.8], [.52, .55, .5]));
        break;
      case 'retell':
        panel(-.75, 2.1, 3.75, 1.05, 1.05, paper, -.14); mark(mesh(g, 'box', '#8ca09b', [-.75, 2.2, 3.83], [.72, .58, .04]));
        mark(mesh(g, 'ring', '#b38b58', [.7, 2.65, 3.7], [.62, .42, .1])); peg(1.1, 3.05, 3.7);
        break;
      case 'open':
        panel(-.72, 2, 3.65, 1.2, 1.4, paper, -.35); panel(.72, 2, 3.65, 1.2, 1.4, '#e8dbc3', .35); stripe(-.72, 2, 3.74, .62); stripe(.72, 2, 3.74, .62);
        break;
      case 'pass':
        post(1.35, 1.8, 3.6, 1.5); panel(1.9, 2.4, 3.6, 1.15, .8, '#d7d1bf', -.45); mark(mesh(g, 'box', '#847963', [-1.2, 1.18, 3.6], [2.7, .08, .24], .16));
        break;
      case 'linger':
        mark(mesh(g, 'ring', '#c18d55', [0, 1.1, 3.6], [1.5, 1.05, .12])); post(0, 2.15, 3.6, 1.3, '#799289'); peg(0, 3.05, 3.6, '#d8b76f');
        break;
      case 'move':
        post(-1.3, 1.65, 3.6, 1.4); panel(.15, 2.15, 3.6, 1.45, 1.15, accent, .35); mark(mesh(g, 'cone', '#ba8759', [1.3, 2.1, 3.6], [.3, .45, .3], Math.PI / 2));
        break;
      case 'empty':
        mark(mesh(g, 'box', '#b9a585', [0, 1.35, 3.6], [2.7, .18, 1.4])); panel(-.55, 2.1, 3.6, 1.05, 1.25, '#e7ddca'); mark(mesh(g, 'ring', '#819389', [.72, 1.75, 3.6], [.5, .5, .12]));
        break;
      case 'clear':
        for (let i = 0; i < 3; i++) mark(mesh(g, 'box', '#7c9b8f', [-1.9 + i * 1.9, 1.12, 3.55], [1.35, .18, .8]));
        mark(mesh(g, 'box', '#ae796c', [3, 1.45, 3.55], [.18, 1, 1.2]));
        break;
      case 'assist':
        mark(mesh(g, 'box', '#b89d7a', [0, 1.55, 3.7], [2.6, .25, 1.3])); panel(0, 2.2, 3.7, 1, .95, paper); mark(mesh(g, 'cone', '#bd9456', [1.45, 2.2, 3.7], [.32, .7, .32]));
        break;
      case 'surface':
        mark(mesh(g, 'cylinder', '#78989a', [0, .95, 3.6], [2.1, .12, 1.05])); panel(-.55, 2.15, 3.65, 1.3, 1.25, '#e3c3cb', -.22); peg(.65, 2.85, 3.65, '#bd8c61');
        break;
      case 'split':
        panel(-1.35, 2, 3.6, 1.25, 1.65, '#d6c8cd'); panel(1.35, 2, 3.6, 1.25, 1.65, '#c9d7cb'); mark(mesh(g, 'box', '#ac795f', [0, 2, 3.6], [.15, .12, .22]));
        break;
      case 'deliver':
        mark(mesh(g, 'box', '#bd9360', [-.6, 1.85, 3.7], [1.5, 1.15, 1.25]));
        mark(mesh(g, 'box', '#e6d6b9', [-.6, 1.9, 3.7], [.16, 1.18, 1.3])); mark(mesh(g, 'box', '#e6d6b9', [-.6, 1.9, 3.7], [1.52, 1.15, .14]));
        panel(1.2, 2.05, 3.8, 1.05, 1.35, paper); stripe(1.2, 2.2, 3.88, .62); peg(1.2, 1.55, 3.88, '#af7667');
        break;
      case 'foreground':
        panel(0, 2.35, 3.45, 2, 2, '#d6dfd1', -.1); mark(mesh(g, 'ball', '#c38872', [-.55, 2.65, 3.58], [.28, .28, .12])); stripe(.3, 2.25, 3.58, .95, '#526e63');
        break;
      case 'spread':
        for (let i = 0; i < 4; i++) { panel(-2.05 + i * 1.35, 2, 3.6, 1, 1.3, ['#d8e0d3', '#e4d3bd', '#d6c5ce', '#c8d7d2'][i], (i - 1.5) * .12); stripe(-2.05 + i * 1.35, 2, 3.68, .55); }
        break;
      default:
        throw new TypeError(`Unsupported scenario visual action ${effect.action}.`);
    }
    if (island !== current) return;
    const actor = actors.find(({ id }) => id === effect.actorId);
    const partnerId = island.canonical === 'A01' && effect.action === 'assist' ? 'yue' : island.sceneData?.characterIds?.find((id) => id !== effect.actorId);
    const actorX = ['sing', 'listen', 'gather'].includes(effect.action) ? 0 : ['exchange', 'retell', 'connect', 'handoff'].includes(effect.action) ? -1.45 : 1.25;
    const actorZ = ['sing', 'listen'].includes(effect.action) ? 4.2 : 4.4;
    poseActor(effect.actorId, actorX, actorZ, ['pause', 'surface', 'split'].includes(effect.action) ? 'concerned' : 'thoughtful');
    if (actor && ['exchange', 'retell', 'connect', 'handoff', 'assist', 'gather'].includes(effect.action)) {
      actor.arms[1].rotation.x = -.9; actor.arms[0].rotation.x = -.45;
    }
    if (partnerId && ['exchange', 'retell', 'connect', 'handoff', 'assist'].includes(effect.action)) {
      const partner = actors.find(({ id }) => id === partnerId);
      const positions = { exchange: .95, retell: 1.5, connect: 1.55, handoff: 1.1, assist: -1.2 };
      poseActor(partnerId, positions[effect.action], 4.1, 'thoughtful');
      if (partner) partner.arms[0].rotation.x = -.85;
    }
    scenarioCrowdPose = ['sing', 'listen', 'gather'].includes(effect.action) ? { articleId: island.articleId, count: Math.min(5, crowd.count) } : null;
    encounter = { characterId: effect.actorId, npcIndex: null };
    setSpeech(effect.reactionText);
  }
  function applyInteraction(articleId, payload = {}) {
    const island = islands.get(articleId); if (!island) return false;
    const kind = payload.kind || island.sceneData?.interactionType;
    const supported = ['sourceverification', 'purchase', 'attention', 'memory', 'persona', 'judgment', 'journey', 'delegation'];
    if (!supported.includes(kind) || !payload.choices) { for (const actor of actors) actor.reaction = time + 1.8; return true; }
    const choices = Array.isArray(payload.choices) ? payload.choices.map(String) : [String(payload.choices)];
    const scenarioChoice = typeof payload.scenarioChoice === 'string' ? payload.scenarioChoice : null;
    const selectedOutcome = island.sceneData?.interaction?.outcomes?.find(({ choiceId }) => choiceId === scenarioChoice);
    const visualEffect = selectedOutcome?.visualEffect || null;
    island.actorBaseline ||= capture(cast);
    restore(island.baseline); island.outcome.clear();
    if (island === current) { characterEvents.cancel(); restore(island.actorBaseline); }
    const eventStarts = new Map(actors.map(actor => [actor.id, actor.root.position.clone()]));
    const before = Boolean(payload.before);
    const impact = { kind, choices, scenarioChoice, effectId: visualEffect?.id || null, propId: visualEffect?.propId || null, action: visualEffect?.action || null, actorId: visualEffect?.actorId || null, reactionText: visualEffect?.reactionText || null, before, layout: 'waiting', expression: 'neutral', checkpoint: false };
    interactionPose = island === current ? impact : interactionPose;
    island.interaction = impact;
    if (before) { scenarioCrowdPose = null; for (const actor of actors) actor.state = 'comparison-before'; return true; }
    const g = island.outcome;
    function part(type, color, position, scale, rotation = 0) { return mesh(g, type, color, position, scale, rotation); }
    function pose(actorId, x, z, expression) { const actor = actors.find(a => a.id === actorId || a.habit === actorId); if (actor && island === current) { actor.root.position.set(x, 1.1, z); actor.root.rotation.y = -.25; actor.expression = expression; actor.state = 'demonstrate'; actor.head.rotation.z = expression === 'concerned' ? -.15 : .04; actor.brows.forEach((b, i) => b.rotation.z = expression === 'concerned' ? (i ? -.35 : .35) : 0); actor.mouth.scale.set(expression === 'smile' ? .16 : .07, expression === 'concerned' ? .035 : .018, .02); } }
    if (kind === 'sourceverification') {
      const hold = choices[0] === 'hold';
      for (let i = 0; i < 3; i++) { const card = part('box', i < choices.length - 1 ? '#87a17a' : '#d5b591', [-1.6 + i * 1.5, 2.7, 1], [1.05, 1.45, .12], (i - 1) * .2); card.rotation.z = hold ? .08 : -.08; part('box', '#5a736a', [-1.6 + i * 1.5, 2.75, 1.08], [.6, .06, .03]); }
      island.core.rotation.y += hold ? -.55 : .55; island.core.position.x += hold ? -1 : .8;
      pose('note', -1.4, 2.5, hold ? 'thoughtful' : 'concerned'); pose('pen', 1.4, 2.7, hold ? 'thoughtful' : 'concerned');
      impact.layout = hold ? 'evidence-held-for-verification' : 'unverified-image-on-desk'; impact.expression = hold ? 'thoughtful' : 'concerned';
    } else if (kind === 'purchase') {
      const selected = choices.includes('high') ? 1 : choices.includes('price') ? 0 : 2;
      for (let i = 0; i < 3; i++) part('box', ['#bc8e55', '#b77673', '#638f85'][i], [i === selected ? 1 : -2 + i * 2, i === selected ? 2.1 : 1.5, i === selected ? 3 : 1], [i === selected ? 1.05 : .65, .9, .65]);
      island.core.position.set(1, 2.1, 3); island.core.scale.multiplyScalar(1.2);
      pose('phone', 1.2, 3.9, selected === 1 ? 'smile' : 'thoughtful'); pose('bell', 3.5, 2.4, 'smile');
      impact.layout = ['budget-product-selected', 'familiar-brand-selected', 'service-product-selected'][selected]; impact.expression = selected === 1 ? 'smile' : 'thoughtful';
    } else if (kind === 'attention') {
      const activeChoice = choices.includes('active'), recalled = choices.includes('human');
      for (let i = 0; i < 4; i++) { const board = part('box', activeChoice ? '#c29251' : '#8f9c96', [-2.4 + i * 1.6, 2.2, 1], [1.2, 1.6, .18]); board.rotation.y = activeChoice ? (i - 1.5) * .12 : Math.PI / 2; }
      island.core.scale.y *= activeChoice ? 1.35 : .65; island.core.rotation.y += activeChoice ? -.3 : .8;
      pose('phone', activeChoice ? 0 : 3.7, activeChoice ? 3.2 : 1.8, recalled ? 'smile' : 'concerned');
      impact.layout = activeChoice ? 'participation-boards-open' : 'passerby-boards-sideways'; impact.expression = recalled ? 'smile' : 'concerned';
    } else if (kind === 'memory') {
      for (const [i, item] of choices.entries()) { const x = -2 + i * 1.8; if (item === 'radio') { part('box', '#987451', [x, 1.8, 2], [1.25, .8, .65]); part('ring', '#594d43', [x, 1.8, 2.35], [.26, .26, .26]); } else if (item === 'cup') { part('cylinder', '#b87a69', [x, 1.8, 2], [.35, .65, .35]); part('ring', '#b87a69', [x + .35, 1.8, 2], [.25, .25, .25]); } else part('box', '#dfbc78', [x, 1.8, 2], [1.2, .05, .6], -.2); }
      island.core.rotation.y += choices.length * .2; pose('phone', -.5, 3.5, choices.length ? 'smile' : 'thoughtful');
      impact.layout = choices.length ? `memory-objects-${choices.join('-')}` : 'memory-still-unfound'; impact.expression = choices.length ? 'smile' : 'thoughtful';
    } else if (kind === 'persona') {
      const commute = choices.includes('commute'), narrow = choices.includes('narrow');
      if (commute) { part('box', '#64878a', [0, 2.2, 0], [4.7, 2.2, .25]); for (let i = 0; i < 3; i++) part('box', '#c2d3cd', [-1.5 + i * 1.5, 2.5, .15], [1, .9, .08]); }
      else { part('box', '#a07d78', [0, 1.5, 1], [3, .9, 1]); part('box', '#c4aa8a', [-2.2, 1.5, 1.5], [.9, .5, .9]); }
      for (let i = 0; i < (narrow ? 1 : 3); i++) part('box', ['#9ab49a', '#bb9eb5', '#c8ae77'][i], [-2 + i * 1.7, 2.7, 2.5], [.8, 1.1, .1]);
      island.core.position.y += .5; pose('note', 1.3, 3.1, narrow ? 'concerned' : 'thoughtful');
      impact.layout = `${commute ? 'commute' : 'home'}-${narrow ? 'single-source-boundary' : 'mixed-context-evidence'}`; impact.expression = narrow ? 'concerned' : 'thoughtful';
    } else if (kind === 'judgment') {
      const bins = ['data', 'estimate', 'inference', 'unknown'];
      for (let i = 0; i < 4; i++) { const x = -2.7 + i * 1.8; part('box', ['#729a85', '#c3a468', '#aa8ba0', '#727e8a'][i], [x, 1.6, 2], [1.35, .3, 1.2]); }
      choices.forEach((choice, i) => part('box', '#f2e7cb', [-2.7 + Math.max(0, bins.indexOf(choice)) * 1.8, 1.86 + i * .12, 2], [1, .07, .7], (i - 1.5) * .08));
      island.core.rotation.z = choices.every((c, i) => c === bins[i]) ? 0 : .16; pose('note', -.5, 3.7, 'thoughtful');
      impact.layout = `evidence-sorted-${choices.join('-')}`; impact.expression = 'thoughtful';
    } else if (kind === 'journey') {
      const repaired = !choices.includes('ad'), station = Math.max(0, ['find', 'compare', 'confirm'].indexOf(choices[0]));
      for (let i = 0; i < 3; i++) part('box', i === station ? '#b67f59' : '#789b8e', [-3 + i * 3, 1.2, 2], [2.3, .2, 1]);
      const barrier = part('box', '#a37d6a', [-3 + station * 3, 1.9, repaired ? .5 : 2], [.22, 1.4, 1.4]); barrier.rotation.y = repaired ? Math.PI / 2 : 0;
      if (choices.includes('explain')) part('box', '#f0dfb4', [-3 + station * 3, 2.6, 1], [1.8, 1.3, .1]);
      pose('phone', repaired ? 2.3 : -3 + station * 3, 3, repaired ? 'smile' : 'concerned'); pose('bell', choices.includes('human') ? 1.2 : 3.7, 3, repaired ? 'smile' : 'concerned');
      impact.layout = repaired ? `path-${station}-${choices[1]}-repaired` : `path-${station}-still-blocked`; impact.expression = repaired ? 'smile' : 'concerned';
    } else {
      const unsafe = choices.includes('auto') && !choices.includes('draft'); const confirm = choices.includes('confirm') || unsafe;
      part('box', '#6b9a9b', [-1.6, 2.1, 1.5], [1.4, 1.8, 1.2]); part('box', '#e4d0a7', [1, 1.9, 1.5], [2.4, .2, 1.8]);
      part('box', unsafe ? '#ba735b' : '#7f9b74', [.1, 2.5, 1.5], [.16, 2.1, confirm ? 2.8 : .4], confirm ? .1 : Math.PI / 2);
      if (confirm) part('cone', '#be9b51', [1.5, 2.4, 1.5], [.4, .5, .4]);
      island.core.rotation.y += unsafe ? -.6 : .6; pose('pen', .6, 3.1, unsafe ? 'concerned' : 'thoughtful'); pose('bell', unsafe ? 1.8 : 3.5, 2.6, unsafe ? 'concerned' : 'smile');
      impact.layout = unsafe ? 'agent-paused-human-takeover' : confirm ? 'agent-waits-at-confirmation-gate' : 'agent-draft-on-human-desk'; impact.checkpoint = confirm; impact.expression = unsafe ? 'concerned' : 'thoughtful';
    }
    if (visualEffect) {
      renderScenarioEffect(island, visualEffect, pose);
      if (island === current) {
        const purchase = island.canonical === 'P05';
        const selected = choices.includes('high') ? 1 : choices.includes('price') ? 0 : 2;
        const prop = purchase ? g.children[selected] : g.children.find(object => object.userData.scenarioVisualEffectId === visualEffect.id && object.geometry?.type === 'BoxGeometry' && object.scale.y > .4 && object.scale.x <= 2.2) || g.children.find(object => object.userData.scenarioVisualEffectId === visualEffect.id);
        characterEvents.start({ island, effect: visualEffect, prop, starts: eventStarts, reducedMotion: reducedMotion || Boolean(payload.settled), purchase });
      }
    }
    for (const actor of actors) actor.state = island === current ? 'demonstrate' : actor.state;
    return true;
  }
  function chime() {
    if (!sound) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); const oscillator = audio.createOscillator(), gain = audio.createGain(); oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(392, audio.currentTime); oscillator.frequency.exponentialRampToValueAtTime(587, audio.currentTime + .15); gain.gain.setValueAtTime(.025, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .35); oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .35); } catch { sound = false; }
  }
  function resize() { if (disposed) return; const bounds = canvas.getBoundingClientRect(); const width = Math.max(1, bounds.width), height = Math.max(1, bounds.height); renderer.setSize(width, height, false); camera.aspect = width / height; camera.fov = width < 700 ? 46 : 40; camera.updateProjectionMatrix(); for (const actor of actors) actor.nameLabel.visible = width >= 700; }
  function visibility() { active = externallyActive && !document.hidden; last = performance.now(); }
  function tick(now) {
    if (disposed) return; frame = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, .05); last = now; if (!active) return; time += dt;
    if (journey) {
      const j = journey; j.elapsed += dt; const t = Math.min(j.elapsed / j.duration, 1); const phase = Math.min(3, Math.floor(t * 5));
      while (j.phase < phase) emitStage(STAGES[++j.phase], j.destination, j.relation);
      const sailT = THREE.MathUtils.smoothstep(t, .16, .93);
      camera.position.copy(j.position.getPoint(sailT)); controls.target.copy(j.target.getPoint(sailT)); camera.lookAt(controls.target);
      animateCarry(t);
      if (t === 1) { finish(j.destination); emitStage('arrival', j.destination, j.relation); }
    } else controls.update();
    if (!reducedMotion) {
      for (const actor of actors) {
        if (characterEvents.hasParticipant(actor.id) || (!characterEvents.hasEvent() && interactionPose) || (encounter?.characterId === actor.id && encounter.npcIndex === null)) continue;
        const phase = time * actor.pace + actor.phase;
        if (time > actor.stateUntil) { actor.state = ['observe', 'walk', 'think', 'compare'][Math.floor(time / (3 + actor.pace) + actor.phase) % 4]; actor.stateUntil = time + 2.5 + actor.pace; }
        const walking = actor.state === 'walk';
        actor.root.position.x = actor.base.x + (walking ? Math.sin(phase * .55) * .55 : 0);
        actor.root.position.z = actor.base.z + (walking ? Math.cos(phase * .55) * .3 : 0);
        actor.root.position.y = actor.base.y + Math.sin(phase * 1.5) * .025;
        actor.root.rotation.y = Math.sin(phase * .32) * .45 + (actor.state === 'compare' ? .7 : 0);
        actor.head.rotation.y = Math.sin(phase * .65) * .26; actor.head.rotation.z = actor.state === 'think' ? -.12 : Math.sin(phase * .4) * .035;
        const blink = Math.sin(time * 1.4 + actor.phase) > .993;
        actor.eyes.forEach(eye => eye.scale.y = blink ? .004 : .037);
        actor.brows.forEach((brow, i) => brow.rotation.z = actor.state === 'think' ? (i ? -.2 : .2) : actor.reaction > time ? .13 : 0);
        actor.mouth.scale.x = actor.reaction > time ? .14 : .09;
        actor.legs.forEach((leg, i) => leg.rotation.x = walking ? Math.sin(phase * 3 + i * Math.PI) * .32 : 0);
        actor.arms.forEach((arm, i) => arm.rotation.x = walking ? Math.sin(phase * 3 + i * Math.PI) * .25 : -.15 - (i ? .15 * Math.sin(phase) : 0));
        actor.prop.rotation.z = actor.habit === 'pen' ? phase * 1.8 : actor.habit === 'phone' ? Math.sin(phase) * .12 : actor.habit === 'note' ? Math.sin(phase * 2) * .08 : Math.sin(phase * .4) * .04;
      }
      updateCrowd(time);
    }
    characterEvents.update(dt, reducedMotion);
    const point = new THREE.Vector3();
    for (const sprite of labels) {
      sprite.getWorldPosition(point);
      const distance = camera.position.distanceTo(point);
      const scale = (sprite.userData.screenWidth / Math.max(1, canvas.clientHeight)) * distance * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const parentScale = sprite.parent?.getWorldScale(new THREE.Vector3()).x || 1;
      sprite.scale.set(scale / parentScale, scale * sprite.userData.aspect / parentScale, 1);
    }
    renderer.render(scene, camera);
    if (renderedFrames === 0) { firstDrawAt = performance.now(); firstDrawShadowCasting = sunlight.castShadow; }
    renderedFrames++;
    if (renderedFrames === 1) shadowRestoreTimer = setTimeout(() => {
      shadowRestoreTimer = undefined;
      if (disposed) return;
      sunlight.castShadow = true;
      renderer.shadowMap.needsUpdate = true;
      shadowRestoredAt = performance.now();
    }, 450);
  }
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', visibility); window.addEventListener('resize', resize);
  setSeason('christmas'); resize(); focus(current.articleId, { animate: false }); frame = requestAnimationFrame(tick);
  const allLabelText = `${data.islands.map((island, index) => `${identify(island, index)} · ${data.scenes?.find(item => item.articleId === island.articleId)?.coreDevice?.label || ''}`).join(' ')} 阿綺小岳映蓁芬姐`;
  void Promise.all([
    document.fonts?.load('600 42px "Publication Sans TW"', allLabelText),
    document.fonts?.load('600 28px "Publication Sans TW"', allLabelText),
  ]).then(() => labels.forEach(sprite => sprite.userData.redraw?.())).catch(() => undefined);
  const setupMs = performance.now() - setupStartedAt;
  return {
    focus, resize, applyInteraction, preview, setRecommendations, setSeason, setEncounter, setSpeech, setMode,
    skipTransition() { return journey ? focus(journey.destination.articleId, { animate: false, relation: journey.relation }) : false; },
    cancelTransition() { return journey ? focus(current.articleId, { animate: false }) : false; },
    setPopulation(count) { crowd.count = Math.max(10, Math.min(100, Math.round(Number(count) || 10))); crowdHeads.count = crowd.count; crowdHair.count = crowd.count; crowdEyes.count = crowd.count * 2; updateCrowd(reducedMotion ? 0 : time); },
    setReducedMotion(value) { reducedMotion = Boolean(value); if (reducedMotion) characterEvents.update(0, true); if (reducedMotion && journey) focus(journey.destination.articleId, { animate: false, relation: journey.relation }); },
    setActive(value) { externallyActive=Boolean(value);visibility(); },
    getCharacterContactState() { return characterEvents.state(); },
    getNPCState(index) { const seed=crowdSeeds[index]; if(!seed||index>=crowd.count)return null;const effective=seed.pauseStartedAt===null?Math.max(0,time-seed.pausedTotal):Math.max(0,seed.pauseStartedAt-seed.pausedTotal);const angle=seed.angle+effective*seed.speed;const position=new THREE.Vector3(Math.cos(angle)*seed.radius,1.45,Math.sin(angle)*seed.radius).add(cast.position);const screen=position.clone().project(camera),rect=canvas.getBoundingClientRect();return {index,angle,speed:seed.speed,walkPhase:(effective+index)%(Math.PI*2),paused:seed.pauseStartedAt!==null,position:{x:position.x,y:position.y,z:position.z},screen:{x:rect.left+(screen.x+1)*rect.width/2,y:rect.top+(1-screen.y)*rect.height/2,z:screen.z}}; },
    getCharacterScreenState() { return actors.map(actor=>{const position=actor.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,1.5,0));const screen=position.project(camera),rect=canvas.getBoundingClientRect();return {id:actor.id,name:actor.name,screen:{x:rect.left+(screen.x+1)*rect.width/2,y:rect.top+(1-screen.y)*rect.height/2,z:screen.z}};}); },
    getRenderState() { return {active,renderedFrames,disposed,setupMs,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textureCount:renderer.info.memory.textures,programCount:renderer.info.programs?.length||0,shadowEnabled:renderer.shadowMap.enabled,shadowCasting:sunlight.castShadow,firstDrawShadowCasting,shadowRestoreMs:shadowRestoredAt===null||firstDrawAt===null?null:shadowRestoredAt-firstDrawAt}; },
    setSound(enabled) { sound = Boolean(enabled); if (sound) chime(); },
    getState() { return { characterEvent: characterEvents.state(), current: current.articleId, currenttarget: journey?.destination.articleId || current.articleId, currentTarget: journey?.destination.articleId || current.articleId, mode, population: crowd.count, reducedMotion, transitioning: Boolean(journey), stage: journey ? STAGES[Math.max(0, journey.phase)] : 'arrival', renderedislandcount: entries.length, renderedIslandCount: entries.length, detailedIslandCount: entries.filter(i => i.detail.visible).length, silhouetteIslandCount: entries.filter(i => i.silhouette.visible).length, characters: actors.map(a => ({ id: a.id, name: a.name, nameLabelVisible: a.nameLabel.visible, state: a.state, habit: a.habit, expression: a.expression, position: a.root.position.toArray() })), previewed, recommendations: recommendations.map(route => ({ sourceArticleId: route.sourceArticleId, targetArticleId: route.targetArticleId, relationType: route.relationType, editorialReason: route.editorialReason, transitionQuestion: route.transitionQuestion, canonical: route.canonical, previewVisible: route.object.visible, points: [0, .5, 1].map(t => route.curve.getPoint(t).toArray()) })), carry: { kind: carryKind, visible: carry.visible, morph: carryMorph, phase: journey ? STAGES[Math.max(0, journey.phase)] : 'arrival', shapes: carryKind === 'photo-evidence-bridge' ? { photoScale: photo.scale.toArray(), evidenceCards: evidenceCards.map(o => ({ position: o.position.toArray(), rotationX: o.rotation.x, visible: o.visible })) } : carryKind === 'product-service-journey' ? { productScale: product.scale.toArray(), listRotationX: list.rotation.x, serviceSteps: serviceSteps.map(o => ({ position: o.position.toArray(), scale: o.scale.x, visible: o.visible })) } : carryKind === 'model-limits-scale' ? { cardFlip: modelCard.rotation.y, frameworkScale: scaleFrame.scale.x } : {}, objectCount: carryKind ? carryForms.get(carryKind).getObjectsByProperty('isMesh', true).length : 0 }, coastLinks, exploredLightCount: entries.filter(i => i.exploredLight.visible).length, season, decoratedIslandCount: entries.filter(i => i.decorations.children.length).length, encounter: encounter ? { ...encounter } : null, speech: speech?.userData.text || '', interaction: current.interaction ? { ...current.interaction, baselineRestored: current.interaction.before && matches(current.baseline) && matches(current.actorBaseline), propPosition: current.core.position.toArray(), propRotation: current.core.rotation.toArray().slice(0, 3), outcomeObjectCount: current.outcome.children.length, scenarioObjects: current.outcome.children.filter(object => object.userData.scenarioVisualEffectId === current.interaction.effectId).map(object => ({ effectId: object.userData.scenarioVisualEffectId, propId: object.userData.scenarioPropId, action: object.userData.scenarioAction, geometry: object.geometry?.type || null, position: object.position.toArray(), rotation: object.rotation.toArray().slice(0, 3), scale: object.scale.toArray() })) } : null, camera: { position: camera.position.toArray(), target: controls.target.toArray() }, visited: entries.filter(i => i.visited).map(i => i.articleId), drawCalls: renderer.info.render.calls }; },
    dispose() { if (disposed) return; disposed = true; characterEvents.cancel(); cancelAnimationFrame(frame); if (shadowRestoreTimer) clearTimeout(shadowRestoreTimer); clearRecommendations(); controls.dispose(); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('resize', resize); for (const geo of geometries.values()) geo.dispose(); for (const mat of materials.values()) mat.dispose(); for (const texture of textures) texture.dispose(); for (const object of [crowd, crowdHeads, crowdHair, crowdEyes]) object.dispose(); renderer.dispose(); audio?.close(); scene.clear(); },
  };
}

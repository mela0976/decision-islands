import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.4 : 1.8));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e6edf0');
  scene.fog = new THREE.Fog('#e6edf0', 100, 230);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  camera.position.set(31, 28, 39);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 9;
  controls.maxDistance = 160;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.target.set(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#fff9e9', '#879597', 2.5));
  const sunlight = new THREE.DirectionalLight('#fff4dc', 3.2);
  sunlight.position.set(-25, 55, 30);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunlight.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
  sunlight.shadow.bias = -0.001;
  scene.add(sunlight, sunlight.target);
  const geometries = new Map();
  const materials = new Map();
  const textures = new Set();
  const random = mulberry32(202601);
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
  function label(text, color = '#263f42') {
    const surface = document.createElement('canvas'); surface.width = 512; surface.height = 128;
    const context = surface.getContext('2d');
    context.fillStyle = '#f9f5e9'; context.fillRect(0, 0, 512, 128);
    context.fillStyle = color; context.font = '600 34px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(text, 256, 64, 482);
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false }); materials.set(`label-${materials.size}`, mat);
    const sprite = new THREE.Sprite(mat); sprite.scale.set(8, 2, 1); return sprite;
  }
  const sea = mesh(scene, 'cylinder', '#b5ced0', [0, -0.9, 0], [230, 0.35, 230]);
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
    const radius = Math.sqrt(localIndex) * 16;
    const x = Number.isFinite(entry.position?.x) ? entry.position.x : origin[0] + Math.cos(angle) * radius;
    const z = Number.isFinite(entry.position?.z) ? entry.position.z : origin[1] + Math.sin(angle) * radius;
    const root = new THREE.Group(); root.position.set(x, 0, z); scene.add(root);
    const shape = new THREE.Shape(); const rng = mulberry32(1103 + index * 691);
    for (let n = 0; n <= 18; n++) { const a = n % 18 / 18 * Math.PI * 2; const r = 6.9 + rng() * 1.2; const px = Math.cos(a) * r, py = Math.sin(a) * r * .82; if (!n) shape.moveTo(px, py); else shape.lineTo(px, py); }
    const coastGeometry = new THREE.ExtrudeGeometry(shape, { depth: .9, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .4, bevelThickness: .3 });
    geometries.set(`coast-${index}`, coastGeometry);
    const coast = new THREE.Mesh(coastGeometry, material('#e6dcc7')); coast.rotation.x = -Math.PI / 2; coast.position.y = .25; coast.receiveShadow = true; root.add(coast);
    const lawn = mesh(root, 'cylinder', theme.color, [0, .85, 0], [6.5, .18, 5.1]);
    const detail = new THREE.Group(); root.add(detail);
    const article = data.articles?.find(a => a.id === entry.articleId);
    const sign = label(`${canonical}  ${article?.title || entry.title || ''}`); sign.position.set(0, 6.8, -1); root.add(sign);
    const island = { ...entry, canonical, chapter, articleId: entry.articleId || article?.id || canonical, root, detail, sign, sceneData: data.scenes?.find(s => s.articleId === entry.articleId), color: theme.color, reactionUntil: 0, visited: false };
    tag(coast, island, 'island', 'coast'); tag(lawn, island, 'island', 'ground');
    islands.set(island.articleId, island); buildScene(island, index); detail.visible = false;
  });
  const routes = new THREE.Group(); scene.add(routes);
  const entries = [...islands.values()];
  for (let n = 1; n < entries.length; n++) {
    const a = entries[n - 1], b = entries[n];
    const points = [a.root.position.clone().setY(.3), a.root.position.clone().lerp(b.root.position, .5).add(new THREE.Vector3(0, .3, -3)), b.root.position.clone().setY(.3)];
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(32)); geometries.set(`route-${n}`, geo);
    const mat = new THREE.LineDashedMaterial({ color: a.color, dashSize: .8, gapSize: .6, transparent: true, opacity: .48 }); materials.set(`route-${n}`, mat);
    const line = new THREE.Line(geo, mat); line.computeLineDistances(); routes.add(line);
    if (a.chapter === b.chapter && a.root.position.distanceTo(b.root.position) < 19) {
      const mid = a.root.position.clone().lerp(b.root.position, .5); const len = a.root.position.distanceTo(b.root.position);
      const bridge = mesh(routes, 'box', '#c8b699', [mid.x, .5, mid.z], [1, .18, len]); bridge.rotation.y = Math.atan2(b.root.position.x - a.root.position.x, b.root.position.z - a.root.position.z);
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
    const name = label(profile.name); name.scale.set(1.7, .42, 1); name.position.y = 2; root.add(name);
    root.scale.setScalar(1.2);
    const configured = data.characters?.find(c => c.name === profile.name || c.id === profile.id);
    return { ...profile, id: configured?.id || profile.id, root, body, head, eyes, brows, mouth, arms, legs, prop, phase: i * 1.7, state: 'observe', stateUntil: 2 + i, base: new THREE.Vector3(-3 + i * 2, 1.1, 3), reaction: 0 };
  });
  const crowd = new THREE.InstancedMesh(geometry('cylinder'), material('#adac94'), 100); crowd.count = 34; crowd.castShadow = true; cast.add(crowd);
  const crowdHeads = new THREE.InstancedMesh(geometry('ball'), material('#d4b397'), 100); crowdHeads.count = crowd.count; crowdHeads.castShadow = true; cast.add(crowdHeads);
  const dummy = new THREE.Object3D();
  const crowdSeeds = Array.from({ length: 100 }, () => ({ angle: random() * Math.PI * 2, radius: 2.6 + random() * 2.8, speed: .05 + random() * .08, scale: .2 + random() * .09 }));
  function updateCrowd(elapsed) {
    for (let i = 0; i < crowd.count; i++) {
      const seed = crowdSeeds[i], angle = seed.angle + elapsed * seed.speed;
      dummy.position.set(Math.cos(angle) * seed.radius, 1.45, Math.sin(angle) * seed.radius); dummy.rotation.y = -angle; dummy.scale.set(seed.scale, .65 + Math.sin(elapsed + i) * .025, seed.scale); dummy.updateMatrix(); crowd.setMatrixAt(i, dummy.matrix);
      dummy.position.y += .5; dummy.scale.setScalar(seed.scale * .85); dummy.updateMatrix(); crowdHeads.setMatrixAt(i, dummy.matrix);
    }
    crowd.instanceMatrix.needsUpdate = true; crowdHeads.instanceMatrix.needsUpdate = true;
  }
  updateCrowd(0);
  const carry = mesh(scene, 'box', '#fff2d2', [0, 0, 0], [.65, .85, .05]); carry.visible = false;
  let current = entries[0], journey = null, disposed = false, mode = 'story', frame = 0, time = 0, last = performance.now(), hover = null, audio = null, sound = false, active = !document.hidden;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  function updateLOD(target = null) {
    for (const island of entries) { island.detail.visible = island === current || island === target; island.sign.visible = mode === 'explore' || island === current || island === target; }
  }
  function placeCast() {
    cast.position.copy(current.root.position);
    for (const actor of actors) { actor.root.position.copy(actor.base); actor.state = 'arrive'; actor.stateUntil = time + 1; actor.reaction = time + 1.4; }
    sunlight.position.copy(current.root.position).add(new THREE.Vector3(-25, 55, 30)); sunlight.target.position.copy(current.root.position);
  }
  function emitStage(stage, destination, relation) { onTransitionStage(stage, { articleId: destination.articleId, question: relation?.transitionQuestion || '', visual: relation?.transitionVisual || '', relation }); }
  function finish(destination) { current = destination; current.visited = true; journey = null; carry.visible = false; controls.enabled = true; updateLOD(); placeCast(); }
  function focus(articleId, { animate = true, relation = null } = {}) {
    const destination = islands.get(articleId) || entries.find(i => i.canonical === articleId);
    if (!destination || disposed) return false;
    journey = null; controls.enabled = true; carry.visible = false;
    const endTarget = destination.root.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    const endPosition = destination.root.position.clone().add(new THREE.Vector3(12.5, 12, 17));
    updateLOD(destination);
    if (!animate || reducedMotion) {
      for (const stage of STAGES) emitStage(stage, destination, relation);
      camera.position.copy(endPosition); controls.target.copy(endTarget); finish(destination); controls.update(); return true;
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
    return raycaster.intersectObjects([...pickables, ...actorTargets], false).find(hit => visible(hit.object))?.object.userData.pick;
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
  function onMove(event) { if (press || journey) return; const hit = pick(event); const next = hit?.articleId || null; if (next !== hover) { hover = next; canvas.style.cursor = hit ? 'pointer' : 'grab'; for (const island of entries) island.sign.visible = mode === 'explore' || island === current || island.articleId === hover; } }
  function applyInteraction(articleId, payload = {}) {
    const island = islands.get(articleId); if (!island) return false;
    island.reactionUntil = time + 2.8; island.lastInteraction = payload.kind || 'choice';
    island.core.material = material(payload.result?.correct === false ? '#d0a17d' : '#d6bd67');
    for (const actor of actors) { actor.state = actor.habit === 'note' ? 'verify' : 'respond'; actor.stateUntil = time + 2.8; actor.reaction = time + 2.8; }
    return true;
  }
  function chime() {
    if (!sound) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); const oscillator = audio.createOscillator(), gain = audio.createGain(); oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(392, audio.currentTime); oscillator.frequency.exponentialRampToValueAtTime(587, audio.currentTime + .15); gain.gain.setValueAtTime(.025, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .35); oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .35); } catch { sound = false; }
  }
  function resize() { if (disposed) return; const bounds = canvas.getBoundingClientRect(); const width = Math.max(1, bounds.width), height = Math.max(1, bounds.height); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
  function visibility() { active = !document.hidden; last = performance.now(); }
  function tick(now) {
    if (disposed) return; frame = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, .05); last = now; if (!active) return; time += dt;
    if (journey) {
      const j = journey; j.elapsed += dt; const t = Math.min(j.elapsed / j.duration, 1); const phase = Math.min(4, Math.floor(t * 5));
      while (j.phase < phase) emitStage(STAGES[++j.phase], j.destination, j.relation);
      const sailT = THREE.MathUtils.smoothstep(t, .16, .93);
      camera.position.copy(j.position.getPoint(sailT)); controls.target.copy(j.target.getPoint(sailT)); camera.lookAt(controls.target);
      carry.visible = t > .32 && t < .92; carry.position.copy(camera.position).lerp(controls.target, .33); carry.rotation.set(.08, time * .65, .12); carry.scale.setScalar(.65 + .2 * Math.sin(t * Math.PI));
      if (t === 1) finish(j.destination);
    } else controls.update();
    if (!reducedMotion) {
      for (const actor of actors) {
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
      current.core.position.y = current.coreRest.y + (current.reactionUntil > time ? Math.sin(time * 6) * .15 : 0);
    }
    renderer.render(scene, camera);
  }
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointermove', onMove);
  document.addEventListener('visibilitychange', visibility); window.addEventListener('resize', resize);
  resize(); focus(current.articleId, { animate: false }); frame = requestAnimationFrame(tick);
  return {
    focus, resize, applyInteraction,
    setMode(value) { mode = value === 'explore' ? 'explore' : 'story'; controls.maxDistance = mode === 'explore' ? 210 : 110; updateLOD(journey?.destination); },
    setPopulation(count) { crowd.count = Math.max(10, Math.min(100, Math.round(Number(count) || 10))); crowdHeads.count = crowd.count; updateCrowd(reducedMotion ? 0 : time); },
    setReducedMotion(value) { reducedMotion = Boolean(value); if (reducedMotion && journey) focus(journey.destination.articleId, { animate: false, relation: journey.relation }); },
    setSound(enabled) { sound = Boolean(enabled); if (sound) chime(); },
    getState() { return { current: current.articleId, currenttarget: journey?.destination.articleId || current.articleId, currentTarget: journey?.destination.articleId || current.articleId, mode, population: crowd.count, reducedMotion, transitioning: Boolean(journey), stage: journey ? STAGES[Math.max(0, journey.phase)] : 'arrival', renderedislandcount: entries.length, renderedIslandCount: entries.length, detailedIslandCount: entries.filter(i => i.detail.visible).length, characters: actors.map(a => ({ id: a.id, name: a.name, state: a.state, habit: a.habit })), visited: entries.filter(i => i.visited).map(i => i.articleId), drawCalls: renderer.info.render.calls }; },
    dispose() { if (disposed) return; disposed = true; cancelAnimationFrame(frame); controls.dispose(); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('resize', resize); for (const geo of geometries.values()) geo.dispose(); for (const mat of materials.values()) mat.dispose(); for (const texture of textures) texture.dispose(); crowd.dispose(); crowdHeads.dispose(); renderer.dispose(); audio?.close(); scene.clear(); },
  };
}

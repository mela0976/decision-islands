import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './world.css';
import { createLibraryScene } from './library-scene';
import { ENTRANCE_DURATION_MS, sampleEntrance } from './entrance';

type Article = { id: string; chapter: string; title: string };
type ChapterKey = 'intro' | 'people' | 'model' | 'ai';
type Options = { onChapter: (chapter: string) => void; onArticle: (id: string) => void; reducedMotion: boolean };
type Phase = 'cosmos' | 'transition' | 'islands' | 'disposed';
const CHAPTERS: { id: ChapterKey; title: string; english: string; x: number; z: number; radius: number }[] = [
  { id: 'intro', title: '啟航', english: 'Intro', x: -9, z: -7.5, radius: 4.2 },
  { id: 'people', title: '人心之島', english: 'People', x: -10, z: 6, radius: 5.2 },
  { id: 'model', title: '洞察之島', english: 'Model', x: 6.5, z: -6.5, radius: 5.4 },
  { id: 'ai', title: '行動之島', english: 'A.I.', x: 8.5, z: 7, radius: 5.2 },
];
const COLORS = { sea: 0x85bab9, sand: 0xeadcc0, orange: 0xc66a42, sage: 0x95ac85, ink: 0x263c3e, cream: 0xfff3d9, paper: 0xeaddc3, teal: 0x4e8180, rock: 0x608e87 };

export function createWorld(container: HTMLElement, options: Options) {
  let phase: Phase = 'cosmos';
  let enabled = !options.reducedMotion;
  let selected: string | null = null;
  let frame = 0;
  let visible = true;
  let width = 1;
  let height = 1;
  let lastFrame = 0;
  let lastTick = 0;
  let lastInteraction = performance.now();
  let transitionElapsed = 0;
  let finishEnter: (() => void) | undefined;
  let enterPromise: Promise<void> | undefined;
  let renderer: THREE.WebGLRenderer | undefined;
  let libraryEnvironment: THREE.WebGLRenderTarget | undefined;
  let dragging = false;
  let dragX = 0;
  let angle = 0;
  let targetAngle = 0;
  const root = document.createElement('div');
  root.className = 'island-world';
  root.dataset.phase = phase;
  const map = document.createElement('div');
  map.className = 'world-fallback-map';
  map.setAttribute('aria-hidden', 'true');
  for (const [i, chapter] of CHAPTERS.entries()) {
    const island = document.createElement('span');
    island.style.left = `${i % 2 ? 58 : 17}%`;
    island.style.top = `${i < 2 ? 24 : 58}%`;
    island.dataset.chapter = chapter.id;
    map.append(island);
  }
  const labels = document.createElement('div');
  labels.className = 'world-labels';
  labels.inert = true;
  labels.setAttribute('aria-label', '探索決策智慧的四座島嶼');
  const compass = document.createElement('div');
  compass.className = 'world-compass';
  compass.setAttribute('aria-hidden', 'true');
  const hint = document.createElement('div');
  hint.className = 'world-hint';
  hint.textContent = '拖曳探索・點選島嶼閱讀';
  const veil = document.createElement('div');
  veil.className = 'entrance-veil';
  veil.setAttribute('aria-hidden', 'true');
  const entranceControls = document.createElement('div');
  entranceControls.className = 'entrance-controls';
  const entranceCaption = document.createElement('span');
  entranceCaption.textContent = '走近書的記憶';
  const skipEntrance = document.createElement('button');
  skipEntrance.type = 'button';
  skipEntrance.textContent = '略過轉場';
  skipEntrance.addEventListener('click', () => completeEnter());
  entranceControls.append(entranceCaption, skipEntrance);
  entranceControls.inert = true;
  root.append(map, labels, compass, hint, veil, entranceControls);
  container.append(root);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe4d7bd);
  const camera = new THREE.OrthographicCamera(-25, 25, 25, -25, .1, 250);
  const libraryCamera = new THREE.PerspectiveCamera(51, 1, .1, 180);
  let activeCamera: THREE.Camera = libraryCamera;
  const world = new THREE.Group();
  const cosmos = new THREE.Group();
  scene.add(world, cosmos);
  cosmos.visible = false;
  world.visible = false;
  const mats = new Map<number, THREE.MeshStandardMaterial>();
  const material = (color: number) => {
    if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({ color, roughness: .88, flatShading: true }));
    return mats.get(color)!;
  };
  const mesh = (geometry: THREE.BufferGeometry, color: number, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const object = new THREE.Mesh(geometry, material(color));
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: number) => mesh(new THREE.BoxGeometry(w, h, d), color, parent, x, y, z);
  const cylinder = (parent: THREE.Object3D, x: number, y: number, z: number, top: number, bottom: number, h: number, color: number, segments = 8) => mesh(new THREE.CylinderGeometry(top, bottom, h, segments), color, parent, x, y, z);
  const libraryScene = createLibraryScene();
  const library = libraryScene.group;
  scene.add(library);
  const book = (parent: THREE.Object3D, x: number, y: number, z: number, scale: number, color: number, rotation = 0) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    parent.add(group);
    box(group, 0, 0, 0, 1.7 * scale, .35 * scale, 1.2 * scale, COLORS.paper);
    box(group, 0, -.2 * scale, 0, 1.85 * scale, .07 * scale, 1.3 * scale, color);
    box(group, 0, .2 * scale, 0, 1.85 * scale, .07 * scale, 1.3 * scale, color);
    box(group, -.88 * scale, 0, 0, .09 * scale, .4 * scale, 1.3 * scale, color);
    return group;
  };
  const tree = (parent: THREE.Object3D, x: number, z: number, scale = 1, orange = false) => {
    cylinder(parent, x, .8 * scale, z, .11 * scale, .15 * scale, 1.6 * scale, 0x8d7357, 5);
    const crown = mesh(new THREE.IcosahedronGeometry(.82 * scale, 0), orange ? COLORS.orange : COLORS.sage, parent, x, 1.8 * scale, z);
    crown.scale.y = 1.3;
    mesh(new THREE.IcosahedronGeometry(.58 * scale, 0), orange ? 0xd79761 : 0xadc39b, parent, x + .33 * scale, 2.1 * scale, z - .2 * scale);
  };
  const person = (parent: THREE.Object3D, x: number, z: number, color = COLORS.orange, rotation = 0) => {
    const g = new THREE.Group();
    g.position.set(x, .2, z);
    g.rotation.y = rotation;
    parent.add(g);
    cylinder(g, 0, .7, 0, .15, .22, .58, color, 6);
    mesh(new THREE.IcosahedronGeometry(.18, 1), 0xe8b994, g, 0, 1.16, 0);
    box(g, -.1, .23, 0, .1, .42, .12, COLORS.ink);
    box(g, .1, .23, 0, .1, .42, .12, COLORS.ink);
  };
  world.add(new THREE.HemisphereLight(0xfff9e9, 0x568782, 2.7));
  cosmos.add(new THREE.HemisphereLight(0xfff6e4, 0x122236, 1.7));
  const light = new THREE.DirectionalLight(0xfff0d4, 3.4);
  light.position.set(-12, 35, 18);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 100 });
  light.shadow.normalBias = .08;
  light.shadow.bias = -.0002;
  world.add(light);
  const sea = mesh(new THREE.PlaneGeometry(300, 300), 0x427f83, world, 0, -1.2, 0);
  sea.rotation.x = -Math.PI / 2;
  sea.castShadow = false;
  const islandGroups = new Map<string, THREE.Group>();
  const chapterLabels: { button: HTMLButtonElement; point: THREE.Vector3; id: string }[] = [];
  let articleLabels: { button: HTMLButtonElement; point: THREE.Vector3; chapter: string }[] = [];
  for (const chapter of CHAPTERS) {
    const g = new THREE.Group();
    g.position.set(chapter.x, .1, chapter.z);
    islandGroups.set(chapter.id, g);
    world.add(g);
    const island = cylinder(g, 0, -.55, 0, chapter.radius, chapter.radius * .82, 1.3, COLORS.rock, 11);
    island.rotation.y = .25;
    const surface = cylinder(g, 0, .12, 0, chapter.radius * 1.01, chapter.radius, .5, COLORS.sand, 11);
    surface.rotation.y = .25;
    cylinder(g, 0, .39, 0, chapter.radius * .77, chapter.radius * .85, .08, 0xaebe9a, 11);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + .3;
      tree(g, Math.cos(a) * chapter.radius * .77, Math.sin(a) * chapter.radius * .77, .6 + (i % 3) * .2, i === 2);
    }
    for (let i = 0; i < 12; i++) {
      const a = i * .52;
      const pebble = mesh(new THREE.DodecahedronGeometry(.18 + (i % 3) * .08), i % 3 ? 0xc9c5a8 : COLORS.cream, g, Math.cos(a) * chapter.radius * .91, .43, Math.sin(a) * chapter.radius * .91);
      pebble.scale.y = .45;
    }
    const button = document.createElement('button');
    button.className = 'world-chapter';
    button.type = 'button';
    button.setAttribute('aria-label', `探索${chapter.title}`);
    const title = document.createElement('span');
    title.textContent = chapter.title;
    const english = document.createElement('small');
    english.textContent = chapter.english;
    button.append(title, english);
    button.addEventListener('click', () => { wake(); options.onChapter(chapter.id); });
    labels.append(button);
    chapterLabels.push({ button, point: new THREE.Vector3(chapter.x, 1.2, chapter.z), id: chapter.id });
  }
  const intro = islandGroups.get('intro')!;
  for (let i = 0; i < 7; i++) book(intro, Math.sin(i * .6) * .15, .75 + i * .45, 0, 1.7 - i * .11, [COLORS.teal, COLORS.orange, COLORS.sage][i % 3], i * .18);
  const openBook = new THREE.Group();
  openBook.position.set(0, 4, 0);
  intro.add(openBook);
  const leftPage = box(openBook, -.66, 0, 0, 1.3, .12, 1.65, COLORS.cream);
  leftPage.rotation.z = -.22;
  const rightPage = box(openBook, .66, 0, 0, 1.3, .12, 1.65, COLORS.cream);
  rightPage.rotation.z = .22;
  for (let i = 0; i < 4; i++) {
    box(openBook, -.66, .16, -.45 + i * .28, .9, .015, .025, 0xc8b99a);
    box(openBook, .66, .16, -.45 + i * .28, .9, .015, .025, 0xc8b99a);
  }
  person(intro, -2, 1.5);
  const people = islandGroups.get('people')!;
  cylinder(people, 0, .55, -.1, 2.2, 2.4, .25, COLORS.cream, 24);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    cylinder(people, Math.cos(a) * 1.75, 1.8, Math.sin(a) * 1.75, .12, .14, 2.4, COLORS.cream, 6);
    person(people, Math.cos(a) * 2.7, Math.sin(a) * 2.7, i % 2 ? COLORS.teal : COLORS.orange, -a);
  }
  const roof = cylinder(people, 0, 3.25, 0, 0, 2.7, 1.25, COLORS.orange, 6);
  roof.rotation.y = Math.PI / 6;
  cylinder(people, 0, 1.05, 0, 1.2, 1.2, .18, COLORS.teal, 12);
  book(people, .1, 1.27, 0, .6, COLORS.orange, .4);
  box(people, -3.2, .75, 1, 1.5, .18, .55, 0x947256).rotation.y = .6;
  const model = islandGroups.get('model')!;
  for (let i = 0; i < 4; i++) {
    book(model, 0, .8 + i * .45, 0, 1.6, i % 2 ? COLORS.teal : COLORS.orange, -.15 + i * .06);
  }
  const nodes: THREE.Vector3[] = [];
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 6;
    nodes.push(i === 6 ? new THREE.Vector3(0, 5.9, 0) : new THREE.Vector3(Math.cos(a) * 2.3, 3.6 + (i % 2) * .8, Math.sin(a) * 2.3));
  }
  const linkMaterial = new THREE.LineBasicMaterial({ color: COLORS.teal });
  for (let i = 0; i < nodes.length; i++) {
    mesh(new THREE.IcosahedronGeometry(i === 6 ? .55 : .35, 0), i % 2 ? COLORS.orange : COLORS.teal, model, nodes[i].x, nodes[i].y, nodes[i].z);
    for (const j of [(i + 1) % 6, 6]) {
      if (i === 6) continue;
      model.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([nodes[i], nodes[j]]), linkMaterial));
    }
  }
  person(model, -2.3, 1.9, COLORS.orange);
  person(model, -1.5, 2.2, COLORS.teal);
  const ai = islandGroups.get('ai')!;
  cylinder(ai, 0, .8, 0, 2.25, 2.6, .7, COLORS.cream, 8);
  cylinder(ai, 0, 1.35, 0, 1.8, 2.2, .4, COLORS.teal, 8);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const column = box(ai, Math.cos(a) * 1.6, 2.7, Math.sin(a) * 1.6, .3, 2.6, .3, COLORS.cream);
    column.rotation.y = a;
  }
  const orb = mesh(new THREE.IcosahedronGeometry(1.3, 1), COLORS.orange, ai, 0, 3.5, 0);
  const ring = mesh(new THREE.TorusGeometry(2, .065, 6, 64), COLORS.cream, ai, 0, 3.5, 0);
  ring.rotation.x = Math.PI / 2.8;
  ring.rotation.y = .3;
  book(ai, -2.7, .75, 1.6, .8, COLORS.orange, .5);
  person(ai, 2.5, 1.5, COLORS.teal);
  person(ai, 1.6, 2, COLORS.orange);
  const bridge = (a: THREE.Vector3, b: THREE.Vector3) => {
    const distance = a.distanceTo(b);
    const middle = a.clone().add(b).multiplyScalar(.5);
    const g = new THREE.Group();
    g.position.copy(middle);
    g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    world.add(g);
    for (let i = 0; i < distance * 2; i++) box(g, 0, .15, i * .5 - distance / 2, 1.1, .14, .34, 0xc3a77b);
    for (const side of [-.55, .55]) {
      for (let i = 0; i <= distance / 1.5; i++) cylinder(g, side, .65, i * 1.5 - distance / 2, .055, .06, 1.1, COLORS.cream, 5);
      box(g, side, 1.05, 0, .055, .06, distance, COLORS.cream);
    }
  };
  bridge(new THREE.Vector3(-9.5, 0, -3), new THREE.Vector3(-10, 0, .9));
  bridge(new THREE.Vector3(-4.8, 0, -7), new THREE.Vector3(1.2, 0, -6.5));
  bridge(new THREE.Vector3(7, 0, -1.1), new THREE.Vector3(8, 0, 1.9));
  const boat = new THREE.Group();
  boat.position.set(-.5, -.6, 8.5);
  boat.rotation.y = .3;
  world.add(boat);
  const hull = cylinder(boat, 0, .3, 0, .65, .38, .5, COLORS.orange, 5);
  hull.scale.z = 2.2;
  cylinder(boat, 0, 1.6, 0, .045, .045, 2.5, COLORS.ink, 5);
  const sail = new THREE.Shape();
  sail.moveTo(.1, .7); sail.lineTo(.1, 2.7); sail.lineTo(1.5, .7); sail.closePath();
  const sailMesh = new THREE.Mesh(new THREE.ShapeGeometry(sail), new THREE.MeshStandardMaterial({ color: COLORS.cream, side: THREE.DoubleSide }));
  boat.add(sailMesh);
  const ripples = new THREE.Group();
  world.add(ripples);
  const rippleMaterial = new THREE.LineBasicMaterial({ color: 0xc8e1d7, transparent: true, opacity: .4 });
  for (let i = 0; i < 43; i++) {
    const x = Math.sin(i * 12.9898) * 24;
    const z = Math.cos(i * 5.731) * 21;
    const curve = new THREE.EllipseCurve(0, 0, .5 + (i % 4) * .3, .16, .15, Math.PI * .8, false, 0);
    const points = curve.getPoints(14).map(p => new THREE.Vector3(p.x + x, -1.16, p.y + z));
    ripples.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), rippleMaterial));
  }
  for (let i = 0; i < 100; i++) {
    const a = i * .38;
    const r = 2.4 + i * .027;
    book(cosmos, Math.cos(a) * r, i * .12 - 6, Math.sin(a) * r, .85, [COLORS.orange, COLORS.teal, COLORS.cream, COLORS.sage][i % 4], -a + .7);
  }
  const starPositions = new Float32Array(650 * 3);
  for (let i = 0; i < 650; i++) {
    starPositions[i * 3] = Math.sin(i * 127.1) * 65;
    starPositions[i * 3 + 1] = Math.cos(i * 311.7) * 45;
    starPositions[i * 3 + 2] = Math.sin(i * 74.7) * 55;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: COLORS.cream, size: .075, transparent: true, opacity: .8, sizeAttenuation: true }));
  cosmos.add(stars);
  const project = new THREE.Vector3();
  const setLibraryCamera = (progress = 0) => {
    activeCamera = libraryCamera;
    libraryCamera.aspect = width / height;
    const shot = sampleEntrance(progress, width / height);
    libraryCamera.fov = shot.fov;
    libraryCamera.position.set(...shot.cameraPosition);
    libraryCamera.lookAt(...shot.cameraTarget);
    libraryCamera.updateProjectionMatrix();
    libraryCamera.updateMatrixWorld();
  };
  const setCamera = (progress = 1) => {
    activeCamera = camera;
    cosmos.position.set(width > 760 ? 7 : 0, width > 760 ? 1 : 3, width > 760 ? -4 : 0);
    const islandDistance = width / height < .8 ? 31 : 25;
    const halfH = 12 + ((width / height < .8 ? 25 : 20) - 12) * progress;
    camera.left = -halfH * width / height;
    camera.right = halfH * width / height;
    camera.top = halfH;
    camera.bottom = -halfH;
    if (width / height < .8) {
      const halfW = 10 + 11 * progress;
      camera.left = -halfW; camera.right = halfW; camera.top = halfW * height / width; camera.bottom = -camera.top;
    }
    camera.position.set(22 * progress + 14 * (1 - progress), 30 * progress + 9 * (1 - progress), islandDistance * progress + 21 * (1 - progress));
    camera.lookAt(0, progress ? 0 : .5, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
  const positionLabels = () => {
    for (const item of [...chapterLabels, ...articleLabels]) {
      if (renderer) {
        project.copy(item.point).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle).project(camera);
        const padding = 'id' in item ? Math.min(110, width * .19) : 16;
        item.button.style.left = `${Math.max(padding, Math.min(width - padding, (project.x * .5 + .5) * width))}px`;
        const labelOffset = 'id' in item ? Math.min(95, width * .09) : 0;
        item.button.style.top = `${Math.max(22, Math.min(height - 22, (-project.y * .5 + .5) * height + labelOffset))}px`;
      } else {
        const chapter = CHAPTERS.find(c => c.id === ('id' in item ? item.id : item.chapter))!;
        const index = CHAPTERS.indexOf(chapter);
        const article = 'chapter' in item;
        item.button.style.left = `${(index % 2 ? 70 : 30) + (article ? (item.point.x - chapter.x) * 2.5 : 0)}%`;
        item.button.style.top = `${(index < 2 ? 34 : 68) + (article ? (item.point.z - chapter.z) * 2.1 : 11)}%`;
      }
    }
  };
  const render = () => {
    if (phase === 'disposed') return;
    positionLabels();
    scene.environment = library.visible ? libraryEnvironment?.texture ?? null : null;
    scene.environmentIntensity = .18;
    if (renderer) renderer.toneMappingExposure = library.visible ? 1 : 1.12;
    renderer?.render(scene, activeCamera);
  };
  const tick = (now: number) => {
    frame = 0;
    if (phase === 'disposed' || document.hidden || !visible) return;
    const delta = lastTick ? Math.max(0, (now - lastTick) / 1000) : 0;
    lastTick = now;
    if (enabled && library.visible) libraryScene.update(delta);
    if (phase === 'transition') {
      transitionElapsed += delta * 1000;
      const t = Math.min(1, transitionElapsed / ENTRANCE_DURATION_MS);
      const shot = sampleEntrance(t, width / height);
      library.visible = shot.libraryVisible;
      cosmos.visible = shot.cosmosVisible;
      world.visible = shot.islandsVisible;
      library.scale.setScalar(shot.libraryScale);
      if (shot.stage === 'islands') setCamera();
      else setLibraryCamera(t);
      cosmos.position.set(0, 8, -6);
      cosmos.scale.setScalar(shot.cosmosScale);
      cosmos.rotation.y += delta * .35;
      veil.style.opacity = String(shot.veil);
      root.dataset.entranceStage = shot.stage;
      entranceCaption.textContent = shot.stage === 'library' ? '走近書的記憶' : shot.stage === 'cosmos' ? '穿過觀點的宇宙' : '抵達決策群島';
      scene.background = new THREE.Color(shot.stage === 'library' ? 0xe4d7bd : shot.stage === 'cosmos' ? 0x080f1c : COLORS.sea);
      if (t === 1) completeEnter();
    }
    const active = now - lastInteraction < 12000;
    if (now - lastFrame > (phase === 'cosmos' ? 1000 / 24 : active ? 1000 / 30 : 1000 / 8) || phase === 'transition') {
      lastFrame = now;
      if (enabled) {
        if (phase === 'islands') {
          angle += (targetAngle - angle) * .1;
          world.rotation.y = angle;
          orb.rotation.y += .003;
          boat.position.y = -.6 + Math.sin(now * .001) * .055;
          if (active) ring.rotation.z += .002;
        }
      }
      render();
    }
    if (phase === 'transition' || (enabled && (phase === 'cosmos' || active))) frame = requestAnimationFrame(tick);
  };
  function wake() {
    lastInteraction = performance.now();
    if (!frame && phase !== 'disposed' && !document.hidden && visible) frame = requestAnimationFrame(tick);
  }
  function completeEnter() {
    phase = 'islands';
    root.dataset.phase = phase;
    veil.style.opacity = '0';
    entranceControls.inert = true;
    labels.inert = false;
    library.visible = false;
    cosmos.visible = false;
    world.visible = true;
    scene.background = new THREE.Color(COLORS.sea);
    setCamera();
    render();
    finishEnter?.();
    finishEnter = undefined;
  }
  const resize = () => {
    const rect = container.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer?.setSize(width, height, false);
    if (phase === 'cosmos') setLibraryCamera();
    else if (phase === 'transition' && sampleEntrance(transitionElapsed / ENTRANCE_DURATION_MS, width / height).stage !== 'islands') setLibraryCamera(transitionElapsed / ENTRANCE_DURATION_MS);
    else setCamera();
    render();
    wake();
  };
  const pointerDown = (event: PointerEvent) => { dragging = true; dragX = event.clientX; wake(); };
  const pointerMove = (event: PointerEvent) => {
    if (!dragging || phase !== 'islands') return;
    targetAngle = Math.max(-.22, Math.min(.22, targetAngle + (event.clientX - dragX) * .002));
    dragX = event.clientX;
    if (!enabled) { angle = targetAngle; world.rotation.y = angle; render(); }
    wake();
  };
  const pointerUp = () => { dragging = false; };
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    const environment = new RoomEnvironment();
    const environmentGenerator = new THREE.PMREMGenerator(renderer);
    libraryEnvironment = environmentGenerator.fromScene(environment, .04);
    environment.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    environment.dispose();
    environmentGenerator.dispose();
    renderer.domElement.setAttribute('aria-hidden', 'true');
    root.prepend(renderer.domElement);
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointerleave', pointerUp);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
  } catch { root.dataset.fallback = 'true'; }
  function contextLost(event: Event) {
    event.preventDefault();
    root.dataset.fallback = 'true';
    renderer = undefined;
    completeEnter();
    positionLabels();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(entries => {
    lastTick = 0;
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) wake();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  });
  intersectionObserver.observe(container);
  const visibilityChange = () => {
    lastTick = 0;
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
    else if (!document.hidden) wake();
  };
  document.addEventListener('visibilitychange', visibilityChange);
  resize();
  return {
    enter: () => {
      if (phase === 'disposed' || phase === 'islands') return Promise.resolve();
      if (enterPromise) return enterPromise;
      enterPromise = new Promise<void>(resolve => { finishEnter = resolve; });
      if (!enabled || !renderer) completeEnter();
      else { phase = 'transition'; root.dataset.phase = phase; entranceControls.inert = false; transitionElapsed = 0; lastTick = 0; wake(); }
      return enterPromise;
    },
    setChapter: (chapter: string | null) => {
      selected = chapter;
      for (const item of chapterLabels) {
        item.button.setAttribute('aria-pressed', String(item.id === selected));
        item.button.style.opacity = !selected || item.id === selected ? '1' : '.55';
      }
      for (const item of articleLabels) item.button.hidden = Boolean(selected && selected !== item.chapter);
      wake();
    },
    setArticles: (articles: Article[]) => {
      for (const item of articleLabels) item.button.remove();
      articleLabels = [];
      const counts = new Map<string, number>();
      for (const article of articles) {
        const chapter = CHAPTERS.find(c => c.id === article.chapter);
        if (!chapter) continue;
        const index = counts.get(chapter.id) ?? 0;
        counts.set(chapter.id, index + 1);
        const a = index * 2.4 + .3;
        const r = chapter.radius * (.64 + (index % 2) * .18);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'world-article';
        button.textContent = String(index + 1).padStart(2, '0');
        button.dataset.title = article.title;
        button.setAttribute('aria-label', `閱讀${article.title}`);
        button.addEventListener('click', () => { wake(); options.onArticle(article.id); });
        button.hidden = Boolean(selected && selected !== article.chapter);
        labels.append(button);
        articleLabels.push({ button, chapter: article.chapter, point: new THREE.Vector3(chapter.x + Math.cos(a) * r, .9, chapter.z + Math.sin(a) * r) });
      }
      positionLabels();
      wake();
    },
    setMotion: (value: boolean) => {
      enabled = value;
      lastTick = 0;
      if (!enabled && phase === 'transition') completeEnter();
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      render();
      if (enabled) wake();
    },
    reset: () => { targetAngle = 0; angle = 0; world.rotation.y = 0; if (phase === 'cosmos') setLibraryCamera(); else setCamera(); wake(); render(); },
    dispose: () => {
      if (phase === 'disposed') return;
      phase = 'disposed';
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      library.removeFromParent();
      libraryScene.dispose();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) object.geometry.dispose();
        if (object instanceof THREE.InstancedMesh) object.dispose();
      });
      for (const mat of mats.values()) mat.dispose();
      linkMaterial.dispose(); rippleMaterial.dispose();
      (stars.material as THREE.Material).dispose(); sailMesh.material.dispose();
      libraryEnvironment?.dispose();
      renderer?.dispose();
      root.remove();
      finishEnter?.();
    },
  };
}

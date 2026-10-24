import * as THREE from 'three';

const DURATION = 8.6;
const PAGE_COUNT = 28;
const PHASES = [
  { start: 0, name: 'cover', caption: '翻開一頁，走進一個問題。' },
  { start: 1.5, name: 'opening', caption: '答案很多，可是我到底該相信哪一個？' },
  { start: 2.8, name: 'tower', caption: '讓紙上的觀點，成為可以走進的地方。' },
  { start: 4.4, name: 'archipelago', caption: '真實、信任與判斷，各有自己的海岸。' },
  { start: 7, name: 'arrival', caption: '帶著問題，航向下一個故事。' },
];
const clamp = (n) => Math.max(0, Math.min(1, n));
const ease = (n) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const between = (time, start, end) => ease((time - start) / (end - start));
const mix = (a, b, t) => a + (b - a) * t;
function mulberry32(seed) {
  return () => { let n = seed += 0x6D2B79F5; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}

export function createBookIntro({ host, coverUrl = '../assets/cover-2026.webp', reducedMotion = false, onCaption = () => {}, onComplete = () => {} } = {}) {
  const state = { phase: 'idle', elapsed: 0, running: false, disposed: false, drawcalls: 0, pagecount: 0 };
  const resources = { geometries: new Set(), materials: new Set(), textures: new Set() };
  let renderer, scene, camera, canvas, frame, image, resizeObserver, startedAt;
  let promise, resolvePlay, rejectPlay, settled = false, completed = false;
  let pages = [], book, coverHinge, sea, clouds;
  const track = (kind, value) => { resources[kind].add(value); return value; };
  const material = (color, options = {}) => track('materials', new THREE.MeshStandardMaterial({ color, roughness: .94, ...options }));
  const geometry = (value) => track('geometries', value);
  const mesh = (shape, surface, parent, x = 0, y = 0, z = 0) => {
    const object = new THREE.Mesh(shape, surface); object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };

  function cleanup() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    resizeObserver?.disconnect();
    if (image) { image.onload = null; image.onerror = null; image = null; }
    canvas?.removeEventListener('webglcontextlost', contextLost);
    for (const values of Object.values(resources)) { for (const value of values) value.dispose(); values.clear(); }
    renderer?.dispose();
    renderer?.forceContextLoss();
    canvas?.remove();
    renderer = scene = camera = canvas = book = coverHinge = sea = clouds = undefined;
    pages = [];
    state.running = false;
  }

  function finish(error) {
    if (settled) return;
    settled = true;
    cleanup();
    if (error) { state.phase = 'failed'; rejectPlay?.(error); return; }
    state.phase = state.disposed ? 'disposed' : 'complete';
    try { if (!completed) { completed = true; onComplete(); } resolvePlay?.(); }
    catch (callbackError) { rejectPlay?.(callbackError); }
  }

  function contextLost(event) {
    event.preventDefault();
    finish(new Error('Book intro WebGL context lost'));
  }

  function coverTexture() {
    const paper = document.createElement('canvas'); paper.width = 768; paper.height = 1024;
    const ctx = paper.getContext('2d');
    if (!ctx) throw new Error('Book intro cover canvas unavailable');
    ctx.fillStyle = '#f4f0e5'; ctx.fillRect(0, 0, 768, 1024);
    ctx.fillStyle = '#232322'; ctx.font = 'bold 54px sans-serif'; ctx.fillText('dentsu', 55, 100);
    ctx.font = 'bold 86px sans-serif'; ctx.fillText('2026', 55, 270);
    ctx.font = 'bold 66px sans-serif'; ctx.fillText('決策智慧', 55, 370);
    ctx.font = '25px sans-serif'; ctx.fillText('Agentic 時代', 58, 425);
    ctx.fillStyle = '#b7c68f'; ctx.beginPath(); ctx.arc(440, 710, 204, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e4bec7'; ctx.beginPath(); ctx.arc(320, 655, 130, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#232322'; ctx.font = '23px sans-serif'; ctx.fillText('重塑品牌與人的真實距離', 55, 952);
    const texture = track('textures', new THREE.CanvasTexture(paper)); texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function build() {
    if (!host?.appendChild) throw new Error('Book intro host is unavailable');
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    canvas = renderer.domElement;
    canvas.dataset.bookIntro = 'true'; canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '0' });
    canvas.addEventListener('webglcontextlost', contextLost);
    host.appendChild(canvas);
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0xe9e5d9, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xdbe6df, 24, 64);
    camera = new THREE.PerspectiveCamera(39, 1, .1, 110);
    scene.add(new THREE.HemisphereLight(0xfffcf4, 0x728f87, 2.5));
    const light = new THREE.DirectionalLight(0xfff3dc, 3.3); light.position.set(-8, 16, 10); light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024); light.shadow.camera.left = light.shadow.camera.bottom = -22; light.shadow.camera.right = light.shadow.camera.top = 22;
    light.shadow.normalBias = .04; scene.add(light);
    const paper = material(0xf5f0e3), ink = material(0x252a28), sand = material(0xe6ddc3);
    const palette = [0xe8e2d1, 0xc2cb82, 0xe4b8c4, 0x88bbb5];
    book = new THREE.Group(); scene.add(book); book.rotation.y = -.18;
    const coverSurface = material(0xffffff, { map: coverTexture() });
    const coverSide = material(0x292c29);
    coverHinge = new THREE.Group(); coverHinge.position.set(-2.17, .43, 0); book.add(coverHinge);
    mesh(geometry(new THREE.BoxGeometry(4.34, .105, 5.92)), [coverSide, coverSide, coverSurface, coverSide, coverSide, coverSide], coverHinge, 2.17, 0, 0);
    mesh(geometry(new THREE.BoxGeometry(4.34, .10, 5.92)), coverSide, book, 0, -.15, 0);
    mesh(geometry(new THREE.BoxGeometry(.12, .60, 5.92)), coverSide, book, -2.17, .13, 0);
    for (let i = 0; i < 7; i++) mesh(geometry(new THREE.BoxGeometry(1.8 - i * .13, .015, .025)), ink, coverHinge, 1.4, .065, 2.2 + i * .045);
    const random = mulberry32(2026);
    const clusters = [[-7, -4], [6, -6], [-7, 5], [6, 5]];
    for (let i = 0; i < PAGE_COUNT; i++) {
      const cluster = i % 4;
      const shape = geometry(new THREE.BoxGeometry(4.18, .027, 5.72, 10, 1, 10));
      const vertices = shape.attributes.position;
      const original = vertices.array.slice(), coast = original.slice();
      const shapeSeed = random() * 10;
      for (let v = 0; v < vertices.count; v++) {
        const x = original[v * 3] / 2.09, z = original[v * 3 + 2] / 2.86;
        const angle = Math.atan2(z, x), radius = Math.max(Math.abs(x), Math.abs(z));
        const edge = 1 + .12 * Math.sin(angle * 3 + shapeSeed) + .065 * Math.cos(angle * 5 + shapeSeed);
        coast[v * 3] = Math.cos(angle) * radius * edge * 2.2;
        coast[v * 3 + 2] = Math.sin(angle) * radius * edge * 2.1;
        coast[v * 3 + 1] = original[v * 3 + 1] > 0 ? .20 : -.25;
      }
      const pageMaterial = material(0xf5f0e3);
      const object = mesh(shape, pageMaterial, scene);
      const angle = i / 4 * 2.4 + cluster, distance = i < 4 ? 0 : 2.8 + (i / PAGE_COUNT) * 4.3;
      const target = new THREE.Vector3(clusters[cluster][0] + Math.cos(angle) * distance, -.25 + random() * .14, clusters[cluster][1] + Math.sin(angle) * distance);
      const vegetation = new THREE.Group(); object.add(vegetation); vegetation.visible = false;
      const plantSurface = material(cluster === 2 ? 0x9fa582 : 0x728d6e);
      for (let j = 0; j < 3; j++) {
        const x = (random() - .5) * 2.4, z = (random() - .5) * 2.2;
        mesh(geometry(new THREE.CylinderGeometry(.055, .075, .45, 5)), sand, vegetation, x, .4, z);
        mesh(geometry(new THREE.SphereGeometry(.28 + random() * .18, 7, 5)), plantSurface, vegetation, x, .79, z);
      }
      const building = mesh(geometry(new THREE.BoxGeometry(.65 + random() * .4, .6, .72)), i % 3 ? sand : paper, vegetation, .3, .53, -.5);
      mesh(geometry(new THREE.BoxGeometry(.12, .22, .015)), ink, building, 0, -.06, .37);
      pages.push({ object, original, coast, target, vegetation, tint: new THREE.Color(palette[cluster]), angle: random() * .4 - .2 });
    }
    state.pagecount = pages.length;
    sea = mesh(geometry(new THREE.PlaneGeometry(150, 150)), material(0x96bbb8, { transparent: true, opacity: 0 }), scene, 0, -.65, 0); sea.rotation.x = -Math.PI / 2; sea.castShadow = false;
    clouds = new THREE.Group(); scene.add(clouds);
    const cloudMaterial = material(0xf8f6eb, { transparent: true, opacity: 0, depthWrite: false });
    const cloudGeometry = geometry(new THREE.SphereGeometry(1, 12, 8));
    for (let i = 0; i < 6; i++) { const cloud = mesh(cloudGeometry, cloudMaterial, clouds, (i - 2.5) * 3.6, 5 + i % 2, 9 - (i % 3) * 1.2); cloud.scale.set(2.6, .48, 1.2); cloud.castShadow = false; }
    const resize = () => {
      if (!renderer || !camera) return;
      const width = Math.max(1, host.clientWidth || globalThis.innerWidth || 1), height = Math.max(1, host.clientHeight || globalThis.innerHeight || 1);
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    resize();
    if (globalThis.ResizeObserver) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); }
    image = new Image();
    image.onload = () => {
      if (!renderer || settled || state.disposed) return;
      const loaded = track('textures', new THREE.Texture(image)); loaded.colorSpace = THREE.SRGBColorSpace; loaded.needsUpdate = true;
      coverSurface.map = loaded; coverSurface.needsUpdate = true;
      image.onload = image.onerror = null; image = null;
    };
    image.onerror = () => { if (image) { image.onload = image.onerror = null; image = null; } };
    image.src = coverUrl;
  }

  function update(time) {
    const opening = between(time, 1.5, 3), rising = between(time, 2.7, 4.5), spreading = between(time, 4.3, 7), arrival = between(time, 6.9, DURATION);
    const phase = PHASES.findLast((item) => time >= item.start);
    if (phase.name !== state.phase) { state.phase = phase.name; onCaption(phase.caption); }
    coverHinge.rotation.z = opening * 2.85;
    book.position.y = -between(time, 4.5, 6.5) * 7;
    book.rotation.y = -.18 + rising * .2;
    const shade = new THREE.Color(0xf5f0e3);
    pages.forEach((page, i) => {
      const delay = i / PAGE_COUNT;
      const lift = between(time, 2.7 + delay * .5, 4.3 + delay * .2);
      const spread = between(time, 4.3 + delay * .5, 6.8 + delay * .2);
      const theta = i * .23;
      page.object.position.set(mix(Math.sin(theta) * lift * .7, page.target.x, spread), mix(.025 + i * .013 + lift * (i * .17 + .7), page.target.y, spread), mix(Math.cos(theta) * lift * .7, page.target.z, spread));
      page.object.rotation.y = mix(theta * lift * .33 - .18, page.angle, spread);
      page.object.scale.setScalar(mix(1, i < 4 ? 1.12 : .46 + delay * .24, spread));
      const vertices = page.object.geometry.attributes.position;
      for (let j = 0; j < vertices.array.length; j++) vertices.array[j] = mix(page.original[j], page.coast[j], spread);
      vertices.needsUpdate = true;
      if (spread > 0 && spread < 1) page.object.geometry.computeVertexNormals();
      page.object.material.color.copy(shade).lerp(page.tint, spread);
      page.vegetation.visible = spread > .45; page.vegetation.scale.setScalar(between(spread, .45, 1));
    });
    sea.material.opacity = spreading;
    clouds.children[0].material.opacity = Math.sin(arrival * Math.PI) * .75;
    clouds.position.z = -arrival * 8;
    const approach = between(time, 0, 1.8);
    const portrait = camera.aspect < .8 ? 1.35 : 1;
    camera.position.set(mix(mix(7, 5.4, approach), -5.7, spreading), mix(mix(9.5, 7.6, approach), 15.4, spreading) * portrait, mix(mix(13, 10.8, approach), 22, spreading) * portrait);
    camera.position.y -= arrival * 8;
    camera.position.z -= arrival * 10;
    camera.lookAt(-arrival * 5, mix(1.8, -.15, spreading), -arrival * 3);
    renderer.setClearAlpha(1 - between(time, 7.65, DURATION));
    canvas.style.opacity = String(1 - between(time, 7.8, DURATION));
    renderer.render(scene, camera);
    state.drawcalls = renderer.info.render.calls;
  }

  function tick(now) {
    if (settled || state.disposed) return;
    if (startedAt === undefined) startedAt = now;
    state.elapsed = Math.min(DURATION, (now - startedAt) / 1000);
    try {
      update(state.elapsed);
      if (state.elapsed >= DURATION) finish();
      else frame = requestAnimationFrame(tick);
    } catch (error) { finish(error); }
  }

  function play() {
    if (promise) return promise;
    promise = new Promise((resolve, reject) => { resolvePlay = resolve; rejectPlay = reject; });
    if (settled) { resolvePlay(); return promise; }
    if (reducedMotion || state.disposed) { finish(); return promise; }
    try { state.running = true; build(); update(0); frame = requestAnimationFrame(tick); }
    catch (error) { finish(error); }
    return promise;
  }

  return {
    play,
    skip() { finish(); },
    dispose() { if (state.disposed) return; state.disposed = true; finish(); cleanup(); state.phase = 'disposed'; },
    getState() { return { ...state }; },
  };
}

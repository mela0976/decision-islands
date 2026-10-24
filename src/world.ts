import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './world.css';
import { createLibraryScene } from './library-scene';
import { createExplorerEngine } from './explorer-scene';
import { ENTRANCE_DURATION_MS, sampleEntrance } from './entrance';
import { HOLIDAYS } from './season';
import type { Season } from './season';
import type { ExplorerData, ExplorerEngine, ExplorerEvent, ExplorerSelection, ExplorerState, NpcSpeechCue } from './explorer-types';

type Phase = 'cosmos' | 'transition' | 'islands' | 'disposed';
type Options = {
  reducedMotion: boolean; season?: Season; language?: 'zh' | 'en';
  onSelection?(selection: ExplorerSelection): void; onMinute?(minute: number): void;
  onEvents?(events: readonly ExplorerEvent[]): void; onFallback?(fallback: boolean, message?: string): void;
};

export function createWorld(container: HTMLElement, options: Options) {
  const compact = matchMedia('(max-width: 800px)').matches;
  const entranceDuration = ENTRANCE_DURATION_MS;
  let phase: Phase = 'cosmos';
  let enabled = !options.reducedMotion;
  let season: Season = options.season ?? 'christmas';
  let ticking = false;
  let frame = 0, lastTick = 0, lastRender = 0, elapsed = 0;
  let visible = true, renderable = false, width = 1, height = 1;
  let libraryShadersReady = false, engineShadersReady = false, prepareVersion = 0;
  const pendingCompiles = new Set<Promise<unknown>>();
  let gpuDisposed = false;
  let renderer: THREE.WebGLRenderer | undefined;
  let environmentTarget: THREE.WebGLRenderTarget | undefined;
  let engine: ExplorerEngine | undefined;
  let explorerState: ExplorerState | undefined;
  let finishEnter: (() => void) | undefined;
  let enterPromise: Promise<void> | undefined;
  const english = options.language === 'en';
  const root = document.createElement('div');
  root.className = 'island-world';
  root.dataset.phase = phase;
  root.dataset.season = season;
  const labelHost = document.createElement('div');
  labelHost.className = 'explorer-label-host';
  labelHost.inert = true;
  const fallback = document.createElement('div');
  fallback.className = 'world-fallback-map';
  fallback.setAttribute('aria-hidden', 'true');
  const veil = document.createElement('div');
  veil.className = 'entrance-veil';
  veil.setAttribute('aria-hidden', 'true');
  const controls = document.createElement('div');
  controls.className = 'entrance-controls';
  controls.inert = true;
  const caption = document.createElement('span');
  caption.textContent = english ? 'Approaching the books' : '走近書的記憶';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.textContent = english ? 'Skip transition' : '略過轉場';
  skip.onclick = () => completeEnter();
  controls.append(caption, skip);
  root.append(fallback, labelHost, veil, controls);
  container.append(root);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe4d7bd);
  const camera = new THREE.PerspectiveCamera(52, 1, .1, 180);
  const libraryScene = createLibraryScene(season);
  scene.add(libraryScene.group);
  const cosmos = new THREE.Group();
  cosmos.visible = false;
  scene.add(cosmos);
  cosmos.add(new THREE.HemisphereLight(0xfff6e4, 0x122236, 1.7));
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const pageMaterial = new THREE.MeshStandardMaterial({ color: 0xeadcc0, roughness: .85 });
  const coverMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .7 });
  const pages = new THREE.InstancedMesh(cube, pageMaterial, 100);
  const covers = new THREE.InstancedMesh(cube, coverMaterial, 200);
  const spines = new THREE.InstancedMesh(cube, coverMaterial, 100);
  const bookTransform = new THREE.Object3D();
  const pieceTransform = new THREE.Object3D();
  const colors = [0xc66a42, 0x4e8180, 0xfff3d9, 0x95ac85];
  for (let i = 0; i < 100; i++) {
    const angle = i * .38, radius = 2.4 + i * .027;
    bookTransform.position.set(Math.cos(angle) * radius, i * .12 - 6, Math.sin(angle) * radius);
    bookTransform.rotation.y = -angle + .7;
    bookTransform.updateMatrix();
    pieceTransform.position.set(0, 0, 0);
    pieceTransform.scale.set(1.445, .2975, 1.02);
    pieceTransform.updateMatrix();
    pages.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(bookTransform.matrix, pieceTransform.matrix));
    for (const side of [-1, 1]) {
      pieceTransform.position.set(0, side * .17, 0);
      pieceTransform.scale.set(1.5725, .0595, 1.105);
      pieceTransform.updateMatrix();
      covers.setMatrixAt(i * 2 + (side === 1 ? 1 : 0), new THREE.Matrix4().multiplyMatrices(bookTransform.matrix, pieceTransform.matrix));
      covers.setColorAt(i * 2 + (side === 1 ? 1 : 0), new THREE.Color(colors[i % colors.length]));
    }
    pieceTransform.position.set(-.748, 0, 0);
    pieceTransform.scale.set(.0765, .34, 1.105);
    pieceTransform.updateMatrix();
    spines.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(bookTransform.matrix, pieceTransform.matrix));
    spines.setColorAt(i, new THREE.Color(colors[i % colors.length]));
  }
  cosmos.add(pages, covers, spines);
  const starPositions = new Float32Array(650 * 3);
  for (let i = 0; i < 650; i++) starPositions.set([Math.sin(i * 127.1) * 65, Math.cos(i * 311.7) * 45, Math.sin(i * 74.7) * 55], i * 3);
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xfff3d9, size: .075, transparent: true, opacity: .8 });
  cosmos.add(new THREE.Points(starGeometry, starMaterial));

  function setEntranceCamera(progress = 0) {
    const shot = sampleEntrance(progress, width / height);
    camera.aspect = width / height;
    camera.fov = shot.fov;
    camera.position.set(...shot.cameraPosition);
    camera.lookAt(...shot.cameraTarget);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
  function render() {
    if (phase === 'disposed' || !renderer || !renderable) return;
    const shot = phase === 'transition' ? sampleEntrance(elapsed / entranceDuration, width / height) : null;
    if (phase === 'islands' || shot?.stage === 'islands') {
      if (!engineShadersReady) return;
      renderer.toneMappingExposure = 1;
      engine?.render(renderer);
    } else {
      if (!libraryShadersReady) return;
      renderer.toneMappingExposure = libraryScene.group.visible ? 1 : 1.12;
      scene.environment = libraryScene.group.visible ? environmentTarget?.texture ?? null : null;
      scene.environmentIntensity = .18;
      renderer.render(scene, camera);
    }
    root.dataset.rendered = 'true';
    if (!root.dataset.firstFrameMs) {
      root.dataset.firstFrameMs = String(performance.now());
      root.dataset.firstFramePhase = phase;
    }
    if ((phase === 'islands' || shot?.stage === 'islands') && !root.dataset.islandFrameMs) root.dataset.islandFrameMs = String(performance.now());
  }
  function tick(now: number) {
    frame = 0;
    if (phase === 'disposed' || !visible || document.hidden) return;
    ticking = true;
    const delta = lastTick ? Math.max(0, (now - lastTick) / 1000) : 0;
    lastTick = now;
    let continuous = false;
    if (phase === 'cosmos') {
      if (enabled && renderable) libraryScene.update(delta);
      continuous = enabled && renderable;
    } else if (phase === 'transition') {
      if (enabled && libraryScene.group.visible) libraryScene.update(delta);
      elapsed += delta * 1000;
      const progress = Math.min(1, elapsed / entranceDuration);
      const shot = sampleEntrance(progress, width / height);
      libraryScene.group.visible = shot.libraryVisible;
      cosmos.visible = shot.cosmosVisible;
      libraryScene.group.scale.setScalar(shot.libraryScale);
      cosmos.position.set(0, 8, -6);
      cosmos.scale.setScalar(shot.cosmosScale);
      cosmos.rotation.y += delta * .35;
      veil.style.opacity = String(shot.veil);
      root.dataset.entranceStage = shot.stage;
      caption.textContent = english ? ({ library: 'Approaching the books', cosmos: 'Through a universe of ideas', islands: 'Arriving at Decision Islands' })[shot.stage] : ({ library: '走近書的記憶', cosmos: '穿過觀點的宇宙', islands: '抵達決策群島' })[shot.stage];
      scene.background = new THREE.Color(shot.stage === 'cosmos' ? 0x080f1c : 0xe4d7bd);
      setEntranceCamera(progress);
      if (progress === 1) completeEnter();
      continuous = phase === 'transition';
    } else if (phase === 'islands' && engine && renderable) {
      const result = engine.update(enabled ? delta : 0);
      continuous = result.continuous && enabled;
    }
    if (now - lastRender >= (phase === 'cosmos' ? 1000 / 24 : 1000 / 30) || !continuous || phase === 'transition') {
      lastRender = now;
      render();
    }
    ticking = false;
    if (continuous && !frame) frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (!frame && phase !== 'disposed' && visible && !document.hidden) { if (!ticking) lastTick = 0; frame = requestAnimationFrame(tick); }
  }
  function activateEngine() {
    engine?.setActive(phase === 'islands' && visible && !document.hidden && renderable);
    labelHost.inert = phase !== 'islands' || !renderable;
  }
  function completeEnter() {
    if (phase === 'disposed') return;
    phase = 'islands';
    root.dataset.phase = phase;
    controls.inert = true;
    veil.style.opacity = '0';
    libraryScene.group.visible = false;
    cosmos.visible = false;
    activateEngine();
    render();
    finishEnter?.();
    finishEnter = undefined;
    wake();
  }
  function markFallback(message: string) {
    renderable = false;
    root.dataset.fallback = 'true';
    engine?.setActive(false);
    labelHost.inert = true;
    options.onFallback?.(true, message);
  }
  function disposeGpu() {
    if (gpuDisposed) return;
    gpuDisposed = true;
    libraryScene.dispose();
    pages.dispose(); covers.dispose(); spines.dispose();
    cube.dispose(); pageMaterial.dispose(); coverMaterial.dispose(); starGeometry.dispose(); starMaterial.dispose();
    environmentTarget?.dispose(); renderer?.dispose();
  }
  function retainCompile(promise: Promise<unknown>) {
    pendingCompiles.add(promise);
    const release = () => {
      pendingCompiles.delete(promise);
      if (phase === 'disposed' && !pendingCompiles.size) disposeGpu();
    };
    void promise.then(release, release);
  }
  function contextLost(event: Event) {
    event.preventDefault();
    markFallback(english ? '3D graphics stopped. Reading and the theme map remain available.' : '3D 畫面已停止，仍可使用主題地圖與完整閱讀。');
    completeEnter();
  }
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !compact, alpha: true, powerPreference: 'low-power' });
    renderer.debug.checkShaderErrors = false;
    renderer.shadowMap.enabled = !compact;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    if (!compact) {
      const room = new RoomEnvironment();
      const generator = new THREE.PMREMGenerator(renderer);
      environmentTarget = generator.fromScene(room, .04);
      room.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      room.dispose(); generator.dispose();
    }
    scene.environment = environmentTarget?.texture ?? null;
    scene.environmentIntensity = .18;
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', english ? 'Interactive reading islands. Use arrow keys to rotate; choose a theme from the list to explore.' : '互動閱讀群島。可用方向鍵旋轉，或從主題清單選擇探索。');
    renderer.domElement.tabIndex = 0;
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    root.prepend(renderer.domElement);
    renderable = true;
  } catch {
    markFallback(english ? '3D is unavailable. Use the accessible theme map and article directory.' : '此瀏覽器無法啟用 3D，仍可使用主題地圖與文章目錄。');
  }
  function resize() {
    const bounds = container.getBoundingClientRect();
    width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
    renderer?.setPixelRatio(Math.min(devicePixelRatio, compact ? 1 : 1.75));
    renderer?.setSize(width, height, false);
    engine?.resize(width, height);
    if (phase !== 'islands') setEntranceCamera(phase === 'transition' ? elapsed / entranceDuration : 0);
    render(); wake();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    lastTick = 0;
    if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; }
    activateEngine(); if (visible) wake();
  });
  intersectionObserver.observe(container);
  const onVisibility = () => {
    lastTick = 0;
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
    activateEngine(); if (!document.hidden) wake();
  };
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  // KHR_parallel_shader_compile lets the browser keep handling input while
  // the first library programs link. Drawing first would force a GPU readback.
  if (renderer && renderable) {
    const compilation = renderer.compileAsync(scene, camera);
    retainCompile(compilation);
    void compilation.then(() => {
      if (phase === 'disposed') return;
      libraryShadersReady = true;
      render(); wake();
    }).catch(() => {
      if (phase !== 'disposed') markFallback(english ? '3D could not initialize. Reading remains available.' : '3D 暫時無法載入，仍可使用閱讀目錄。');
    });
  }
  return {
    enter() {
      if (phase === 'disposed' || phase === 'islands') return Promise.resolve();
      if (enterPromise) return enterPromise;
      enterPromise = new Promise<void>(resolve => { finishEnter = resolve; });
      if (compact || !enabled || !renderable) completeEnter();
      else { phase = 'transition'; root.dataset.phase = phase; controls.inert = false; elapsed = 0; lastTick = 0; wake(); }
      return enterPromise;
    },
    setData(data: ExplorerData) {
      if (!renderable || !renderer) { options.onFallback?.(true); return; }
      if (engine) engine.setData(data);
      else engine = createExplorerEngine({ data, canvas: renderer.domElement, labelHost, invalidate: wake,
        onSelection: selection => options.onSelection?.(selection), onMinute: minute => options.onMinute?.(minute), onEvents: events => options.onEvents?.(events) });
      if (explorerState) engine.setState(explorerState);
      engine.resize(width, height);
      engineShadersReady = false;
      const version = ++prepareVersion;
      const preparation = engine.prepare(renderer);
      retainCompile(preparation);
      void preparation.then(() => {
        if (phase === 'disposed' || version !== prepareVersion) return;
        engineShadersReady = true;
        render(); wake();
      }).catch(() => { if (phase !== 'disposed' && version === prepareVersion) markFallback(english ? '3D could not initialize. Reading remains available.' : '3D 暫時無法載入，仍可使用閱讀目錄。'); });
      activateEngine(); render(); wake();
    },
    setState(state: Readonly<ExplorerState>) { explorerState = { ...state }; engine?.setState(state); wake(); },
    setSelection(selection: ExplorerSelection, focus = true) { engine?.setSelection(selection, { focus }); wake(); },
    setNpcSpeech(cue: NpcSpeechCue | null) { engine?.setNpcSpeech(cue); wake(); },
    setSeason(value: Season) { season = value; root.dataset.season = value; libraryScene.setSeason(value); starMaterial.color.set(HOLIDAYS[value].glow); wake(); render(); },
    setMotion(value: boolean) {
      enabled = value; lastTick = 0;
      if (!enabled && phase === 'transition') completeEnter();
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      render(); wake();
    },
    reset() { if (explorerState) { engine?.setState({ ...explorerState, birdseye: false }); engine?.setSelection(null); } wake(); },
    thumbnail(itemId: string) { return renderer && renderable ? engine?.thumbnail(itemId, renderer) ?? null : null; },
    getWalkers() { return engine?.getWalkers() ?? []; },
    getFallback() { return !renderable; },
    dispose() {
      if (phase === 'disposed') return;
      phase = 'disposed';
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect(); intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      renderer?.domElement.removeEventListener('webglcontextlost', contextLost);
      engine?.dispose();
      if (!pendingCompiles.size) disposeGpu();
      root.remove(); finishEnter?.(); finishEnter = undefined;
    },
  };
}

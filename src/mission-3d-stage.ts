import * as THREE from 'three';
import { createMission3DAssets } from './mission-3d-assets';
import { resolveMissionChangeCue, resolveMissionEntityPose } from './mission-change-cues';
import type { Mission3DAssets, Mission3DModel, Mission3DStage, Mission3DSnapshot } from './mission-3d-types';
import type { MissionSceneEntity, MissionStageInput, MissionVisualFrame } from './mission-stage-types';

const ACTORS = new Set(['adult', 'child', 'elder', 'robot']);
const DURATION = 1400;
const MIN_USER_ZOOM = .65;
const MAX_USER_ZOOM = 2.4;
const ZOOM_STEP = 1.2;
const WHEEL_DELTA_LIMIT = 240;
const smooth = (t: number) => { const v = THREE.MathUtils.clamp(t, 0, 1); return v * v * (3 - 2 * v); };
const mix = THREE.MathUtils.lerp;
export function getMission3DControlsHelp(language: 'zh' | 'en'): string {
  return language === 'zh'
    ? '拖曳旋轉場景；滾輪或 +／− 縮放；雙擊重設視角，按 0 重設縮放。'
    : 'Drag to rotate. Use the mouse wheel or +/− to zoom. Double-click to reset the view, or press 0 to reset zoom.';
}
type Pose = { position: THREE.Vector3; yaw: number; joints: number[]; scale: number; opacity: number };
type Entity = { model: Mission3DModel; definition: MissionSceneEntity; start: Pose; end: Pose };
type Signal = { root: THREE.Group; token: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; kind: string };
const jointNames = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;
function readPose(entry: Entity): Pose {
  return { position: entry.model.root.position.clone(), yaw: entry.model.root.rotation.y, joints: jointNames.flatMap(name => entry.model.joints ? entry.model.joints[name].rotation.toArray().slice(0, 3) as number[] : [0, 0, 0]), scale: entry.model.root.scale.x, opacity: entry.model.root.userData.opacity ?? 1 };
}
function handPosition(entry: Entity): THREE.Vector3 {
  const arm = entry.model.joints?.rightArm;
  entry.model.root.updateWorldMatrix(true, true);
  const hand = arm?.children.find(child => child.name.endsWith('-hand'));
  return hand ? hand.getWorldPosition(new THREE.Vector3()) : entry.model.root.position.clone().add(new THREE.Vector3(0, .8, .4));
}
function terminalPose(entity: MissionSceneEntity, frame: MissionVisualFrame): Pose {
  const pose = resolveMissionEntityPose(entity, frame);
  return {...pose, position: new THREE.Vector3(...pose.position)};
}

export function createMission3DStage(host: HTMLElement, language: 'zh' | 'en', onFallback?: (fallback: boolean) => void): Mission3DStage {
  const controlsHelp = getMission3DControlsHelp(language);
  const canvas = document.createElement('canvas');
  canvas.className = 'mission-stage-canvas';
  canvas.dataset.renderer = 'fallback';
  canvas.dataset.phase = 'ready';
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  canvas.setAttribute('title', controlsHelp);
  canvas.setAttribute('aria-label', controlsHelp);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  host.append(canvas);
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-8.5, 8.5, 4.25, -4.25, .1, 70);
  const focus = new THREE.Vector3(0, .65, 0);
  let cameraYaw = .55;
  let userZoom = 1;
  const aimCamera = () => { camera.position.set(Math.sin(cameraYaw) * 12, 9, Math.cos(cameraYaw) * 12); camera.lookAt(focus); };
  aimCamera();
  let renderer: THREE.WebGLRenderer | null = null;
  let assets: Mission3DAssets | null = null;
  let room: THREE.Group | null = null;
  let setting = '';
  let disposed = false, failed = false, active = true, motion = true;
  let current: MissionStageInput | null = null, frame: MissionVisualFrame | null = null;
  let signature = '', missionKey = '', progress = 1, startTime = 0, raf = 0, renderCount = 0;
  let phase: Mission3DSnapshot['phase'] = 'ready', phaseMetadata = '';
  let viewportWidth = 720, viewportHeight = 360;
  const entities = new Map<string, Entity>();
  const signals: Signal[] = [];
  const effects: {root: THREE.Group; action: string; target: string}[] = [];
  const privateMaterials = new Map<THREE.Material, { opacity: number; transparent: boolean }>();
  const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const cueMaterials = new Map<THREE.MeshStandardMaterial | THREE.MeshBasicMaterial, { color: THREE.Color; emissive?: THREE.Color; intensity?: number }>();
  let cueTimer: ReturnType<typeof setTimeout> | null = null, cueToken: number | null = null;
  let cueEntityIds: string[] = [];
  const clearCue = () => {
    if (cueTimer != null) clearTimeout(cueTimer);
    cueTimer = null;
    for (const [material, base] of cueMaterials) {
      material.color.copy(base.color);
      if (material instanceof THREE.MeshStandardMaterial && base.emissive) { material.emissive.copy(base.emissive); material.emissiveIntensity = base.intensity!; }
    }
    cueMaterials.clear(); cueEntityIds = [];
  };
  const applyCue = () => {
    const command = current?.comparisonCue;
    if (!command) { const highlighted = cueEntityIds.length > 0; clearCue(); if (highlighted) render(); return; }
    if (command.token === cueToken) return;
    clearCue(); cueToken = command.token;
    if (!current || !active || document.hidden || !host.isConnected || !renderer || failed || current.comparisonView == null || (current.previewChoiceId ?? current.choiceId) == null || !Number.isFinite(command.durationMs) || command.durationMs <= 0) return;
    const changed = new Set(resolveMissionChangeCue(current).entityIds);
    for (const id of new Set(command.entityIds)) {
      const entry = entities.get(id);
      if (!changed.has(id) || !entry?.model.root.visible || (entry.model.root.userData.opacity ?? 1) <= .005) continue;
      cueEntityIds.push(id);
      entry.model.root.traverse(object => {
        if (!(object instanceof THREE.Mesh) || !object.visible) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) || cueMaterials.has(material)) continue;
          cueMaterials.set(material, {color: material.color.clone(), ...(material instanceof THREE.MeshStandardMaterial ? {emissive: material.emissive.clone(), intensity: material.emissiveIntensity} : {})});
          material.color.lerp(new THREE.Color(0xffd071), .42);
          if (material instanceof THREE.MeshStandardMaterial) { material.emissive.set(0xffbc52); material.emissiveIntensity = .48; }
        }
      });
    }
    if (cueEntityIds.length) { cueTimer = setTimeout(() => { clearCue(); render(); }, command.durationMs); render(); }
  };
  const removeEntity = (entry: Entity) => {
    scene.remove(entry.model.root);
    entry.model.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (privateMaterials.delete(material)) material.dispose();
      const original = originalMaterials.get(object);
      if (original) { object.material = original; originalMaterials.delete(object); }
    });
  };
  const owned = new Set<THREE.BufferGeometry | THREE.Material>();
  const disposeSignals = () => {
    signals.forEach(signal => scene.remove(signal.root));
    effects.forEach(effect => scene.remove(effect.root)); effects.length = 0;
    signals.length = 0;
    owned.forEach(resource => resource.dispose());
    owned.clear();
  };
  const cancel = () => { if (raf) cancelAnimationFrame(raf); raf = 0; canvas.dataset.animating = 'false'; };
  const restingPhase = (): Mission3DSnapshot['phase'] => current?.comparisonView !== 'before' && (current?.previewChoiceId != null || current?.choiceId != null) ? 'result' : 'ready';
  const publishPhase = (next: Mission3DSnapshot['phase']) => {
    const detail = {phase: next, choiceId: current?.previewChoiceId ?? current?.choiceId ?? null, preview: current?.previewChoiceId != null, comparisonView: current?.comparisonView ?? 'after'};
    const metadata = JSON.stringify(detail);
    phase = next; canvas.dataset.phase = phase;
    if (metadata === phaseMetadata) return;
    phaseMetadata = metadata;
    canvas.dispatchEvent(new CustomEvent('mission-stage-phase', {bubbles: true, detail}));
  };
  const projectedBounds = (root: THREE.Group) => {
    const box = new THREE.Box2();
    root.updateWorldMatrix(true, true);
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !object.visible) return;
      const geometry = object.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!;
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new THREE.Vector3(x, y, z).applyMatrix4(object.matrixWorld).project(camera);
        box.expandByPoint(new THREE.Vector2(point.x, point.y));
      }
    });
    return box;
  };
  const fitCamera = () => {
    const box = new THREE.Box2();
    camera.zoom = 1;
    camera.left = -1; camera.right = 1; camera.top = 1; camera.bottom = -1;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const selectedId = current?.previewChoiceId ?? current?.choiceId;
    const compared = current?.comparisonView != null && selectedId != null;
    if (compared && current) {
      for (const comparedFrame of [current.definition.initial, current.definition.choices[selectedId!] ?? current.definition.initial]) {
        for (const definition of comparedFrame.entities) {
          if ((definition.opacity ?? 1) <= .04) continue;
          const entry = entities.get(definition.id);
          if (!entry) continue;
          const end = terminalPose(definition, comparedFrame);
          const model = entry.definition.kind === definition.kind ? entry.model : assets!.entity(definition.kind, definition.id);
          const measurement = {...entry, model};
          const saved = readPose(measurement), savedVisible = model.root.visible;
          model.root.position.copy(end.position); model.root.rotation.y = end.yaw; model.root.scale.setScalar(end.scale);
          jointNames.forEach((name, index) => model.joints?.[name].rotation.set(...end.joints.slice(index * 3, index * 3 + 3) as [number, number, number]));
          model.root.visible = true; box.union(projectedBounds(model.root));
          model.root.position.copy(saved.position); model.root.rotation.y = saved.yaw; model.root.scale.setScalar(saved.scale);
          jointNames.forEach((name, index) => model.joints?.[name].rotation.set(...saved.joints.slice(index * 3, index * 3 + 3) as [number, number, number]));
          model.root.visible = savedVisible;
        }
      }
    } else for (const entry of entities.values()) if (entry.model.root.visible && (entry.model.root.userData.opacity ?? 1) > .04) box.union(projectedBounds(entry.model.root));
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector2()), size = box.getSize(new THREE.Vector2());
      const aspect = viewportWidth / viewportHeight;
      const topMargin = Math.min(.36, 54 / viewportHeight), bottomMargin = .06;
      const selected = current?.previewChoiceId != null || current?.choiceId != null;
      const framing = compared ? 1 : selected ? mix(1.12, 1, smooth(progress / .34)) : 1.12;
      const halfHeight = Math.max(size.y / (2 * (1 - topMargin - bottomMargin)), size.x / (2 * aspect * .88), 1.6) * framing;
      center.y += halfHeight * (topMargin - bottomMargin);
      camera.left = center.x - halfHeight * aspect; camera.right = center.x + halfHeight * aspect;
      camera.top = center.y + halfHeight; camera.bottom = center.y - halfHeight;
      camera.updateProjectionMatrix();
    }
    camera.zoom = userZoom;
    canvas.dataset.zoom = String(userZoom);
    camera.updateProjectionMatrix();
  };
  const render = () => { if (renderer && !failed && !disposed) { fitCamera(); renderer.render(scene, camera); renderCount++; } };
  const resize = () => {
    if (!renderer || disposed) return;
    const bounds = host.getBoundingClientRect();
    const width = Math.max(1, bounds.width || 720), height = Math.max(1, bounds.height || width / 2);
    viewportWidth = width; viewportHeight = height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 600 ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    render();
  };
  const fail = () => {
    clearCue(); failed = true; cancel(); progress = 1;
    entities.forEach(entry => apply(entry, 1)); applySignals(1);
    publishPhase(restingPhase());
    canvas.dataset.renderer = 'fallback';
    onFallback?.(true);
  };
  const initialize = () => {
    if (renderer || failed || !active || !current || disposed) return;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      scene.add(new THREE.HemisphereLight(0xfff4de, 0x718f8c, 2.5));
      const key = new THREE.DirectionalLight(0xffe5bf, 3.3);
      key.position.set(-3, 9, 5); key.castShadow = true;
      key.shadow.mapSize.set(512, 512); key.shadow.camera.left = -7; key.shadow.camera.right = 7;
      key.shadow.camera.top = 6; key.shadow.camera.bottom = -6; key.shadow.normalBias = .04;
      scene.add(key);
      assets = createMission3DAssets();
      canvas.dataset.renderer = 'webgl'; onFallback?.(false); resize();
    } catch { renderer?.dispose(); renderer = null; fail(); }
  };
  const apply = (entry: Entity, t: number) => {
    const { start, end, model } = entry;
    const approach = smooth(t / .34), perform = smooth((t - .30) / .40), settle = smooth((t - .78) / .22);
    if (t === 1) model.root.position.copy(end.position);
    else model.root.position.lerpVectors(start.position, end.position, approach);
    const interaction = frame?.actions?.find(action => action.prop === entry.definition.id);
    const operator = interaction && entities.get(interaction.actor);
    const handling = smooth((t - .30) / .16) * (1 - smooth((t - .82) / .18));
    if (operator && !model.joints && t > .30 && t < 1) {
      const hand = handPosition(operator);
      const receiver = interaction.kind === 'handoff' && entities.get(interaction.target);
      if (receiver) {
        const receivingHand = handPosition(receiver);
        hand.lerp(receivingHand, smooth((t - .48) / .28));
      }
      hand.y -= .20 * end.scale;
      model.root.position.lerp(hand, handling);
    }
    const travels = start.position.distanceTo(end.position) > .08;
    const moving = travels && t < .34;
    const walkYaw = Math.atan2(end.position.x - start.position.x, end.position.z - start.position.z);
    const desiredYaw = travels ? walkYaw + Math.atan2(Math.sin(end.yaw - walkYaw), Math.cos(end.yaw - walkYaw)) * smooth((t - .27) / .20) : end.yaw;
    const delta = Math.atan2(Math.sin(desiredYaw - start.yaw), Math.cos(desiredYaw - start.yaw));
    model.root.rotation.y = start.yaw + delta * smooth(t / .23);
    if (t === 1) model.root.rotation.y = end.yaw;
    model.root.scale.setScalar(t === 1 ? end.scale : mix(start.scale, end.scale, smooth(t / .6)));
    const opacity = t === 1 ? end.opacity : mix(start.opacity, end.opacity, smooth(t / .65));
    model.root.userData.opacity = opacity;
    model.root.visible = opacity > .005;
    model.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const base = privateMaterials.get(material)!;
        material.transparent = base.transparent || opacity < .999;
        material.opacity = base.opacity * opacity;
      }
    });
    if (!model.joints) return;
    const gait = moving ? Math.sin(t * Math.PI * 15) * .48 * Math.sin(Math.PI * approach) : 0;
    const reach = smooth((t - .30) / .16) * (1 - settle);
    jointNames.forEach((name, index) => {
      const values = [0, 1, 2].map(axis => t === 1 ? end.joints[index * 3 + axis] : mix(start.joints[index * 3 + axis], end.joints[index * 3 + axis], smooth(t / .72)));
      if (name === 'leftLeg') values[0] += gait;
      if (name === 'rightLeg') values[0] -= gait;
      if (name === 'leftArm') values[0] -= gait * .65 + reach * .2;
      if (name === 'rightArm') values[0] += gait * .65 - reach * .68;
      if (name === 'torso') values[0] += reach * .18;
      if (name === 'head') values[1] += Math.sin(perform * Math.PI * 2) * .13 * (1 - settle);
      model.joints![name].rotation.set(values[0], values[1], values[2]);
    });
  };
  const applySignals = (t: number) => {
    effects.forEach(effect => { effect.root.visible = t >= .30; });
    for (const signal of signals) {
      const travel = smooth((t - .42) / .37);
      signal.token.position.lerpVectors(signal.from, signal.to, travel);
      signal.token.position.y += Math.sin(Math.PI * travel) * .5;
      signal.root.visible = t >= .30;
      signal.token.scale.setScalar(signal.kind === 'pause' ? 1 : .8 + Math.sin(Math.PI * travel) * .3);
    }
  };
  const settle = () => { cancel(); progress = 1; entities.forEach(entry => apply(entry, 1)); applySignals(1); publishPhase(restingPhase()); render(); };
  const canAnimate = () => active && motion && !media.matches && !document.hidden && host.isConnected && !!renderer && !failed;
  const canHandleZoomInput = () => {
    if (disposed || !active || document.hidden || !host.isConnected || !canvas.isConnected || !renderer || failed || canvas.getClientRects().length === 0) return false;
    for (let element: HTMLElement | null = canvas; element; element = element.parentElement) {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    const bounds = canvas.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0;
  };
  const setUserZoom = (value: number) => {
    if (!Number.isFinite(value)) return false;
    const next = THREE.MathUtils.clamp(value, MIN_USER_ZOOM, MAX_USER_ZOOM);
    if (next === userZoom) return false;
    userZoom = next;
    render();
    return true;
  };
  const zoomBy = (factor: number) => Number.isFinite(factor) && factor > 0 && setUserZoom(userZoom * factor);
  const tick = (now: number) => {
    raf = 0;
    if (!canAnimate()) { settle(); return; }
    progress = Math.min(1, (now - startTime) / DURATION);
    publishPhase(progress < .34 ? 'approach' : progress < .78 ? 'interact' : 'result');
    entities.forEach(entry => apply(entry, progress)); applySignals(progress); render();
    if (progress < 1) raf = requestAnimationFrame(tick); else canvas.dataset.animating = 'false';
  };
  const begin = () => { cancel(); progress = 0; startTime = performance.now(); canvas.dataset.animating = 'true'; publishPhase('approach'); raf = requestAnimationFrame(tick); };
  const buildSignals = () => {
    disposeSignals();
    if (!frame) return;
    if (current?.comparisonView != null && current.comparisonView !== 'before' && (current.previewChoiceId ?? current.choiceId) != null) {
      const focused = new Set<string>();
      for (const action of frame.actions ?? []) for (const id of [action.target, action.prop]) {
        if (!id || focused.has(id)) continue;
        const entry = entities.get(id);
        if (!entry || entry.end.opacity <= .04) continue;
        focused.add(id);
        const root = new THREE.Group(); root.name = `action-focus-${id}`;
        // Props sit on the work surface; a floor marker would disappear under its table.
        root.position.copy(entry.end.position); root.position.y += ACTORS.has(entry.definition.kind) ? .025 : .012;
        const discGeometry = new THREE.CircleGeometry(.49, 32); owned.add(discGeometry);
        const discMaterial = new THREE.MeshBasicMaterial({color: 0xe8bd72, side: THREE.DoubleSide, transparent: true, opacity: .32, depthWrite: false}); owned.add(discMaterial);
        const disc = new THREE.Mesh(discGeometry, discMaterial); disc.rotation.x = -Math.PI / 2; root.add(disc);
        const geometry = new THREE.RingGeometry(.49, .59, 32); owned.add(geometry);
        const material = new THREE.MeshBasicMaterial({color: 0xc4a05e, side: THREE.DoubleSide, transparent: true, opacity: .8, depthWrite: false}); owned.add(material);
        const ring = new THREE.Mesh(geometry, material); ring.rotation.x = -Math.PI / 2; root.add(ring);
        scene.add(root); effects.push({root, action: action.kind, target: id});
      }
    }
    for (const flow of frame.flows) {
      const source = entities.get(flow.from), target = entities.get(flow.to);
      if (!source || !target) continue;
      const from = source.end.position.clone(), to = target.end.position.clone();
      from.y += source.model.joints ? 1 : .2; to.y += target.model.joints ? 1 : .2;
      const root = new THREE.Group(); root.name = flow.id;
      const color = flow.kind === 'pause' ? 0xd9534f : flow.kind === 'review' ? 0xd3a44e : 0x5d9e90;
      const material = new THREE.MeshStandardMaterial({color, roughness: .65}); owned.add(material);
      const geometry = flow.kind === 'review' ? new THREE.TorusGeometry(.32, .065, 6, 20) : flow.kind === 'pause' ? new THREE.BoxGeometry(.56, .18, .13) : new THREE.BoxGeometry(.34, .4, .09);
      owned.add(geometry);
      const token = new THREE.Mesh(geometry, material); token.castShadow = true; root.add(token);
      if (flow.kind === 'pause') {
        const ringGeometry = new THREE.TorusGeometry(.34, .05, 6, 8); owned.add(ringGeometry);
        const ring = new THREE.Mesh(ringGeometry, material); token.add(ring);
      }
      const curve = new THREE.QuadraticBezierCurve3(from, from.clone().lerp(to, .5).add(new THREE.Vector3(0, .45, 0)), to);
      const trailGeometry = new THREE.TubeGeometry(curve, 16, .035, 4, false); owned.add(trailGeometry);
      const trailMaterial = new THREE.MeshStandardMaterial({color, transparent: true, opacity: .45}); owned.add(trailMaterial);
      root.add(new THREE.Mesh(trailGeometry, trailMaterial));
      const haloGeometry = new THREE.TorusGeometry(.48, .045, 6, 28); owned.add(haloGeometry);
      const halo = new THREE.Mesh(haloGeometry, trailMaterial);
      halo.rotation.x = -Math.PI / 2;
      halo.position.copy(target.end.position); halo.position.y += .035;
      root.add(halo);
      scene.add(root); signals.push({root, token, from, to, kind: flow.kind});
    }
  };
  const sync = (animate: boolean) => {
    if (!assets || !frame || !current) return;
    if (setting !== current.definition.setting) {
      if (room) scene.remove(room);
      const nextRoom = assets.room(current.definition.setting);
      room = nextRoom; scene.add(nextRoom); setting = current.definition.setting;
    }
    const selectedId = current.previewChoiceId ?? current.choiceId;
    const definitions = new Map(frame.entities.map(entity => [entity.id, entity]));
    if (current.comparisonView != null && selectedId != null) {
      for (const compared of [current.definition.initial, current.definition.choices[selectedId] ?? current.definition.initial]) for (const entity of compared.entities) {
        if (!definitions.has(entity.id)) definitions.set(entity.id, {...entity, opacity: 0});
      }
    }
    const present = new Set(definitions.keys());
    for (const [id, entry] of entities) if (!present.has(id)) { removeEntity(entry); entities.delete(id); }
    for (const definition of definitions.values()) {
      let entry = entities.get(definition.id);
      if (entry && entry.definition.kind !== definition.kind) { removeEntity(entry); entities.delete(definition.id); entry = undefined; }
      const end = terminalPose(definition, frame);
      if (!entry) {
        const model = assets.entity(definition.kind, definition.id);
        const clones = new Map<THREE.Material, THREE.Material>();
        model.root.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          originalMaterials.set(object, object.material);
          const clone = (material: THREE.Material) => {
            let copy = clones.get(material);
            if (!copy) { copy = material.clone(); clones.set(material, copy); privateMaterials.set(copy, {opacity: material.opacity, transparent: material.transparent}); }
            return copy;
          };
          object.material = Array.isArray(object.material) ? object.material.map(clone) : clone(object.material);
        });
        model.root.name = definition.id;
        entry = {model, definition, start: {...end, position: end.position.clone(), joints: [...end.joints], opacity: animate ? 0 : end.opacity}, end};
        entities.set(definition.id, entry); scene.add(model.root);
      } else { entry.start = readPose(entry); entry.end = end; entry.definition = definition; }
    }
    buildSignals();
    canvas.dataset.setting = current.definition.setting;
    canvas.setAttribute('aria-label', `${current.definition.title[language]} · ${frame.description[language]} · ${controlsHelp}`);
    if (animate && canAnimate()) begin(); else settle();
  };
  const onVisibility = () => { if (document.hidden) { clearCue(); settle(); } };
  const onMotion = () => { if (media.matches) settle(); };
  const onContextLost = (event: Event) => { event.preventDefault(); fail(); };
  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey || !canHandleZoomInput() || !Number.isFinite(event.deltaY) || event.deltaY === 0) return;
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? 1
      : event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? Math.max(1, window.innerHeight) : Number.NaN;
    const rawDelta = event.deltaY * unit;
    if (!Number.isFinite(rawDelta)) return;
    const delta = THREE.MathUtils.clamp(rawDelta, -WHEEL_DELTA_LIMIT, WHEEL_DELTA_LIMIT);
    if (zoomBy(Math.exp(-delta * .001))) event.preventDefault();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || !canHandleZoomInput()) return;
    const factor = event.key === '+' || event.key === '=' || event.code === 'NumpadAdd' ? ZOOM_STEP
      : event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract' ? 1 / ZOOM_STEP : null;
    if (factor !== null) { if (zoomBy(factor)) event.preventDefault(); return; }
    if ((event.key === '0' || event.code === 'Numpad0') && setUserZoom(1)) event.preventDefault();
  };
  const onDoubleClick = (event: MouseEvent) => {
    if (!canHandleZoomInput() || (userZoom === 1 && cameraYaw === .55)) return;
    userZoom = 1; cameraYaw = .55;
    aimCamera(); render(); event.preventDefault();
  };
  const observer = new ResizeObserver(resize); observer.observe(host);
  document.addEventListener('visibilitychange', onVisibility);
  media.addEventListener('change', onMotion);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('wheel', onWheel, {passive: false});
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('dblclick', onDoubleClick);
  let pointer: {id: number; x: number; yaw: number} | null = null;
  const onDown = (event: PointerEvent) => { pointer = {id: event.pointerId, x: event.clientX, yaw: cameraYaw}; canvas.setPointerCapture?.(event.pointerId); };
  const onMove = (event: PointerEvent) => { if (!pointer || event.pointerId !== pointer.id) return; cameraYaw = THREE.MathUtils.clamp(pointer.yaw + (event.clientX - pointer.x) * .003, .16, .86); aimCamera(); render(); };
  const onUp = () => { pointer = null; };
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
  return {
    update(input) {
      if (disposed) return;
      const choice = input.previewChoiceId ?? input.choiceId;
      const nextFrame = input.comparisonView === 'before' ? input.definition.initial : choice ? input.definition.choices[choice] ?? input.definition.initial : input.definition.initial;
      const physicalEntities = nextFrame.entities.map(({id, kind, x, y, scale, opacity, pose}) => [id, kind, x, y, scale ?? 1, opacity ?? 1, pose ?? 'idle']).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      const physicalFlows = nextFrame.flows.map(({id, from, to, kind}) => [id, from, to, kind]).sort((a, b) => a[0].localeCompare(b[0]));
      const nextSignature = JSON.stringify([input.key, input.definition.setting, physicalEntities, physicalFlows, nextFrame.actions ?? [], input.comparisonView ?? null, input.comparisonView != null ? choice : null]);
      current = input;
      canvas.dataset.comparisonView = input.comparisonView ?? 'after';
      canvas.setAttribute('aria-label', `${input.definition.title[language]} · ${nextFrame.description[language]} · ${controlsHelp}`);
      if (nextSignature === signature) { if (input.animate === false && progress < 1) settle(); else publishPhase(progress === 1 ? restingPhase() : phase); applyCue(); return; }
      clearCue();
      focus.set(0, .65, 0);
      aimCamera();
      camera.updateProjectionMatrix();
      const animate = input.animate !== false && input.comparisonView !== 'before' && missionKey === input.key && setting === input.definition.setting && choice !== null;
      if (missionKey !== input.key) { cameraYaw = .55; userZoom = 1; aimCamera(); }
      cancel(); signature = nextSignature; missionKey = input.key; frame = nextFrame;
      initialize(); sync(animate); applyCue();
    },
    setActive(value) { if (disposed) return; active = value; if (!value) { clearCue(); settle(); } else if (!renderer && current) { initialize(); sync(false); } },
    setMotion(value) { if (disposed) return; motion = value; if (!value) settle(); },
    replay() {
      if (disposed || !current || !frame || current.comparisonView === 'before' || !canAnimate()) return;
      clearCue();
      for (const [id, entry] of entities) {
        const initial = current.definition.initial.entities.find(entity => entity.id === id);
        entry.start = initial ? terminalPose(initial, current.definition.initial) : {...entry.end, position: entry.end.position.clone(), joints: [...entry.end.joints], opacity: 0};
      }
      entities.forEach(entry => apply(entry, 0)); applySignals(0); render(); begin();
    },
    snapshot(): Mission3DSnapshot {
      return {mode: renderer && !failed ? 'webgl' : 'fallback', animating: !!raf, progress, phase, comparisonView: current?.comparisonView ?? 'after', choiceId: current?.choiceId ?? null, previewChoiceId: current?.previewChoiceId ?? null,
        comparisonCue: {active: cueEntityIds.length > 0, token: cueToken, entityIds: [...cueEntityIds]},
        camera: {position: camera.position.toArray(), zoom: camera.zoom, left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom},
        effects: effects.map(effect => ({kind: 'action-focus', action: effect.action, target: effect.target, position: effect.root.position.toArray()})), entities: [...entities].map(([id, entry]) => {
        const bounds = projectedBounds(entry.model.root), size = bounds.getSize(new THREE.Vector2());
        return {id, kind: entry.definition.kind, position: entry.model.root.position.toArray(), rotation: entry.model.root.rotation.toArray().slice(0, 3) as number[], visible: entry.model.root.visible, joints: readPose(entry).joints, projected: {left: (bounds.min.x + 1) / 2 * viewportWidth, right: (bounds.max.x + 1) / 2 * viewportWidth, top: (1 - bounds.max.y) / 2 * viewportHeight, bottom: (1 - bounds.min.y) / 2 * viewportHeight, width: size.x / 2 * viewportWidth, height: size.y / 2 * viewportHeight}};
      }), flowCount: signals.length, renderCount};
    },
    dispose() {
      if (disposed) return;
      clearCue(); cancel(); disposed = true; observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility); media.removeEventListener('change', onMotion);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('dblclick', onDoubleClick);
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      disposeSignals(); entities.forEach(removeEntity); assets?.dispose(); privateMaterials.forEach((_base, material) => material.dispose()); privateMaterials.clear(); originalMaterials.clear();
      renderer?.dispose(); renderer?.forceContextLoss(); scene.clear(); entities.clear(); canvas.remove();
    },
  };
}

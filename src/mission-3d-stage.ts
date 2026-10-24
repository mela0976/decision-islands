import * as THREE from 'three';
import { createMission3DAssets } from './mission-3d-assets';
import type { Mission3DAssets, Mission3DModel, Mission3DStage, Mission3DSnapshot } from './mission-3d-types';
import type { MissionSceneEntity, MissionStageInput, MissionVisualFrame } from './mission-stage-types';

const ACTORS = new Set(['adult', 'child', 'elder', 'robot']);
const DURATION = 2100;
const smooth = (t: number) => { const v = THREE.MathUtils.clamp(t, 0, 1); return v * v * (3 - 2 * v); };
const mix = THREE.MathUtils.lerp;
const position = (entity: MissionSceneEntity) => new THREE.Vector3((entity.x - 50) * .12, ACTORS.has(entity.kind) ? 0 : .85, ACTORS.has(entity.kind) ? (entity.y - 75) * .1 + 1.3 : (entity.y - 60) * .07 - .4);
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
  const hand = arm?.children.reduce<THREE.Object3D | undefined>((lowest, child) => !lowest || child.position.y < lowest.position.y ? child : lowest, undefined);
  return hand ? hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -.12, 0)) : entry.model.root.position.clone().add(new THREE.Vector3(0, .8, .4));
}
function terminalPose(entity: MissionSceneEntity, frame: MissionVisualFrame): Pose {
  const joints = Array<number>(18).fill(0);
  const action = frame.actions?.find(item => item.actor === entity.id);
  const flow = frame.flows.find(item => item.from === entity.id || item.to === entity.id);
  const otherId = action?.target ?? (flow && (flow.from === entity.id ? flow.to : flow.from));
  const other = frame.entities.find(item => item.id === otherId);
  const point = position(entity), target = other ? position(other) : null;
  const yaw = ACTORS.has(entity.kind) && target ? Math.atan2(target.x - point.x, target.z - point.z) : -.25;
  const pose = entity.pose ?? 'idle';
  if (pose === 'present' || action?.kind === 'show' || action?.kind === 'handoff' || (flow && flow.from === entity.id)) { joints[9] = -1.05; joints[11] = -.24; joints[3] = -.07; }
  if (pose === 'work' || action?.kind === 'operate' || action?.kind === 'review') { joints[6] = -.95; joints[9] = -.95; joints[3] = .16; joints[0] = .22; }
  if (pose === 'listen' || (flow && flow.to === entity.id)) { joints[0] = .13; joints[2] = .08; joints[6] = -.32; }
  if (action?.kind === 'pause' || (!action && flow?.kind === 'pause')) { joints[9] = -.9; joints[11] = -.65; joints[3] = -.12; }
  return { position: point, yaw, joints, scale: entity.scale ?? 1, opacity: entity.opacity ?? 1 };
}

export function createMission3DStage(host: HTMLElement, language: 'zh' | 'en', onFallback?: (fallback: boolean) => void): Mission3DStage {
  const canvas = document.createElement('canvas');
  canvas.className = 'mission-stage-canvas';
  canvas.dataset.renderer = 'fallback';
  canvas.setAttribute('role', 'img');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  host.append(canvas);
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-8.5, 8.5, 4.25, -4.25, .1, 70);
  const focus = new THREE.Vector3(0, .65, 0);
  let cameraYaw = .55;
  const aimCamera = () => { camera.position.set(Math.sin(cameraYaw) * 12, 9, Math.cos(cameraYaw) * 12); camera.lookAt(focus); };
  aimCamera();
  let renderer: THREE.WebGLRenderer | null = null;
  let assets: Mission3DAssets | null = null;
  let room: THREE.Group | null = null;
  let setting = '';
  let disposed = false, failed = false, active = true, motion = true;
  let current: MissionStageInput | null = null, frame: MissionVisualFrame | null = null;
  let signature = '', missionKey = '', progress = 1, startTime = 0, raf = 0, renderCount = 0;
  const entities = new Map<string, Entity>();
  const signals: Signal[] = [];
  const privateMaterials = new Map<THREE.Material, { opacity: number; transparent: boolean }>();
  const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
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
    signals.length = 0;
    owned.forEach(resource => resource.dispose());
    owned.clear();
  };
  const cancel = () => { if (raf) cancelAnimationFrame(raf); raf = 0; canvas.dataset.animating = 'false'; };
  const render = () => { if (renderer && !failed && !disposed) { renderer.render(scene, camera); renderCount++; } };
  const resize = () => {
    if (!renderer || disposed) return;
    const bounds = host.getBoundingClientRect();
    const width = Math.max(1, bounds.width || 720), height = Math.max(1, bounds.height || width / 2);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 600 ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const halfWidth = Math.max(8.5, 4.25 * aspect), halfHeight = halfWidth / aspect;
    camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    render();
  };
  const fail = () => {
    failed = true; cancel(); progress = 1;
    entities.forEach(entry => apply(entry, 1)); applySignals(1);
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
    const approach = smooth(t / .48), perform = smooth((t - .38) / .32), settle = smooth((t - .78) / .22);
    if (t === 1) model.root.position.copy(end.position);
    else model.root.position.lerpVectors(start.position, end.position, approach);
    const interaction = frame?.actions?.find(action => action.prop === entry.definition.id);
    const operator = interaction && entities.get(interaction.actor);
    const handling = Math.sin(Math.PI * smooth((t - .36) / .6));
    if (operator && !model.joints && t > .36 && t < .96) {
      const hand = handPosition(operator);
      const receiver = interaction.kind === 'handoff' && entities.get(interaction.target);
      if (receiver) {
        const receivingHand = handPosition(receiver);
        hand.lerp(receivingHand, smooth((t - .49) / .3));
      }
      model.root.position.lerp(hand, handling);
    }
    const moving = start.position.distanceTo(end.position) > .08 && t < .49;
    const walkYaw = Math.atan2(end.position.x - start.position.x, end.position.z - start.position.z);
    const desiredYaw = moving ? walkYaw : end.yaw;
    const delta = Math.atan2(Math.sin(desiredYaw - start.yaw), Math.cos(desiredYaw - start.yaw));
    model.root.rotation.y = start.yaw + delta * smooth(t / .23);
    if (!moving && t >= .48) model.root.rotation.y = walkYaw + Math.atan2(Math.sin(end.yaw - walkYaw), Math.cos(end.yaw - walkYaw)) * smooth((t - .48) / .22);
    if (start.position.distanceTo(end.position) <= .08) model.root.rotation.y = mix(start.yaw, end.yaw, smooth(t / .3));
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
    const reach = Math.sin(Math.PI * perform) * (1 - settle);
    jointNames.forEach((name, index) => {
      const values = [0, 1, 2].map(axis => t === 1 ? end.joints[index * 3 + axis] : mix(start.joints[index * 3 + axis], end.joints[index * 3 + axis], smooth(t / .72)));
      if (name === 'leftLeg') values[0] += gait;
      if (name === 'rightLeg') values[0] -= gait;
      if (name === 'leftArm') values[0] -= gait * .65 + reach * .2;
      if (name === 'rightArm') values[0] += gait * .65 - reach * .45;
      if (name === 'torso') values[0] += reach * .13;
      if (name === 'head') values[1] += Math.sin(perform * Math.PI * 2) * .13 * (1 - settle);
      model.joints![name].rotation.set(values[0], values[1], values[2]);
    });
  };
  const applySignals = (t: number) => {
    for (const signal of signals) {
      const travel = smooth((t - .42) / .37);
      signal.token.position.lerpVectors(signal.from, signal.to, travel);
      signal.token.position.y += Math.sin(Math.PI * travel) * .5;
      signal.root.visible = t >= .38;
      signal.token.scale.setScalar(signal.kind === 'pause' ? 1 : .8 + Math.sin(Math.PI * travel) * .3);
    }
  };
  const settle = () => { cancel(); progress = 1; entities.forEach(entry => apply(entry, 1)); applySignals(1); render(); };
  const canAnimate = () => active && motion && !media.matches && !document.hidden && host.isConnected && !!renderer && !failed;
  const tick = (now: number) => {
    raf = 0;
    if (!canAnimate()) { settle(); return; }
    progress = Math.min(1, (now - startTime) / DURATION);
    entities.forEach(entry => apply(entry, progress)); applySignals(progress); render();
    if (progress < 1) raf = requestAnimationFrame(tick); else canvas.dataset.animating = 'false';
  };
  const begin = () => { cancel(); progress = 0; startTime = performance.now(); canvas.dataset.animating = 'true'; raf = requestAnimationFrame(tick); };
  const buildSignals = () => {
    disposeSignals();
    if (!frame) return;
    for (const flow of frame.flows) {
      const source = entities.get(flow.from), target = entities.get(flow.to);
      if (!source || !target) continue;
      const from = source.end.position.clone(), to = target.end.position.clone();
      from.y += source.model.joints ? 1 : .2; to.y += target.model.joints ? 1 : .2;
      const root = new THREE.Group(); root.name = flow.id;
      const color = flow.kind === 'pause' ? 0xd9534f : flow.kind === 'review' ? 0xd3a44e : 0x5d9e90;
      const material = new THREE.MeshStandardMaterial({color, roughness: .65}); owned.add(material);
      const geometry = flow.kind === 'review' ? new THREE.TorusGeometry(.28, .045, 6, 20) : flow.kind === 'pause' ? new THREE.BoxGeometry(.46, .14, .11) : new THREE.BoxGeometry(.24, .3, .07);
      owned.add(geometry);
      const token = new THREE.Mesh(geometry, material); token.castShadow = true; root.add(token);
      if (flow.kind === 'pause') {
        const ringGeometry = new THREE.TorusGeometry(.34, .05, 6, 8); owned.add(ringGeometry);
        const ring = new THREE.Mesh(ringGeometry, material); token.add(ring);
      }
      const curve = new THREE.QuadraticBezierCurve3(from, from.clone().lerp(to, .5).add(new THREE.Vector3(0, .45, 0)), to);
      const trailGeometry = new THREE.TubeGeometry(curve, 16, .018, 4, false); owned.add(trailGeometry);
      const trailMaterial = new THREE.MeshStandardMaterial({color, transparent: true, opacity: .45}); owned.add(trailMaterial);
      root.add(new THREE.Mesh(trailGeometry, trailMaterial));
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
    const present = new Set(frame.entities.map(entity => entity.id));
    for (const [id, entry] of entities) if (!present.has(id)) { removeEntity(entry); entities.delete(id); }
    for (const definition of frame.entities) {
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
    canvas.setAttribute('aria-label', `${current.definition.title[language]} · ${frame.description[language]}`);
    if (animate && canAnimate()) begin(); else settle();
  };
  const onVisibility = () => { if (document.hidden) settle(); };
  const onMotion = () => { if (media.matches) settle(); };
  const onContextLost = (event: Event) => { event.preventDefault(); fail(); };
  const observer = new ResizeObserver(resize); observer.observe(host);
  document.addEventListener('visibilitychange', onVisibility);
  media.addEventListener('change', onMotion);
  canvas.addEventListener('webglcontextlost', onContextLost);
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
      const nextFrame = choice ? input.definition.choices[choice] ?? input.definition.initial : input.definition.initial;
      const physicalEntities = nextFrame.entities.map(({id, kind, x, y, scale, opacity, pose}) => [id, kind, x, y, scale ?? 1, opacity ?? 1, pose ?? 'idle']).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      const physicalFlows = nextFrame.flows.map(({id, from, to, kind}) => [id, from, to, kind]).sort((a, b) => a[0].localeCompare(b[0]));
      const nextSignature = JSON.stringify([input.key, input.definition.setting, physicalEntities, physicalFlows, nextFrame.actions ?? []]);
      current = input;
      canvas.setAttribute('aria-label', `${input.definition.title[language]} · ${nextFrame.description[language]}`);
      if (nextSignature === signature) return;
      camera.zoom = choice ? 1.18 : 1;
      focus.set(0, .65, choice ? .8 : 0);
      aimCamera();
      camera.updateProjectionMatrix();
      const animate = missionKey === input.key && setting === input.definition.setting && choice !== null;
      if (missionKey !== input.key) { cameraYaw = .55; aimCamera(); }
      cancel(); signature = nextSignature; missionKey = input.key; frame = nextFrame;
      initialize(); sync(animate);
    },
    setActive(value) { if (disposed) return; active = value; if (!value) settle(); else if (!renderer && current) { initialize(); sync(false); } },
    setMotion(value) { if (disposed) return; motion = value; if (!value) settle(); },
    replay() {
      if (disposed || !current || !frame || !canAnimate()) return;
      for (const [id, entry] of entities) {
        const initial = current.definition.initial.entities.find(entity => entity.id === id);
        entry.start = initial ? terminalPose(initial, current.definition.initial) : {...entry.end, position: entry.end.position.clone(), joints: [...entry.end.joints], opacity: 0};
      }
      entities.forEach(entry => apply(entry, 0)); applySignals(0); render(); begin();
    },
    snapshot(): Mission3DSnapshot {
      return {mode: renderer && !failed ? 'webgl' : 'fallback', animating: !!raf, progress, entities: [...entities].map(([id, entry]) => ({id, kind: entry.definition.kind, position: entry.model.root.position.toArray(), rotation: entry.model.root.rotation.toArray().slice(0, 3) as number[], visible: entry.model.root.visible, joints: readPose(entry).joints})), flowCount: signals.length, renderCount};
    },
    dispose() {
      if (disposed) return;
      cancel(); disposed = true; observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility); media.removeEventListener('change', onMotion);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      disposeSignals(); entities.forEach(removeEntity); assets?.dispose(); privateMaterials.forEach((_base, material) => material.dispose()); privateMaterials.clear(); originalMaterials.clear();
      renderer?.dispose(); renderer?.forceContextLoss(); scene.clear(); entities.clear(); canvas.remove();
    },
  };
}

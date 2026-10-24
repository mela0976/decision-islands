import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MISSION_PROPS, MISSION_SETTINGS } from './mission-stage-types';
import type { MissionPropKind, MissionSetting } from './mission-stage-types';
import type { Mission3DAssets, Mission3DModel, MissionActorJoints } from './mission-3d-types';

type Vec3 = readonly [number, number, number];
type Shape = 'box' | 'roundBox' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'ico' | 'octagon' | 'heart' | 'shield';
type Paint = {
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
};
type EntityBuilder = (root: THREE.Group, id: string) => void;
type RoomBuilder = (root: THREE.Group) => void;

const C = {
  cream: '#fff8f0',
  paper: '#f4ebdd',
  coral: '#db6a41',
  terracotta: '#a34e34',
  ink: '#211d1d',
  yellow: '#fcea8b',
  stone: '#c5b5a7',
  wood: '#b48560',
  glass: '#86a8a6',
  teal: '#3e7c8c',
  green: '#71806a',
  leaf: '#9cc27a',
  leafDark: '#5d7851',
  blush: '#f2b5c6',
  blue: '#6f7fb5',
  aqua: '#58a6a6',
  dark: '#39464a',
  white: '#fffdf9',
} as const;

const HUMAN_SKIN = ['#e9b79c', '#c98666', '#f1c8a4', '#8e5a44', '#f1d0b0', '#ad7059'] as const;
const HUMAN_HAIR = ['#463630', '#4b2d22', '#221e1b', '#a66b42', '#625247'] as const;
const HUMAN_CLOTHES = [C.coral, C.teal, C.green, C.blue, '#b45f59', '#577069', '#d19a48', '#8d6f98'] as const;
const ROOM_PAINT: Record<MissionSetting, { wall: string; trim: string; floor: string; accent: string }> = {
  home: { wall: C.cream, trim: C.coral, floor: C.wood, accent: C.green },
  community: { wall: '#f4ebdd', trim: C.teal, floor: '#ad815c', accent: C.yellow },
  office: { wall: '#ebe9e1', trim: C.blue, floor: '#b9997c', accent: C.teal },
  commute: { wall: '#e4e4df', trim: C.yellow, floor: '#899194', accent: C.teal },
  'brand-studio': { wall: '#f9ede0', trim: C.coral, floor: '#b68d67', accent: C.blue },
  meeting: { wall: '#eee9e1', trim: C.green, floor: '#ae8666', accent: C.teal },
  production: { wall: '#e4e4df', trim: C.coral, floor: '#866c62', accent: C.dark },
  'insight-lab': { wall: '#e8efec', trim: C.teal, floor: '#ad987f', accent: C.blue },
};

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}
function dimensionsKey(size: Vec3): string {
  return size.map((value) => value.toFixed(3)).join(',');
}

export function createMission3DAssets(): Mission3DAssets {
  const geometryCache = new Map<string, THREE.BufferGeometry>();
  const materials = new Set<THREE.MeshStandardMaterial>();
  const rooms = new Map<MissionSetting, THREE.Group>();
  const entities = new Map<string, Mission3DModel>();
  let disposed = false;

  const geometry = (shape: Shape, size: Vec3): THREE.BufferGeometry => {
    const key = shape === 'roundBox' ? shape + ':' + dimensionsKey(size) : shape;
    const cached = geometryCache.get(key);
    if (cached) return cached;

    let result: THREE.BufferGeometry;
    switch (shape) {
      case 'box':
        result = new THREE.BoxGeometry(1, 1, 1);
        break;
      case 'roundBox': {
        const radius = Math.max(0.006, Math.min(size[0], size[1], size[2]) * 0.16);
        result = new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius);
        break;
      }
      case 'sphere':
        result = new THREE.SphereGeometry(0.5, 14, 10);
        break;
      case 'cylinder':
        result = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
        break;
      case 'cone':
        result = new THREE.CylinderGeometry(0, 0.5, 1, 10);
        break;
      case 'torus':
        result = new THREE.TorusGeometry(0.4, 0.07, 8, 18);
        break;
      case 'ico':
        result = new THREE.IcosahedronGeometry(0.5, 0);
        break;
      case 'octagon':
        result = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1);
        break;
      case 'heart': {
        const shapePath = new THREE.Shape();
        shapePath.moveTo(0, -0.46);
        shapePath.bezierCurveTo(-0.18, -0.16, -0.54, 0.08, -0.42, 0.34);
        shapePath.bezierCurveTo(-0.31, 0.62, -0.05, 0.55, 0, 0.34);
        shapePath.bezierCurveTo(0.05, 0.55, 0.31, 0.62, 0.42, 0.34);
        shapePath.bezierCurveTo(0.54, 0.08, 0.18, -0.16, 0, -0.46);
        result = new THREE.ExtrudeGeometry(shapePath, { depth: 0.16, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.025, bevelThickness: 0.025 });
        result.translate(0, 0, -0.08);
        break;
      }
      case 'shield': {
        const shieldPath = new THREE.Shape();
        shieldPath.moveTo(-0.48, 0.44);
        shieldPath.lineTo(0.48, 0.44);
        shieldPath.lineTo(0.39, -0.08);
        shieldPath.lineTo(0, -0.48);
        shieldPath.lineTo(-0.39, -0.08);
        shieldPath.closePath();
        result = new THREE.ExtrudeGeometry(shieldPath, { depth: 0.12, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 });
        result.translate(0, 0, -0.06);
        break;
      }
    }
    result.computeBoundingBox();
    geometryCache.set(key, result);
    return result;
  };

  const addMesh = (
    parent: THREE.Group,
    shape: Shape,
    name: string,
    color: string,
    position: Vec3,
    size: Vec3,
    rotation: Vec3 = [0, 0, 0],
    paint: Paint = {},
  ): THREE.Mesh => {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.78,
      metalness: 0.015,
      emissive: paint.emissive ?? '#000000',
      emissiveIntensity: paint.emissiveIntensity ?? 0,
      opacity: paint.opacity ?? 1,
      transparent: (paint.opacity ?? 1) < 1,
      depthWrite: (paint.opacity ?? 1) >= 1,
    });
    materials.add(material);
    const mesh = new THREE.Mesh(geometry(shape, size), material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (shape === 'roundBox') mesh.scale.set(1, 1, 1);
    else mesh.scale.set(size[0], size[1], size[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.assetPart = name;
    parent.add(mesh);
    return mesh;
  };

  const makeGroup = (parent: THREE.Group, name: string): THREE.Group => {
    const result = new THREE.Group();
    result.name = name;
    parent.add(result);
    return result;
  };

  const addBox = (parent: THREE.Group, name: string, color: string, position: Vec3, size: Vec3, rounded = true, rotation: Vec3 = [0, 0, 0], paint: Paint = {}): THREE.Mesh =>
    addMesh(parent, rounded ? 'roundBox' : 'box', name, color, position, size, rotation, paint);

  const addSphere = (parent: THREE.Group, name: string, color: string, position: Vec3, size: Vec3): THREE.Mesh =>
    addMesh(parent, 'sphere', name, color, position, size);

  const addCylinder = (parent: THREE.Group, name: string, color: string, position: Vec3, size: Vec3, rotation: Vec3 = [0, 0, 0]): THREE.Mesh =>
    addMesh(parent, 'cylinder', name, color, position, size, rotation);

  const buildTable = (
    parent: THREE.Group,
    name: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    color: string,
  ): void => {
    const table = makeGroup(parent, name);
    addBox(table, 'table-top', color, [0, 0.795, 0], [width, 0.11, depth]);
    for (const dx of [-width * 0.43, width * 0.43]) {
      for (const dz of [-depth * 0.35, depth * 0.35]) {
        addBox(table, 'table-leg', C.wood, [dx, 0.39, dz], [0.11, 0.78, 0.12]);
      }
    }
    addBox(table, 'table-apron', C.terracotta, [0, 0.69, 0], [width * 0.78, 0.09, depth * 0.7]);
    table.position.set(x, 0, z);
  };

  const buildSceneTable = (root: THREE.Group, setting: MissionSetting): void => {
    const palette = ROOM_PAINT[setting];
    buildTable(root, 'mission-table', 0, -0.05, 3.25, 1.9, palette.floor);
    buildTable(root, 'mission-display-left', -2.55, -0.05, 1.8, 1.9, palette.floor);
    buildTable(root, 'mission-display-right', 2.55, -0.05, 1.8, 1.9, palette.floor);
  };

  const buildWindow = (parent: THREE.Group, name: string, x: number, z: number): void => {
    const windowGroup = makeGroup(parent, name);
    addBox(windowGroup, 'window-wood-frame', C.wood, [0, 1.78, 0], [1.55, 1.12, 0.12]);
    addBox(windowGroup, 'window-glass', C.glass, [0, 1.78, 0.075], [1.31, 0.9, 0.035], false);
    addBox(windowGroup, 'window-mullion', C.cream, [0, 1.78, 0.1], [0.055, 0.92, 0.04], false);
    addBox(windowGroup, 'window-crossbar', C.cream, [0, 1.78, 0.1], [1.34, 0.055, 0.04], false);
    windowGroup.position.set(x, 0, z);
  };

  const buildSign = (parent: THREE.Group, name: string, x: number, y: number, z: number, width: number, height: number, color: string): void => {
    const sign = makeGroup(parent, name);
    addBox(sign, 'sign-board', color, [0, 0, 0], [width, height, 0.1]);
    addBox(sign, 'sign-strip', C.coral, [0, height * 0.22, 0.06], [width * 0.56, 0.045, 0.018], false);
    addSphere(sign, 'sign-dot-one', C.yellow, [-width * 0.2, -height * 0.16, 0.065], [0.09, 0.09, 0.035]);
    addSphere(sign, 'sign-dot-two', C.teal, [0, -height * 0.16, 0.065], [0.09, 0.09, 0.035]);
    addSphere(sign, 'sign-dot-three', C.green, [width * 0.2, -height * 0.16, 0.065], [0.09, 0.09, 0.035]);
    sign.position.set(x, y, z);
  };

  const buildPlant = (parent: THREE.Group, name: string, x: number, z: number): void => {
    const plant = makeGroup(parent, name);
    addMesh(plant, 'cylinder', 'plant-pot', C.terracotta, [0, 0.19, 0], [0.34, 0.38, 0.34]);
    addCylinder(plant, 'plant-stem', C.green, [0, 0.53, 0], [0.055, 0.44, 0.055]);
    for (const [index, leaf] of [[-1, [-0.18, 0.68, 0]], [1, [0.18, 0.74, 0.02]], [-1, [0, 0.9, -0.04]], [1, [-0.14, 0.83, 0.05]]] as const) {
      addSphere(plant, 'plant-leaf-' + index + '-' + leaf[1], C.leaf, leaf, [0.25, 0.14, 0.18]);
    }
    plant.position.set(x, 0, z);
  };

  const buildSofa = (parent: THREE.Group, name: string, x: number, z: number): void => {
    const sofa = makeGroup(parent, name);
    addBox(sofa, 'sofa-seat-base', C.teal, [0, 0.36, 0], [1.85, 0.33, 0.78]);
    addBox(sofa, 'sofa-back', C.green, [0, 0.72, -0.28], [1.85, 0.72, 0.22]);
    addBox(sofa, 'sofa-left-arm', C.green, [-0.82, 0.53, 0.04], [0.24, 0.55, 0.82]);
    addBox(sofa, 'sofa-right-arm', C.green, [0.82, 0.53, 0.04], [0.24, 0.55, 0.82]);
    addBox(sofa, 'sofa-cushion-left', C.cream, [-0.4, 0.55, 0.1], [0.62, 0.12, 0.54]);
    addBox(sofa, 'sofa-cushion-right', C.paper, [0.4, 0.55, 0.1], [0.62, 0.12, 0.54]);
    sofa.position.set(x, 0, z);
  };

  const buildBookshelf = (parent: THREE.Group, name: string, x: number, z: number): void => {
    const shelf = makeGroup(parent, name);
    addBox(shelf, 'bookshelf-back', C.wood, [0, 0.92, -0.24], [0.94, 1.84, 0.12]);
    for (const y of [0.2, 0.66, 1.12, 1.58]) {
      addBox(shelf, 'bookshelf-shelf', C.terracotta, [0, y, 0], [1.02, 0.07, 0.55]);
      for (let index = 0; index < 4; index++) {
        const colors = [C.coral, C.teal, C.blue, C.green];
        const bookX = -0.34 + index * 0.22;
        addBox(shelf, 'bookshelf-book-' + index + '-' + y, colors[(index + Math.round(y * 10)) % colors.length], [bookX, y + 0.18, 0.04], [0.14, 0.29, 0.33]);
      }
    }
    shelf.position.set(x, 0, z);
  };

  const buildDesk = (parent: THREE.Group, name: string, x: number, z: number, width = 1.65): void => {
    const desk = makeGroup(parent, name);
    buildTable(desk, 'desk-surface', 0, 0, width, 0.9, C.wood);
    addBox(desk, 'desk-monitor-base', C.dark, [0, 0.89, -0.2], [0.42, 0.06, 0.28]);
    addBox(desk, 'desk-monitor', C.dark, [0, 1.24, -0.27], [0.7, 0.56, 0.1]);
    addBox(desk, 'desk-monitor-screen', C.glass, [0, 1.24, -0.21], [0.59, 0.43, 0.025], false);
    addBox(desk, 'desk-keyboard', C.ink, [0, 0.88, 0.2], [0.62, 0.045, 0.18], false);
    addChair(desk, 'desk-chair', 0, 0.95);
    desk.position.set(x, 0, z);
  };

  const addChair = (parent: THREE.Group, name: string, x: number, z: number): void => {
    const chair = makeGroup(parent, name);
    addBox(chair, 'chair-seat', C.teal, [0, 0.48, 0], [0.52, 0.13, 0.48]);
    addBox(chair, 'chair-back', C.blue, [0, 0.78, -0.19], [0.52, 0.55, 0.12]);
    for (const dx of [-0.2, 0.2]) for (const dz of [-0.17, 0.17]) {
      addBox(chair, 'chair-leg', C.wood, [dx, 0.23, dz], [0.055, 0.46, 0.055]);
    }
    chair.position.set(x, 0, z);
  };

  const buildWhiteboard = (parent: THREE.Group, name: string, x: number, z: number, width = 3.1): void => {
    const board = makeGroup(parent, name);
    addBox(board, 'whiteboard-frame', C.wood, [0, 1.63, 0], [width, 1.34, 0.12]);
    addBox(board, 'whiteboard-surface', C.white, [0, 1.63, 0.07], [width - 0.2, 1.14, 0.025], false);
    for (let index = 0; index < 5; index++) {
      addBox(board, 'whiteboard-note-' + index, [C.coral, C.teal, C.blue, C.yellow, C.green][index], [-width * 0.35 + index * width * 0.17, 1.68 + (index % 2) * 0.2, 0.095], [0.29, 0.07, 0.018], false);
    }
    board.position.set(x, 0, z);
  };

  const buildRoomTrim = (root: THREE.Group, setting: MissionSetting): void => {
    const palette = ROOM_PAINT[setting];
    const platform = makeGroup(root, 'room-island');
    addBox(platform, 'room-island-base', C.terracotta, [0, -0.16, 0], [10.6, 0.32, 6.6]);
    addBox(platform, 'room-floor', palette.floor, [0, -0.014, 0], [10, 0.028, 6]);
    for (let index = 0; index < 12; index++) {
      const z = -2.75 + index * 0.5;
      addBox(platform, 'room-floor-plank-' + index, index % 2 === 0 ? palette.floor : C.wood, [0, 0.008, z], [9.94, 0.016, 0.46], false);
      if (index % 3 === 1) {
        for (const x of [-4.6, 4.6]) addCylinder(platform, 'room-floor-nail-' + index + '-' + x, C.terracotta, [x, 0.019, z], [0.025, 0.006, 0.025]);
      }
    }
    addBox(platform, 'room-wall-back', palette.wall, [0, 1.35, -3.08], [10, 2.7, 0.18]);
    addBox(platform, 'room-wall-left', palette.wall, [-5.08, 1.35, 0], [0.18, 2.7, 6]);
    addBox(platform, 'room-wall-cap-back', palette.trim, [0, 2.72, -3.08], [10, 0.12, 0.2]);
    addBox(platform, 'room-wall-cap-left', palette.trim, [-5.08, 2.72, 0], [0.2, 0.12, 6]);
    addBox(platform, 'room-wall-left-foot', C.wood, [-4.96, 0.12, 0], [0.1, 0.24, 5.92]);
    addBox(platform, 'room-wall-back-foot', C.wood, [0, 0.12, -2.96], [9.92, 0.24, 0.1]);
  };

  const buildRoomHome: RoomBuilder = (root) => {
    buildWindow(root, 'home-window', -3.25, -2.93);
    buildSofa(root, 'home-sofa', -3.92, -1.35);
    buildBookshelf(root, 'home-bookshelf', 4.18, -1.55);
    addBox(root, 'home-coffee-table', C.wood, [-3.8, 0.36, -0.25], [1.15, 0.08, 0.58]);
    buildPlant(root, 'home-plant', 4.1, 1.55);
    buildSign(root, 'home-family-photo', 3.2, 1.9, -2.91, 0.85, 0.62, C.paper);
  };

  const buildRoomCommunity: RoomBuilder = (root) => {
    buildSign(root, 'community-workshop-sign', 0, 2.1, -2.91, 2.9, 0.92, C.teal);
    buildPlant(root, 'community-plant-left', -4.08, 1.55);
    buildPlant(root, 'community-plant-right', 4.08, 1.55);
    addBox(root, 'community-workshop-board', C.wood, [-3.8, 1.25, -2.82], [1.5, 1.55, 0.1]);
    for (const index of [0, 1, 2]) {
      addBox(root, 'community-board-note-' + index, [C.yellow, C.coral, C.glass][index], [-4.25 + index * 0.42, 1.35, -2.74], [0.28, 0.36, 0.025]);
    }
  };

  const buildRoomOffice: RoomBuilder = (root) => {
    buildWhiteboard(root, 'office-project-board', 0, -2.9, 3.7);
    buildDesk(root, 'office-desk-left', -3.95, -0.25, 1.55);
    buildDesk(root, 'office-desk-right', 3.95, -0.25, 1.55);
    addBox(root, 'office-filing-cabinet', C.blue, [4.32, 0.8, -2.0], [0.78, 1.6, 0.72]);
    for (const y of [0.42, 0.78, 1.14]) addBox(root, 'office-cabinet-drawer-' + y, C.cream, [4.32, y, -1.62], [0.62, 0.08, 0.025], false);
  };

  const buildRoomCommute: RoomBuilder = (root) => {
    const train = makeGroup(root, 'commute-train');
    addBox(train, 'train-body', C.cream, [0, 1.12, -2.18], [6.45, 1.72, 0.92]);
    addBox(train, 'train-lower-band', C.teal, [0, 0.61, -1.69], [6.4, 0.14, 0.06]);
    for (let index = 0; index < 6; index++) {
      const x = -2.55 + index * 1.02;
      addBox(train, 'train-window-frame-' + index, C.wood, [x, 1.37, -1.72], [0.8, 0.69, 0.035], false);
      addBox(train, 'train-window-' + index, C.glass, [x, 1.37, -1.68], [0.7, 0.58, 0.025], false);
    }
    addBox(root, 'commute-platform', C.stone, [0, 0.04, -1.12], [9.5, 0.08, 1.22]);
    addBox(root, 'commute-yellow-safety-line', C.yellow, [0, 0.09, -0.62], [9.45, 0.035, 0.09], false);
    for (const x of [-4.25, -2.55, -0.85, 0.85, 2.55, 4.25]) {
      addBox(root, 'commute-line-dash-' + x, C.cream, [x, 0.096, -0.62], [0.55, 0.018, 0.035], false);
    }
  };

  const buildRoomBrandStudio: RoomBuilder = (root) => {
    buildWhiteboard(root, 'brand-studio-moodboard', 0, -2.9, 4.3);
    for (const [index, x] of [-3.95, 3.95].entries()) {
      const display = makeGroup(root, 'brand-studio-product-display-' + index);
      addBox(display, 'product-plinth', C.paper, [0, 0.43, 0], [1.4, 0.86, 1.1]);
      addBox(display, 'product-plinth-top', C.coral, [0, 0.88, 0], [1.48, 0.06, 1.16]);
      addSphere(display, 'product-object', index === 0 ? C.glass : C.yellow, [0, 1.25, 0], [0.65, 0.65, 0.65]);
      addBox(display, 'product-label', C.cream, [0, 1.07, 0.59], [0.76, 0.16, 0.04]);
      display.position.set(x, 0, -0.55);
    }
    buildSign(root, 'brand-studio-swatch-board', -3.75, 1.74, -2.84, 1.6, 1.25, C.blue);
    for (let index = 0; index < 4; index++) {
      addBox(root, 'brand-studio-swatch-' + index, [C.coral, C.yellow, C.teal, C.green][index], [-4.23 + index * 0.32, 1.75, -2.75], [0.24, 0.32, 0.035]);
    }
  };

  const buildRoomMeeting: RoomBuilder = (root) => {
    buildWhiteboard(root, 'meeting-whiteboard', 0, -2.9, 4.3);
    buildTable(root, 'meeting-long-table', 0, -0.7, 3.75, 1.35, C.wood);
    addChair(root, 'meeting-chair-left', -2.35, -0.7);
    addChair(root, 'meeting-chair-right', 2.35, -0.7);
    addChair(root, 'meeting-chair-back-left', -1.25, -1.95);
    addChair(root, 'meeting-chair-back-right', 1.25, -1.95);
  };

  const buildRoomProduction: RoomBuilder = (root) => {
    addBox(root, 'production-backdrop', C.dark, [0, 1.42, -2.82], [6.3, 2.42, 0.16]);
    for (let x = -2.7; x <= 2.7; x += 0.54) addBox(root, 'production-backdrop-fold-' + x, x % 1.08 === 0 ? C.teal : '#46565a', [x, 1.42, -2.72], [0.08, 2.35, 0.04], false);
    for (const [index, x] of [-4.15, 4.15].entries()) {
      const light = makeGroup(root, 'production-light-' + index);
      addBox(light, 'light-stand-base', C.dark, [0, 0.04, 0], [0.66, 0.08, 0.54]);
      addCylinder(light, 'light-stand-pole', C.stone, [0, 0.9, 0], [0.06, 1.65, 0.06]);
      addBox(light, 'light-housing', C.cream, [0, 1.76, 0], [0.62, 0.42, 0.24]);
      addBox(light, 'light-diffuser', C.yellow, [0, 1.76, 0.14], [0.48, 0.28, 0.035], false, [0, 0, -0.05], { emissive: C.yellow, emissiveIntensity: 0.22 });
      light.position.set(x, 0, 0.25);
    }
    const cameraRig = makeGroup(root, 'production-camera-rig');
    buildCamera(cameraRig);
    cameraRig.position.set(-3.85, 0, 0.1);
    buildTable(root, 'production-equipment-table', 3.8, -0.65, 1.65, 0.95, C.wood);
  };

  const buildRoomInsight: RoomBuilder = (root) => {
    const screen = makeGroup(root, 'insight-lab-research-screen');
    addBox(screen, 'research-screen-frame', C.dark, [0, 1.72, 0], [4.6, 1.55, 0.14]);
    addBox(screen, 'research-screen-glass', C.glass, [0, 1.72, 0.085], [4.32, 1.29, 0.025], false);
    for (let index = 0; index < 5; index++) {
      addBox(screen, 'research-screen-row-' + index, index % 2 ? C.cream : C.yellow, [-1.48 + index * 0.72, 1.72, 0.11], [0.42, 0.46, 0.035]);
      addBox(screen, 'research-screen-bar-' + index, C.blue, [-1.48 + index * 0.72, 1.48, 0.13], [0.34, 0.025, 0.02], false);
    }
    screen.position.set(0, 0, -2.89);
    addBox(root, 'insight-lab-chart-board', C.paper, [4.12, 1.58, -2.8], [1.35, 1.75, 0.12]);
    for (let index = 0; index < 4; index++) {
      addBox(root, 'insight-lab-chart-bar-' + index, [C.teal, C.coral, C.blue, C.green][index], [3.69 + index * 0.27, 1.15 + index * 0.17, -2.72], [0.16, 0.3 + index * 0.18, 0.035]);
    }
    buildPlant(root, 'insight-lab-plant', -4.18, 1.55);
  };

  const roomBuilders: Record<MissionSetting, RoomBuilder> = {
    home: buildRoomHome,
    community: buildRoomCommunity,
    office: buildRoomOffice,
    commute: buildRoomCommute,
    'brand-studio': buildRoomBrandStudio,
    meeting: buildRoomMeeting,
    production: buildRoomProduction,
    'insight-lab': buildRoomInsight,
  };

  const buildHuman = (root: THREE.Group, id: string, kind: 'adult' | 'child' | 'elder'): MissionActorJoints => {
    const seed = hashSeed(kind + ':' + id);
    const variation = makeGroup(root, 'actor-variation');
    const sizeScale = kind === 'child' ? 0.67 : kind === 'elder' ? 0.94 : 1;
    variation.scale.setScalar(sizeScale);

    const skin = kind === 'elder' ? HUMAN_SKIN[(seed >>> 3) % HUMAN_SKIN.length] : HUMAN_SKIN[seed % HUMAN_SKIN.length];
    const hair = kind === 'elder' ? '#c8c4bc' : HUMAN_HAIR[(seed >>> 5) % HUMAN_HAIR.length];
    const shirt = HUMAN_CLOTHES[(seed >>> 8) % HUMAN_CLOTHES.length];
    const trousers = HUMAN_CLOTHES[(seed >>> 12) % HUMAN_CLOTHES.length];
    const hairStyle = (seed >>> 16) % 3;

    const head = makeGroup(variation, 'joint-head');
    head.position.set(0, 1.24, 0);
    addSphere(head, 'actor-head', skin, [0, 0, 0], [0.34, 0.36, 0.3]);
    addSphere(head, 'actor-hair-cap', hair, [0, 0.12, -0.025], [0.35, 0.19, 0.31]);
    if (hairStyle === 0) {
      addSphere(head, 'actor-hair-side-left', hair, [-0.14, 0.025, -0.015], [0.11, 0.22, 0.27]);
      addSphere(head, 'actor-hair-side-right', hair, [0.14, 0.025, -0.015], [0.11, 0.22, 0.27]);
    } else if (hairStyle === 1) {
      addSphere(head, 'actor-hair-part', hair, [0.09, 0.14, 0.035], [0.2, 0.12, 0.2]);
      addSphere(head, 'actor-hair-back', hair, [0, -0.035, -0.12], [0.31, 0.2, 0.14]);
    } else {
      addSphere(head, 'actor-hair-bun', hair, [-0.13, 0.12, -0.15], [0.16, 0.16, 0.16]);
      addSphere(head, 'actor-hair-sweep', hair, [0.1, 0.13, 0.06], [0.23, 0.1, 0.2]);
    }
    for (const x of [-0.075, 0.075]) {
      addSphere(head, 'actor-eye-white', C.white, [x, 0.015, 0.132], [0.052, 0.062, 0.025]);
      addSphere(head, 'actor-eye', C.ink, [x, 0.012, 0.151], [0.022, 0.03, 0.018]);
    }
    addSphere(head, 'actor-nose', skin, [0, -0.035, 0.157], [0.045, 0.06, 0.045]);
    addBox(head, 'actor-mouth', C.terracotta, [0, -0.105, 0.148], [0.075, 0.014, 0.018], false);
    if ((seed % 3 === 0) || (kind === 'elder' && seed % 2 === 0)) {
      for (const x of [-0.078, 0.078]) addMesh(head, 'torus', 'actor-glasses', C.dark, [x, 0.015, 0.157], [0.22, 0.19, 0.035]);
      addBox(head, 'actor-glasses-bridge', C.dark, [0, 0.015, 0.165], [0.06, 0.022, 0.02], false);
    }

    const torso = makeGroup(variation, 'joint-torso');
    torso.position.set(0, 0.82, 0);
    addBox(torso, 'actor-shirt', shirt, [0, 0, 0], [0.49, 0.52, 0.29]);
    addBox(torso, 'actor-collar', C.cream, [0, 0.22, 0.155], [0.2, 0.07, 0.035]);
    addBox(torso, 'actor-shirt-detail', kind === 'elder' ? C.yellow : C.paper, [0.13, -0.02, 0.16], [0.075, 0.13, 0.025]);
    addSphere(torso, 'actor-shirt-button', C.cream, [-0.04, 0.12, 0.162], [0.028, 0.028, 0.018]);
    addBox(torso, 'actor-belt', C.dark, [0, -0.285, 0], [0.38, 0.06, 0.23]);
    if ((seed >>> 20) % 4 === 0) addBox(torso, 'actor-backpack', C.blue, [0, 0.025, -0.205], [0.31, 0.34, 0.12]);

    const leftArm = makeGroup(variation, 'joint-leftArm');
    leftArm.position.set(-0.25, 0.98, 0);
    addBox(leftArm, 'actor-left-sleeve', shirt, [0, -0.17, 0], [0.17, 0.34, 0.19]);
    addBox(leftArm, 'actor-left-cuff', trousers, [0, -0.34, 0], [0.16, 0.075, 0.18]);
    addSphere(leftArm, 'actor-left-hand', skin, [0, -0.405, 0.012], [0.12, 0.12, 0.12]);

    const rightArm = makeGroup(variation, 'joint-rightArm');
    rightArm.position.set(0.25, 0.98, 0);
    addBox(rightArm, 'actor-right-sleeve', shirt, [0, -0.17, 0], [0.17, 0.34, 0.19]);
    addBox(rightArm, 'actor-right-cuff', trousers, [0, -0.34, 0], [0.16, 0.075, 0.18]);
    addSphere(rightArm, 'actor-right-hand', skin, [0, -0.405, 0.012], [0.12, 0.12, 0.12]);

    const leftLeg = makeGroup(variation, 'joint-leftLeg');
    leftLeg.position.set(-0.125, 0.41, 0);
    addBox(leftLeg, 'actor-left-trouser', trousers, [0, -0.16, 0], [0.19, 0.32, 0.2]);
    addBox(leftLeg, 'actor-left-shoe', C.dark, [0, -0.37, 0.04], [0.23, 0.08, 0.31]);

    const rightLeg = makeGroup(variation, 'joint-rightLeg');
    rightLeg.position.set(0.125, 0.41, 0);
    addBox(rightLeg, 'actor-right-trouser', trousers, [0, -0.16, 0], [0.19, 0.32, 0.2]);
    addBox(rightLeg, 'actor-right-shoe', C.dark, [0, -0.37, 0.04], [0.23, 0.08, 0.31]);

    return { head, torso, leftArm, rightArm, leftLeg, rightLeg };
  };

  const buildRobot = (root: THREE.Group, id: string): MissionActorJoints => {
    const seed = hashSeed('robot:' + id);
    const variation = makeGroup(root, 'actor-variation');
    const shell = [C.teal, C.blue, C.cream][seed % 3];
    const accent = [C.coral, C.yellow, C.green][(seed >>> 4) % 3];

    const head = makeGroup(variation, 'joint-head');
    head.position.set(0, 1.02, 0);
    addBox(head, 'robot-head', shell, [0, 0, 0], [0.39, 0.31, 0.3]);
    addBox(head, 'robot-face-screen', C.dark, [0, -0.015, 0.16], [0.29, 0.16, 0.025], false);
    for (const x of [-0.07, 0.07]) addSphere(head, 'robot-eye', C.aqua, [x, 0.005, 0.18], [0.045, 0.055, 0.02]);
    addCylinder(head, 'robot-antenna', C.wood, [0, 0.205, 0], [0.045, 0.16, 0.045]);
    addSphere(head, 'robot-antenna-light', C.coral, [0, 0.3, 0], [0.09, 0.09, 0.09]);

    const torso = makeGroup(variation, 'joint-torso');
    torso.position.set(0, 0.64, 0);
    addBox(torso, 'robot-torso', shell, [0, 0, 0], [0.44, 0.4, 0.27]);
    addBox(torso, 'robot-chest-panel', C.paper, [0, 0.02, 0.15], [0.25, 0.18, 0.025]);
    addSphere(torso, 'robot-status-light', accent, [0, 0.02, 0.176], [0.075, 0.075, 0.025]);

    const leftArm = makeGroup(variation, 'joint-leftArm');
    leftArm.position.set(-0.24, 0.83, 0);
    addBox(leftArm, 'robot-left-arm', shell, [0, -0.17, 0], [0.15, 0.33, 0.18]);
    addSphere(leftArm, 'robot-left-hand', C.dark, [0, -0.36, 0], [0.15, 0.12, 0.16]);

    const rightArm = makeGroup(variation, 'joint-rightArm');
    rightArm.position.set(0.24, 0.83, 0);
    addBox(rightArm, 'robot-right-arm', shell, [0, -0.17, 0], [0.15, 0.33, 0.18]);
    addSphere(rightArm, 'robot-right-hand', C.dark, [0, -0.36, 0], [0.15, 0.12, 0.16]);

    const leftLeg = makeGroup(variation, 'joint-leftLeg');
    leftLeg.position.set(-0.12, 0.34, 0);
    addBox(leftLeg, 'robot-left-leg', C.dark, [0, -0.13, 0], [0.13, 0.26, 0.15]);
    addBox(leftLeg, 'robot-left-foot', C.wood, [0, -0.29, 0.04], [0.2, 0.09, 0.26]);

    const rightLeg = makeGroup(variation, 'joint-rightLeg');
    rightLeg.position.set(0.12, 0.34, 0);
    addBox(rightLeg, 'robot-right-leg', C.dark, [0, -0.13, 0], [0.13, 0.26, 0.15]);
    addBox(rightLeg, 'robot-right-foot', C.wood, [0, -0.29, 0.04], [0.2, 0.09, 0.26]);

    return { head, torso, leftArm, rightArm, leftLeg, rightLeg };
  };

  const buildPhone = (root: THREE.Group): void => {
    addBox(root, 'phone-body', C.dark, [0, 0.37, 0], [0.42, 0.74, 0.085]);
    addBox(root, 'phone-screen', C.glass, [0, 0.39, 0.052], [0.34, 0.59, 0.02], false, [0, 0, 0], { emissive: C.glass, emissiveIntensity: 0.08 });
    addBox(root, 'phone-status-bar', C.teal, [0, 0.64, 0.066], [0.25, 0.025, 0.014], false);
    addBox(root, 'phone-card', C.cream, [0, 0.44, 0.067], [0.22, 0.18, 0.016]);
    addSphere(root, 'phone-button', C.cream, [0, 0.075, 0.055], [0.05, 0.04, 0.025]);
  };

  const buildScreen = (root: THREE.Group): void => {
    addBox(root, 'screen-foot', C.dark, [0, 0.045, 0], [0.42, 0.09, 0.26]);
    addBox(root, 'screen-stand', C.stone, [0, 0.2, -0.04], [0.09, 0.27, 0.1]);
    addBox(root, 'screen-bezel', C.dark, [0, 0.51, -0.015], [0.8, 0.53, 0.09]);
    addBox(root, 'screen-glass', C.glass, [0, 0.51, 0.036], [0.68, 0.41, 0.02], false, [0, 0, 0], { emissive: C.glass, emissiveIntensity: 0.08 });
    addBox(root, 'screen-window', C.cream, [-0.13, 0.54, 0.052], [0.3, 0.19, 0.018]);
    for (let index = 0; index < 3; index++) {
      addBox(root, 'screen-chart-bar-' + index, [C.coral, C.yellow, C.teal][index], [0.16 + index * 0.11, 0.45 + index * 0.045, 0.063], [0.06, 0.1 + index * 0.09, 0.025]);
    }
  };

  const buildDocument = (root: THREE.Group): void => {
    addBox(root, 'document-clipboard', C.wood, [0, 0.36, 0], [0.58, 0.72, 0.065]);
    addBox(root, 'document-paper', C.cream, [0, 0.36, 0.04], [0.5, 0.61, 0.025], false);
    addBox(root, 'document-clip', C.dark, [0, 0.69, 0.065], [0.18, 0.07, 0.035]);
    for (let index = 0; index < 5; index++) {
      addBox(root, 'document-line-' + index, index === 0 ? C.teal : C.stone, [-0.02, 0.56 - index * 0.095, 0.058], [0.34 - (index % 2) * 0.06, 0.018, 0.012], false);
    }
  };

  const buildBook = (root: THREE.Group, id: string): void => {
    const cover = HUMAN_CLOTHES[hashSeed(id) % HUMAN_CLOTHES.length];
    addBox(root, 'book-pages', C.cream, [0, 0.36, 0], [0.57, 0.65, 0.17]);
    addBox(root, 'book-front-cover', cover, [0, 0.36, 0.095], [0.6, 0.69, 0.045]);
    addBox(root, 'book-back-cover', C.terracotta, [0, 0.36, -0.095], [0.6, 0.69, 0.04]);
    addBox(root, 'book-title-block', C.yellow, [0, 0.43, 0.122], [0.34, 0.22, 0.018]);
    addBox(root, 'book-title-line', C.wood, [0, 0.43, 0.134], [0.23, 0.025, 0.012], false);
    addBox(root, 'book-spine', C.wood, [-0.3, 0.36, 0], [0.055, 0.69, 0.2]);
  };

  const buildMug = (root: THREE.Group): void => {
    addMesh(root, 'cylinder', 'mug-body', C.coral, [0, 0.23, 0], [0.38, 0.46, 0.34]);
    addMesh(root, 'torus', 'mug-rim', C.wood, [0, 0.46, 0], [0.39, 0.39, 0.08]);
    addMesh(root, 'torus', 'mug-handle', C.cream, [0.23, 0.25, 0], [0.27, 0.27, 0.09]);
    addBox(root, 'mug-tea', C.terracotta, [0, 0.435, 0], [0.27, 0.015, 0.24], false);
  };

  const buildCart = (root: THREE.Group): void => {
    addBox(root, 'cart-basket-base', C.wood, [0, 0.36, -0.03], [0.63, 0.08, 0.42]);
    for (const x of [-0.3, 0.3]) {
      addBox(root, 'cart-basket-side', C.teal, [x, 0.52, -0.03], [0.06, 0.34, 0.47]);
    }
    for (const z of [-0.23, 0.17]) addBox(root, 'cart-basket-end', C.teal, [0, 0.52, z], [0.63, 0.34, 0.06]);
    for (let index = 0; index < 4; index++) {
      const y = 0.42 + index * 0.065;
      addBox(root, 'cart-wire-' + index, C.cream, [0, y, -0.24], [0.56, 0.025, 0.025], false);
      addBox(root, 'cart-wire-' + index, C.cream, [0, y, 0.19], [0.56, 0.025, 0.025], false);
    }
    for (const x of [-0.23, 0.23]) {
      addBox(root, 'cart-handle-support', C.dark, [x, 0.68, -0.05], [0.045, 0.47, 0.045], false, [0.17, 0, 0]);
      addMesh(root, 'torus', 'cart-wheel', C.dark, [x, 0.08, 0.14], [0.17, 0.17, 0.08], [Math.PI / 2, 0, 0]);
    }
  };

  const buildBag = (root: THREE.Group): void => {
    addBox(root, 'bag-body', C.blue, [0, 0.31, 0], [0.59, 0.55, 0.34]);
    addBox(root, 'bag-front-pocket', C.coral, [0, 0.23, 0.18], [0.38, 0.25, 0.04]);
    addBox(root, 'bag-pocket-tag', C.yellow, [0, 0.24, 0.21], [0.14, 0.08, 0.025]);
    for (const x of [-0.16, 0.16]) addBox(root, 'bag-handle', C.wood, [x, 0.65, -0.04], [0.08, 0.25, 0.08], false, [0, 0, x < 0 ? -0.3 : 0.3]);
    addBox(root, 'bag-top-handle', C.dark, [0, 0.65, -0.04], [0.33, 0.07, 0.07]);
  };

  const buildCalendar = (root: THREE.Group): void => {
    addBox(root, 'calendar-backing', C.wood, [0, 0.36, 0], [0.63, 0.72, 0.07]);
    addBox(root, 'calendar-page', C.cream, [0, 0.34, 0.05], [0.54, 0.58, 0.025], false);
    addBox(root, 'calendar-month-bar', C.coral, [0, 0.6, 0.07], [0.54, 0.11, 0.025], false);
    for (let index = 0; index < 7; index++) {
      const x = -0.19 + (index % 4) * 0.13;
      const y = 0.43 - Math.floor(index / 4) * 0.15;
      addBox(root, 'calendar-day-' + index, index === 5 ? C.yellow : C.teal, [x, y, 0.075], [0.075, 0.075, 0.02]);
    }
    for (const x of [-0.19, 0, 0.19]) addMesh(root, 'torus', 'calendar-ring', C.dark, [x, 0.7, 0.04], [0.1, 0.11, 0.025]);
  };

  const buildPoster = (root: THREE.Group): void => {
    addBox(root, 'poster-board', C.wood, [0, 0.48, 0], [0.67, 0.8, 0.065]);
    addBox(root, 'poster-paper', C.cream, [0, 0.48, 0.05], [0.57, 0.7, 0.022], false);
    addBox(root, 'poster-art', C.coral, [0, 0.56, 0.067], [0.34, 0.26, 0.022]);
    addSphere(root, 'poster-sun', C.yellow, [0, 0.58, 0.087], [0.15, 0.15, 0.025]);
    addBox(root, 'poster-caption-one', C.teal, [0, 0.3, 0.067], [0.39, 0.025, 0.015], false);
    addBox(root, 'poster-caption-two', C.stone, [0, 0.23, 0.067], [0.28, 0.02, 0.015], false);
    addBox(root, 'poster-stand-left', C.wood, [-0.23, 0.08, -0.04], [0.05, 0.16, 0.05]);
    addBox(root, 'poster-stand-right', C.wood, [0.23, 0.08, -0.04], [0.05, 0.16, 0.05]);
  };

  const buildMicrophone = (root: THREE.Group): void => {
    addMesh(root, 'cylinder', 'microphone-base', C.dark, [0, 0.04, 0], [0.35, 0.08, 0.35]);
    addCylinder(root, 'microphone-stand', C.wood, [0, 0.31, 0], [0.04, 0.5, 0.04]);
    addSphere(root, 'microphone-head', C.dark, [0, 0.62, 0], [0.2, 0.23, 0.2]);
    for (const y of [0.58, 0.63, 0.68]) addBox(root, 'microphone-grill', C.stone, [0, y, 0.098], [0.13, 0.012, 0.015], false);
    addBox(root, 'microphone-band', C.coral, [0, 0.51, 0], [0.18, 0.045, 0.18]);
  };

  const buildCamera = (root: THREE.Group, isProp = false): void => {
    const baseY = isProp ? 0.4 : 0.5;
    addMesh(root, 'cylinder', 'camera-tripod-hub', C.dark, [0, baseY - 0.05, 0], [0.14, 0.12, 0.14]);
    if (isProp) {
      for (const [x, z] of [[-0.24, 0.18], [0.24, 0.18], [0, -0.26]] as const) {
        addBox(root, 'camera-tripod-leg', C.dark, [x / 2, 0.21, z / 2], [0.045, 0.42, 0.045], false, [x * 0.45, 0, z * 0.25]);
      }
    }
    addBox(root, 'camera-body', C.dark, [0, baseY, 0], [0.53, 0.36, 0.3]);
    addMesh(root, 'cylinder', 'camera-lens', C.ink, [0, baseY, 0.18], [0.25, 0.21, 0.25], [Math.PI / 2, 0, 0]);
    addMesh(root, 'cylinder', 'camera-lens-glass', C.glass, [0, baseY, 0.245], [0.16, 0.035, 0.16], [Math.PI / 2, 0, 0]);
    addBox(root, 'camera-viewfinder', C.teal, [0, baseY + 0.23, -0.03], [0.19, 0.12, 0.14]);
    addSphere(root, 'camera-record-light', C.coral, [0.19, baseY + 0.13, 0.14], [0.055, 0.055, 0.035]);
  };

  const buildChart = (root: THREE.Group): void => {
    addBox(root, 'chart-board', C.cream, [0, 0.39, 0], [0.72, 0.74, 0.06]);
    addBox(root, 'chart-baseline', C.dark, [0, 0.13, 0.044], [0.57, 0.025, 0.02], false);
    addBox(root, 'chart-y-axis', C.dark, [-0.27, 0.4, 0.044], [0.025, 0.52, 0.02], false);
    for (let index = 0; index < 4; index++) {
      const h = 0.2 + index * 0.1;
      addBox(root, 'chart-column-' + index, [C.teal, C.coral, C.yellow, C.blue][index], [-0.14 + index * 0.13, 0.15 + h / 2, 0.055], [0.08, h, 0.025]);
    }
    addBox(root, 'chart-leg-left', C.wood, [-0.23, 0.04, -0.02], [0.045, 0.08, 0.045]);
    addBox(root, 'chart-leg-right', C.wood, [0.23, 0.04, -0.02], [0.045, 0.08, 0.045]);
  };

  const buildMagnifier = (root: THREE.Group): void => {
    addMesh(root, 'torus', 'magnifier-rim', C.wood, [-0.04, 0.48, 0], [0.52, 0.52, 0.08]);
    addMesh(root, 'sphere', 'magnifier-lens', C.glass, [-0.04, 0.48, -0.02], [0.37, 0.37, 0.025], [0, 0, 0], { opacity: 0.42, emissive: C.glass, emissiveIntensity: 0.08 });
    addBox(root, 'magnifier-handle', C.wood, [0.19, 0.17, 0], [0.11, 0.39, 0.1], true, [0, 0, -0.52]);
  };

  const buildShield = (root: THREE.Group): void => {
    addMesh(root, 'shield', 'shield-body', C.teal, [0, 0.43, 0], [0.62, 0.72, 0.16]);
    addBox(root, 'shield-check-left', C.cream, [-0.075, 0.4, 0.1], [0.09, 0.24, 0.04], true, [0, 0, -0.7]);
    addBox(root, 'shield-check-right', C.cream, [0.08, 0.45, 0.12], [0.09, 0.36, 0.04], true, [0, 0, 0.68]);
  };

  const buildCheck = (root: THREE.Group): void => {
    addBox(root, 'check-tile', C.green, [0, 0.38, 0], [0.58, 0.58, 0.16]);
    addBox(root, 'check-short-stroke', C.cream, [-0.09, 0.35, 0.1], [0.1, 0.23, 0.04], true, [0, 0, -0.7]);
    addBox(root, 'check-long-stroke', C.cream, [0.1, 0.4, 0.12], [0.1, 0.36, 0.04], true, [0, 0, 0.68]);
  };

  const buildPlaylist = (root: THREE.Group): void => {
    addBox(root, 'playlist-panel', C.dark, [0, 0.38, 0], [0.64, 0.72, 0.07]);
    addBox(root, 'playlist-screen', C.cream, [0, 0.38, 0.045], [0.53, 0.62, 0.02], false);
    addMesh(root, 'cylinder', 'playlist-play-button', C.coral, [-0.17, 0.61, 0.067], [0.18, 0.18, 0.025], [Math.PI / 2, 0, 0]);
    for (let index = 0; index < 3; index++) {
      const y = 0.42 - index * 0.14;
      addSphere(root, 'playlist-track-dot-' + index, [C.teal, C.blue, C.green][index], [-0.17, y, 0.068], [0.07, 0.07, 0.025]);
      addBox(root, 'playlist-track-line-' + index, C.wood, [0.08, y, 0.066], [0.28, 0.035, 0.016], false);
    }
  };

  const buildGlobe = (root: THREE.Group): void => {
    addMesh(root, 'cylinder', 'globe-base', C.wood, [0, 0.05, 0], [0.48, 0.1, 0.36]);
    addCylinder(root, 'globe-stem', C.terracotta, [0, 0.18, 0], [0.09, 0.2, 0.09]);
    addSphere(root, 'globe-sphere', C.aqua, [0, 0.48, 0], [0.58, 0.58, 0.58]);
    addMesh(root, 'torus', 'globe-meridian', C.cream, [0, 0.48, 0], [0.64, 0.64, 0.08], [Math.PI / 2, 0.35, 0]);
    addMesh(root, 'torus', 'globe-equator', C.yellow, [0, 0.48, 0], [0.6, 0.6, 0.065], [Math.PI / 2, 0, 0]);
    addMesh(root, 'ico', 'globe-continent-left', C.green, [-0.09, 0.54, 0.18], [0.2, 0.15, 0.045], [0, 0, 0.35]);
    addMesh(root, 'ico', 'globe-continent-right', C.leaf, [0.14, 0.39, 0.16], [0.16, 0.11, 0.045], [0, 0, -0.25]);
  };

  const buildClapperboard = (root: THREE.Group): void => {
    addBox(root, 'clapperboard-body', C.dark, [0, 0.35, 0], [0.68, 0.54, 0.1]);
    addBox(root, 'clapperboard-face', C.cream, [0, 0.35, 0.06], [0.57, 0.4, 0.025], false);
    for (let index = 0; index < 4; index++) {
      addBox(root, 'clapperboard-field-' + index, [C.coral, C.yellow, C.teal, C.green][index], [-0.2 + index * 0.13, 0.35, 0.08], [0.085, 0.31, 0.025], false);
    }
    addBox(root, 'clapperboard-hinge', C.wood, [0, 0.66, -0.005], [0.72, 0.1, 0.12], true, [0, 0, -0.08]);
    for (let index = 0; index < 5; index++) {
      addBox(root, 'clapperboard-stripe-' + index, index % 2 ? C.dark : C.cream, [-0.28 + index * 0.14, 0.67, 0.06], [0.08, 0.1, 0.025], false, [0, 0, -0.08]);
    }
  };

  const buildLightbulb = (root: THREE.Group): void => {
    addSphere(root, 'lightbulb-globe', C.yellow, [0, 0.49, 0], [0.42, 0.42, 0.42]);
    addMesh(root, 'cone', 'lightbulb-neck', C.wood, [0, 0.22, 0], [0.21, 0.22, 0.21]);
    addBox(root, 'lightbulb-base', C.dark, [0, 0.09, 0], [0.19, 0.1, 0.19]);
    for (let index = 0; index < 8; index++) {
      const angle = (Math.PI * 2 * index) / 8;
      addSphere(root, 'lightbulb-ray-' + index, C.coral, [Math.cos(angle) * 0.31, 0.5 + Math.sin(angle) * 0.31, 0], [0.075, 0.075, 0.07]);
    }
  };

  const buildStop = (root: THREE.Group): void => {
    addBox(root, 'stop-button-pedestal', C.dark, [0, 0.1, 0], [0.72, 0.2, 0.68]);
    addBox(root, 'stop-button-red-face', C.coral, [0, 0.36, 0], [0.72, 0.38, 0.72]);
    addMesh(root, 'octagon', 'stop-button-hand-back', C.cream, [0, 0.38, 0.2], [0.3, 0.3, 0.04], [Math.PI / 2, 0, 0]);
    addBox(root, 'stop-hand-palm', C.cream, [0, 0.39, 0.232], [0.17, 0.18, 0.04], false);
    for (let index = 0; index < 4; index++) {
      const x = -0.11 + index * 0.073;
      const height = index === 0 || index === 3 ? 0.13 : 0.2;
      addBox(root, 'stop-hand-finger-' + index, C.cream, [x, 0.55 + (height - 0.13) / 2, 0.235], [0.047, height, 0.04], true, [0, 0, index === 0 ? -0.04 : 0]);
    }
    addBox(root, 'stop-hand-thumb', C.cream, [-0.17, 0.38, 0.232], [0.08, 0.14, 0.04], true, [0, 0, -0.55]);
  };

  const entityBuilders: Record<MissionPropKind, EntityBuilder> = {
    adult: (root, id) => { buildHuman(root, id, 'adult'); },
    child: (root, id) => { buildHuman(root, id, 'child'); },
    elder: (root, id) => { buildHuman(root, id, 'elder'); },
    robot: (root, id) => { buildRobot(root, id); },
    phone: (root) => buildPhone(root),
    screen: (root) => buildScreen(root),
    document: (root) => buildDocument(root),
    book: (root, id) => buildBook(root, id),
    mug: (root) => buildMug(root),
    cart: (root) => buildCart(root),
    bag: (root) => buildBag(root),
    calendar: (root) => buildCalendar(root),
    poster: (root) => buildPoster(root),
    microphone: (root) => buildMicrophone(root),
    camera: (root) => buildCamera(root, true),
    chart: (root) => buildChart(root),
    magnifier: (root) => buildMagnifier(root),
    shield: (root) => buildShield(root),
    check: (root) => buildCheck(root),
    heart: (root) => { addMesh(root, 'heart', 'heart-symbol', C.coral, [0, 0.43, 0], [0.75, 0.75, 0.75]); },
    playlist: (root) => buildPlaylist(root),
    globe: (root) => buildGlobe(root),
    clapperboard: (root) => buildClapperboard(root),
    lightbulb: (root) => buildLightbulb(root),
    stop: (root) => buildStop(root),
  };

  const resetModel = (model: Mission3DModel): void => {
    model.root.position.set(0, 0, 0);
    model.root.rotation.set(0, 0, 0);
    model.root.scale.set(1, 1, 1);
    if (model.joints) for (const joint of Object.values(model.joints)) joint.rotation.set(0, 0, 0);
    model.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.MeshStandardMaterial;
      material.opacity = 1;
      material.transparent = false;
      material.depthWrite = true;
    });
  };

  const assertActive = (): void => {
    if (disposed) throw new Error('Mission 3D assets are disposed');
  };

  return {
    room(setting) {
      assertActive();
      if (!MISSION_SETTINGS.includes(setting)) throw new Error('Unknown mission setting: ' + setting);
      const cached = rooms.get(setting);
      if (cached) return cached;
      const root = new THREE.Group();
      root.name = 'mission-room-' + setting;
      root.userData.setting = setting;
      buildRoomTrim(root, setting);
      buildSceneTable(root, setting);
      roomBuilders[setting](root);
      rooms.set(setting, root);
      return root;
    },
    entity(kind, id) {
      assertActive();
      if (!MISSION_PROPS.includes(kind)) throw new Error('Unknown mission prop: ' + kind);
      const cacheKey = kind + ':' + id;
      const cached = entities.get(cacheKey);
      if (cached) {
        resetModel(cached);
        return cached;
      }
      const root = new THREE.Group();
      root.name = 'mission-entity-' + kind + '-' + id;
      root.userData.kind = kind;
      root.userData.id = id;
      let joints: MissionActorJoints | undefined;
      if (kind === 'adult' || kind === 'child' || kind === 'elder') joints = buildHuman(root, id, kind);
      else if (kind === 'robot') joints = buildRobot(root, id);
      else entityBuilders[kind](root, id);
      const model: Mission3DModel = joints ? { root, joints } : { root };
      entities.set(cacheKey, model);
      return model;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const value of geometryCache.values()) value.dispose();
      for (const value of materials) value.dispose();
      geometryCache.clear();
      materials.clear();
      rooms.clear();
      entities.clear();
    },
  };
}

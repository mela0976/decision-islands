import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { GeometryKind, ModelKit, ModelKind, ModelPlacement } from './explorer-types';
import { hashSeed, mulberry32 } from './explorer-random';

export type ModelWriter = (kind: GeometryKind, matrix: THREE.Matrix4, color: string, owner: string) => void;
export type ModelBuilder = (placement: ModelPlacement, random: () => number, push: ModelWriter) => void;

type Part = {
  kind: GeometryKind;
  position: readonly [number, number, number];
  size: readonly [number, number, number];
  color: string;
  rotation?: readonly [number, number, number];
};

const C = {
  cream: '#fff8f0', paper: '#f4ebdd', coral: '#db6a41', terracotta: '#a34e34', ink: '#211d1d',
  yellow: '#fcea8b', stone: '#c5b5a7', wood: '#b48560', glass: '#86a8a6', teal: '#3e7c8c',
  green: '#71806a', leaf: '#9cc27a', leaf2: '#8db86f', blush: '#f2b5c6', blue: '#6f7fb5',
  aqua: '#58a6a6', dark: '#39464a',
} as const;

function add(push: ModelWriter, placement: ModelPlacement, part: Part, random: () => number): void {
  const [x, y, z] = part.position;
  const [sx, sy, sz] = part.size;
  const rotation = placement.rotation ?? 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const worldX = placement.position[0] + (x * cos + z * sin) * placement.scale;
  const worldZ = placement.position[2] + (z * cos - x * sin) * placement.scale;
  const jitter = 1 + (random() * 2 - 1) * 0.0072;
  const [rx, ry, rz] = part.rotation ?? [0, 0, 0];
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(worldX, placement.position[1] + y * placement.scale, worldZ),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, rotation + ry, rz)),
    new THREE.Vector3(sx * placement.scale * jitter, sy * placement.scale * jitter, sz * placement.scale * jitter),
  );
  push(part.kind, matrix, part.color, placement.id);
}

function model(parts: (placement: ModelPlacement, random: () => number) => Part[], accentIndex = 0): ModelBuilder {
  return (placement, random, push) => {
    const components = parts(placement, random);
    if (components[accentIndex]) components[accentIndex] = { ...components[accentIndex], color: placement.color };
    for (const part of components) add(push, placement, part, random);
  };
}

const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, kind: GeometryKind = 'rbox', rotation?: readonly [number, number, number]): Part => ({ kind, position: [x, y, z], size: [sx, sy, sz], color, rotation });
const post = (x: number, y: number, z: number, h: number, color: string = C.paper, radius = 0.045): Part => ({ kind: 'cylinder', position: [x, y, z], size: [radius * 2, h, radius * 2], color });

export const MODEL_BUILDERS: Record<ModelKind, ModelBuilder> = {
  book: model(() => [
    box(0, 0.06, 0, 0.82, 0.12, 0.62, C.wood),
    box(-0.19, 0.17, 0, 0.38, 0.11, 0.52, C.cream, 'rbox', [0, 0, -0.1]),
    box(0.19, 0.17, 0, 0.38, 0.11, 0.52, C.cream, 'rbox', [0, 0, 0.1]),
    box(-0.41, 0.17, 0, 0.055, 0.25, 0.63, C.coral),
    box(0.02, 0.23, 0, 0.045, 0.018, 0.35, C.yellow, 'box'),
    box(0, 0.31, 0, 0.66, 0.035, 0.42, C.coral),
    box(0, 0.34, 0, 0.52, 0.018, 0.31, C.paper, 'rbox'),
  ], 3),
  pavilion: model(() => [
    box(0, 0.06, 0, 0.9, 0.12, 0.82, C.stone),
    ...[-0.36, 0.36].flatMap(x => [-0.3, 0.3].map(z => post(x, 0.52, z, 0.86))),
    box(0, 0.97, 0, 0.96, 0.13, 0.9, C.terracotta, 'hip'),
    box(0, 0.8, 0, 0.84, 0.09, 0.78, C.coral),
    box(0, 0.22, 0.23, 0.38, 0.09, 0.16, C.wood),
    box(0, 0.3, 0.23, 0.38, 0.05, 0.04, C.wood, 'box'),
    { kind: 'glowbox', position: [0, 0.66, 0], size: [0.12, 0.08, 0.12], color: C.yellow },
    { kind: 'glowsphere', position: [0, 0.72, 0], size: [0.09, 0.09, 0.09], color: C.yellow },
  ], 2),
  classroom: model(() => [
    box(0, 0.38, 0, 0.88, 0.74, 0.72, C.paper),
    box(0, 0.79, -0.02, 0.94, 0.1, 0.82, C.coral, 'hip'),
    box(0, 0.43, 0.371, 0.4, 0.36, 0.035, C.green),
    box(-0.27, 0.44, 0.395, 0.018, 0.27, 0.014, C.cream, 'box'),
    box(0.26, 0.44, 0.395, 0.018, 0.27, 0.014, C.cream, 'box'),
    ...[-0.25, 0.05, 0.35].flatMap(x => [
      box(x, 0.2, -0.27, 0.2, 0.045, 0.16, C.wood),
      post(x - 0.065, 0.09, -0.31, 0.15, C.wood, 0.018), post(x + 0.065, 0.09, -0.31, 0.15, C.wood, 0.018),
    ]),
    box(-0.27, 0.4, -0.37, 0.16, 0.24, 0.035, C.glass, 'glowbox'),
    box(0.27, 0.4, -0.37, 0.16, 0.24, 0.035, C.glass, 'glowbox'),
    box(0.04, 0.12, 0.4, 0.16, 0.22, 0.04, C.wood),
  ], 1),
  observatory: model(() => [
    box(0, 0.36, 0, 0.82, 0.72, 0.78, C.paper),
    box(0, 0.75, 0, 0.92, 0.12, 0.88, C.teal),
    { kind: 'dome', position: [0, 0.95, 0], size: [0.76, 0.55, 0.76], color: C.blue },
    { kind: 'cylinder', position: [0.02, 1.12, 0.03], size: [0.13, 0.72, 0.13], color: C.wood, rotation: [0.2, 0, -0.8] },
    post(-0.25, 0.52, 0.18, 0.33, C.terracotta), post(0.25, 0.52, 0.18, 0.33, C.terracotta),
    box(0, 0.2, 0.402, 0.17, 0.28, 0.035, C.glass, 'glowbox'),
    box(-0.22, 0.2, 0.402, 0.15, 0.27, 0.035, C.glass, 'glowbox'),
  ], 2),
  studio: model(() => [
    box(0, 0.36, 0, 0.88, 0.72, 0.76, C.paper),
    box(0, 0.79, -0.02, 0.96, 0.11, 0.88, C.blue, 'prism'),
    box(0, 0.48, 0.405, 0.34, 0.43, 0.06, C.wood, 'rbox', [0, 0, -0.08]),
    box(0, 0.5, 0.444, 0.26, 0.33, 0.025, C.coral),
    box(0, 0.5, 0.46, 0.17, 0.22, 0.018, C.yellow),
    box(-0.27, 0.41, -0.39, 0.19, 0.27, 0.035, C.glass, 'glowbox'),
    { kind: 'sphere', position: [0.31, 0.2, 0.32], size: [0.17, 0.09, 0.13], color: C.blush },
    post(0.31, 0.11, 0.32, 0.17, C.wood, 0.022),
    box(0, 0.1, -0.46, 0.34, 0.18, 0.025, C.terracotta),
  ], 1),
  bridge: model(() => {
    const parts: Part[] = [
      box(-0.42, 0.14, 0, 0.16, 0.28, 0.9, C.stone), box(0.42, 0.14, 0, 0.16, 0.28, 0.9, C.stone),
      box(0, 0.13, 0, 0.66, 0.12, 0.72, C.wood),
      box(0, 0.29, -0.34, 0.72, 0.045, 0.045, C.terracotta), box(0, 0.29, 0.34, 0.72, 0.045, 0.045, C.terracotta),
    ];
    for (let i = 0; i < 5; i++) {
      const x = -0.28 + i * 0.14;
      const arch = 0.32 + Math.sin((i / 4) * Math.PI) * 0.1;
      parts.push(box(x, arch, -0.34, 0.045, 0.14 + Math.sin((i / 4) * Math.PI) * 0.09, 0.045, C.terracotta));
      parts.push(box(x, arch, 0.34, 0.045, 0.14 + Math.sin((i / 4) * Math.PI) * 0.09, 0.045, C.terracotta));
    }
    return parts;
  }, 2),
  garden: model((_placement, random) => {
    const parts: Part[] = [
      box(-0.29, 0.1, 0, 0.27, 0.18, 0.84, C.wood),
      box(0, 0.1, 0, 0.27, 0.18, 0.84, C.terracotta),
      box(0.29, 0.1, 0, 0.27, 0.18, 0.84, C.wood),
    ];
    for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
      const x = -0.29 + row * 0.29;
      const z = -0.28 + column * 0.27;
      parts.push(post(x, 0.31, z, 0.28 + random() * 0.12, C.green, 0.018));
      parts.push({ kind: random() > 0.45 ? 'sphere' : 'ico', position: [x, 0.5 + random() * 0.04, z], size: [0.16, 0.15, 0.15], color: [C.leaf, C.leaf2, C.blush][Math.floor(random() * 3)] });
    }
    parts.push(box(0, 0.15, 0.48, 0.62, 0.08, 0.06, C.stone));
    return parts;
  }, 1),
  stage: model(() => [
    box(0, 0.08, 0, 0.95, 0.16, 0.82, C.wood),
    box(0, 0.28, -0.02, 0.83, 0.22, 0.68, C.coral),
    box(0, 0.56, -0.37, 0.78, 0.56, 0.07, C.blue),
    box(-0.41, 0.52, -0.32, 0.12, 0.66, 0.12, C.blush),
    box(0.41, 0.52, -0.32, 0.12, 0.66, 0.12, C.blush),
    ...[-0.28, 0, 0.28].map(x => ({ kind: 'glowbox' as const, position: [x, 1.08, -0.26] as const, size: [0.11, 0.12, 0.11] as const, color: C.yellow })),
    box(-0.24, 0.2, 0.25, 0.16, 0.26, 0.11, C.teal),
    box(0.24, 0.2, 0.25, 0.16, 0.26, 0.11, C.teal),
  ], 1),
  clock: model(() => [
    box(0, 0.43, 0, 0.64, 0.86, 0.58, C.paper),
    box(0, 0.97, 0, 0.72, 0.22, 0.66, C.coral, 'hip'),
    box(0, 1.02, 0.32, 0.35, 0.35, 0.06, C.cream, 'rbox'),
    { kind: 'cylinder', position: [0, 1.02, 0.36], size: [0.24, 0.045, 0.24], color: C.wood, rotation: [Math.PI / 2, 0, 0] },
    box(0, 1.03, 0.39, 0.018, 0.15, 0.018, C.ink, 'box'),
    box(0.035, 0.99, 0.4, 0.11, 0.018, 0.018, C.ink, 'box', [0, 0, -0.45]),
    box(-0.2, 0.42, 0.303, 0.12, 0.33, 0.04, C.glass, 'glowbox'),
    box(0.2, 0.42, 0.303, 0.12, 0.33, 0.04, C.glass, 'glowbox'),
    box(0, 0.12, 0.3, 0.16, 0.24, 0.04, C.wood),
  ], 1),
  globe: model(() => [
    box(0, 0.05, 0, 0.55, 0.1, 0.46, C.wood),
    { kind: 'cylinder', position: [0, 0.31, 0], size: [0.1, 0.42, 0.1], color: C.terracotta },
    { kind: 'sphere', position: [0, 0.83, 0], size: [0.74, 0.74, 0.74], color: C.aqua },
    { kind: 'torus', position: [0, 0.83, 0], size: [0.92, 0.92, 0.92], color: C.cream, rotation: [Math.PI / 2.6, 0, 0.18] },
    { kind: 'torus', position: [0, 0.83, 0], size: [0.72, 0.72, 0.72], color: C.yellow, rotation: [Math.PI / 2, 0.5, 0] },
    { kind: 'ico', position: [-0.12, 0.91, 0.12], size: [0.18, 0.1, 0.12], color: C.leaf },
    { kind: 'ico', position: [0.19, 0.7, -0.09], size: [0.13, 0.1, 0.12], color: C.leaf2 },
  ], 2),
  workshop: model(() => [
    box(0, 0.35, 0, 0.86, 0.7, 0.72, C.wood),
    box(0, 0.79, 0, 0.94, 0.12, 0.86, C.terracotta, 'hip'),
    box(0, 0.43, 0.37, 0.31, 0.48, 0.035, C.dark),
    box(-0.3, 0.42, -0.38, 0.18, 0.3, 0.035, C.glass, 'glowbox'),
    box(0.3, 0.42, -0.38, 0.18, 0.3, 0.035, C.glass, 'glowbox'),
    box(0, 0.25, -0.12, 0.54, 0.09, 0.36, C.wood),
    ...[-0.19, 0.19].map(x => post(x, 0.12, -0.12, 0.22, C.wood, 0.022)),
    post(0.29, 0.98, -0.23, 0.42, C.stone, 0.07),
    { kind: 'glowbox', position: [0.12, 0.33, -0.14], size: [0.15, 0.045, 0.08], color: C.yellow },
  ], 1),
  lighthouse: model(() => [
    { kind: 'cylinder', position: [0, 0.57, 0], size: [0.5, 1.12, 0.5], color: C.paper },
    { kind: 'cylinder', position: [0, 0.15, 0], size: [0.67, 0.17, 0.67], color: C.terracotta },
    { kind: 'cylinder', position: [0, 0.9, 0], size: [0.55, 0.1, 0.55], color: C.coral },
    box(0, 1.18, 0, 0.36, 0.27, 0.36, C.glass, 'glowbox'),
    { kind: 'cone', position: [0, 1.39, 0], size: [0.49, 0.21, 0.49], color: C.coral },
    { kind: 'torus', position: [0, 1.04, 0], size: [0.69, 0.69, 0.69], color: C.wood, rotation: [Math.PI / 2, 0, 0] },
    ...[-0.17, 0, 0.17].map(x => box(x, 0.58, 0.252, 0.09, 0.2, 0.04, C.glass, 'glowbox')),
    box(0, 0.1, 0, 0.72, 0.1, 0.72, C.stone),
  ], 2),
};

function createGeometry(kind: GeometryKind): THREE.BufferGeometry {
  switch (kind) {
    case 'box': case 'glowbox': return new THREE.BoxGeometry(1, 1, 1);
    case 'rbox': return new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
    case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
    case 'cone': return new THREE.CylinderGeometry(0, 0.5, 1, 14);
    case 'sphere': case 'glowsphere': return new THREE.SphereGeometry(0.5, 14, 10);
    case 'ico': return new THREE.IcosahedronGeometry(0.5, 1);
    case 'dome': return new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    case 'torus': return new THREE.TorusGeometry(0.37, 0.065, 7, 18);
    case 'prism': return new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1);
    case 'hip': {
      const geometry = new THREE.CylinderGeometry(0, 0.5, 1, 4, 1);
      geometry.rotateY(Math.PI / 4);
      return geometry;
    }
  }
}

const MODEL_KINDS: readonly ModelKind[] = ['book', 'pavilion', 'classroom', 'observatory', 'studio', 'bridge', 'garden', 'stage', 'clock', 'globe', 'workshop', 'lighthouse'];
const GEOMETRY_KINDS: readonly GeometryKind[] = ['box', 'rbox', 'cylinder', 'cone', 'sphere', 'ico', 'dome', 'torus', 'prism', 'hip', 'glowbox', 'glowsphere'];

export function createModelKit(placements: readonly ModelPlacement[], seed: number): ModelKit {
  const group = new THREE.Group();
  group.name = 'explorer-model-kit';
  const geometryByKind = new Map<GeometryKind, THREE.BufferGeometry>();
  const materialByKind = new Map<GeometryKind, THREE.MeshStandardMaterial>();
  const meshesByKind = new Map<GeometryKind, THREE.InstancedMesh>();
  const ownerInstances = new Map<string, Array<{ mesh: THREE.InstancedMesh; instanceId: number; color: THREE.Color }>>();
  const ownerByMesh = new Map<THREE.InstancedMesh, string[]>();
  let disposed = false;

  const partsByKind = new Map<GeometryKind, Array<{ matrix: THREE.Matrix4; color: THREE.Color; owner: string }>>();
  const write: ModelWriter = (kind, matrix, color, owner) => {
    const parts = partsByKind.get(kind) ?? [];
    parts.push({ matrix, color: new THREE.Color(color), owner });
    partsByKind.set(kind, parts);
  };

  for (const placement of placements) {
    const builder = MODEL_BUILDERS[placement.model];
    if (!builder) throw new Error(`No explorer model builder for ${placement.model}`);
    builder(placement, mulberry32(hashSeed(seed, placement.id)), write);
  }

  for (const kind of GEOMETRY_KINDS) {
    const parts = partsByKind.get(kind);
    if (!parts?.length) continue;
    const geometry = createGeometry(kind);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0,
      emissive: kind === 'glowbox' || kind === 'glowsphere' ? new THREE.Color('#ffc777') : new THREE.Color(0x000000),
      emissiveIntensity: 0,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
    mesh.name = `explorer-model-${kind}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.geometryKind = kind;
    const meshOwners: string[] = new Array(parts.length);
    for (let instanceId = 0; instanceId < parts.length; instanceId++) {
      const part = parts[instanceId];
      mesh.setMatrixAt(instanceId, part.matrix);
      mesh.setColorAt(instanceId, part.color);
      meshOwners[instanceId] = part.owner;
      const refs = ownerInstances.get(part.owner) ?? [];
      refs.push({ mesh, instanceId, color: part.color.clone() });
      ownerInstances.set(part.owner, refs);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    geometryByKind.set(kind, geometry);
    materialByKind.set(kind, material);
    meshesByKind.set(kind, mesh);
    ownerByMesh.set(mesh, meshOwners);
  }

  return {
    group,
    hitMeshes: [...meshesByKind.values()],
    resolveHit(object, instanceId) {
      if (disposed || instanceId === undefined || !object) return null;
      const owners = ownerByMesh.get(object as THREE.InstancedMesh);
      return owners?.[instanceId] ?? null;
    },
    highlight(selected, active) {
      if (disposed) return;
      for (const [owner, instances] of ownerInstances) {
        for (const { mesh, instanceId, color } of instances) {
          const result = color.clone();
          if (active.has(owner)) result.lerp(new THREE.Color('#fcea8b'), 0.22);
          if (selected.has(owner)) result.lerp(new THREE.Color('#db6a41'), 0.22);
          mesh.setColorAt(instanceId, result);
        }
      }
      for (const mesh of meshesByKind.values()) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    setNight(night) {
      if (disposed) return;
      const intensity = Math.max(0, night) * 3.2;
      for (const [kind, material] of materialByKind) {
        if (kind === 'glowbox' || kind === 'glowsphere') material.emissiveIntensity = intensity;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      for (const geometry of geometryByKind.values()) geometry.dispose();
      for (const material of materialByKind.values()) material.dispose();
      for (const mesh of meshesByKind.values()) mesh.dispose();
      geometryByKind.clear();
      materialByKind.clear();
      meshesByKind.clear();
      ownerInstances.clear();
      ownerByMesh.clear();
    },
  };
}

export { MODEL_KINDS, GEOMETRY_KINDS };

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DaySnapshot, ExplorerData } from './explorer-types';
import { hashSeed, mulberry32 } from './explorer-random';
import { HOLIDAYS, type Season } from './season';

export interface ExplorerEnvironment {
  group: THREE.Group;
  fog: THREE.Fog;
  readonly waterMaterial: THREE.ShaderMaterial;
  applyDay(day: DaySnapshot): void;
  update(dtSeconds: number): void;
  setMobile(mobile: boolean): void;
  setSeason(season: Season): void;
  dispose(): void;
}

type Cloud = { mesh: THREE.Mesh; speed: number; range: number };
type SeasonalMesh = THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
type SeasonalMeshes = { group: THREE.Group; meshes: SeasonalMesh[] };

function present<T>(value: T | null): value is T { return value !== null; }

const color = (hex: string): THREE.Color => new THREE.Color(hex.startsWith('#') ? hex : `#${hex}`);
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const smoothstep = (a: number, b: number, value: number): number => {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function makeMerged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('Could not merge explorer environment geometry');
  return merged;
}

function terrainHeight(x: number, z: number, noise: (x: number, z: number) => number): number {
  const radius = Math.hypot(x, z);
  const rise = smoothstep(25, 50, radius);
  const front = smoothstep(-7, 42, z);
  const broad = 1.7 + noise(x * 0.7, z * 0.7) * 1.1 + noise(x * 1.8, z * 1.8) * 0.38;
  const terrace = Math.floor((broad * rise) / 0.32) * 0.32;
  return -1.1 + rise * (broad + terrace * 0.34) * (1 - front * 0.58);
}

function makeNoise(seed: number): (x: number, z: number) => number {
  const random = mulberry32(hashSeed(seed, 'basin-fbm'));
  const size = 256;
  const values = new Float32Array(size * size);
  for (let i = 0; i < values.length; i++) values[i] = random();
  const sample = (x: number, z: number): number => {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const at = (a: number, b: number) => values[((b % size + size) % size) * size + ((a % size + size) % size)];
    const a = THREE.MathUtils.lerp(at(ix, iz), at(ix + 1, iz), sx);
    const b = THREE.MathUtils.lerp(at(ix, iz + 1), at(ix + 1, iz + 1), sx);
    return THREE.MathUtils.lerp(a, b, sz) * 2 - 1;
  };
  return (x, z) => {
    let total = 0, amplitude = 0.54, frequency = 0.075, norm = 0;
    for (let octave = 0; octave < 4; octave++) {
      total += sample(x * frequency + octave * 17.3, z * frequency - octave * 11.7) * amplitude;
      norm += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return total / norm;
  };
}

function makeTerrain(seed: number): THREE.BufferGeometry {
  const noise = makeNoise(seed);
  const geometry = new THREE.PlaneGeometry(170, 170, 160, 160);
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const palette = ['#8fb3ad', '#d9c9a3', '#aec493', '#a3b986', '#6f8a62', '#b2a38d'].map(color);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = -positions.getY(i);
    const y = terrainHeight(x, z, noise);
    positions.setXYZ(i, x, y, z);
    const h = clamp((y + 1.1) / 5.8, 0, 1);
    const segment = h * (palette.length - 1);
    const lower = Math.floor(segment), upper = Math.min(palette.length - 1, lower + 1);
    const shade = palette[lower].clone().lerp(palette[upper], segment - lower);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  positions.needsUpdate = true;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function makePineGeometry(): THREE.BufferGeometry {
  const parts = [
    new THREE.ConeGeometry(0.42, 0.58, 7).translate(0, 0.34, 0),
    new THREE.ConeGeometry(0.32, 0.55, 7).translate(0, 0.72, 0),
    new THREE.ConeGeometry(0.22, 0.5, 7).translate(0, 1.08, 0),
  ];
  return makeMerged(parts);
}

function makeCanopyGeometry(seed: number): THREE.BufferGeometry {
  const random = mulberry32(hashSeed(seed, 'broadleaf-lobes'));
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const size = 0.42 + random() * 0.13;
    parts.push(new THREE.IcosahedronGeometry(0.5, 0).scale(size, size, size).translate((random() - 0.5) * 0.36, 0.45 + random() * 0.68, (random() - 0.5) * 0.36));
  }
  return makeMerged(parts);
}

function makeMountainGeometry(radius: number, seed: number): THREE.BufferGeometry {
  const random = mulberry32(hashSeed(seed, `mountain-${radius}`));
  const segments = 192;
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const jitter = 1 + Math.sin(angle * (4 + radius * 0.02) + radius) * 0.035 + random() * 0.008;
    const r = radius * jitter;
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    const base = i * 2;
    const ridge = 1.5 + Math.abs(Math.sin(angle * 3.2 + radius)) * (2.1 + radius * 0.025) + Math.sin(angle * 7 + radius) * 0.42;
    positions.set([x, -1.15, z, x * 0.985, ridge, z * 0.985], base * 3);
    if (i < segments) {
      const a = base, b = base + 1, c = base + 2, d = base + 3;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeEggGeometry(): THREE.BufferGeometry {
  const points = [
    new THREE.Vector2(0, -0.5), new THREE.Vector2(0.17, -0.46), new THREE.Vector2(0.32, -0.32),
    new THREE.Vector2(0.42, -0.08), new THREE.Vector2(0.38, 0.18), new THREE.Vector2(0.27, 0.39),
    new THREE.Vector2(0.12, 0.52), new THREE.Vector2(0, 0.55),
  ];
  return new THREE.LatheGeometry(points, 16);
}

function makeStarGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI * 0.5 + i * Math.PI / 5;
    const radius = i % 2 === 0 ? 0.5 : 0.23;
    const point = new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    if (i === 0) shape.moveTo(point.x, point.y); else shape.lineTo(point.x, point.y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
  geometry.translate(0, 0, -0.06);
  return geometry;
}

function makeFlowerHeadGeometry(): THREE.BufferGeometry {
  const parts = [new THREE.IcosahedronGeometry(0.16, 0)];
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 0.4;
    parts.push(new THREE.IcosahedronGeometry(0.5, 0).scale(0.25, 0.12, 0.18).translate(Math.cos(angle) * 0.15, 0, Math.sin(angle) * 0.15));
  }
  return makeMerged(parts);
}

function makeBatGeometry(): THREE.BufferGeometry {
  const body = new THREE.SphereGeometry(0.13, 8, 6).scale(1, 0.6, 1);
  const wingGeometry = new THREE.BufferGeometry();
  wingGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0.06, 0.02, 0, 0.48, 0.03, 0, 0.3, -0.23, 0,
    0.06, 0.02, 0, 0.3, -0.23, 0, 0.13, -0.18, 0,
  ], 3));
  wingGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(Array(18).fill(0).map((_, index) => index % 3 === 2 ? 1 : 0), 3));
  wingGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.7, 1, 0, 0, 0.7, 1, 0.25, 0.8], 2));
  wingGeometry.setIndex([0, 1, 2, 3, 4, 5]);
  wingGeometry.computeVertexNormals();
  const left = wingGeometry.clone().scale(-1, 1, 1);
  return makeMerged([body, wingGeometry, left]);
}

function makeSeasons(data: ExplorerData, addGeometry: (geometry: THREE.BufferGeometry) => void, addMaterial: (material: THREE.Material) => void): Map<Season, SeasonalMeshes> {
  const all = new Map<Season, SeasonalMeshes>();
  const islandRadius = data.layout.radius;
  const islandTop = data.layout.top;
  const centers = data.islands.map(island => ({
    x: Math.sqrt(3) * data.layout.spacing * (island.axial[0] + island.axial[1] / 2),
    z: 1.5 * data.layout.spacing * island.axial[1],
  }));
  const centerFor = (index: number) => centers.length ? centers[index % centers.length] : { x: 0, z: 0 };
  const makeMesh = (group: THREE.Group, name: string, geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, matrices: THREE.Matrix4[], colors: string[], role: 'accent' | 'secondary' | 'glow'): SeasonalMesh | null => {
    if (!matrices.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.name = name;
    mesh.userData.seasonRole = role;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    for (let i = 0; i < matrices.length; i++) {
      mesh.setMatrixAt(i, matrices[i]);
      mesh.setColorAt(i, color(colors[i]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    return mesh;
  };
  const matrix = (position: THREE.Vector3, scale: THREE.Vector3, rotationY = 0, rotationZ = 0) => new THREE.Matrix4().compose(position, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, rotationZ)), scale);
  const solid = (roughness = 0.92) => {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness: 0 });
    addMaterial(material);
    return material;
  };
  const glowMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: '#ffc777', emissiveIntensity: 1.5, roughness: 0.45, metalness: 0 });
  addMaterial(glowMaterial);

  const christmas = new THREE.Group();
  christmas.name = 'season-christmas';
  const treeGeometry = makePineGeometry(); addGeometry(treeGeometry);
  const giftGeometry = new THREE.BoxGeometry(1, 1, 1); addGeometry(giftGeometry);
  const ornamentGeometry = new THREE.IcosahedronGeometry(0.5, 1); addGeometry(ornamentGeometry);
  const starGeometry = makeStarGeometry(); addGeometry(starGeometry);
  const treeMatrices: THREE.Matrix4[] = [], treeColors: string[] = [];
  const giftMatrices: THREE.Matrix4[] = [], giftColors: string[] = [];
  const lightMatrices: THREE.Matrix4[] = [], lightColors: string[] = [];
  const starMatrices: THREE.Matrix4[] = [], starColors: string[] = [];
  const christmasRandom = mulberry32(hashSeed(data.seed, 'season-christmas'));
  for (let i = 0; i < 18; i++) {
    const angle = i * 2.399963;
    const center = centerFor(i);
    const radius = islandRadius * (0.62 + christmasRandom() * 0.1);
    const x = center.x + Math.cos(angle) * radius, z = center.z + Math.sin(angle) * radius;
    const scale = 0.62 + christmasRandom() * 0.32;
    treeMatrices.push(matrix(new THREE.Vector3(x, islandTop + 0.03, z), new THREE.Vector3(scale, scale, scale), angle));
    treeColors.push(i % 3 === 0 ? '#58775c' : '#789266');
    const giftRadius = islandRadius * 0.36;
    const gx = center.x + Math.cos(angle + 0.22) * giftRadius, gz = center.z + Math.sin(angle + 0.22) * giftRadius;
    giftMatrices.push(matrix(new THREE.Vector3(gx, islandTop + 0.15, gz), new THREE.Vector3(0.32, 0.25, 0.3), christmasRandom() * Math.PI * 2));
    giftColors.push(i % 2 ? '#b84338' : '#d8b86c');
    starMatrices.push(matrix(new THREE.Vector3(x, islandTop + 1.14 * scale + 0.03, z), new THREE.Vector3(0.26 * scale, 0.26 * scale, 0.12 * scale), angle, -0.16));
    starColors.push('#ffd68a');
  }
  for (let i = 0; i < 72; i++) {
    const angle = i * 0.41;
    const center = centerFor(Math.floor(i / 6));
    const radius = islandRadius * 0.82;
    const y = islandTop + 0.18 + (i % 3) * 0.2;
    lightMatrices.push(matrix(new THREE.Vector3(center.x + Math.cos(angle) * radius, y, center.z + Math.sin(angle) * radius), new THREE.Vector3(0.09, 0.09, 0.09)));
    lightColors.push(i % 3 === 0 ? '#ffd68a' : '#fff2ce');
  }
  const christmasMeshes = [
    makeMesh(christmas, 'christmas-trees', treeGeometry, solid(), treeMatrices, treeColors, 'secondary'),
    makeMesh(christmas, 'christmas-gifts', giftGeometry, solid(), giftMatrices, giftColors, 'accent'),
    makeMesh(christmas, 'christmas-lights', ornamentGeometry, glowMaterial, lightMatrices, lightColors, 'glow'),
    makeMesh(christmas, 'christmas-star-toppers', starGeometry, glowMaterial, starMatrices, starColors, 'glow'),
  ].filter(present);
  all.set('christmas', { group: christmas, meshes: christmasMeshes });

  const halloween = new THREE.Group();
  halloween.name = 'season-halloween';
  const pumpkinGeometry = new THREE.SphereGeometry(0.5, 12, 10).scale(1, 0.8, 0.84);
  addGeometry(pumpkinGeometry);
  const stemGeometry = new THREE.CylinderGeometry(0.055, 0.07, 0.17, 7); addGeometry(stemGeometry);
  const batGeometry = makeBatGeometry(); addGeometry(batGeometry);
  const pumpkinMatrices: THREE.Matrix4[] = [], pumpkinColors: string[] = [];
  const stemMatrices: THREE.Matrix4[] = [], stemColors: string[] = [];
  const batMatrices: THREE.Matrix4[] = [], batColors: string[] = [];
  const lanternMatrices: THREE.Matrix4[] = [], lanternColors: string[] = [];
  const halloweenRandom = mulberry32(hashSeed(data.seed, 'season-halloween'));
  for (let i = 0; i < 28; i++) {
    const angle = i * 2.399963;
    const center = centerFor(i);
    const radius = islandRadius * (0.67 + halloweenRandom() * 0.12);
    const x = center.x + Math.cos(angle) * radius, z = center.z + Math.sin(angle) * radius;
    const size = 0.25 + halloweenRandom() * 0.14;
    pumpkinMatrices.push(matrix(new THREE.Vector3(x, islandTop + size * 0.5, z), new THREE.Vector3(size, size, size), angle));
    pumpkinColors.push(i % 3 === 0 ? '#c96725' : '#e47b2b');
    stemMatrices.push(matrix(new THREE.Vector3(x, islandTop + size * 0.95, z), new THREE.Vector3(size, size, size)));
    stemColors.push('#586942');
  }
  for (let i = 0; i < 22; i++) {
    const angle = i * 2.399963;
    const center = centerFor(i);
    const radius = islandRadius * 0.72;
    const x = center.x + Math.cos(angle) * radius, z = center.z + Math.sin(angle) * radius;
    const y = islandTop + 2.3 + halloweenRandom() * 1.2;
    batMatrices.push(matrix(new THREE.Vector3(x, y, z), new THREE.Vector3(0.4, 0.4, 0.4), angle));
    batColors.push('#2f223d');
  }
  for (let i = 0; i < 24; i++) {
    const angle = i * 2.399963;
    const center = centerFor(i);
    const radius = islandRadius * 0.94;
    lanternMatrices.push(matrix(new THREE.Vector3(center.x + Math.cos(angle) * radius, islandTop + 0.14, center.z + Math.sin(angle) * radius), new THREE.Vector3(0.16, 0.16, 0.16)));
    lanternColors.push(i % 2 ? '#ffb24a' : '#d8a6ff');
  }
  const halloweenMeshes = [
    makeMesh(halloween, 'halloween-pumpkins', pumpkinGeometry, solid(), pumpkinMatrices, pumpkinColors, 'accent'),
    makeMesh(halloween, 'halloween-stems', stemGeometry, solid(), stemMatrices, stemColors, 'secondary'),
    makeMesh(halloween, 'halloween-bats', batGeometry, solid(), batMatrices, batColors, 'secondary'),
    makeMesh(halloween, 'halloween-lanterns', ornamentGeometry, glowMaterial, lanternMatrices, lanternColors, 'glow'),
  ].filter(present);
  all.set('halloween', { group: halloween, meshes: halloweenMeshes });

  const easter = new THREE.Group();
  easter.name = 'season-easter';
  const eggGeometry = makeEggGeometry(); addGeometry(eggGeometry);
  const flowerGeometry = makeFlowerHeadGeometry(); addGeometry(flowerGeometry);
  const easterStemGeometry = new THREE.CylinderGeometry(0.025, 0.035, 0.66, 7).translate(0, 0.33, 0); addGeometry(easterStemGeometry);
  const eggMatrices: THREE.Matrix4[] = [], eggColors: string[] = [];
  const flowerMatrices: THREE.Matrix4[] = [], flowerColors: string[] = [];
  const easterStemMatrices: THREE.Matrix4[] = [], easterStemColors: string[] = [];
  const easterRandom = mulberry32(hashSeed(data.seed, 'season-easter'));
  const eggPalette = ['#c6a2d6', '#e8a6a7', '#f2d287', '#9cc6bd'];
  for (let i = 0; i < 42; i++) {
    const angle = i * 2.399963;
    const center = centerFor(i);
    const radius = islandRadius * (0.68 + easterRandom() * 0.13);
    const size = 0.23 + easterRandom() * 0.16;
    eggMatrices.push(matrix(new THREE.Vector3(center.x + Math.cos(angle) * radius, islandTop + size * 0.56, center.z + Math.sin(angle) * radius), new THREE.Vector3(size * 0.8, size, size * 0.8), angle));
    eggColors.push(eggPalette[i % eggPalette.length]);
  }
  for (let i = 0; i < 36; i++) {
    const angle = i * 1.7;
    const center = centerFor(i);
    const radius = islandRadius * 0.92;
    const x = center.x + Math.cos(angle) * radius, z = center.z + Math.sin(angle) * radius;
    const y = islandTop + 0.01;
    flowerMatrices.push(matrix(new THREE.Vector3(x, y + 0.34, z), new THREE.Vector3(0.46, 0.46, 0.46), angle));
    flowerColors.push(i % 2 ? '#f2b5c6' : '#fff4d8');
    easterStemMatrices.push(matrix(new THREE.Vector3(x, y, z), new THREE.Vector3(0.46, 0.46, 0.46), angle));
    easterStemColors.push('#71806a');
  }
  const easterMeshes = [
    makeMesh(easter, 'easter-eggs', eggGeometry, solid(), eggMatrices, eggColors, 'accent'),
    makeMesh(easter, 'easter-flowers', flowerGeometry, solid(), flowerMatrices, flowerColors, 'accent'),
    makeMesh(easter, 'easter-flower-stems', easterStemGeometry, solid(), easterStemMatrices, easterStemColors, 'secondary'),
  ].filter(present);
  all.set('easter', { group: easter, meshes: easterMeshes });

  for (const value of all.values()) value.group.visible = false;
  return all;
}

export function createExplorerEnvironment(data: ExplorerData): ExplorerEnvironment {
  const group = new THREE.Group();
  group.name = 'explorer-environment';
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  const ownedMeshes = new Set<THREE.InstancedMesh>();
  const clouds: Cloud[] = [];
  const seasonal: Map<Season, SeasonalMeshes> = makeSeasons(data, geometry => ownedGeometries.add(geometry), material => ownedMaterials.add(material));
  const addGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => { ownedGeometries.add(geometry); return geometry; };
  const addMaterial = <T extends THREE.Material>(material: T): T => { ownedMaterials.add(material); return material; };
  const mesh = <T extends THREE.BufferGeometry, M extends THREE.Material>(geometry: T, material: M, name: string): THREE.Mesh<T, M> => {
    const object = new THREE.Mesh(addGeometry(geometry), addMaterial(material));
    object.name = name;
    group.add(object);
    return object;
  };

  const skyUniforms = {
    uTop: { value: color('#9fd0ec') },
    uHorizon: { value: color('#f4eee3') },
    uSunDir: { value: new THREE.Vector3(0.34, 0.8, 0.48).normalize() },
    uSun: { value: color('#fff1de') },
    uNight: { value: 0 },
  };
  const skyGeometry = addGeometry(new THREE.SphereGeometry(170, 36, 22));
  const skyMaterial = addMaterial(new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `varying vec3 vSkyDirection; void main(){ vSkyDirection=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSun; uniform float uNight;
      varying vec3 vSkyDirection;
      float starHash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      void main(){
        vec3 dir=normalize(vSkyDirection);
        float blend=smoothstep(-0.02,0.55,dir.y);
        vec3 sky=mix(uHorizon,uTop,blend);
        float sun=max(dot(dir,normalize(uSunDir)),0.0);
        sky+=uSun*pow(sun,18.0)*0.35;
        vec3 cell=floor(dir*180.0);
        float star=step(0.9965,starHash(cell))*uNight;
        sky+=vec3(star*0.8);
        gl_FragColor=vec4(sky,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  mesh(skyGeometry, skyMaterial, 'explorer-sky');

  const fog = new THREE.Fog(color('#f4eee3'), 42, 150);
  const sun = new THREE.DirectionalLight(color('#fff1de'), 2.8);
  sun.name = 'explorer-sun';
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 22, bottom: -22, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.045;
  sun.shadow.radius = 3;
  sun.shadow.camera.updateProjectionMatrix();
  group.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(color('#eef6fa'), color('#8f8270'), 1.35);
  hemi.name = 'explorer-hemi';
  group.add(hemi);
  const fill = new THREE.DirectionalLight(color('#bfd6ff'), 0.35);
  fill.name = 'explorer-fill';
  fill.position.set(-24, 18, -16);
  group.add(fill);

  const waterUniforms = {
    uTime: { value: 0 },
    uWater: { value: color('#a9d8db') },
    uHorizon: { value: color('#f4eee3') },
    uFogNear: { value: 42 },
    uFogFar: { value: 150 },
  };
  const waterGeometry = new THREE.CircleGeometry(160, 64);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    vertexShader: `varying vec3 vWorld; varying float vDepth; void main(){
      vec4 local=vec4(position,1.0);
      #ifdef USE_INSTANCING
        local=instanceMatrix*local;
      #endif
      vec4 world=modelMatrix*local; vWorld=world.xyz; vec4 mv=viewMatrix*world; vDepth=-mv.z; gl_Position=projectionMatrix*mv;
    }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uWater; uniform vec3 uHorizon; uniform float uFogNear; uniform float uFogFar;
      varying vec3 vWorld; varying float vDepth;
      void main(){
        vec2 p=vWorld.xz;
        float wave=sin(p.x*0.075+uTime*0.21)+sin(p.y*0.092-uTime*0.17+sin(p.x*0.025));
        float distanceMix=smoothstep(10.0,82.0,length(p));
        vec3 shallow=vec3(0.64,0.83,0.85); vec3 deep=vec3(0.27,0.49,0.57);
        vec3 water=mix(shallow,deep,distanceMix)*0.72+uWater*0.28;
        water+=vec3(max(0.0,wave-1.75)*0.045);
        float fog=smoothstep(uFogNear,uFogFar,vDepth);
        gl_FragColor=vec4(mix(water,uHorizon,fog),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = mesh(waterGeometry, waterMaterial, 'explorer-water');
  water.position.y = data.layout.waterY;
  water.renderOrder = -2;

  const terrainNoise = makeNoise(data.seed);
  const terrainGeometry = makeTerrain(data.seed);
  const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  const terrain = mesh(terrainGeometry, terrainMaterial, 'explorer-basin-terraces');
  terrain.receiveShadow = true;
  terrain.castShadow = false;

  const mountainPalette = [0.42, 0.52, 0.62].map(() => new THREE.MeshBasicMaterial({ color: '#f4eee3', side: THREE.DoubleSide, fog: false }));
  const mountainRadii = [56, 66, 77];
  for (let i = 0; i < mountainRadii.length; i++) {
    const mountain = mesh(makeMountainGeometry(mountainRadii[i], data.seed), mountainPalette[i], `explorer-mountain-${i + 1}`);
    mountain.renderOrder = -1;
  }

  const pineGeometry = addGeometry(makePineGeometry());
  const canopyGeometry = addGeometry(makeCanopyGeometry(data.seed));
  const pineMaterial = addMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98, metalness: 0, flatShading: true }));
  const canopyMaterial = addMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98, metalness: 0, flatShading: true }));
  const treeCount = 2400;
  const pineMesh = new THREE.InstancedMesh(pineGeometry, pineMaterial, treeCount);
  const canopyMesh = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, treeCount);
  pineMesh.name = 'explorer-pine-trees';
  canopyMesh.name = 'explorer-broadleaf-trees';
  pineMesh.count = 0;
  canopyMesh.count = 0;
  pineMesh.castShadow = canopyMesh.castShadow = false;
  pineMesh.receiveShadow = canopyMesh.receiveShadow = false;
  ownedMeshes.add(pineMesh);
  ownedMeshes.add(canopyMesh);
  const treeRandom = mulberry32(hashSeed(data.seed, 'environment-trees'));
  const pineColors = ['#718f66', '#80986d', '#5c7f66'].map(color);
  const leafColors = ['#9cc27a', '#8db86f', '#728f5f', '#81a878'].map(color);
  for (let i = 0; i < treeCount; i++) {
    const angle = treeRandom() * Math.PI * 2;
    const radius = 16 + treeRandom() * 36;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const scale = 0.72 + treeRandom() * 0.92;
    const y = terrainHeight(x, z, terrainNoise) - 0.08;
    const rotation = treeRandom() * Math.PI * 2;
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation), new THREE.Vector3(scale, scale, scale));
    if (treeRandom() < 0.53) {
      const instance = pineMesh.count;
      pineMesh.setMatrixAt(instance, matrix);
      pineMesh.setColorAt(instance, pineColors[Math.floor(treeRandom() * pineColors.length)]);
      pineMesh.count = instance + 1;
    } else {
      const instance = canopyMesh.count;
      canopyMesh.setMatrixAt(instance, matrix);
      canopyMesh.setColorAt(instance, leafColors[Math.floor(treeRandom() * leafColors.length)]);
      canopyMesh.count = instance + 1;
    }
  }
  const pineCapacity = pineMesh.count;
  const canopyCapacity = canopyMesh.count;
  pineMesh.instanceMatrix.needsUpdate = true;
  canopyMesh.instanceMatrix.needsUpdate = true;
  if (pineMesh.instanceColor) pineMesh.instanceColor.needsUpdate = true;
  if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;
  group.add(pineMesh, canopyMesh);

  const cloudParts = [
    new THREE.SphereGeometry(0.5, 12, 8).scale(1.1, 0.6, 0.65).translate(-0.5, 0, 0),
    new THREE.SphereGeometry(0.5, 12, 8).scale(0.9, 0.8, 0.7).translate(0, 0.14, 0),
    new THREE.SphereGeometry(0.5, 12, 8).scale(1.1, 0.55, 0.65).translate(0.5, 0, 0),
  ];
  const cloudGeometry = addGeometry(makeMerged(cloudParts));
  const cloudMaterial = addMaterial(new THREE.MeshStandardMaterial({ color: '#fffdf8', roughness: 1, metalness: 0 }));
  const cloudRandom = mulberry32(hashSeed(data.seed, 'environment-clouds'));
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloud.name = `explorer-cloud-${i + 1}`;
    cloud.position.set(-67 + cloudRandom() * 134, 10 + cloudRandom() * 13, -60 + cloudRandom() * 120);
    const scale = 1.4 + cloudRandom() * 2.3;
    cloud.scale.set(scale, scale, scale);
    cloud.castShadow = false;
    cloud.receiveShadow = false;
    group.add(cloud);
    clouds.push({ mesh: cloud, speed: 0.16 + cloudRandom() * 0.13, range: 74 });
  }

  const propMaterial = addMaterial(new THREE.MeshStandardMaterial({ color: '#b2a38d', roughness: 0.9, metalness: 0 }));
  const propAccent = addMaterial(new THREE.MeshStandardMaterial({ color: '#fff8f0', roughness: 0.85, metalness: 0 }));
  const propGlow = addMaterial(new THREE.MeshStandardMaterial({ color: '#ffc777', emissive: '#ffc777', emissiveIntensity: 0, roughness: 0.5, metalness: 0 }));
  const remoteIslandGeometry = addGeometry(new THREE.SphereGeometry(1, 14, 8));
  const remoteIsland = mesh(remoteIslandGeometry, propMaterial, 'explorer-sea-island-west');
  remoteIsland.position.set(-48, -0.3, -31); remoteIsland.scale.set(4.5, 0.65, 3.6);
  const remoteIsland2 = new THREE.Mesh(remoteIslandGeometry, propMaterial);
  remoteIsland2.name = 'explorer-sea-island-east';
  remoteIsland2.position.set(52, -0.35, 37); remoteIsland2.scale.set(3.8, 0.55, 3.1);
  group.add(remoteIsland2);
  const towerGeometry = addGeometry(new THREE.CylinderGeometry(0.48, 0.68, 5.1, 12));
  const tower = mesh(towerGeometry, propAccent, 'explorer-remote-lighthouse');
  tower.position.set(-48, 2.3, -31);
  const towerTopGeometry = addGeometry(new THREE.ConeGeometry(0.7, 1.1, 12));
  const towerTopMaterial = addMaterial(new THREE.MeshStandardMaterial({ color: '#c96725', roughness: 0.84, metalness: 0 }));
  const towerTop = mesh(towerTopGeometry, towerTopMaterial, 'explorer-remote-lighthouse-roof');
  towerTop.position.set(-48, 5.4, -31);
  const towerLampGeometry = addGeometry(new THREE.SphereGeometry(0.25, 12, 8));
  const towerLamp = mesh(towerLampGeometry, propGlow, 'explorer-remote-lighthouse-lamp');
  towerLamp.position.set(-48, 4.7, -31);

  const boatGeometry = addGeometry(new THREE.BoxGeometry(2.3, 0.35, 0.8));
  const boat = mesh(boatGeometry, propAccent, 'explorer-sailboat-hull');
  boat.position.set(43, -0.02, -39);
  const mastGeometry = addGeometry(new THREE.CylinderGeometry(0.055, 0.055, 2.7, 7));
  const mast = mesh(mastGeometry, propMaterial, 'explorer-sailboat-mast');
  mast.position.set(43, 1.38, -39);
  const sailGeometry = new THREE.BufferGeometry();
  sailGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -1.05, 0, 0, 1.05, 0, 1.2, -0.8, 0], 3));
  sailGeometry.setIndex([0, 1, 2]);
  sailGeometry.computeVertexNormals();
  const sailMaterial = addMaterial(new THREE.MeshStandardMaterial({ color: '#fff8f0', roughness: 0.9, side: THREE.DoubleSide }));
  const sail = mesh(sailGeometry, sailMaterial, 'explorer-sailboat-sail');
  sail.position.set(43.1, 1.34, -39);

  for (const season of seasonal.values()) {
    for (const object of season.group.children) if (object instanceof THREE.InstancedMesh) ownedMeshes.add(object);
    group.add(season.group);
  }

  let currentSeason: Season = 'christmas';
  let lastDay: DaySnapshot | undefined;
  let elapsed = 0;
  let mobile = false;
  let disposed = false;
  const dayColor = (value: string) => color(value);
  const syncPalette = () => {
    if (!lastDay) return;
    const palette = HOLIDAYS[currentSeason];
    const top = dayColor(lastDay.skyTop).lerp(color(palette.sky), 0.16);
    const horizon = dayColor(lastDay.horizon).lerp(color(palette.sky), 0.22);
    const waterTone = dayColor(lastDay.water).lerp(color(palette.sea), 0.25);
    skyUniforms.uTop.value.copy(top);
    skyUniforms.uHorizon.value.copy(horizon);
    skyUniforms.uSun.value.copy(dayColor(lastDay.sunColor));
    skyUniforms.uSunDir.value.set(...lastDay.sunDirection).normalize();
    skyUniforms.uNight.value = lastDay.night;
    waterUniforms.uWater.value.copy(waterTone);
    waterUniforms.uHorizon.value.copy(horizon);
    fog.color.copy(horizon);
    hemi.color.copy(dayColor(lastDay.hemiSky));
    hemi.groundColor.copy(dayColor(lastDay.hemiGround));
    hemi.intensity = lastDay.hemiIntensity;
    sun.color.copy(dayColor(lastDay.sunColor));
    sun.intensity = lastDay.sunIntensity;
    const direction = new THREE.Vector3(...lastDay.sunDirection).normalize();
    sun.position.copy(direction.multiplyScalar(40));
    fill.intensity = lastDay.hemiIntensity * 0.26;
    propGlow.emissiveIntensity = lastDay.night * 3.2;
    propGlow.color.copy(color(palette.glow));
    propGlow.emissive.copy(color(palette.glow));
    const mountainColor = horizon.clone().lerp(color(palette.secondary), 0.1);
    for (const material of mountainPalette) material.color.copy(mountainColor);
    cloudMaterial.color.copy(color(palette.paper).lerp(new THREE.Color('#ffffff'), 0.28));
    for (const values of seasonal.values()) {
      for (const seasonalMesh of values.meshes) {
        if ((seasonalMesh.userData.seasonRole as string) === 'glow') {
          const material = seasonalMesh.material as THREE.MeshStandardMaterial;
          material.emissive.copy(color(palette.glow));
          material.emissiveIntensity = 0.35 + lastDay.night * 2.4;
        }
      }
    }
  };
  const setSeason = (season: Season) => {
    if (disposed || !Object.hasOwn(HOLIDAYS, season)) return;
    currentSeason = season;
    for (const [key, value] of seasonal) value.group.visible = key === season;
    const active = seasonal.get(season)!;
    const palette = HOLIDAYS[season];
    for (const mesh of active.meshes) {
      const role = mesh.userData.seasonRole as 'accent' | 'secondary' | 'glow';
      const tint = role === 'accent' ? palette.accent : role === 'secondary' ? palette.secondary : palette.glow;
      const base = color(tint);
      for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, base.clone().lerp(new THREE.Color('#ffffff'), (i % 4) * 0.035));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.set('#ffffff');
      if (role === 'glow') material.emissive.copy(color(palette.glow));
    }
    syncPalette();
  };

  const defaultKeyframe = data.dayKeyframes.find(frame => frame.minute === 720) ?? data.dayKeyframes[0];
  if (defaultKeyframe) {
    const day: DaySnapshot = { ...defaultKeyframe, sunDirection: [0.34, 0.8, 0.48] };
    lastDay = day;
  } else {
    lastDay = { minute: 720, skyTop: '9fd0ec', horizon: 'f4eee3', sunColor: 'fff1de', sunIntensity: 2.9, hemiSky: 'eef6fa', hemiGround: '8f8270', hemiIntensity: 1.35, night: 0, water: 'a9d8db', sunDirection: [0.34, 0.8, 0.48] };
  }
  setSeason('christmas');
  syncPalette();

  return {
    group,
    fog,
    waterMaterial,
    applyDay(day) {
      if (disposed) return;
      lastDay = { ...day, sunDirection: [...day.sunDirection] as DaySnapshot['sunDirection'] };
      syncPalette();
    },
    update(dtSeconds) {
      if (disposed || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
      elapsed += dtSeconds;
      waterUniforms.uTime.value = elapsed;
      for (const cloud of clouds) {
        cloud.mesh.position.x += cloud.speed * dtSeconds;
        if (cloud.mesh.position.x > cloud.range) cloud.mesh.position.x -= cloud.range * 2;
      }
    },
    setMobile(value) {
      if (disposed || mobile === value) return;
      mobile = value;
      const total = mobile ? 900 : 2400;
      const pineCount = Math.round(total * pineCapacity / treeCount);
      pineMesh.count = mobile ? Math.min(pineCount, pineCapacity) : pineCapacity;
      canopyMesh.count = mobile ? Math.min(total - pineMesh.count, canopyCapacity) : canopyCapacity;
    },
    setSeason,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      sun.dispose();
      for (const object of ownedMeshes) object.dispose();
      for (const geometry of ownedGeometries) geometry.dispose();
      for (const material of ownedMaterials) material.dispose();
      ownedMeshes.clear();
      ownedGeometries.clear();
      ownedMaterials.clear();
      clouds.length = 0;
      seasonal.clear();
    },
  };
}

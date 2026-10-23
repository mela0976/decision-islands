import * as THREE from 'three';
import { treeRotationForElapsed } from './entrance';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createLibraryTextures } from './library-materials';
import { HOLIDAYS, isSeason, type HolidayPalette, type Season } from './season';

type BookPlacement = {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  yaw: number;
  tiltX: number;
  tiltZ: number;
  variant: number;
  tint: number;
};

type SurfacePoint = { x: number; z: number; nx: number; nz: number };
type BookWall = {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  radius: number;
  height: number;
  levels: number;
  spacing: number;
  seed: number;
};
type BoxPlacement = {
  position: THREE.Vector3;
  yaw: number;
  scale: THREE.Vector3;
};
type Beam = { start: THREE.Vector3; end: THREE.Vector3; width: number; height: number };
const ATLAS_COLUMNS = 8;
const ATLAS_ROWS = 8;
const ATLAS_COVER_START = 0;
const ATLAS_SPINE_START = 32;
const ATLAS_PAPER_START = 56;
const HOLIDAY_SEASONS: readonly Season[] = ['christmas', 'halloween', 'easter'];

type ColoredPlacement = BoxPlacement & { color: THREE.ColorRepresentation };

export function createLibraryScene(initialSeason: Season = 'christmas'): {
  group: THREE.Group;
  tree: THREE.Group;
  update: (deltaSeconds: number) => void;
  setSeason: (season: Season) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'starfield-library';
  const tree = new THREE.Group();
  tree.name = 'stacked-book-christmas-tree';
  tree.position.set(0, 0, 1.7);
  group.add(tree);

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const ownGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    return geometry;
  };
  const ownMaterial = <T extends THREE.Material>(material: T): T => {
    materials.add(material);
    return material;
  };
  const surfaceTextures = createLibraryTextures();
  const woodTexture = surfaceTextures.wood;
  const floorTexture = surfaceTextures.floor;
  const bookAtlas = surfaceTextures.books;

  const woodMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xd4ba95,
    map: woodTexture,
    bumpMap: surfaceTextures.woodBump,
    bumpScale: 0.012,
    roughness: 0.68,
    metalness: 0.035,
  }));
  const shelfMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xe0c7a2,
    map: woodTexture,
    bumpMap: surfaceTextures.woodBump,
    bumpScale: 0.008,
    roughness: 0.62,
    metalness: 0.015,
  }));
  const bookMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: bookAtlas,
    bumpMap: surfaceTextures.bookBump,
    bumpScale: 0.008,
    roughnessMap: surfaceTextures.bookRoughness,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.015,
  }));
  const floorMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xf1e6d2,
    map: floorTexture,
    bumpMap: surfaceTextures.floorBump,
    bumpScale: 0.005,
    roughness: 0.58,
    metalness: 0.035,
  }));
  const brassMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xd5a45a,
    roughness: 0.34,
    metalness: 0.72,
  }));
  const metalMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xd2dadd,
    roughness: 0.4,
    metalness: 0.38,
  }));
  const darkMetalMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0x3e4647,
    roughness: 0.3,
    metalness: 0.74,
  }));
  const glassMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xd5edf2,
    roughness: 0.16,
    metalness: 0.025,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  }));
  const roofGlassMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xd8e8eb,
    roughness: 0.18,
    metalness: 0.035,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
  }));
  const ledMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xffcf73,
    emissive: 0xf2a63b,
    emissiveIntensity: 0.62,
    roughness: 0.28,
    metalness: 0.2,
  }));
  const ornamentMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xf8d184,
    emissive: 0x9c5515,
    emissiveIntensity: 0.22,
    roughness: 0.24,
    metalness: 0.6,
  }));
  const starMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xffd778,
    emissive: 0xf6a72e,
    emissiveIntensity: 0.8,
    roughness: 0.22,
    metalness: 0.48,
  }));
  const floor = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(50, 49)), floorMaterial);
  floor.name = 'polished-stone-floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.13;
  floor.receiveShadow = true;
  group.add(floor);

  const walls: BookWall[] = [
    { x: -15.1, z: -5.4, halfWidth: 6.9, halfDepth: 9.6, radius: 4.55, height: 15.6, levels: 26, spacing: 0.145, seed: 112 },
    { x: 15.4, z: -5.85, halfWidth: 7.05, halfDepth: 9.8, radius: 4.9, height: 15.45, levels: 26, spacing: 0.145, seed: 923 },
  ];
  const wallBookPlacements: BookPlacement[] = [];
  const structuralPlacements: BoxPlacement[] = [];
  const shelfParts: THREE.BufferGeometry[] = [];
  for (const wall of walls) {
    const samples = roundedRectangleSamples(wall, wall.spacing);
    const random = seededRandom(wall.seed);
    const footprint = roundedRectangleShape(wall.halfWidth, wall.halfDepth, wall.radius);
    const bodyGeometry = ownGeometry(new THREE.ExtrudeGeometry(footprint, {
      depth: wall.height, bevelEnabled: false, curveSegments: 40, steps: 1,
    }));
    bodyGeometry.rotateX(-Math.PI / 2);
    bodyGeometry.translate(wall.x, 0, wall.z);
    const body = new THREE.Mesh(bodyGeometry, woodMaterial);
    body.name = 'continuous-timber-bookwall-backing';
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    for (let level = 0; level <= wall.levels; level++) {
      const shelfY = 0.34 + level * 0.58;
      const outer = roundedRectangleShape(wall.halfWidth + 0.56, wall.halfDepth + 0.56, wall.radius + 0.56);
      const inner = roundedRectangleShape(wall.halfWidth - 0.02, wall.halfDepth - 0.02, wall.radius - 0.02);
      outer.holes.push(inner);
      const shelf = new THREE.ExtrudeGeometry(outer, {
        depth: level === wall.levels ? 0.12 : 0.065,
        bevelEnabled: true, bevelSegments: 1, bevelThickness: 0.008, bevelSize: 0.008,
        curveSegments: 40, steps: 1,
      });
      shelf.rotateX(-Math.PI / 2);
      shelf.translate(wall.x, shelfY - 0.065, wall.z);
      shelfParts.push(shelf);
      if (level === wall.levels) continue;
      let clusterRemaining = 0;
      let clusterVariant = 0;
      let clusterHeight = 0.4;
      for (let index = 0; index < samples.length; index++) {
        const sample = samples[index];
        const viewFacing = sample.nx * (-wall.x - sample.x) + sample.nz * (25 - wall.z - sample.z);
        if (viewFacing < -0.5 || sample.nz < -0.02) continue;
        if (clusterRemaining <= 0) {
          clusterRemaining = 3 + Math.floor(random() * 8);
          clusterVariant = Math.floor(random() * 32);
          clusterHeight = 0.32 + random() * 0.16;
        }
        clusterRemaining--;
        const yaw = Math.atan2(sample.nx, sample.nz);
        const inGap = (index + level * 7) % 43;
        if (inGap >= 35 && level % 3 === 0) {
          if (inGap === 37) {
            for (let stack = 0; stack < 4; stack++) {
              wallBookPlacements.push({
                x: wall.x + sample.x + sample.nx * 0.24,
                y: shelfY + 0.038 + stack * 0.072,
                z: wall.z + sample.z + sample.nz * 0.24,
                width: 0.39 + random() * 0.06, height: 0.064, depth: 0.28 + random() * 0.05,
                yaw: yaw + (random() - 0.5) * 0.15, tiltX: 0, tiltZ: 0,
                variant: Math.floor(random() * 32), tint: 0.88 + random() * 0.1,
              });
            }
          }
          continue;
        }
        if (inGap > 38 || random() < 0.025) continue;
        const width = sample.spacing * (0.69 + random() * 0.25);
        const height = Math.min(0.52, clusterHeight + (random() - 0.5) * 0.1);
        const depth = 0.25 + random() * 0.16;
        const leaning = clusterRemaining === 0 ? (random() > 0.5 ? 0.13 : -0.1) : (random() - 0.5) * 0.035;
        const radialOffset = depth / 2 + 0.045 + random() * 0.07;
        wallBookPlacements.push({
          x: wall.x + sample.x + sample.nx * radialOffset,
          y: shelfY + height / 2 + Math.abs(Math.sin(leaning)) * width / 2,
          z: wall.z + sample.z + sample.nz * radialOffset,
          width, height, depth, yaw,
          tiltX: (random() - 0.5) * 0.035, tiltZ: leaning,
          variant: random() < 0.7 ? clusterVariant : Math.floor(random() * 32),
          tint: 0.82 + random() * 0.2,
        });
        if (inGap === 36 && level % 3 === 1) {
          wallBookPlacements.push({
            x: wall.x + sample.x + sample.nx * 0.39,
            y: shelfY + 0.23, z: wall.z + sample.z + sample.nz * 0.39,
            width: 0.055, height: 0.45, depth: 0.31, yaw: yaw + Math.PI / 2,
            tiltX: -0.08, tiltZ: 0, variant: clusterVariant, tint: 0.94,
          });
        }
      }
    }
    const dividerSamples = roundedRectangleSamples(wall, 1.65);
    for (const sample of dividerSamples) {
      structuralPlacements.push({
        position: new THREE.Vector3(wall.x + sample.x + sample.nx * 0.26, wall.height / 2, wall.z + sample.z + sample.nz * 0.26),
        yaw: Math.atan2(sample.nx, sample.nz),
        scale: new THREE.Vector3(0.065, wall.height, 0.52),
      });
    }
  }
  const shelfGeometry = mergeGeometries(shelfParts, false);
  for (const part of shelfParts) part.dispose();
  if (shelfGeometry) {
    const shelves = new THREE.Mesh(ownGeometry(shelfGeometry), shelfMaterial);
    shelves.name = 'continuous-smooth-curved-shelf-bands';
    shelves.castShadow = true;
    shelves.receiveShadow = true;
    group.add(shelves);
  }
  const wallBooks = new THREE.Mesh(createBookGeometry(wallBookPlacements, ownGeometry), bookMaterial);
  wallBooks.name = 'individual-books-on-curved-walls';
  wallBooks.castShadow = true;
  wallBooks.receiveShadow = true;
  group.add(wallBooks);
  addBoxInstances(group, structuralPlacements, ownGeometry(new THREE.BoxGeometry(1, 1, 1)), shelfMaterial, true);

  addCentralAtrium(group, ownGeometry, ownMaterial, glassMaterial, roofGlassMaterial, metalMaterial, darkMetalMaterial, shelfMaterial);
  addEscalator(group, ownGeometry, ownMaterial, darkMetalMaterial, metalMaterial);
  addReadingFurniture(group, ownGeometry, ownMaterial, shelfMaterial, darkMetalMaterial);

  const plinth = new THREE.Mesh(ownGeometry(new THREE.CylinderGeometry(4.35, 4.48, 0.2, 96)), darkMetalMaterial);
  plinth.name = 'tree-display-plinth';
  plinth.position.set(0, 0.04, 1.7);
  plinth.receiveShadow = true;
  group.add(plinth);
  const plinthTrim = new THREE.Mesh(ownGeometry(new THREE.TorusGeometry(4.36, 0.055, 8, 128)), brassMaterial);
  plinthTrim.rotation.x = Math.PI / 2;
  plinthTrim.position.set(0, 0.155, 1.7);
  group.add(plinthTrim);

  const treeBooks = createTreeBookPlacements();
  const treeBookMesh = new THREE.Mesh(createBookGeometry(treeBooks, ownGeometry), bookMaterial);
  treeBookMesh.name = 'stacked-book-tree-volumes';
  treeBookMesh.castShadow = true;
  treeBookMesh.receiveShadow = true;
  tree.add(treeBookMesh);

  const treeDecorations: Record<Season, THREE.Group> = {
    christmas: new THREE.Group(),
    halloween: new THREE.Group(),
    easter: new THREE.Group(),
  };
  const groundDecorations: Record<Season, THREE.Group> = {
    christmas: new THREE.Group(),
    halloween: new THREE.Group(),
    easter: new THREE.Group(),
  };
  for (const season of HOLIDAY_SEASONS) {
    treeDecorations[season].name = `holiday-tree-${season}`;
    groundDecorations[season].name = `holiday-ground-${season}`;
    tree.add(treeDecorations[season]);
    group.add(groundDecorations[season]);
  }

  const pumpkinGeometry = ownGeometry(createPumpkinGeometry());
  const pumpkinStemGeometry = ownGeometry(new THREE.CylinderGeometry(0.16, 0.2, 1, 8));
  const eggGeometry = ownGeometry(createEggGeometry());

  addTreeDecorations(treeDecorations.christmas, ownGeometry, ownMaterial, ledMaterial, ornamentMaterial, starMaterial);
  addHalloweenTreeDecorations(treeDecorations.halloween, ownGeometry, ownMaterial, pumpkinGeometry, pumpkinStemGeometry, HOLIDAYS.halloween);
  addEasterTreeDecorations(treeDecorations.easter, ownGeometry, ownMaterial, eggGeometry, HOLIDAYS.easter);
  addHalloweenGroundDecorations(groundDecorations.halloween, ownGeometry, ownMaterial, pumpkinGeometry, pumpkinStemGeometry, HOLIDAYS.halloween);
  addChristmasGroundDecorations(groundDecorations.christmas, ownGeometry, ownMaterial, HOLIDAYS.christmas);
  addEasterGroundDecorations(groundDecorations.easter, ownGeometry, ownMaterial, eggGeometry, HOLIDAYS.easter);

  const sky = new THREE.HemisphereLight(0xfff8eb, 0x827563, 0.65);
  sky.name = 'library-ambient-sky';
  group.add(sky);
  const daylight = new THREE.DirectionalLight(0xfff3da, 3.1);
  daylight.name = 'library-glass-atrium-daylight';
  daylight.position.set(-15, 23, 14);
  daylight.target.position.set(0, 6, 1);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(1536, 1536);
  daylight.shadow.camera.left = -27;
  daylight.shadow.camera.right = 27;
  daylight.shadow.camera.top = 22;
  daylight.shadow.camera.bottom = -18;
  daylight.shadow.camera.near = 1;
  daylight.shadow.camera.far = 58;
  daylight.shadow.normalBias = 0.055;
  daylight.shadow.bias = -0.00018;
  daylight.shadow.intensity = 0.65;
  daylight.shadow.radius = 5;
  group.add(daylight, daylight.target);
  const frontFill = new THREE.DirectionalLight(0xe8f2fb, 0.3);
  frontFill.name = 'library-soft-front-fill';
  frontFill.position.set(9, 13, 26);
  group.add(frontFill);
  const warmAccent = new THREE.PointLight(0xffbb66, 5.5, 25, 2);
  warmAccent.name = 'library-warm-light';
  warmAccent.position.set(0, 11, 0);
  group.add(warmAccent);
  const treeGlow = new THREE.PointLight(0xffbc54, 8, 17, 2);
  treeGlow.name = 'tree-garland-glow';
  treeGlow.position.set(0, 6.5, 1.2);
  tree.add(treeGlow);

  let activeSeason: Season | null = null;
  let elapsedSeconds = 0;
  let disposed = false;
  const setSeason = (season: Season) => {
    if (disposed || !isSeason(season) || activeSeason === season) return;
    activeSeason = season;
    for (const value of HOLIDAY_SEASONS) {
      treeDecorations[value].visible = value === season;
      groundDecorations[value].visible = value === season;
    }
    const palette = HOLIDAYS[season];
    sky.color.set(palette.sky);
    sky.groundColor.set(palette.secondary);
    daylight.color.set(palette.glow);
    frontFill.color.set(palette.sea);
    warmAccent.color.set(palette.glow);
    treeGlow.color.set(palette.glow);
  };
  setSeason(isSeason(initialSeason) ? initialSeason : 'christmas');

  const update = (deltaSeconds: number) => {
    if (disposed || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    elapsedSeconds += deltaSeconds;
    tree.rotation.y = treeRotationForElapsed(elapsedSeconds);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    group.traverse(object => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
      if (object instanceof THREE.DirectionalLight || object instanceof THREE.SpotLight || object instanceof THREE.PointLight) object.shadow.dispose();
    });
    group.clear();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    surfaceTextures.dispose();
    geometries.clear();
    materials.clear();

  };
  return { group, tree, update, setSeason, dispose };
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function atlasUv(tile: number, u: number, v: number): [number, number] {
  const column = tile % ATLAS_COLUMNS;
  const row = Math.floor(tile / ATLAS_COLUMNS);
  const inset = 0.012;
  const u0 = (column + inset) / ATLAS_COLUMNS;
  const u1 = (column + 1 - inset) / ATLAS_COLUMNS;
  const v0 = 1 - (row + 1 - inset) / ATLAS_ROWS;
  const v1 = 1 - (row + inset) / ATLAS_ROWS;
  return [u0 + (u1 - u0) * u, v0 + (v1 - v0) * v];
}

function createBookGeometry(books: BookPlacement[], ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T): THREE.BufferGeometry {
  const vertexCount = books.length * 68;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(books.length * 102);
  const quaternion = new THREE.Quaternion();
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  let vertexOffset = 0;
  let indexOffset = 0;
  const appendFace = (book: BookPlacement, corners: number[][], faceNormal: number[], tile: number, shade = 1) => {
    normal.set(faceNormal[0], faceNormal[1], faceNormal[2]).applyQuaternion(quaternion);
    const faceUvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let corner = 0; corner < 4; corner++) {
      point.set(...corners[corner] as [number, number, number]).applyQuaternion(quaternion);
      positions.set([book.x + point.x, book.y + point.y, book.z + point.z], (vertexOffset + corner) * 3);
      normals.set([normal.x, normal.y, normal.z], (vertexOffset + corner) * 3);
      uvs.set(atlasUv(tile, faceUvs[corner][0], faceUvs[corner][1]), (vertexOffset + corner) * 2);
      const tone = book.tint * shade;
      colors.set([tone, tone, tone], (vertexOffset + corner) * 3);
    }
    indices.set([vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3], indexOffset);
    vertexOffset += 4;
    indexOffset += 6;
  };
  const box = (book: BookPlacement, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, tiles: number[], shade = 1, coveredFront = false) => {
    const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
    if (!coveredFront) appendFace(book, [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], [0,0,1], tiles[0], shade);
    appendFace(book, [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]], [0,0,-1], tiles[1], shade);
    appendFace(book, [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]], [1,0,0], tiles[2], shade);
    appendFace(book, [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], [-1,0,0], tiles[3], shade);
    appendFace(book, [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]], [0,1,0], tiles[4], shade);
    appendFace(book, [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], [0,-1,0], tiles[5], shade);
  };
  for (const book of books) {
    quaternion.setFromEuler(new THREE.Euler(book.tiltX, book.yaw, book.tiltZ, 'YXZ'));
    const hx = book.width / 2, hy = book.height / 2, hz = book.depth / 2;
    const cover = ATLAS_COVER_START + book.variant % 32;
    const spine = ATLAS_SPINE_START + book.variant % 24;
    const paper = ATLAS_PAPER_START + book.variant % 8;
    const horizontal = book.width > book.height * 1.8;
    const board = horizontal ? Math.min(0.012, book.height * 0.09) : Math.min(0.008, book.width * 0.14);
    if (horizontal) {
      box(book, 0, 0, -0.004, hx - 0.012, hy - board * 2, hz - 0.014, [paper,paper,paper,paper,paper,paper], 0.94);
      box(book, 0, hy - board / 2, 0, hx, board / 2, hz, [cover,cover,cover,cover,cover,cover], 1, true);
      box(book, 0, -hy + board / 2, 0, hx, board / 2, hz, [cover,cover,cover,cover,cover,cover], 1, true);
    } else {
      box(book, 0, 0, -0.005, Math.max(0.01, hx - board * 2), hy - 0.009, hz - 0.015, [paper,paper,paper,paper,paper,paper], 0.94);
      box(book, hx - board / 2, 0, 0, board / 2, hy, hz, [cover,cover,cover,cover,cover,cover], 1, true);
      box(book, -hx + board / 2, 0, 0, board / 2, hy, hz, [cover,cover,cover,cover,cover,cover], 1, true);
    }
    appendFace(book, [[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]], [0,0,1], spine, 0.94);
  }
  const geometry = ownGeometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function roundedRectangleShape(halfWidth: number, halfDepth: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + radius, halfDepth);
  shape.lineTo(halfWidth - radius, halfDepth);
  shape.absarc(halfWidth - radius, halfDepth - radius, radius, Math.PI / 2, 0, true);
  shape.lineTo(halfWidth, -halfDepth + radius);
  shape.absarc(halfWidth - radius, -halfDepth + radius, radius, 0, -Math.PI / 2, true);
  shape.lineTo(-halfWidth + radius, -halfDepth);
  shape.absarc(-halfWidth + radius, -halfDepth + radius, radius, -Math.PI / 2, -Math.PI, true);
  shape.lineTo(-halfWidth, halfDepth - radius);
  shape.absarc(-halfWidth + radius, halfDepth - radius, radius, Math.PI, Math.PI / 2, true);
  return shape;
}

function roundedRectangleSamples(wall: BookWall, spacing: number): Array<SurfacePoint & { spacing: number }> {
  type Segment = { length: number; at: (fraction: number) => SurfacePoint };
  const { halfWidth: w, halfDepth: d, radius: r } = wall;
  const segments: Segment[] = [];
  const line = (x1: number, z1: number, x2: number, z2: number, nx: number, nz: number) => {
    const length = Math.hypot(x2 - x1, z2 - z1);
    segments.push({ length, at: (t) => ({ x: x1 + (x2 - x1) * t, z: z1 + (z2 - z1) * t, nx, nz }) });
  };
  const arc = (cx: number, cz: number, start: number, end: number) => {
    const length = r * Math.abs(end - start);
    segments.push({
      length,
      at: (t) => {
        const angle = start + (end - start) * t;
        return { x: cx + Math.cos(angle) * r, z: cz + Math.sin(angle) * r, nx: Math.cos(angle), nz: Math.sin(angle) };
      },
    });
  };
  line(-w + r, d, w - r, d, 0, 1);
  arc(w - r, d - r, Math.PI / 2, 0);
  line(w, d - r, w, -d + r, 1, 0);
  arc(w - r, -d + r, 0, -Math.PI / 2);
  line(w - r, -d, -w + r, -d, 0, -1);
  arc(-w + r, -d + r, -Math.PI / 2, -Math.PI);
  line(-w, -d + r, -w, d - r, -1, 0);
  arc(-w + r, d - r, Math.PI, Math.PI / 2);
  const perimeter = segments.reduce((sum, segment) => sum + segment.length, 0);
  const count = Math.ceil(perimeter / spacing);
  const slot = perimeter / count;
  const atDistance = (distance: number): SurfacePoint => {
    let remaining = ((distance % perimeter) + perimeter) % perimeter;
    for (const segment of segments) {
      if (remaining <= segment.length) return segment.at(remaining / segment.length);
      remaining -= segment.length;
    }
    return segments[0].at(0);
  };
  return Array.from({ length: count }, (_, index) => ({ ...atDistance((index + 0.5) * slot), spacing: slot }));
}

function createTreeBookPlacements(): BookPlacement[] {
  const books: BookPlacement[] = [];
  const random = seededRandom(6701);
  const levels = 30;
  const pitch = 0.323;
  for (let level = 0; level < levels; level++) {
    const fraction = level / (levels - 1);
    const ringRadius = 4.14 * Math.pow(1 - fraction, 0.76) + 0.15;
    const count = Math.max(3, Math.floor((Math.PI * 2 * ringRadius) / 0.9));
    const slot = (Math.PI * 2 * ringRadius) / count;
    const offset = level * 0.28;
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2 + offset;
      const depth = Math.min(0.76, 0.28 + ringRadius * (0.18 + random() * 0.12));
      const width = slot * (0.73 + random() * 0.26);
      const height = 0.21 + random() * 0.1;
      const radius = Math.max(0.035, ringRadius + (random() - 0.5) * 0.16);
      const nx = Math.cos(angle);
      const nz = Math.sin(angle);
      books.push({
        x: nx * (radius - depth * 0.47),
        y: 0.27 + level * pitch + height / 2,
        z: nz * (radius - depth * 0.47),
        width,
        height,
        depth,
        yaw: Math.atan2(nx, nz),
        tiltX: (random() - 0.5) * 0.018,
        tiltZ: (random() - 0.5) * 0.03,
        variant: Math.floor(random() * 32),
        tint: 0.94 + random() * 0.08,
      });
    }
  }
  return books;
}

function createPumpkinGeometry(): THREE.BufferGeometry {
  const segments = 24;
  const rings = 16;
  const positions = new Float32Array((segments + 1) * (rings + 1) * 3);
  const indices: number[] = [];
  let offset = 0;
  for (let ring = 0; ring <= rings; ring++) {
    const polar = (ring / rings) * Math.PI;
    const y = Math.cos(polar) * 0.5;
    const baseRadius = Math.sin(polar) * 0.47;
    for (let segment = 0; segment <= segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2;
      const radius = baseRadius * (1 + 0.095 * Math.cos(angle * 8));
      positions.set([Math.cos(angle) * radius, y, Math.sin(angle) * radius], offset);
      offset += 3;
    }
  }
  for (let ring = 0; ring < rings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const a = ring * (segments + 1) + segment;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createEggGeometry(): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [];
  for (let step = 0; step <= 24; step++) {
    const fraction = step / 24;
    const radius = Math.sin(Math.PI * fraction) * (0.38 - fraction * 0.1);
    points.push(new THREE.Vector2(radius, fraction - 0.5));
  }
  return new THREE.LatheGeometry(points, 16);
}

function createBatGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0.12);
  shape.lineTo(-0.28, 0.05);
  shape.lineTo(-0.2, 0.34);
  shape.lineTo(-0.04, 0.2);
  shape.lineTo(0, 0.1);
  shape.lineTo(0.04, 0.2);
  shape.lineTo(0.2, 0.34);
  shape.lineTo(0.28, 0.05);
  shape.lineTo(0.5, 0.12);
  shape.lineTo(0.4, -0.18);
  shape.lineTo(0.16, -0.11);
  shape.lineTo(0, -0.42);
  shape.lineTo(-0.16, -0.11);
  shape.lineTo(-0.4, -0.18);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: false, curveSegments: 2 });
}

function addHalloweenTreeDecorations(
  group: THREE.Group,
  ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T,
  ownMaterial: <T extends THREE.Material>(material: T) => T,
  pumpkinGeometry: THREE.BufferGeometry,
  stemGeometry: THREE.BufferGeometry,
  palette: HolidayPalette,
): void {
  const pumpkinMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: palette.accent,
    emissive: palette.glow,
    emissiveIntensity: 0.62,
    roughness: 0.38,
    metalness: 0.04,
  }));
  const stemMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: palette.secondary, roughness: 0.82 }));
  const pumpkins: BoxPlacement[] = [];
  const stems: BoxPlacement[] = [];
  const pumpkinCount = 22;
  for (let index = 0; index < pumpkinCount; index++) {
    const fraction = (index + 0.5) / pumpkinCount;
    const angle = fraction * Math.PI * 2 * 4.3 + 0.28;
    const radius = 4.12 * Math.pow(1 - fraction, 0.76) + 0.22;
    const scale = new THREE.Vector3(0.29, 0.3, 0.29);
    const position = new THREE.Vector3(Math.cos(angle) * radius, 0.72 + fraction * 9.15, Math.sin(angle) * radius);
    pumpkins.push({ position, yaw: Math.atan2(position.x, position.z), scale });
    stems.push({
      position: new THREE.Vector3(position.x, position.y + scale.y * 0.58, position.z),
      yaw: Math.atan2(position.x, position.z),
      scale: new THREE.Vector3(0.15, 0.18, 0.15),
    });
  }
  pumpkins.push({ position: new THREE.Vector3(0, 10.27, 0), yaw: 0, scale: new THREE.Vector3(1.22, 1.1, 1.22) });
  stems.push({ position: new THREE.Vector3(0, 10.94, 0), yaw: 0, scale: new THREE.Vector3(0.28, 0.24, 0.28) });
  addBoxInstances(group, pumpkins, pumpkinGeometry, pumpkinMaterial, false);
  addBoxInstances(group, stems, stemGeometry, stemMaterial, false);

  const batGeometry = ownGeometry(createBatGeometry());
  const batMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: palette.ink, roughness: 0.84, side: THREE.DoubleSide }));
  const bats: BoxPlacement[] = [];
  for (let index = 0; index < 10; index++) {
    const height = 1.2 + index * 0.86;
    const fraction = height / 11;
    const angle = index * 2.4;
    const radius = 4.3 * Math.pow(1 - fraction, 0.76) + 0.4;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    bats.push({
      position: new THREE.Vector3(x, height, z),
      yaw: Math.atan2(x, z),
      scale: new THREE.Vector3(0.75, 0.62, 0.75),
    });
  }
  addBoxInstances(group, bats, batGeometry, batMaterial, false);
}

function addEasterTreeDecorations(
  group: THREE.Group,
  ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T,
  ownMaterial: <T extends THREE.Material>(material: T) => T,
  eggGeometry: THREE.BufferGeometry,
  palette: HolidayPalette,
): void {
  const eggMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.36, metalness: 0.025 }));
  const eggColors = [palette.accent, palette.ornament, palette.glow, palette.paper, palette.secondary];
  const eggs: ColoredPlacement[] = [];
  const eggCount = 24;
  for (let index = 0; index < eggCount; index++) {
    const fraction = (index + 0.5) / eggCount;
    const angle = fraction * Math.PI * 2 * 4.2 + 0.5;
    const radius = 4.08 * Math.pow(1 - fraction, 0.76) + 0.22;
    const position = new THREE.Vector3(Math.cos(angle) * radius, 0.72 + fraction * 9.0, Math.sin(angle) * radius);
    eggs.push({
      position,
      yaw: Math.atan2(position.x, position.z),
      scale: new THREE.Vector3(0.28, 0.42, 0.28),
      color: eggColors[index % eggColors.length],
    });
  }
  eggs.push({
    position: new THREE.Vector3(0, 10.22, 0), yaw: 0,
    scale: new THREE.Vector3(0.9, 1.28, 0.9), color: palette.ornament,
  });
  addColoredInstances(group, eggs, eggGeometry, eggMaterial, false);

  const earsGeometry = ownGeometry(new THREE.SphereGeometry(1, 10, 8));
  const earsMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68 }));
  const ears: ColoredPlacement[] = [];
  for (const side of [-1, 1]) {
    ears.push({
      position: new THREE.Vector3(side * 0.29, 10.6, -0.12), yaw: side * 0.12,
      scale: new THREE.Vector3(0.14, 0.48, 0.1), color: palette.paper,
    });
    ears.push({
      position: new THREE.Vector3(side * 0.29, 10.62, -0.018), yaw: side * 0.12,
      scale: new THREE.Vector3(0.06, 0.32, 0.04), color: palette.accent,
    });
  }
  addColoredInstances(group, ears, earsGeometry, earsMaterial, false);
}

function addChristmasGroundDecorations(
  group: THREE.Group,
  ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T,
  ownMaterial: <T extends THREE.Material>(material: T) => T,
  palette: HolidayPalette,
): void {
  const boxGeometry = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const giftMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.54, metalness: 0.025 }));
  const ribbonMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: palette.glow, roughness: 0.34, metalness: 0.22 }));
  const gifts: ColoredPlacement[] = [];
  const ribbons: BoxPlacement[] = [];
  for (let index = 0; index < 6; index++) {
    const angle = (index / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(angle) * 4.95;
    const z = 1.7 + Math.sin(angle) * 4.95;
    const height = 0.38 + (index % 2) * 0.09;
    const y = -0.13 + height / 2;
    gifts.push({
      position: new THREE.Vector3(x, y, z), yaw: angle,
      scale: new THREE.Vector3(0.52, height, 0.5),
      color: index % 2 === 0 ? palette.accent : palette.secondary,
    });
    ribbons.push({ position: new THREE.Vector3(x, y, z), yaw: angle, scale: new THREE.Vector3(0.075, height + 0.01, 0.52) });
    ribbons.push({ position: new THREE.Vector3(x, -0.13 + height, z), yaw: angle, scale: new THREE.Vector3(0.53, 0.055, 0.075) });
  }
  addColoredInstances(group, gifts, boxGeometry, giftMaterial, false);
  addBoxInstances(group, ribbons, boxGeometry, ribbonMaterial, false);
}

function addHalloweenGroundDecorations(
  group: THREE.Group,
  ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T,
  ownMaterial: <T extends THREE.Material>(material: T) => T,
  pumpkinGeometry: THREE.BufferGeometry,
  stemGeometry: THREE.BufferGeometry,
  palette: HolidayPalette,
): void {
  const pumpkinMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: palette.accent,
    emissive: palette.glow,
    emissiveIntensity: 0.72,
    roughness: 0.4,
  }));
  const stemMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: palette.secondary, roughness: 0.84 }));
  const pumpkins: BoxPlacement[] = [];
  const stems: BoxPlacement[] = [];
  for (let index = 0; index < 7; index++) {
    const angle = (index / 7) * Math.PI * 2 + Math.PI / 7;
    const x = Math.cos(angle) * 4.95;
    const z = 1.7 + Math.sin(angle) * 4.95;
    const scale = new THREE.Vector3(0.78, 0.7, 0.78);
    const position = new THREE.Vector3(x, -0.13 + scale.y / 2, z);
    pumpkins.push({ position, yaw: Math.atan2(x, z - 1.7), scale });
    stems.push({
      position: new THREE.Vector3(x, position.y + scale.y * 0.57, z),
      yaw: Math.atan2(x, z - 1.7),
      scale: new THREE.Vector3(0.26, 0.2, 0.26),
    });
  }
  addBoxInstances(group, pumpkins, pumpkinGeometry, pumpkinMaterial, false);
  addBoxInstances(group, stems, stemGeometry, stemMaterial, false);
}

function addEasterGroundDecorations(
  group: THREE.Group,
  ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T,
  ownMaterial: <T extends THREE.Material>(material: T) => T,
  eggGeometry: THREE.BufferGeometry,
  palette: HolidayPalette,
): void {
  const eggMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.36, metalness: 0.025 }));
  const colors = [palette.accent, palette.ornament, palette.glow, palette.paper, palette.secondary];
  const eggs: ColoredPlacement[] = [];
  for (let index = 0; index < 7; index++) {
    const angle = (index / 7) * Math.PI * 2 + Math.PI / 7;
    eggs.push({
      position: new THREE.Vector3(Math.cos(angle) * 4.95, 0.13, 1.7 + Math.sin(angle) * 4.95),
      yaw: angle,
      scale: new THREE.Vector3(0.34, 0.52, 0.34),
      color: colors[index % colors.length],
    });
  }
  addColoredInstances(group, eggs, eggGeometry, eggMaterial, false);

  const petalGeometry = ownGeometry(new THREE.SphereGeometry(1, 8, 6));
  const stemGeometry = ownGeometry(new THREE.CylinderGeometry(0.06, 0.08, 1, 6));
  const centerGeometry = ownGeometry(new THREE.SphereGeometry(1, 8, 6));
  const petalMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 }));
  const stemMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: palette.secondary, roughness: 0.88 }));
  const centerMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: palette.glow, roughness: 0.48 }));
  const petals: ColoredPlacement[] = [];
  const stems: BoxPlacement[] = [];
  const centers: BoxPlacement[] = [];
  for (let flower = 0; flower < 6; flower++) {
    const angle = (flower / 6) * Math.PI * 2;
    const x = Math.cos(angle) * 5.65;
    const z = 1.7 + Math.sin(angle) * 5.65;
    stems.push({ position: new THREE.Vector3(x, 0.02, z), yaw: 0, scale: new THREE.Vector3(0.58, 0.32, 0.58) });
    centers.push({ position: new THREE.Vector3(x, 0.2, z), yaw: 0, scale: new THREE.Vector3(0.09, 0.09, 0.09) });
    for (let petal = 0; petal < 5; petal++) {
      const petalAngle = (petal / 5) * Math.PI * 2;
      petals.push({
        position: new THREE.Vector3(x + Math.cos(petalAngle) * 0.13, 0.19, z + Math.sin(petalAngle) * 0.13),
        yaw: -petalAngle,
        scale: new THREE.Vector3(0.1, 0.045, 0.15),
        color: petal % 2 === 0 ? palette.accent : palette.ornament,
      });
    }
  }
  addColoredInstances(group, petals, petalGeometry, petalMaterial, false);
  addBoxInstances(group, stems, stemGeometry, stemMaterial, false);
  addBoxInstances(group, centers, centerGeometry, centerMaterial, false);
}

function addTreeDecorations(
  group: THREE.Group,
  ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T,
  ownMaterial: <T extends THREE.Material>(material: T) => T,
  ledMaterial: THREE.Material,
  ornamentMaterial: THREE.Material,
  starMaterial: THREE.Material,
): void {
  const garlandPoints: THREE.Vector3[] = [];
  const lightPlacements: BoxPlacement[] = [];
  const ornamentPlacements: BoxPlacement[] = [];
  const turns = 8;
  const samples = 620;
  for (let index = 0; index < samples; index++) {
    const fraction = index / (samples - 1);
    const angle = fraction * Math.PI * 2 * turns;
    const radius = 4.2 * Math.pow(1 - fraction, 0.76) + 0.2;
    const point = new THREE.Vector3(Math.cos(angle) * radius, 0.53 + fraction * 9.38, Math.sin(angle) * radius);
    garlandPoints.push(point);
    if (index % 6 === 0) {
      lightPlacements.push({ position: point.clone(), yaw: angle, scale: new THREE.Vector3(0.105, 0.105, 0.105) });
    }
    if (index % 39 === 11) {
      ornamentPlacements.push({ position: point.clone().multiplyScalar(0.96), yaw: angle, scale: new THREE.Vector3(0.13, 0.13, 0.13) });
    }
  }
  const garlandCurve = new THREE.CatmullRomCurve3(garlandPoints);
  const garland = new THREE.Mesh(ownGeometry(new THREE.TubeGeometry(garlandCurve, 500, 0.022, 5, false)), ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xe3b762,
    emissive: 0x68400f,
    emissiveIntensity: 0.26,
    roughness: 0.36,
    metalness: 0.56,
  })));
  garland.name = 'warm-gold-spiral-garland';
  group.add(garland);
  addBoxInstances(group, lightPlacements, ownGeometry(new THREE.SphereGeometry(1, 8, 6)), ledMaterial, false);
  addBoxInstances(group, ornamentPlacements, ownGeometry(new THREE.SphereGeometry(1, 10, 7)), ornamentMaterial, false);

  const starShape = new THREE.Shape();
  for (let point = 0; point < 10; point++) {
    const angle = point * Math.PI / 5 + Math.PI / 2;
    const radius = point % 2 === 0 ? 0.72 : 0.34;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const star = new THREE.Mesh(ownGeometry(new THREE.ExtrudeGeometry(starShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.07,
    bevelThickness: 0.06,
    curveSegments: 3,
  })), starMaterial);
  star.name = 'faceted-brass-star';
  star.position.set(0, 10.25, 0);
  star.castShadow = true;
  group.add(star);
  const starStem = new THREE.Mesh(ownGeometry(new THREE.CylinderGeometry(0.045, 0.07, 0.52, 10)), starMaterial);
  starStem.position.set(0, 9.88, 0);
  group.add(starStem);
}

function addCentralAtrium(
  group: THREE.Group,
  ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T,
  ownMaterial: <T extends THREE.Material>(material: T) => T,
  glassMaterial: THREE.Material,
  roofGlassMaterial: THREE.Material,
  metalMaterial: THREE.Material,
  darkMetalMaterial: THREE.Material,
  shelfMaterial: THREE.Material,
): void {
  const skyBackdropMaterial = ownMaterial(new THREE.MeshBasicMaterial({
    color: 0xcce5eb,
    side: THREE.DoubleSide,
    toneMapped: false,
  }));
  const rearSky = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(18.2, 12.2)), skyBackdropMaterial);
  rearSky.name = 'soft-blue-sky-through-rear-glass';
  rearSky.position.set(0, 13.05, -15.52);
  group.add(rearSky);

  const window = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(18.2, 12.2)), glassMaterial);
  window.name = 'rear-atrium-glass';
  window.position.set(0, 13.05, -15.35);
  group.add(window);

  const roofSky = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(44, 30)), skyBackdropMaterial);
  roofSky.name = 'soft-blue-skylight-backdrop';
  roofSky.rotation.x = -Math.PI / 2;
  roofSky.position.set(0, 22.15, -2);
  group.add(roofSky);

  const roofGeometry = createRoofGlassGeometry(ownGeometry);
  const roof = new THREE.Mesh(roofGeometry, roofGlassMaterial);
  roof.name = 'curved-glass-skylight';
  roof.renderOrder = 1;
  group.add(roof);

  const frameBeams: Beam[] = [];
  const roofY = (x: number) => 18.7 + 1.75 * (1 - (x / 22) ** 2);
  for (let z = -17; z <= 12.5; z += 1.65) {
    let previous = new THREE.Vector3(-22, roofY(-22), z);
    for (let x = -20.5; x <= 22; x += 1.5) {
      const current = new THREE.Vector3(x, roofY(x), z);
      frameBeams.push({ start: previous, end: current, width: 0.045, height: 0.04 });
      previous = current;
    }
  }
  for (let x = -22; x <= 22; x += 1.5) {
    for (let z = -17; z < 12.5; z += 1.65) {
      frameBeams.push({
        start: new THREE.Vector3(x, roofY(x), z),
        end: new THREE.Vector3(x, roofY(x), Math.min(z + 1.65, 12.5)),
        width: 0.035,
        height: 0.032,
      });
    }
  }
  for (let x = -20; x < 20; x += 3) {
    for (let z = -15; z < 11; z += 3.3) {
      frameBeams.push({
        start: new THREE.Vector3(x, roofY(x) + 0.025, z),
        end: new THREE.Vector3(x + 1.5, roofY(x + 1.5) + 0.025, z + 1.65),
        width: 0.018,
        height: 0.018,
      });
    }
  }
  const roofFrameMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xd3dbdc,
    roughness: 0.42,
    metalness: 0.32,
  }));
  addBeamInstances(group, frameBeams, ownGeometry(new THREE.BoxGeometry(1, 1, 1)), roofFrameMaterial, false);

  const mullions: Beam[] = [];
  for (let x = -8.5; x <= 8.6; x += 2.85) {
    mullions.push({ start: new THREE.Vector3(x, 7.0, -15.1), end: new THREE.Vector3(x, 19.05, -15.1), width: 0.095, height: 0.08 });
  }
  for (let y = 7.1; y <= 19.05; y += 2.4) {
    mullions.push({ start: new THREE.Vector3(-9.15, y, -15.1), end: new THREE.Vector3(9.15, y, -15.1), width: 0.085, height: 0.07 });
  }
  addBeamInstances(group, mullions, ownGeometry(new THREE.BoxGeometry(1, 1, 1)), metalMaterial, false);

  const balcony = new THREE.Mesh(ownGeometry(new THREE.BoxGeometry(18.6, 0.62, 3.3)), shelfMaterial);
  balcony.name = 'upper-reading-mezzanine';
  balcony.position.set(0, 7.55, -13.05);
  balcony.castShadow = true;
  balcony.receiveShadow = true;
  group.add(balcony);

  const rails: Beam[] = [];
  const railY = 8.18;
  for (let segment = 0; segment < 16; segment++) {
    const x1 = -8.9 + segment * 1.12;
    const x2 = x1 + 1.12;
    rails.push({ start: new THREE.Vector3(x1, railY, -11.31), end: new THREE.Vector3(x2, railY, -11.31), width: 0.075, height: 0.075 });
    rails.push({ start: new THREE.Vector3(x1, railY, -14.78), end: new THREE.Vector3(x2, railY, -14.78), width: 0.075, height: 0.075 });
  }
  for (let x = -8.7; x <= 8.8; x += 1.12) {
    rails.push({ start: new THREE.Vector3(x, 7.88, -11.31), end: new THREE.Vector3(x, railY, -11.31), width: 0.04, height: 0.04 });
    rails.push({ start: new THREE.Vector3(x, 7.88, -14.78), end: new THREE.Vector3(x, railY, -14.78), width: 0.04, height: 0.04 });
  }
  rails.push({ start: new THREE.Vector3(-9.25, railY, -11.31), end: new THREE.Vector3(-9.25, railY, -14.78), width: 0.075, height: 0.075 });
  rails.push({ start: new THREE.Vector3(9.25, railY, -11.31), end: new THREE.Vector3(9.25, railY, -14.78), width: 0.075, height: 0.075 });
  addBeamInstances(group, rails, ownGeometry(new THREE.BoxGeometry(1, 1, 1)), darkMetalMaterial, false);

  const accents: BoxPlacement[] = [];
  for (let x = -8.4; x <= 8.4; x += 2.8) {
    accents.push({ position: new THREE.Vector3(x, 8.42, -11.31), yaw: Math.PI / 2, scale: new THREE.Vector3(0.22, 0.035, 0.07) });
  }
  addBoxInstances(group, accents, ownGeometry(new THREE.BoxGeometry(1, 1, 1)), ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xf2d59e,
    emissive: 0x60401b,
    emissiveIntensity: 0.28,
    roughness: 0.38,
    metalness: 0.45,
  })), false);
}

function createRoofGlassGeometry(ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const columns = 12;
  const rows = 13;
  const xAt = (column: number) => -22 + (44 * column) / columns;
  const zAt = (row: number) => -17 + (30 * row) / rows;
  const roofY = (x: number) => 18.7 + 1.75 * (1 - (x / 22) ** 2);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x1 = xAt(column) + 0.035;
      const x2 = xAt(column + 1) - 0.035;
      const z1 = zAt(row) + 0.035;
      const z2 = zAt(row + 1) - 0.035;
      const base = positions.length / 3;
      positions.push(
        x1, roofY(x1) - 0.045, z1,
        x2, roofY(x2) - 0.045, z1,
        x2, roofY(x2) - 0.045, z2,
        x1, roofY(x1) - 0.045, z2,
      );
      uvs.push(column / columns, row / rows, (column + 1) / columns, row / rows,
        (column + 1) / columns, (row + 1) / rows, column / columns, (row + 1) / rows);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const geometry = ownGeometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function addEscalator(
  group: THREE.Group,
  ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T,
  ownMaterial: <T extends THREE.Material>(material: T) => T,
  darkMetalMaterial: THREE.Material,
  metalMaterial: THREE.Material,
): void {
  const x = -7.05;
  const steps: BoxPlacement[] = [];
  const stepCount = 21;
  for (let index = 0; index < stepCount; index++) {
    steps.push({
      position: new THREE.Vector3(x, 0.32 + index * 0.31, -4.1 - index * 0.36),
      yaw: 0,
      scale: new THREE.Vector3(1.2, 0.075, 0.36),
    });
  }
  addBoxInstances(group, steps, ownGeometry(new THREE.BoxGeometry(1, 1, 1)), darkMetalMaterial, true);
  const rails: Beam[] = [];
  for (const side of [-0.75, 0.75]) {
    rails.push({
      start: new THREE.Vector3(x + side, 0.35, -3.95),
      end: new THREE.Vector3(x + side, 7.25, -11.65),
      width: 0.075,
      height: 0.075,
    });
  }
  addBeamInstances(group, rails, ownGeometry(new THREE.BoxGeometry(1, 1, 1)), metalMaterial, false);
  const landing = new THREE.Mesh(ownGeometry(new THREE.BoxGeometry(1.6, 0.18, 1.4)), darkMetalMaterial);
  landing.position.set(x, 7.22, -11.72);
  group.add(landing);
  const warmPost = new THREE.Mesh(ownGeometry(new THREE.BoxGeometry(0.16, 7.1, 0.18)), ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xb76c35,
    roughness: 0.55,
    metalness: 0.08,
  })));
  warmPost.position.set(x + 1.12, 3.55, -7.8);
  warmPost.rotation.x = 0.72;
  group.add(warmPost);
}

function addReadingFurniture(
  group: THREE.Group,
  ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T,
  ownMaterial: <T extends THREE.Material>(material: T) => T,
  timber: THREE.Material,
  metal: THREE.Material,
): void {
  const wood: BoxPlacement[] = [];
  const legs: BoxPlacement[] = [];
  const upholstery: BoxPlacement[] = [];
  const transform = (x: number, z: number, yaw: number, lx: number, y: number, lz: number) => new THREE.Vector3(
    x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, y,
    z - Math.sin(yaw) * lx + Math.cos(yaw) * lz,
  );
  const tables = [{ x: -6.4, z: 11.5, yaw: 0.15 }, { x: 7.1, z: 8.9, yaw: -0.22 }, { x: 5.8, z: -7.4, yaw: 0.45 }];
  for (const table of tables) {
    wood.push({ position: transform(table.x, table.z, table.yaw, 0, 0.79, 0), yaw: table.yaw, scale: new THREE.Vector3(2.15, 0.085, 1.05) });
    for (const x of [-0.86, 0.86]) for (const z of [-0.36, 0.36]) {
      legs.push({ position: transform(table.x, table.z, table.yaw, x, 0.38, z), yaw: table.yaw, scale: new THREE.Vector3(0.055, 0.76, 0.055) });
    }
    for (const side of [-1, 1]) for (const offset of [-0.54, 0.54]) {
      const cz = side * 1.02;
      const chairYaw = table.yaw + (side === 1 ? Math.PI : 0);
      wood.push({ position: transform(table.x, table.z, table.yaw, offset, 0.47, cz), yaw: chairYaw, scale: new THREE.Vector3(0.47, 0.06, 0.47) });
      upholstery.push({ position: transform(table.x, table.z, table.yaw, offset, 0.515, cz), yaw: chairYaw, scale: new THREE.Vector3(0.42, 0.045, 0.41) });
      wood.push({ position: transform(table.x, table.z, table.yaw, offset, 0.82, cz + side * 0.21), yaw: chairYaw, scale: new THREE.Vector3(0.47, 0.39, 0.055) });
      for (const dx of [-0.18, 0.18]) for (const dz of [-0.18, 0.18]) {
        legs.push({ position: transform(table.x, table.z, table.yaw, offset + dx, 0.23, cz + dz), yaw: chairYaw, scale: new THREE.Vector3(0.032, 0.46, 0.032) });
      }
    }
  }
  const geometry = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  addBoxInstances(group, wood, geometry, timber, true);
  addBoxInstances(group, legs, geometry, metal, true);
  addBoxInstances(group, upholstery, geometry, ownMaterial(new THREE.MeshStandardMaterial({ color: 0x69756b, roughness: 0.94 })), true);
}

function addColoredInstances(
  parent: THREE.Group,
  placements: ColoredPlacement[],
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  castShadow: boolean,
): THREE.InstancedMesh | undefined {
  if (placements.length === 0) return undefined;
  const instances = new THREE.InstancedMesh(geometry, material, placements.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  for (let index = 0; index < placements.length; index++) {
    const placement = placements[index];
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.yaw);
    matrix.compose(placement.position, quaternion, placement.scale);
    instances.setMatrixAt(index, matrix);
    instances.setColorAt(index, new THREE.Color(placement.color));
  }
  instances.instanceMatrix.needsUpdate = true;
  if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
  instances.castShadow = castShadow;
  instances.receiveShadow = false;
  parent.add(instances);
  return instances;
}

function addBoxInstances(
  parent: THREE.Group,
  placements: BoxPlacement[],
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  castShadow: boolean,
): THREE.InstancedMesh | undefined {
  if (placements.length === 0) return undefined;
  const instances = new THREE.InstancedMesh(geometry, material, placements.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  for (let index = 0; index < placements.length; index++) {
    const placement = placements[index];
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.yaw);
    matrix.compose(placement.position, quaternion, placement.scale);
    instances.setMatrixAt(index, matrix);
  }
  instances.instanceMatrix.needsUpdate = true;
  instances.castShadow = castShadow;
  instances.receiveShadow = true;
  parent.add(instances);
  return instances;
}

function addBeamInstances(
  parent: THREE.Group,
  beams: Beam[],
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  castShadow: boolean,
): THREE.InstancedMesh | undefined {
  if (beams.length === 0) return undefined;
  const instances = new THREE.InstancedMesh(geometry, material, beams.length);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const direction = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const center = new THREE.Vector3();
  const localX = new THREE.Vector3(1, 0, 0);
  for (let index = 0; index < beams.length; index++) {
    const beam = beams[index];
    direction.subVectors(beam.end, beam.start);
    const length = direction.length();
    direction.normalize();
    rotation.setFromUnitVectors(localX, direction);
    center.addVectors(beam.start, beam.end).multiplyScalar(0.5);
    scale.set(length, beam.width, beam.height);
    matrix.compose(center, rotation, scale);
    instances.setMatrixAt(index, matrix);
  }
  instances.instanceMatrix.needsUpdate = true;
  instances.castShadow = castShadow;
  instances.receiveShadow = true;
  parent.add(instances);
  return instances;
}

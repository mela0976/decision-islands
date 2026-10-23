import * as THREE from 'three';
import { treeRotationForElapsed } from './entrance';

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
type GeometryBuffers = {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
};

const ATLAS_COLUMNS = 8;
const ATLAS_ROWS = 8;
const ATLAS_COVER_START = 0;
const ATLAS_SPINE_START = 32;
const ATLAS_PAPER_START = 56;
const BOOK_COLORS = [
  '#a9442d', '#c2642d', '#d39646', '#62463a', '#566f58', '#3f5f60', '#753d44', '#d3c09a',
  '#435c75', '#90784b', '#9c643b', '#597d78', '#b05a45', '#7f604c', '#c09a56', '#4d536a',
  '#7b4633', '#bd783d', '#52664e', '#375566', '#a88159', '#6a4148', '#dfba70', '#65777a',
  '#8c6f50', '#425143', '#a74635', '#586e86', '#c78350', '#77634a', '#45716b', '#d6c8ae',
];

export function createLibraryScene(): {
  group: THREE.Group;
  tree: THREE.Group;
  update: (deltaSeconds: number) => void;
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
  const textures = new Set<THREE.Texture>();
  const ownGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    return geometry;
  };
  const ownMaterial = <T extends THREE.Material>(material: T): T => {
    materials.add(material);
    return material;
  };
  const ownTexture = <T extends THREE.Texture>(texture: T): T => {
    textures.add(texture);
    return texture;
  };
  const makeTexture = (draw: (context: CanvasRenderingContext2D) => void): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas texture creation is unavailable.');
    draw(context);
    const texture = ownTexture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  };
  const woodTexture = makeTexture((context) => {
    context.fillStyle = '#b76c35';
    context.fillRect(0, 0, 1024, 1024);
    const random = seededRandom(41);
    for (let row = 0; row < 14; row++) {
      const y = row * 74;
      const tone = row % 3 === 0 ? '#c77a3c' : row % 3 === 1 ? '#aa5e30' : '#bd7138';
      context.fillStyle = tone;
      context.globalAlpha = 0.38;
      context.fillRect(0, y, 1024, 72);
      context.globalAlpha = 1;
      context.strokeStyle = '#7f482b';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, y + 72);
      context.lineTo(1024, y + 72);
      context.stroke();
    }
    for (let line = 0; line < 240; line++) {
      const x = random() * 1024;
      const y = random() * 1024;
      const length = 18 + random() * 220;
      context.strokeStyle = random() > 0.5 ? '#e6a45a' : '#713f28';
      context.globalAlpha = 0.08 + random() * 0.17;
      context.lineWidth = 0.5 + random() * 2.2;
      context.beginPath();
      context.moveTo(x, y);
      context.bezierCurveTo(x + 5, y + length * 0.28, x - 4, y + length * 0.72, x + 2, y + length);
      context.stroke();
    }
    for (let knot = 0; knot < 7; knot++) {
      const x = 45 + random() * 930;
      const y = 40 + random() * 940;
      context.strokeStyle = '#774329';
      context.globalAlpha = 0.2;
      context.lineWidth = 2;
      context.beginPath();
      context.ellipse(x, y, 5 + random() * 6, 15 + random() * 17, random() * 0.25, 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
  });
  woodTexture.wrapS = THREE.RepeatWrapping;
  woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(2, 4);

  const floorTexture = makeTexture((context) => {
    const random = seededRandom(87);
    context.fillStyle = '#ded2bd';
    context.fillRect(0, 0, 1024, 1024);
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        const x = column * 128;
        const y = row * 128;
        const light = Math.round(157 + random() * 17);
        context.fillStyle = `rgb(${light + 22}, ${light + 10}, ${light - 3})`;
        context.fillRect(x + 2, y + 2, 124, 124);
        context.strokeStyle = 'rgba(91, 76, 58, .075)';
        context.lineWidth = 1;
        context.strokeRect(x + 3, y + 3, 122, 122);
      }
    }
    for (let fleck = 0; fleck < 1600; fleck++) {
      const tone = random() > 0.5 ? 'rgba(255, 245, 225, .16)' : 'rgba(94, 77, 58, .055)';
      context.fillStyle = tone;
      context.fillRect(random() * 1024, random() * 1024, 1 + random() * 3, 1 + random() * 2);
    }
  });

  const bookAtlas = makeTexture((context) => {
    const cell = 128;
    const random = seededRandom(2026);
    for (let variant = 0; variant < 32; variant++) {
      const x = (variant % ATLAS_COLUMNS) * cell;
      const y = Math.floor(variant / ATLAS_COLUMNS) * cell;
      drawCoverTile(context, x, y, cell, variant, random);
    }
    for (let variant = 0; variant < 24; variant++) {
      const tile = ATLAS_SPINE_START + variant;
      const x = (tile % ATLAS_COLUMNS) * cell;
      const y = Math.floor(tile / ATLAS_COLUMNS) * cell;
      drawSpineTile(context, x, y, cell, variant);
    }
    for (let variant = 0; variant < 8; variant++) {
      const tile = ATLAS_PAPER_START + variant;
      const x = (tile % ATLAS_COLUMNS) * cell;
      const y = Math.floor(tile / ATLAS_COLUMNS) * cell;
      drawPageTile(context, x, y, cell, variant);
    }
  });

  const woodMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xd07b3d,
    map: woodTexture,
    bumpMap: woodTexture,
    bumpScale: 0.025,
    roughness: 0.68,
    metalness: 0.035,
  }));
  const shelfMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xf0b366,
    map: woodTexture,
    roughness: 0.48,
    metalness: 0.12,
  }));
  const bookMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: bookAtlas,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.015,
  }));
  const floorMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xf1e6d2,
    map: floorTexture,
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
  const figureMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0x263a3a,
    roughness: 0.86,
    metalness: 0.02,
  }));
  const skinMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    color: 0xd4a47d,
    roughness: 0.82,
    metalness: 0,
  }));

  const floor = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(50, 49)), floorMaterial);
  floor.name = 'polished-stone-floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.13;
  floor.receiveShadow = true;
  group.add(floor);

  const walls: BookWall[] = [
    { x: -15.1, z: -5.2, halfWidth: 6.9, halfDepth: 9.6, radius: 4.55, height: 15.6, levels: 26, spacing: 0.29, seed: 112 },
    { x: 15.1, z: -5.2, halfWidth: 6.9, halfDepth: 9.6, radius: 4.55, height: 15.6, levels: 26, spacing: 0.29, seed: 923 },
  ];
  const wallBookPlacements: BookPlacement[] = [];
  const shelfPlacements: BoxPlacement[] = [];
  const structuralPlacements: BoxPlacement[] = [];
  for (const wall of walls) {
    const samples = roundedRectangleSamples(wall, wall.spacing);
    const random = seededRandom(wall.seed);
    const footprint = roundedRectangleShape(wall.halfWidth, wall.halfDepth, wall.radius);
    const bodyGeometry = ownGeometry(new THREE.ExtrudeGeometry(footprint, {
      depth: wall.height,
      bevelEnabled: false,
      curveSegments: 12,
      steps: 1,
    }));
    bodyGeometry.rotateX(-Math.PI / 2);
    bodyGeometry.translate(wall.x, 0, wall.z);
    const body = new THREE.Mesh(bodyGeometry, woodMaterial);
    body.name = 'rounded-timber-bookwall-core';
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    for (let level = 0; level < wall.levels; level++) {
      const shelfY = 0.34 + level * 0.58;
      for (let index = 0; index < samples.length; index++) {
        const sample = samples[(index + (level % 2 ? Math.floor(samples.length / 2) : 0)) % samples.length];
        const variation = random();
        const width = sample.spacing * (0.7 + random() * 0.28);
        const height = 0.38 + random() * 0.15;
        const depth = 0.3 + random() * 0.12;
        const yaw = Math.atan2(sample.nx, sample.nz);
        const radialOffset = depth * 0.47;
        wallBookPlacements.push({
          x: wall.x + sample.x + sample.nx * radialOffset,
          y: shelfY + height / 2,
          z: wall.z + sample.z + sample.nz * radialOffset,
          width,
          height,
          depth,
          yaw,
          tiltX: (random() - 0.5) * 0.035,
          tiltZ: (random() - 0.5) * 0.045,
          variant: Math.floor(random() * 32),
          tint: 0.93 + variation * 0.09,
        });
        shelfPlacements.push({
          position: new THREE.Vector3(wall.x + sample.x + sample.nx * 0.22, shelfY - 0.045, wall.z + sample.z + sample.nz * 0.22),
          yaw,
          scale: new THREE.Vector3(sample.spacing + 0.025, 0.075, 0.66),
        });
      }
    }

    const ribFractions = [0.015, 0.255, 0.5, 0.745, 0.985];
    for (const fraction of ribFractions) {
      const sample = samples[Math.floor(fraction * (samples.length - 1))];
      structuralPlacements.push({
        position: new THREE.Vector3(wall.x + sample.x + sample.nx * 0.45, wall.height / 2, wall.z + sample.z + sample.nz * 0.45),
        yaw: Math.atan2(sample.nx, sample.nz),
        scale: new THREE.Vector3(0.095, wall.height, 0.11),
      });
    }
    for (let index = 0; index < samples.length; index += 8) {
      const sample = samples[index];
      shelfPlacements.push({
        position: new THREE.Vector3(wall.x + sample.x + sample.nx * 0.22, wall.height - 0.08, wall.z + sample.z + sample.nz * 0.22),
        yaw: Math.atan2(sample.nx, sample.nz),
        scale: new THREE.Vector3(sample.spacing * 7.8, 0.16, 0.76),
      });
    }
  }
  const wallBooks = new THREE.Mesh(createBookGeometry(wallBookPlacements, ownGeometry), bookMaterial);
  wallBooks.name = 'individual-books-on-curved-walls';
  wallBooks.castShadow = true;
  wallBooks.receiveShadow = true;
  group.add(wallBooks);
  addBoxInstances(group, shelfPlacements, ownGeometry(new THREE.BoxGeometry(1, 1, 1)), shelfMaterial, true);
  addBoxInstances(group, structuralPlacements, ownGeometry(new THREE.BoxGeometry(1, 1, 1)), brassMaterial, true);

  addCentralAtrium(group, ownGeometry, ownMaterial, glassMaterial, roofGlassMaterial, metalMaterial, darkMetalMaterial, shelfMaterial);
  addEscalator(group, ownGeometry, ownMaterial, darkMetalMaterial, metalMaterial);
  addReadingScaleFigures(group, ownGeometry, figureMaterial, skinMaterial);

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
  addTreeDecorations(tree, ownGeometry, ownMaterial, ledMaterial, ornamentMaterial, starMaterial);

  const sky = new THREE.HemisphereLight(0xfff8eb, 0x817361, 1.45);
  sky.name = 'library-ambient-sky';
  group.add(sky);
  const daylight = new THREE.DirectionalLight(0xfff7e8, 2.25);
  daylight.name = 'library-glass-atrium-daylight';
  daylight.position.set(-14, 24, -9);
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
  daylight.shadow.intensity = 0.24;
  daylight.shadow.radius = 5;
  group.add(daylight, daylight.target);
  const frontFill = new THREE.DirectionalLight(0xf3f8f7, 1.25);
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

  let elapsedSeconds = 0;
  let disposed = false;
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
    for (const texture of textures) texture.dispose();
    geometries.clear();
    materials.clear();
    textures.clear();
  };
  return { group, tree, update, dispose };
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

function drawCoverTile(context: CanvasRenderingContext2D, x: number, y: number, cell: number, variant: number, random: () => number): void {
  const color = BOOK_COLORS[variant];
  const gold = variant % 3 === 0 ? '#ecd18d' : '#dcb974';
  context.fillStyle = color;
  context.fillRect(x, y, cell, cell);
  context.strokeStyle = 'rgba(35, 25, 20, .42)';
  context.lineWidth = 4;
  context.strokeRect(x + 3, y + 3, cell - 6, cell - 6);
  context.fillStyle = gold;
  context.globalAlpha = 0.78;
  context.fillRect(x + 15, y + 16, 98, 3);
  context.fillRect(x + 15, y + 109, 98, 3);
  context.globalAlpha = 1;
  context.strokeStyle = `${gold}b8`;
  context.lineWidth = 2;
  context.strokeRect(x + 19, y + 26, 90, 75);
  context.fillStyle = `${gold}d8`;
  if (variant % 4 === 0) {
    context.beginPath();
    context.arc(x + 64, y + 61, 20 + random() * 7, 0, Math.PI * 2);
    context.strokeStyle = gold;
    context.stroke();
    context.beginPath();
    context.moveTo(x + 38, y + 82);
    context.lineTo(x + 64, y + 41);
    context.lineTo(x + 90, y + 82);
    context.closePath();
    context.fill();
  } else if (variant % 4 === 1) {
    for (let line = 0; line < 5; line++) context.fillRect(x + 31, y + 42 + line * 9, 66 - line * 3, 2);
  } else if (variant % 4 === 2) {
    context.fillRect(x + 39, y + 39, 50, 44);
    context.clearRect(x + 46, y + 46, 36, 30);
    context.strokeStyle = gold;
    context.strokeRect(x + 46, y + 46, 36, 30);
  } else {
    context.beginPath();
    context.moveTo(x + 64, y + 36);
    context.lineTo(x + 89, y + 63);
    context.lineTo(x + 64, y + 89);
    context.lineTo(x + 39, y + 63);
    context.closePath();
    context.strokeStyle = gold;
    context.stroke();
  }
  context.font = 'bold 9px Georgia, serif';
  context.fillStyle = '#f4e6c8';
  context.textAlign = 'center';
  context.fillText(`VOL. ${String(variant + 1).padStart(2, '0')}`, x + 64, y + 99);
}

function drawSpineTile(context: CanvasRenderingContext2D, x: number, y: number, cell: number, variant: number): void {
  const color = BOOK_COLORS[(variant * 5 + 3) % BOOK_COLORS.length];
  const gold = variant % 2 === 0 ? '#f1d294' : '#e0b86e';
  context.fillStyle = color;
  context.fillRect(x, y, cell, cell);
  context.fillStyle = 'rgba(28, 22, 20, .24)';
  context.fillRect(x + 2, y + 2, 5, cell - 4);
  context.fillStyle = gold;
  context.fillRect(x + 13, y + 12, cell - 26, 3);
  context.fillRect(x + 13, y + cell - 15, cell - 26, 3);
  context.fillRect(x + 20, y + 21, cell - 40, 2);
  context.fillRect(x + 20, y + cell - 23, cell - 40, 2);
  context.save();
  context.translate(x + cell / 2, y + cell / 2);
  context.rotate(-Math.PI / 2);
  context.fillStyle = '#f8e9c8';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold 13px Georgia, serif';
  context.fillText(`${['FOLIO', 'STUDY', 'ATLAS', 'NOTES'][variant % 4]} ${String(variant + 1).padStart(2, '0')}`, 0, 0);
  context.restore();
  for (let line = 0; line < 3; line++) {
    context.fillStyle = line === 1 ? '#f4e5c4' : gold;
    context.globalAlpha = 0.55;
    context.fillRect(x + 27, y + 42 + line * 7, 74 - (line % 2) * 17, 1.6);
  }
  context.globalAlpha = 1;
}

function drawPageTile(context: CanvasRenderingContext2D, x: number, y: number, cell: number, variant: number): void {
  context.fillStyle = ['#eadcc1', '#e7d6b9', '#f0e3ca', '#dcccae'][variant % 4];
  context.fillRect(x, y, cell, cell);
  context.fillStyle = 'rgba(139, 104, 68, .22)';
  context.fillRect(x + 11, y + 7, 2, cell - 14);
  context.fillStyle = 'rgba(112, 91, 72, .28)';
  for (let line = 0; line < 14; line++) {
    const width = 78 + ((line * 17 + variant * 11) % 33);
    context.fillRect(x + 24, y + 12 + line * 8, width, 1.3);
  }
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
  const vertexCount = books.length * 24;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(books.length * 36);
  const localX = new THREE.Vector3();
  const localY = new THREE.Vector3();
  const localZ = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  let vertexOffset = 0;
  let indexOffset = 0;

  const appendFace = (book: BookPlacement, corners: THREE.Vector3[], faceNormal: THREE.Vector3, tile: number) => {
    normal.copy(faceNormal).applyQuaternion(quaternion).normalize();
    const faceUvs = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
    for (let corner = 0; corner < 4; corner++) {
      const point = corners[corner].clone().applyQuaternion(quaternion);
      positions[(vertexOffset + corner) * 3] = book.x + point.x;
      positions[(vertexOffset + corner) * 3 + 1] = book.y + point.y;
      positions[(vertexOffset + corner) * 3 + 2] = book.z + point.z;
      normals[(vertexOffset + corner) * 3] = normal.x;
      normals[(vertexOffset + corner) * 3 + 1] = normal.y;
      normals[(vertexOffset + corner) * 3 + 2] = normal.z;
      const [u, v] = atlasUv(tile, faceUvs[corner][0], faceUvs[corner][1]);
      uvs[(vertexOffset + corner) * 2] = u;
      uvs[(vertexOffset + corner) * 2 + 1] = v;
      colors[(vertexOffset + corner) * 3] = book.tint;
      colors[(vertexOffset + corner) * 3 + 1] = book.tint;
      colors[(vertexOffset + corner) * 3 + 2] = book.tint;
    }
    indices.set([
      vertexOffset, vertexOffset + 1, vertexOffset + 2,
      vertexOffset, vertexOffset + 2, vertexOffset + 3,
    ], indexOffset);
    vertexOffset += 4;
    indexOffset += 6;
  };

  for (const book of books) {
    quaternion.setFromEuler(new THREE.Euler(book.tiltX, book.yaw, book.tiltZ, 'YXZ'));
    const hx = book.width / 2;
    const hy = book.height / 2;
    const hz = book.depth / 2;
    localX.set(1, 0, 0);
    localY.set(0, 1, 0);
    localZ.set(0, 0, 1);
    appendFace(book, [
      new THREE.Vector3(-hx, -hy, hz), new THREE.Vector3(hx, -hy, hz),
      new THREE.Vector3(hx, hy, hz), new THREE.Vector3(-hx, hy, hz),
    ], localZ, ATLAS_SPINE_START + book.variant % 24);
    appendFace(book, [
      new THREE.Vector3(hx, -hy, -hz), new THREE.Vector3(-hx, -hy, -hz),
      new THREE.Vector3(-hx, hy, -hz), new THREE.Vector3(hx, hy, -hz),
    ], localZ.clone().negate(), ATLAS_COVER_START + (book.variant + 11) % 32);
    appendFace(book, [
      new THREE.Vector3(hx, -hy, hz), new THREE.Vector3(hx, -hy, -hz),
      new THREE.Vector3(hx, hy, -hz), new THREE.Vector3(hx, hy, hz),
    ], localX, ATLAS_PAPER_START + book.variant % 8);
    appendFace(book, [
      new THREE.Vector3(-hx, -hy, -hz), new THREE.Vector3(-hx, -hy, hz),
      new THREE.Vector3(-hx, hy, hz), new THREE.Vector3(-hx, hy, -hz),
    ], localX.clone().negate(), ATLAS_PAPER_START + (book.variant + 3) % 8);
    appendFace(book, [
      new THREE.Vector3(-hx, hy, hz), new THREE.Vector3(hx, hy, hz),
      new THREE.Vector3(hx, hy, -hz), new THREE.Vector3(-hx, hy, -hz),
    ], localY, ATLAS_COVER_START + book.variant % 32);
    appendFace(book, [
      new THREE.Vector3(-hx, -hy, -hz), new THREE.Vector3(hx, -hy, -hz),
      new THREE.Vector3(hx, -hy, hz), new THREE.Vector3(-hx, -hy, hz),
    ], localY.clone().negate(), ATLAS_COVER_START + (book.variant + 17) % 32);
  }

  const geometry = ownGeometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function roundedRectangleShape(halfWidth: number, halfDepth: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + radius, halfDepth);
  shape.lineTo(halfWidth - radius, halfDepth);
  shape.quadraticCurveTo(halfWidth, halfDepth, halfWidth, halfDepth - radius);
  shape.lineTo(halfWidth, -halfDepth + radius);
  shape.quadraticCurveTo(halfWidth, -halfDepth, halfWidth - radius, -halfDepth);
  shape.lineTo(-halfWidth + radius, -halfDepth);
  shape.quadraticCurveTo(-halfWidth, -halfDepth, -halfWidth, -halfDepth + radius);
  shape.lineTo(-halfWidth, halfDepth - radius);
  shape.quadraticCurveTo(-halfWidth, halfDepth, -halfWidth + radius, halfDepth);
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

function addTreeDecorations(
  tree: THREE.Group,
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
  tree.add(garland);
  addBoxInstances(tree, lightPlacements, ownGeometry(new THREE.SphereGeometry(1, 8, 6)), ledMaterial, false);
  addBoxInstances(tree, ornamentPlacements, ownGeometry(new THREE.SphereGeometry(1, 10, 7)), ornamentMaterial, false);

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
  tree.add(star);
  const starStem = new THREE.Mesh(ownGeometry(new THREE.CylinderGeometry(0.045, 0.07, 0.52, 10)), starMaterial);
  starStem.position.set(0, 9.88, 0);
  tree.add(starStem);
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
    map: undefined,
    roughness: 0.55,
    metalness: 0.08,
  })));
  warmPost.position.set(x + 1.12, 3.55, -7.8);
  warmPost.rotation.x = 0.72;
  group.add(warmPost);
}

function addReadingScaleFigures(
  group: THREE.Group,
  ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T,
  figureMaterial: THREE.Material,
  skinMaterial: THREE.Material,
): void {
  const placements = [
    { x: -8.9, y: 0, z: 10.2 }, { x: -6.8, y: 0, z: 11.8 }, { x: 7.6, y: 0, z: 10.7 },
    { x: 9.5, y: 0, z: 8.8 }, { x: 5.6, y: 0, z: 13.2 }, { x: -4.7, y: 0, z: 14.2 },
    { x: -6.0, y: 7.86, z: -12.4 }, { x: 5.2, y: 7.86, z: -13.0 },
  ];
  const bodies: BoxPlacement[] = [];
  const heads: BoxPlacement[] = [];
  for (const person of placements) {
    bodies.push({
      position: new THREE.Vector3(person.x, person.y + 0.78, person.z),
      yaw: 0,
      scale: new THREE.Vector3(0.27, 0.78, 0.22),
    });
    heads.push({
      position: new THREE.Vector3(person.x, person.y + 1.3, person.z),
      yaw: 0,
      scale: new THREE.Vector3(0.24, 0.28, 0.24),
    });
  }
  addBoxInstances(group, bodies, ownGeometry(new THREE.CapsuleGeometry(0.13, 0.45, 3, 6)), figureMaterial, true);
  addBoxInstances(group, heads, ownGeometry(new THREE.SphereGeometry(1, 8, 6)), skinMaterial, false);
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

import * as THREE from 'three';

const ATLAS_SIZE = 2048;
const DETAIL_ATLAS_SIZE = 1024;
const ATLAS_COLUMNS = 8;
const ATLAS_ROWS = 8;
const TILE_SIZE = ATLAS_SIZE / ATLAS_COLUMNS;

type TextureChannel = 'color' | 'bump' | 'roughness';
type TilePainter = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number,
  channel: TextureChannel,
) => void;
type AtlasRegion = { start: number; count: number; paint: TilePainter };
type BookDesign = {
  cover: string;
  ink: string;
  accent: string;
  finish: number;
  style: number;
};

const BOOK_TITLES = [
  'Quiet Forms', 'A City in Layers', 'Field Notes', 'Light and Place',
  'Northern Rooms', 'Small Observations', 'The Open Shelf', 'Common Ground',
  'Soft Geometry', 'Ways of Seeing', 'A Study of Water', 'Living Archive',
  'Between Lines', 'Rooms for Reading', 'The Long Afternoon', 'Modern Folio',
  'A Natural Order', 'Collected Places', 'Notes on Light', 'The Shape of Time',
  'Everyday Atlas', 'Slow Looking', 'The Paper Garden', 'Studio Journal',
  'Objects and Memory', 'The Quiet City', 'A Place to Begin', 'Visible Things',
  'A Useful Life', 'Index of Days', 'The Reading Room', 'Measured Spaces',
];

const BOOK_DESIGNS: readonly BookDesign[] = [
  { cover: '#eeeae0', ink: '#3e4a4b', accent: '#89978c', finish: 0.91, style: 0 },
  { cover: '#e4dccb', ink: '#474943', accent: '#a77f62', finish: 0.94, style: 1 },
  { cover: '#d8d9d2', ink: '#41494b', accent: '#82929a', finish: 0.87, style: 2 },
  { cover: '#35495c', ink: '#eee9dc', accent: '#b8aa8d', finish: 0.78, style: 3 },
  { cover: '#6d7d83', ink: '#f2eee5', accent: '#c7bda8', finish: 0.84, style: 4 },
  { cover: '#778477', ink: '#f0ece1', accent: '#c5b48e', finish: 0.91, style: 5 },
  { cover: '#405b54', ink: '#f2eee4', accent: '#aab7a5', finish: 0.79, style: 0 },
  { cover: '#36575a', ink: '#eeeade', accent: '#a9b9b0', finish: 0.83, style: 1 },
  { cover: '#898175', ink: '#f2eee3', accent: '#c9bca2', finish: 0.92, style: 2 },
  { cover: '#9b6552', ink: '#f1e8dc', accent: '#d1b38b', finish: 0.88, style: 3 },
  { cover: '#a87561', ink: '#f4ece0', accent: '#d9c3a1', finish: 0.9, style: 4 },
  { cover: '#a18c65', ink: '#f4eee0', accent: '#d1c7a9', finish: 0.85, style: 5 },
  { cover: '#75675a', ink: '#f1eadc', accent: '#bdad91', finish: 0.92, style: 0 },
  { cover: '#414849', ink: '#eae7dd', accent: '#adb5ac', finish: 0.8, style: 1 },
  { cover: '#685d66', ink: '#f0e9de', accent: '#c6b4a8', finish: 0.9, style: 2 },
  { cover: '#829094', ink: '#f4f0e6', accent: '#c4c1ae', finish: 0.92, style: 3 },
  { cover: '#92947c', ink: '#f3eee1', accent: '#c8b78f', finish: 0.93, style: 4 },
  { cover: '#c0b49d', ink: '#484c47', accent: '#8b7966', finish: 0.95, style: 5 },
  { cover: '#987d79', ink: '#f2eae0', accent: '#d0b8a5', finish: 0.91, style: 0 },
  { cover: '#b3b1a8', ink: '#4a4e4a', accent: '#807c6e', finish: 0.96, style: 1 },
  { cover: '#756b60', ink: '#f0e9dc', accent: '#b7b19e', finish: 0.89, style: 2 },
  { cover: '#53646a', ink: '#f1ece0', accent: '#b8b89f', finish: 0.82, style: 3 },
  { cover: '#d4c9ae', ink: '#4c4c42', accent: '#8d8069', finish: 0.96, style: 4 },
  { cover: '#a37d79', ink: '#f2e9df', accent: '#d0b5a1', finish: 0.9, style: 5 },
  { cover: '#eeeae0', ink: '#3e4a4b', accent: '#89978c', finish: 0.94, style: 2 },
  { cover: '#e4dccb', ink: '#474943', accent: '#a77f62', finish: 0.88, style: 3 },
  { cover: '#d8d9d2', ink: '#41494b', accent: '#82929a', finish: 0.92, style: 4 },
  { cover: '#35495c', ink: '#eee9dc', accent: '#b8aa8d', finish: 0.8, style: 5 },
  { cover: '#6d7d83', ink: '#f2eee5', accent: '#c7bda8', finish: 0.91, style: 0 },
  { cover: '#778477', ink: '#f0ece1', accent: '#c5b48e', finish: 0.86, style: 1 },
  { cover: '#405b54', ink: '#f2eee4', accent: '#aab7a5', finish: 0.9, style: 2 },
  { cover: '#36575a', ink: '#eeeade', accent: '#a9b9b0', finish: 0.84, style: 3 },
];

const PAPER_TONES = [
  '#f2f0e9', '#eee9de', '#e8e3d7', '#f5f2eb',
  '#e3dfd4', '#f0ebdf', '#ebe7dc', '#f4f1e9',
];

const ATLAS_REGIONS: readonly AtlasRegion[] = [
  { start: 0, count: 32, paint: drawCoverTile },
  { start: 32, count: 24, paint: drawSpineTile },
  { start: 56, count: 8, paint: drawPaperTile },
];

export function createLibraryTextures(): {
  wood: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  floor: THREE.CanvasTexture;
  floorBump: THREE.CanvasTexture;
  books: THREE.CanvasTexture;
  bookBump: THREE.CanvasTexture;
  bookRoughness: THREE.CanvasTexture;
  dispose: () => void;
} {
  const ownedTextures = new Set<THREE.CanvasTexture>();
  const ownTexture = (texture: THREE.CanvasTexture): THREE.CanvasTexture => {
    ownedTextures.add(texture);
    return texture;
  };
  let disposed = false;

  const createTexture = (
    size: number,
    colorTexture: boolean,
    draw: (context: CanvasRenderingContext2D) => void,
  ): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas texture creation is unavailable.');
    draw(context);
    const texture = ownTexture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = 4;
    return texture;
  };

  const createPairedSurface = (
    size: number,
    painter: (context: CanvasRenderingContext2D, channel: 'color' | 'bump') => void,
    repeat: [number, number],
  ): [THREE.CanvasTexture, THREE.CanvasTexture] => {
    const color = createTexture(size, true, context => painter(context, 'color'));
    const bump = createTexture(size, false, context => painter(context, 'bump'));
    for (const texture of [color, bump]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat[0], repeat[1]);
    }
    return [color, bump];
  };

  try {
    const [wood, woodBump] = createPairedSurface(1024, drawOakTexture, [2, 4]);
    const [floor, floorBump] = createPairedSurface(1024, drawLimestoneTexture, [3, 3]);
    const books = createTexture(ATLAS_SIZE, true, context => drawBookAtlas(context, 'color'));
    const bookBump = createTexture(DETAIL_ATLAS_SIZE, false, context => drawBookAtlas(context, 'bump'));
    const bookRoughness = createTexture(DETAIL_ATLAS_SIZE, false, context => drawBookAtlas(context, 'roughness'));

    return {
      wood,
      woodBump,
      floor,
      floorBump,
      books,
      bookBump,
      bookRoughness,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        for (const texture of ownedTextures) texture.dispose();
        ownedTextures.clear();
      },
    };
  } catch (error) {
    for (const texture of ownedTextures) texture.dispose();
    ownedTextures.clear();
    throw error;
  }
}

function drawBookAtlas(context: CanvasRenderingContext2D, channel: TextureChannel): void {
  const scale = context.canvas.width / ATLAS_SIZE;
  context.save();
  context.scale(scale, scale);
  for (const region of ATLAS_REGIONS) {
    for (let variant = 0; variant < region.count; variant++) {
      const tile = region.start + variant;
      const x = (tile % ATLAS_COLUMNS) * TILE_SIZE;
      const y = Math.floor(tile / ATLAS_COLUMNS) * TILE_SIZE;
      region.paint(context, x, y, variant, channel);
    }
  }
  context.restore();
}

function drawCoverTile(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number,
  channel: TextureChannel,
): void {
  const design = BOOK_DESIGNS[variant];
  const tones = channelTones(channel, design, variant);
  context.fillStyle = tones.background;
  context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  drawWovenPaper(context, x, y, variant, channel);
  drawCoverArtwork(context, x, y, variant, tones);
}

function drawCoverArtwork(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number,
  tones: { ink: string; accent: string; muted: string; rule: string },
): void {
  const style = BOOK_DESIGNS[variant].style;
  const title = BOOK_TITLES[variant];
  const ink = tones.ink;
  const accent = tones.accent;
  context.save();
  context.translate(x, y);
  context.textBaseline = 'top';

  if (style === 0) {
    context.fillStyle = accent;
    context.fillRect(28, 30, 3, 178);
    context.font = '600 10px Arial, sans-serif';
    context.fillStyle = tones.muted;
    context.fillText('STUDIES  /  VOL. ' + String(variant + 1).padStart(2, '0'), 42, 34);
    context.font = '24px Georgia, serif';
    context.fillStyle = ink;
    wrapTitle(context, title, 42, 93, 168, 27);
    context.fillStyle = accent;
    context.fillRect(42, 196, 82 + (variant % 5) * 9, 2);
    context.font = '9px Arial, sans-serif';
    context.fillStyle = tones.muted;
    context.fillText('AN EDITION FOR LOOKING', 42, 209);
  } else if (style === 1) {
    const shape = variant % 3;
    context.fillStyle = accent;
    if (shape === 0) context.fillRect(37, 39, 150, 88);
    if (shape === 1) context.fillRect(37, 39, 66, 112);
    if (shape === 2) {
      context.beginPath();
      context.arc(111, 91, 48, 0, Math.PI * 2);
      context.fill();
    }
    context.strokeStyle = tones.ink;
    context.globalAlpha = 0.65;
    context.lineWidth = 1.2;
    context.strokeRect(49, 50, 124, 74);
    context.globalAlpha = 1;
    context.fillStyle = ink;
    context.font = '21px Georgia, serif';
    wrapTitle(context, title, 37, 166, 184, 24);
    context.font = '9px Arial, sans-serif';
    context.fillStyle = tones.muted;
    context.fillText('ESSAYS   •   ' + String(variant + 1).padStart(2, '0'), 38, 222);
  } else if (style === 2) {
    drawContourLines(context, 20, 20, 216, 142, tones.rule, variant);
    context.fillStyle = accent;
    context.beginPath();
    context.arc(180 - (variant % 4) * 11, 73 + (variant % 3) * 8, 17 + variant % 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ink;
    context.font = '22px Georgia, serif';
    wrapTitle(context, title, 34, 180, 188, 24);
    context.font = '8px Arial, sans-serif';
    context.fillStyle = tones.muted;
    context.fillText('MAPS FOR THE PRESENT', 35, 231);
  } else if (style === 3) {
    context.strokeStyle = accent;
    context.lineWidth = 1.6;
    context.beginPath();
    const stemX = 130 + (variant % 3) * 8;
    context.moveTo(stemX, 31);
    context.bezierCurveTo(stemX - 29, 72, stemX + 25, 109, stemX - 16, 157);
    context.stroke();
    for (let leaf = 0; leaf < 7; leaf++) {
      const ly = 45 + leaf * 16;
      const side = leaf % 2 === 0 ? -1 : 1;
      context.beginPath();
      context.ellipse(stemX + side * 15, ly, 9, 17, side * -0.55, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = ink;
    context.font = '20px Georgia, serif';
    wrapTitle(context, title, 29, 184, 196, 23);
    context.fillStyle = tones.muted;
    context.font = '9px Arial, sans-serif';
    context.fillText('BOTANICAL OBSERVATIONS', 31, 231);
  } else if (style === 4) {
    context.strokeStyle = tones.rule;
    context.lineWidth = 1;
    for (let line = 0; line < 7; line++) {
      context.beginPath();
      context.moveTo(32, 34 + line * 18);
      context.lineTo(224, 34 + line * 18);
      context.stroke();
    }
    context.fillStyle = accent;
    context.fillRect(41, 48, 52, 88);
    context.fillStyle = tones.muted;
    context.fillRect(105, 48, 104, 38);
    context.fillStyle = ink;
    context.font = '19px Georgia, serif';
    wrapTitle(context, title, 38, 161, 184, 22);
    context.font = '8px Arial, sans-serif';
    context.fillStyle = tones.muted;
    context.fillText('FORM / SPACE / TIME', 39, 226);
  } else {
    context.fillStyle = accent;
    context.fillRect(33, 34, 190, 91);
    context.fillStyle = tones.muted;
    context.globalAlpha = 0.65;
    context.fillRect(45, 46, 68, 67);
    context.globalAlpha = 1;
    context.strokeStyle = tones.ink;
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(127, 50);
    context.lineTo(206, 111);
    context.moveTo(127, 111);
    context.lineTo(206, 50);
    context.stroke();
    context.fillStyle = ink;
    context.font = '21px Georgia, serif';
    wrapTitle(context, title, 36, 163, 186, 23);
    context.font = '9px Arial, sans-serif';
    context.fillStyle = tones.muted;
    context.fillText('COLLECTED PAPERS', 37, 224);
  }

  if (variant % 4 === 1) {
    context.strokeStyle = tones.rule;
    context.lineWidth = 1;
    context.strokeRect(13, 13, TILE_SIZE - 26, TILE_SIZE - 26);
  }
  context.restore();
}

function drawSpineTile(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number,
  channel: TextureChannel,
): void {
  const design = BOOK_DESIGNS[variant];
  const tones = channelTones(channel, design, variant + 71);
  context.fillStyle = tones.background;
  context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  drawWovenPaper(context, x, y, variant + 71, channel);

  const heightTone = channel === 'bump' ? '#919191' : channel === 'roughness' ? '#d0d0d0' : tones.accent;
  const shadowTone = channel === 'bump' ? '#6d6d6d' : channel === 'roughness' ? '#e9e9e9' : 'rgba(26, 29, 28, .2)';
  context.fillStyle = shadowTone;
  context.fillRect(x + 8, y + 4, 4, TILE_SIZE - 8);
  context.fillStyle = heightTone;
  context.fillRect(x + 16, y + 7, 2, TILE_SIZE - 14);
  context.fillStyle = channel === 'color' ? 'rgba(255,255,255,.12)' : channel === 'bump' ? '#888888' : '#d6d6d6';
  context.fillRect(x + TILE_SIZE - 15, y + 5, 3, TILE_SIZE - 10);

  const panelTone = channel === 'bump' ? '#888888' : channel === 'roughness' ? '#d5d5d5' : tones.rule;
  context.strokeStyle = panelTone;
  context.globalAlpha = channel === 'color' ? 0.74 : 0.92;
  context.lineWidth = variant % 3 === 0 ? 1.4 : 0.9;
  if (variant % 3 !== 1) context.strokeRect(x + 28, y + 18, TILE_SIZE - 56, TILE_SIZE - 36);
  context.globalAlpha = 1;

  if (variant % 4 === 0) {
    context.fillStyle = tones.accent;
    context.beginPath();
    context.arc(x + TILE_SIZE / 2, y + 45, 11 + variant % 5, 0, Math.PI * 2);
    context.fill();
  } else if (variant % 4 === 1) {
    context.fillStyle = tones.accent;
    context.fillRect(x + 48, y + 29, 34, 33);
  } else if (variant % 4 === 2) {
    context.strokeStyle = tones.accent;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x + 52, y + 57);
    context.lineTo(x + TILE_SIZE - 52, y + 29);
    context.stroke();
  }

  context.save();
  context.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 20);
  context.rotate(-Math.PI / 2);
  context.fillStyle = tones.ink;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = variant % 4 === 3 ? '600 15px Arial, sans-serif' : '16px Georgia, serif';
  const shortTitle = BOOK_TITLES[variant];
  context.fillText(shortTitle, 0, 0, 178);
  context.restore();

  context.fillStyle = tones.accent;
  context.fillRect(x + 33, y + TILE_SIZE - 34, 45 + (variant % 5) * 8, 2);
  context.fillStyle = tones.muted;
  context.font = '8px Arial, sans-serif';
  context.textAlign = 'left';
  context.fillText('EDITION ' + String(variant + 1).padStart(2, '0'), x + 35, y + TILE_SIZE - 23, 145);
}

function drawPaperTile(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number,
  channel: TextureChannel,
): void {
  const base = PAPER_TONES[variant];
  context.fillStyle = channel === 'color' ? base : channel === 'bump' ? '#808080' : '#eeeeee';
  context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  const random = seededRandom(1207 + variant * 37);

  if (channel === 'color') {
    const edge = context.createLinearGradient(x, y, x + TILE_SIZE, y);
    edge.addColorStop(0, 'rgba(124, 115, 96, .09)');
    edge.addColorStop(0.08, 'rgba(255, 255, 255, .18)');
    edge.addColorStop(0.91, 'rgba(255, 255, 255, .12)');
    edge.addColorStop(1, 'rgba(117, 108, 91, .12)');
    context.fillStyle = edge;
    context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  } else if (channel === 'bump') {
    context.fillStyle = '#777777';
    context.fillRect(x + 6, y, 2, TILE_SIZE);
    context.fillStyle = '#898989';
    context.fillRect(x + 14, y, 2, TILE_SIZE);
  } else {
    context.fillStyle = '#e2e2e2';
    context.fillRect(x + 7, y, 3, TILE_SIZE);
  }

  for (let line = 0; line < 29; line++) {
    const lineY = y + 12 + line * 8;
    const width = 147 + ((line * 29 + variant * 13) % 66);
    context.fillStyle = channel === 'color'
      ? (line % 5 === 0 ? 'rgba(255,255,255,.3)' : 'rgba(121,113,97,.12)')
      : channel === 'bump'
        ? (line % 4 === 0 ? '#878787' : '#7c7c7c')
        : (line % 5 === 0 ? '#f4f4f4' : '#e8e8e8');
    context.fillRect(x + 26, lineY, width, channel === 'bump' ? 1.25 : 1.4);
  }

  for (let fleck = 0; fleck < 200; fleck++) {
    const px = x + 20 + random() * (TILE_SIZE - 40);
    const py = y + random() * TILE_SIZE;
    context.fillStyle = channel === 'color'
      ? (random() > 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(105,98,84,.12)')
      : channel === 'bump'
        ? (random() > 0.5 ? '#888888' : '#777777')
        : (random() > 0.5 ? '#f4f4f4' : '#e5e5e5');
    context.fillRect(px, py, 1, 1);
  }
}

function channelTones(
  channel: TextureChannel,
  design: BookDesign,
  variant: number,
): { background: string; ink: string; accent: string; muted: string; rule: string } {
  if (channel === 'color') {
    return {
      background: design.cover,
      ink: design.ink,
      accent: design.accent,
      muted: mixHex(design.ink, design.cover, 0.66),
      rule: mixHex(design.ink, design.cover, 0.45),
    };
  }
  if (channel === 'bump') {
    return {
      background: '#808080',
      ink: variant % 2 === 0 ? '#9a9a9a' : '#949494',
      accent: variant % 3 === 0 ? '#909090' : '#999999',
      muted: '#888888',
      rule: '#878787',
    };
  }
  const roughness = Math.round(design.finish * 255);
  const base = grayHex(roughness);
  return {
    background: base,
    ink: grayHex(Math.max(160, roughness - 20)),
    accent: grayHex(Math.max(175, roughness - 10)),
    muted: grayHex(Math.min(250, roughness + 4)),
    rule: grayHex(Math.min(248, roughness + 2)),
  };
}

function drawWovenPaper(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number,
  channel: TextureChannel,
): void {
  const random = seededRandom(923 + variant * 101);
  const color = channel === 'color';
  const bump = channel === 'bump';
  context.save();
  for (let fiber = 0; fiber < 300; fiber++) {
    const fx = x + 8 + random() * (TILE_SIZE - 16);
    const fy = y + 7 + random() * (TILE_SIZE - 14);
    const length = 5 + random() * 28;
    context.strokeStyle = color
      ? (random() > 0.5 ? 'rgba(255,255,255,.09)' : 'rgba(30,34,31,.055)')
      : bump
        ? (random() > 0.5 ? '#858585' : '#7b7b7b')
        : (random() > 0.5 ? '#f5f5f5' : '#dddddd');
    context.globalAlpha = color ? 1 : bump ? 0.78 : 0.58;
    context.lineWidth = 0.35 + random() * 0.85;
    context.beginPath();
    context.moveTo(fx, fy);
    context.lineTo(fx + (random() - 0.5) * 2, fy + length);
    context.stroke();
  }
  context.globalAlpha = 1;
  context.restore();
}

function wrapTitle(
  context: CanvasRenderingContext2D,
  title: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = title.split(' ');
  let line = '';
  let lineIndex = 0;
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      context.fillText(line, x, y + lineIndex * lineHeight, maxWidth);
      line = word;
      lineIndex++;
    } else {
      line = candidate;
    }
  }
  if (line) context.fillText(line, x, y + lineIndex * lineHeight, maxWidth);
}

function drawContourLines(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  variant: number,
): void {
  context.save();
  context.strokeStyle = color;
  context.globalAlpha = 0.8;
  context.lineWidth = 0.85;
  for (let ring = 0; ring < 8; ring++) {
    context.beginPath();
    for (let point = 0; point <= 48; point++) {
      const angle = (point / 48) * Math.PI * 2;
      const radius = 0.22 + ring * 0.047 + Math.sin(angle * 3 + variant) * 0.012;
      const px = x + width * (0.5 + Math.cos(angle) * radius);
      const py = y + height * (0.48 + Math.sin(angle) * radius);
      if (point === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.stroke();
  }
  context.globalAlpha = 1;
  context.restore();
}

function drawOakTexture(context: CanvasRenderingContext2D, channel: 'color' | 'bump'): void {
  const size = context.canvas.width;
  context.fillStyle = channel === 'color' ? '#c2b18f' : '#808080';
  context.fillRect(0, 0, size, size);
  const random = seededRandom(41027);

  const wash = context.createLinearGradient(0, 0, size, 0);
  if (channel === 'color') {
    wash.addColorStop(0, '#b8a580');
    wash.addColorStop(0.22, '#c9b999');
    wash.addColorStop(0.5, '#c1b08b');
    wash.addColorStop(0.77, '#c9bb9c');
    wash.addColorStop(1, '#b8a580');
  } else {
    wash.addColorStop(0, '#7d7d7d');
    wash.addColorStop(0.22, '#828282');
    wash.addColorStop(0.5, '#7f7f7f');
    wash.addColorStop(0.77, '#828282');
    wash.addColorStop(1, '#7d7d7d');
  }
  context.fillStyle = wash;
  context.fillRect(0, 0, size, size);

  for (let grain = 0; grain < 460; grain++) {
    const x = random() * size;
    const phase = random() * Math.PI * 2;
    const amplitude = 0.5 + random() * 2.3;
    const width = 0.25 + random() * 1.25;
    const bright = random() > 0.46;
    context.strokeStyle = channel === 'color'
      ? bright ? 'rgba(245, 235, 210, .24)' : 'rgba(91, 77, 54, .16)'
      : bright ? '#888888' : '#777777';
    context.globalAlpha = 0.58;
    context.lineWidth = width;
    context.beginPath();
    for (let step = 0; step <= 16; step++) {
      const fraction = step / 16;
      const py = fraction * size;
      const px = x + Math.sin(fraction * Math.PI * 2 + phase) * amplitude;
      if (step === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.stroke();
  }

  for (let band = 0; band < 42; band++) {
    const y = random() * size;
    const x = random() * size;
    const length = 50 + random() * 270;
    context.strokeStyle = channel === 'color'
      ? (band % 3 === 0 ? 'rgba(245,237,216,.24)' : 'rgba(91,77,55,.09)')
      : (band % 3 === 0 ? '#858585' : '#7b7b7b');
    context.globalAlpha = channel === 'color' ? 0.7 : 0.42;
    context.lineWidth = 1 + random() * 2.3;
    for (const offset of [-size, 0, size]) {
      context.beginPath();
      context.moveTo(x + offset, y);
      context.bezierCurveTo(x + offset + length * 0.25, y - 2, x + offset + length * 0.7, y + 2, x + offset + length, y);
      context.stroke();
    }
  }

  for (let knot = 0; knot < 5; knot++) {
    const x = 72 + random() * (size - 144);
    const y = 72 + random() * (size - 144);
    for (let ring = 0; ring < 4; ring++) {
      context.strokeStyle = channel === 'color'
        ? ring % 2 === 0 ? 'rgba(104,83,56,.16)' : 'rgba(238,226,198,.28)'
        : ring % 2 === 0 ? '#747474' : '#878787';
      context.globalAlpha = 0.52;
      context.lineWidth = 0.65 + ring * 0.2;
      context.beginPath();
      context.ellipse(x, y, 3 + ring * 2.1, 8 + ring * 4.2, 0.08, 0, Math.PI * 2);
      context.stroke();
    }
  }
  context.globalAlpha = 1;
}

function drawLimestoneTexture(context: CanvasRenderingContext2D, channel: 'color' | 'bump'): void {
  const size = context.canvas.width;
  context.fillStyle = channel === 'color' ? '#d2cfc2' : '#808080';
  context.fillRect(0, 0, size, size);
  const random = seededRandom(87019);

  for (let patch = 0; patch < 115; patch++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 20 + random() * 155;
    const opacity = 0.018 + random() * 0.045;
    const tone = channel === 'color'
      ? (random() > 0.52 ? `rgba(255,252,239,${opacity})` : `rgba(123,119,107,${opacity})`)
      : (random() > 0.52 ? '#838383' : '#7d7d7d');
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const gradient = context.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, radius);
        gradient.addColorStop(0, tone);
        gradient.addColorStop(1, channel === 'color' ? 'rgba(255,255,255,0)' : '#808080');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x + ox, y + oy, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  for (let vein = 0; vein < 18; vein++) {
    const y = random() * size;
    const phase = random() * Math.PI * 2;
    const waveHeight = 4 + random() * 0.1;
    context.strokeStyle = channel === 'color'
      ? (vein % 3 === 0 ? 'rgba(255,252,242,.2)' : 'rgba(137,130,115,.095)')
      : (vein % 3 === 0 ? '#828282' : '#7e7e7e');
    context.globalAlpha = channel === 'color' ? 0.65 : 0.7;
    context.lineWidth = 0.45 + random() * 1.4;
    context.beginPath();
    for (let step = 0; step <= 32; step++) {
      const fraction = step / 32;
      const px = fraction * size;
      const py = y + Math.sin(fraction * Math.PI * 2 + phase) * waveHeight;
      if (step === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.stroke();
  }

  for (let fleck = 0; fleck < 1800; fleck++) {
    const x = random() * size;
    const y = random() * size;
    const diameter = 0.45 + random() * 1.6;
    context.fillStyle = channel === 'color'
      ? random() > 0.5 ? 'rgba(255,252,240,.28)' : 'rgba(107,103,92,.17)'
      : random() > 0.5 ? '#858585' : '#7b7b7b';
    context.globalAlpha = channel === 'color' ? 0.58 : 0.45;
    context.fillRect(x, y, diameter, diameter);
  }
  context.globalAlpha = 1;
}

function mixHex(first: string, second: string, secondWeight: number): string {
  const a = parseHex(first);
  const b = parseHex(second);
  const weight = Math.max(0, Math.min(1, secondWeight));
  return '#' + a.map((value, index) => Math.round(value * (1 - weight) + b[index] * weight).toString(16).padStart(2, '0')).join('');
}

function parseHex(color: string): [number, number, number] {
  const value = color.startsWith('#') ? color.slice(1) : color;
  return [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

function grayHex(value: number): string {
  const byte = Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
  return '#' + byte + byte + byte;
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

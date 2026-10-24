const TEXTURE_SIZE = 512;

function seededRandom(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}

function portraitBase(config, size = TEXTURE_SIZE) {
  const surface = document.createElement('canvas');
  surface.width = size;
  surface.height = size;
  const context = surface.getContext('2d');
  const [paper = '#f4f0e7', ink = '#222728', mid = '#777a76'] = config.palette || [];
  const random = seededRandom(config.seed);
  const scale = size / 512;
  const point = value => value * scale;

  context.fillStyle = paper;
  context.fillRect(0, 0, size, size);
  context.fillStyle = '#d7d3ca';
  context.fillRect(point(28), point(28), point(456), point(456));
  const vignette = context.createRadialGradient(point(256), point(225), point(25), point(256), point(255), point(250));
  vignette.addColorStop(0, '#eeeae2');
  vignette.addColorStop(1, '#b8b6b0');
  context.fillStyle = vignette;
  context.fillRect(point(42), point(42), point(428), point(428));

  context.fillStyle = ink;
  context.beginPath();
  context.moveTo(point(76), point(449));
  context.bezierCurveTo(point(98), point(357), point(152), point(334), point(256), point(334));
  context.bezierCurveTo(point(360), point(334), point(416), point(357), point(438), point(449));
  context.closePath();
  context.fill();

  context.fillStyle = mid;
  context.fillRect(point(222), point(276), point(68), point(92));
  context.fillStyle = ink;
  context.beginPath();
  context.ellipse(point(256), point(210), point(121), point(147), 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#d0ccc3';
  context.beginPath();
  context.ellipse(point(257), point(224), point(96), point(119), 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = ink;
  context.beginPath();
  context.moveTo(point(133), point(178));
  context.bezierCurveTo(point(132), point(79), point(201), point(45), point(278), point(69));
  context.bezierCurveTo(point(359), point(93), point(383), point(148), point(379), point(194));
  context.bezierCurveTo(point(341), point(165), point(300), point(140), point(256), point(140));
  context.bezierCurveTo(point(208), point(140), point(163), point(159), point(133), point(178));
  context.fill();

  context.strokeStyle = ink;
  context.lineWidth = point(8);
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(point(190), point(211));
  context.lineTo(point(222), point(211));
  context.moveTo(point(289), point(211));
  context.lineTo(point(321), point(211));
  context.moveTo(point(256), point(212));
  context.lineTo(point(241), point(259));
  context.lineTo(point(267), point(264));
  context.moveTo(point(220), point(295));
  context.quadraticCurveTo(point(256), point(315), point(292), point(295));
  context.stroke();

  context.fillStyle = '#f7f4ec';
  for (let i = 0; i < 980; i++) {
    const x = random() * size;
    const y = random() * size;
    context.globalAlpha = 0.08 + random() * 0.18;
    context.fillRect(x, y, point(1.2), point(1.2));
  }
  context.globalAlpha = 1;
  context.strokeStyle = '#f7f4ec';
  context.lineWidth = point(4);
  context.strokeRect(point(35), point(35), point(442), point(442));
  return surface;
}

function drawHalftone(context, source) {
  context.drawImage(source, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  let pixels;
  try {
    pixels = context.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE).data;
  } catch {
    pixels = null;
  }
  for (let y = 16; y < TEXTURE_SIZE; y += 32) {
    for (let x = 16; x < TEXTURE_SIZE; x += 32) {
      const index = (y * TEXTURE_SIZE + x) * 4;
      const luminance = pixels ? (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) : 128;
      const radius = Math.max(2.4, (255 - luminance) / 255 * 13);
      context.fillStyle = '#15191a';
      context.globalAlpha = Math.min(0.82, 0.24 + (255 - luminance) / 255 * 0.68);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.globalAlpha = 1;
}

function drawPortrait(context, config) {
  const finish = config.finish || 'photo';
  if (finish === 'pixel') {
    const lowResolution = portraitBase(config, 8);
    context.imageSmoothingEnabled = false;
    context.drawImage(lowResolution, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    context.strokeStyle = 'rgba(248, 245, 235, 0.42)';
    context.lineWidth = 2.2;
    context.beginPath();
    for (let x = TEXTURE_SIZE / 8; x < TEXTURE_SIZE; x += TEXTURE_SIZE / 8) {
      context.moveTo(x, 28);
      context.lineTo(x, TEXTURE_SIZE - 28);
    }
    for (let y = TEXTURE_SIZE / 8; y < TEXTURE_SIZE; y += TEXTURE_SIZE / 8) {
      context.moveTo(28, y);
      context.lineTo(TEXTURE_SIZE - 28, y);
    }
    context.stroke();
    return;
  }

  const source = portraitBase(config);
  if (finish === 'halftone') drawHalftone(context, source);
  else context.drawImage(source, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
}

function drawFingerprint(context, config) {
  const [paper = '#f3eee3', ink = '#354448', secondary = '#9a8a70'] = config.palette || [];
  context.fillStyle = paper;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.strokeStyle = secondary;
  context.lineWidth = 3;
  context.strokeRect(31, 31, 450, 450);
  context.strokeStyle = ink;
  context.lineCap = 'round';
  context.lineWidth = 5;
  const cx = 257;
  const cy = 264;
  for (let row = 0; row < 13; row++) {
    const width = 46 + row * 11.8;
    const height = 59 + row * 13.2;
    const start = -Math.PI * (0.84 + row * 0.004);
    const end = Math.PI * (0.84 + row * 0.004);
    context.beginPath();
    context.ellipse(cx + (row % 2 ? 2 : -2), cy + row * 0.5, width, height, 0, start, end);
    context.stroke();
  }
  context.beginPath();
  context.arc(cx, cy + 9, 39, Math.PI * 0.04, Math.PI * 1.84);
  context.stroke();
  context.beginPath();
  context.moveTo(97, 411);
  context.quadraticCurveTo(251, 454, 414, 407);
  context.stroke();
  const random = seededRandom(config.seed);
  context.fillStyle = ink;
  for (let i = 0; i < 620; i++) {
    context.globalAlpha = 0.08 + random() * 0.12;
    context.fillRect(random() * TEXTURE_SIZE, random() * TEXTURE_SIZE, 1.2, 1.2);
  }
  context.globalAlpha = 1;
}

function drawFlowerPaper(context, config) {
  const [paper = '#fffaf0', fiber = '#c8bda8'] = config.palette || [];
  const random = seededRandom(config.seed);
  context.fillStyle = paper;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.strokeStyle = fiber;
  context.lineWidth = 3;
  context.lineCap = 'round';
  for (let vein = 0; vein < 5; vein++) {
    const offset = 30 + vein * 12;
    context.beginPath();
    context.moveTo(256, 256);
    context.quadraticCurveTo(257 + (vein - 2) * 26, 150, 255 + (vein - 2) * 43, 54);
    context.stroke();
    context.beginPath();
    context.moveTo(256, 256);
    context.quadraticCurveTo(255 - (vein - 2) * 25, 352, 257 - (vein - 2) * 42, 459);
    context.stroke();
    context.fillStyle = fiber;
    context.globalAlpha = 0.11;
    context.fillRect(offset * 2, 0, 1, TEXTURE_SIZE);
  }
  context.globalAlpha = 0.12;
  context.fillStyle = fiber;
  for (let i = 0; i < 380; i++) context.fillRect(random() * TEXTURE_SIZE, random() * TEXTURE_SIZE, 1.2, 1.2);
  context.globalAlpha = 1;
}

export function editorialTextureKey(config) {
  return [config.type, config.finish || '', config.seed, ...(config.palette || [])].join(':');
}

export function createEditorialTextureFactory(THREE, themes, ownedTextures = new Set()) {
  const cache = new Map();
  const themeByChapter = new Map((themes || []).map(theme => [theme.chapterId, theme]));

  function configFor(chapterId, sceneId, motifId) {
    return themeByChapter.get(chapterId)?.editorialMotifs?.[sceneId]?.[motifId] || null;
  }

  function textureFor(config) {
    if (!config) return null;
    const key = editorialTextureKey(config);
    if (cache.has(key)) return cache.get(key);

    const surface = document.createElement('canvas');
    surface.width = TEXTURE_SIZE;
    surface.height = TEXTURE_SIZE;
    const context = surface.getContext('2d');
    if (config.type === 'portrait') drawPortrait(context, config);
    else if (config.type === 'fingerprint') drawFingerprint(context, config);
    else if (config.type === 'flower-paper') drawFlowerPaper(context, config);
    else throw new Error(`Unknown editorial motif type: ${config.type}`);

    const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    cache.set(key, texture);
    ownedTextures.add(texture);
    return texture;
  }

  return {
    configFor,
    textureFor,
    get cacheSize() { return cache.size; },
    get keys() { return [...cache.keys()]; },
    dispose() { cache.clear(); },
  };
}

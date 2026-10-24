export const ENTRANCE_DURATION_MS = 900;

type Point = [number, number, number];
export type EntranceSample = {
  stage: 'library' | 'cosmos' | 'islands';
  cameraPosition: Point;
  cameraTarget: Point;
  fov: number;
  libraryVisible: boolean;
  cosmosVisible: boolean;
  islandsVisible: boolean;
  libraryScale: number;
  cosmosScale: number;
  islandProgress: number;
  veil: number;
};
type CameraKey = { at: number; position: Point; target: Point; fov: number };

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const ease = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function interpolate(keys: CameraKey[], progress: number, field: 'position' | 'target', axis: number) {
  const index = Math.min(keys.length - 2, Math.max(0, keys.findIndex((key, i) => i < keys.length - 1 && progress <= keys[i + 1].at)));
  const from = keys[index];
  const to = keys[index + 1];
  const before = keys[Math.max(0, index - 1)];
  const after = keys[Math.min(keys.length - 1, index + 2)];
  const span = to.at - from.at;
  const t = clamp((progress - from.at) / span);
  const startVelocity = index === 0 ? 0 : (to[field][axis] - before[field][axis]) / (to.at - before.at);
  const endVelocity = index + 1 === keys.length - 1 ? 0 : (after[field][axis] - from[field][axis]) / (after.at - from.at);
  return (2 * t ** 3 - 3 * t ** 2 + 1) * from[field][axis]
    + (t ** 3 - 2 * t ** 2 + t) * span * startVelocity
    + (-2 * t ** 3 + 3 * t ** 2) * to[field][axis]
    + (t ** 3 - t ** 2) * span * endVelocity;
}

function veilAt(t: number, start: number, covered: number, end: number) {
  return t < covered ? ease((t - start) / (covered - start)) : 1 - ease((t - covered) / (end - covered));
}

export function sampleEntrance(progress: number, aspect: number): EntranceSample {
  const t = Number.isNaN(progress) ? 0 : clamp(progress);
  const ratio = Number.isFinite(aspect) && aspect > 0 ? clamp(aspect, .3, 4) : 1;
  const narrow = 1 - ease((ratio - .65) / .6);
  const initialFov = mix(52, 64, narrow);
  const distance = clamp(1.7 + 16 / (ratio * Math.tan(initialFov * Math.PI / 360)), 30, 38);
  const keys: CameraKey[] = [
    { at: 0, position: [0, 6, distance], target: [0, 6, 1.7], fov: initialFov },
    { at: .18, position: [-1.1, 6.5, 24 + (distance - 30) * .6], target: [0, 6.4, 1.7], fov: 53 },
    { at: .36, position: [-.6, 9.7, 10], target: [0, 9.2, 1.7], fov: 56 },
    { at: .44, position: [0, 10.6, 6.5], target: [0, 9.7, 1.7], fov: 59 },
    { at: .55, position: [1.4, 10.9, -1.5], target: [0, 9, -9], fov: 63 },
    { at: .69, position: [-1.8, 11, -11], target: [0, 8, -20], fov: 65 },
    { at: .78, position: [1, 15, -3], target: [0, 2, -8], fov: 61 },
    { at: .88, position: [18, 27, 20], target: [0, 0, 0], fov: 55 },
    { at: 1, position: [22, 30, mix(25, 31, narrow)], target: [0, 0, 0], fov: 52 },
  ];
  const segment = keys.findIndex((key, index) => index < keys.length - 1 && t <= keys[index + 1].at);
  const from = keys[segment];
  const to = keys[segment + 1];
  const stage = t < .44 ? 'library' : t < .82 ? 'cosmos' : 'islands';
  const islandProgress = ease((t - .82) / .18);
  return {
    stage,
    cameraPosition: [0, 1, 2].map(axis => interpolate(keys, t, 'position', axis)) as Point,
    cameraTarget: [0, 1, 2].map(axis => interpolate(keys, t, 'target', axis)) as Point,
    fov: mix(from.fov, to.fov, ease((t - from.at) / (to.at - from.at))),
    libraryVisible: stage === 'library',
    cosmosVisible: stage === 'cosmos',
    islandsVisible: stage === 'islands',
    libraryScale: 1,
    cosmosScale: mix(1, .86, ease((t - .44) / .38)),
    islandProgress,
    veil: Math.max(veilAt(t, .395, .44, .485), veilAt(t, .765, .82, .895)),
  };
}

export function treeRotationForElapsed(seconds: number): number {
  return Number.isFinite(seconds) ? ((seconds % 150) / 150) * Math.PI * 2 : 0;
}

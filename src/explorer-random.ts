export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(seed: number, key: string): number {
  let value = seed >>> 0;
  for (const character of key) value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0;
  return value;
}

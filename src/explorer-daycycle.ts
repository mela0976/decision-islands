import type { DayKeyframe, DaySnapshot, ExplorerData, Vec3 } from './explorer-types';
const wrap = (minute: number) => ((Number.isFinite(minute) ? minute : 0) % 1440 + 1440) % 1440;
function color(a: string, b: string, t: number): string {
    const av = parseInt(a.replace('#', ''), 16), bv = parseInt(b.replace('#', ''), 16);
    return '#' + [16, 8, 0].map(shift => Math.round(((av >> shift) & 255) * (1 - t) + ((bv >> shift) & 255) * t).toString(16).padStart(2, '0')).join('');
}
export function sampleDay(keyframes: readonly DayKeyframe[], minute: number): DaySnapshot {
    if (keyframes.length < 2)
        throw new Error('Explorer day: two keyframes required');
    minute = wrap(minute);
    let k = 1;
    while (k < keyframes.length - 1 && keyframes[k].minute < minute)
        k++;
    const a = keyframes[k - 1], b = keyframes[k], t = (minute - a.minute) / (b.minute - a.minute), lerp = (a: number, b: number) => a + (b - a) * t;
    const solarMinute = Math.floor(minute / 10) * 10, solarT = Math.max(0, Math.min(1, (solarMinute - 360) / 720)), az = Math.PI * (.15 + .7 * solarT), el = .35 + Math.sin(solarT * Math.PI) * .75;
    const v = [Math.cos(az) * Math.cos(el), Math.sin(el), .55 * Math.cos(el) + .35], length = Math.hypot(...v), sunDirection = v.map(n => n / length) as unknown as Vec3;
    return { minute, skyTop: color(a.skyTop, b.skyTop, t), horizon: color(a.horizon, b.horizon, t), sunColor: color(a.sunColor, b.sunColor, t), sunIntensity: lerp(a.sunIntensity, b.sunIntensity), hemiSky: color(a.hemiSky, b.hemiSky, t), hemiGround: color(a.hemiGround, b.hemiGround, t), hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity), night: lerp(a.night, b.night), water: color(a.water, b.water, t), sunDirection };
}
export function activeItemIds(data: ExplorerData, minute: number): readonly string[] { const m = wrap(minute); return [...new Set(data.daySegments.filter(s => m >= s.startMinute && m < s.endMinute).flatMap(s => s.itemIds))]; }

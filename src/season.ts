export type Season = 'christmas' | 'halloween' | 'easter';
export interface HolidayPalette {
  title: { zh: string; en: string }; accent: string; secondary: string; paper: string; ink: string;
  sea: string; sky: string; glow: string; ornament: string; motif: 'star' | 'pumpkin' | 'egg';
}
export const HOLIDAYS: Record<Season, HolidayPalette> = {
  christmas: { title: { zh: '聖誕節', en: 'Christmas' }, accent: '#b84338', secondary: '#58775c', paper: '#fff8ef', ink: '#203c35', sea: '#a7c9c4', sky: '#e9f2ee', glow: '#ffd68a', ornament: '#b84338', motif: 'star' },
  halloween: { title: { zh: '萬聖節', en: 'Halloween' }, accent: '#c96725', secondary: '#76618b', paper: '#fff2df', ink: '#2f223d', sea: '#777ca5', sky: '#d8c9e3', glow: '#ffb24a', ornament: '#8c5cab', motif: 'pumpkin' },
  easter: { title: { zh: '復活節', en: 'Easter' }, accent: '#a7668e', secondary: '#94b59c', paper: '#fffaf3', ink: '#31564c', sea: '#a9d5cf', sky: '#edf2e5', glow: '#ffd1a3', ornament: '#c6a2d6', motif: 'egg' },
};
export function isSeason(value: unknown): value is Season { return typeof value === 'string' && Object.hasOwn(HOLIDAYS, value); }
const key = 'decision-islands-season-v1';
export function readSeason(): Season {
  try { const value = localStorage.getItem(key); return isSeason(value) ? value : 'christmas'; } catch { return 'christmas'; }
}
export function saveSeason(season: Season): boolean {
  try { localStorage.setItem(key, season); return true; } catch { return false; }
}
export function applySeason(season: Season): void {
  const palette = HOLIDAYS[season];
  document.documentElement.dataset.season = season;
  for (const name of ['accent', 'secondary', 'paper', 'ink', 'sea', 'sky', 'glow'] as const) document.documentElement.style.setProperty(`--holiday-${name}`, palette[name]);
}

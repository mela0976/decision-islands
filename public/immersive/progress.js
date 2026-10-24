const KEY = 'decision-immersive-progress-v1';
const uniqueStrings = value => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string'))].slice(0, 1000) : [];
export function parseProgress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('備份格式不正確');
  const notes = Object.create(null);
  for (const [id, text] of Object.entries(value.notes || {})) if (/^2026-\d{2}$/.test(id) && typeof text === 'string') notes[id] = text.slice(0, 8000);
  return { version: 1, read: uniqueStrings(value.read), bookmarks: uniqueStrings(value.bookmarks), stamps: uniqueStrings(value.stamps), routes: (Array.isArray(value.routes)?value.routes.filter(route=>typeof route==='string'):[]).slice(-30), notes, last: typeof value.last === 'string' ? value.last : '2026-01', mode: value.mode === 'explore' ? 'explore' : 'story', introSeen: value.introSeen === true };
}
const setFields = ['read', 'bookmarks', 'stamps'];
const scalarFields = ['last', 'mode', 'introSeen'];
function appendedRoutes(before, after) {
  for (let overlap = Math.min(before.length, after.length); overlap > 0; overlap--) {
    if (before.slice(-overlap).every((route, i) => route === after[i])) return after.slice(overlap);
  }
  return after;
}
function changesSince(baseline, state, pending) {
  const sets = Object.fromEntries(setFields.map(field => [field, {
    added: state[field].filter(id => !baseline[field].includes(id) || pending.restoredSets[field].has(id)),
    removed: baseline[field].filter(id => !state[field].includes(id)),
  }]));
  const notes = [...new Set([...Object.keys(baseline.notes), ...Object.keys(state.notes)])]
    .filter(id => baseline.notes[id] !== state.notes[id])
    .map(id => ({ id, value: state.notes[id], recover: pending.restoredNotes.has(id) && pending.restoredNotes.get(id) === state.notes[id] }));
  const scalars = Object.fromEntries(scalarFields.filter(field => baseline[field] !== state[field]).map(field => [field, state[field]]));
  return { sets, notes, scalars, routes: pending.routes.length ? pending.routes : appendedRoutes(baseline.routes, state.routes) };
}
function mergeChanges(latest, changes) {
  for (const field of setFields) {
    const { added, removed } = changes.sets[field];
    latest[field] = [...new Set([...latest[field].filter(id => !removed.includes(id)), ...added])];
  }
  for (const { id, value, recover } of changes.notes) {
    if (recover && latest.notes[id]?.trim()) continue;
    if (value === undefined) delete latest.notes[id];
    else latest.notes[id] = value;
  }
  return parseProgress({ ...latest, ...changes.scalars, routes: [...latest.routes, ...changes.routes] });
}
function readProgress(storage) {
  const raw = storage.getItem(KEY);
  if (raw !== null) return { state: parseProgress(JSON.parse(raw)), primary: true };
  const state = parseProgress({});
  const old = JSON.parse(storage.getItem('decision-islands-v1') || '{}');
  state.read = uniqueStrings(old.completed); state.bookmarks = uniqueStrings(old.bookmarks); state.last = typeof old.last === 'string' ? old.last : state.last;
  const legacyPrefix = 'decision-islands-reading-note-v1:';
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(legacyPrefix)) continue;
    // Read failures must abort migration, while invalid legacy records stay untouched.
    const rawNote = storage.getItem(key);
    try {
      const record = JSON.parse(rawNote);
      const identity = JSON.parse(decodeURIComponent(key.slice(legacyPrefix.length)));
      if (identity[0] !== '決策智慧 2026｜Agentic 時代，重塑品牌與人的真實距離' || identity[1] !== 2026) continue;
      const id = record.articleId || record.identity?.articleId || identity[2];
      const text = record.text ?? record.note;
      if (/^2026-\d{2}$/.test(id) && typeof text === 'string') state.notes[id] = text.slice(0, 8000);
    } catch { /* Preserve unreadable legacy records in their original keys. */ }
  }
  return { state, primary: false };
}
export function createProgress(storage, onError = () => {}) {
  let state = parseProgress({});
  let baseline = parseProgress({});
  let readable = true;
  let persistent = true;
  let lastSuccessfulSave = null;
  const pending = { restoredNotes: new Map(), restoredSets: Object.fromEntries(setFields.map(field => [field, new Set()])), routes: [] };
  try {
    const loaded = readProgress(storage);
    state = loaded.state;
    if (loaded.primary) baseline = parseProgress(state);
  } catch { readable = persistent = false; onError('瀏覽器無法讀取儲存資料，本次仍可探索；請下載備份保存新增內容。'); }
  return {
    get state() { return state; },
    get readable() { return readable; },
    get persistent() { return persistent; },
    get lastSuccessfulSave() { return lastSuccessfulSave; },
    save() {
      let latest;
      try { latest = readProgress(storage).state; readable = true; }
      catch { readable = persistent = false; onError('尚未讀回原有紀錄，暫不覆寫；請下載備份保留本次筆記。'); return false; }
      const merged = mergeChanges(latest, changesSince(baseline, parseProgress(state), pending));
      try { storage.setItem(KEY, JSON.stringify(merged)); }
      catch { persistent = false; onError('儲存失敗，請下載備份保留本次筆記。'); return false; }
      state = merged; baseline = parseProgress(merged); pending.restoredNotes.clear(); pending.routes = [];
      for (const field of setFields) pending.restoredSets[field].clear();
      persistent = true; lastSuccessfulSave = Date.now();
      return true;
    },
    toggle(field, id) { const values = new Set(state[field]); values.has(id) ? values.delete(id) : values.add(id); state[field] = [...values]; return this.save(); },
    visit(id) {
      const from = state.last; state.last = id;
      if (from !== id) {
        const route = `${from}>${id}`;
        state.routes = [...state.routes, route].slice(-30); pending.routes = [...pending.routes, route].slice(-30);
      }
      return this.save();
    },
    stamp(id) { state.stamps = uniqueStrings([...state.stamps, id]); return this.save(); },
    restore(value) {
      const incoming = parseProgress(value);
      for (const [id, note] of Object.entries(incoming.notes)) {
        if (!state.notes[id]?.trim()) { state.notes[id] = note; pending.restoredNotes.set(id, note); }
      }
      for (const field of setFields) for (const id of incoming[field]) pending.restoredSets[field].add(id);
      pending.routes = [...pending.routes, ...incoming.routes].slice(-30);
      state = parseProgress({ ...state, read: [...state.read, ...incoming.read], bookmarks: [...state.bookmarks, ...incoming.bookmarks], stamps: [...state.stamps, ...incoming.stamps], routes: [...state.routes, ...incoming.routes] });
      return this.save();
    },
  };
}

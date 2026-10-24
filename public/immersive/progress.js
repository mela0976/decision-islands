const KEY = 'decision-immersive-progress-v1';
const uniqueStrings = value => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string'))].slice(0, 1000) : [];
export function parseProgress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('備份格式不正確');
  const notes = Object.create(null);
  for (const [id, text] of Object.entries(value.notes || {})) if (/^2026-\d{2}$/.test(id) && typeof text === 'string') notes[id] = text.slice(0, 8000);
  return { version: 1, read: uniqueStrings(value.read), bookmarks: uniqueStrings(value.bookmarks), stamps: uniqueStrings(value.stamps), routes: (Array.isArray(value.routes)?value.routes.filter(route=>typeof route==='string'):[]).slice(-30), notes, last: typeof value.last === 'string' ? value.last : '2026-01', mode: value.mode === 'explore' ? 'explore' : 'story', introSeen: value.introSeen === true };
}
export function createProgress(storage, onError = () => {}) {
  let state = parseProgress({});
  let readable = true;
  try {
    const raw = storage.getItem(KEY);
    if (raw) state = parseProgress(JSON.parse(raw));
    else {
      const old = JSON.parse(storage.getItem('decision-islands-v1') || '{}');
      state.read = uniqueStrings(old.completed); state.bookmarks = uniqueStrings(old.bookmarks); state.last = typeof old.last === 'string' ? old.last : state.last;
      const legacyPrefix = 'decision-islands-reading-note-v1:';
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(legacyPrefix)) continue;
        try {
          const record = JSON.parse(storage.getItem(key));
          const identity = JSON.parse(decodeURIComponent(key.slice(legacyPrefix.length)));
          if (identity[0] !== '決策智慧 2026｜Agentic 時代，重塑品牌與人的真實距離' || identity[1] !== 2026) continue;
          const id = record.articleId || record.identity?.articleId || identity[2];
          const text = record.text ?? record.note;
          if (/^2026-\d{2}$/.test(id) && typeof text === 'string') state.notes[id] = text.slice(0, 8000);
        } catch { /* Preserve unreadable legacy records in their original keys. */ }
      }
    }
  } catch { readable = false; onError('瀏覽器無法讀取儲存資料，本次仍可探索；請下載備份保存新增內容。'); }
  return {
    get state() { return state; },
    save() { if (!readable) { onError('尚未讀回原有紀錄，暫不覆寫；請下載備份保留本次筆記。'); return false; } try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch { onError('儲存失敗，請下載備份保留本次筆記。'); return false; } },
    toggle(field, id) { const values = new Set(state[field]); values.has(id) ? values.delete(id) : values.add(id); state[field] = [...values]; return this.save(); },
    visit(id) { const from = state.last; state.last = id; if (from !== id) state.routes = [...state.routes, `${from}>${id}`].slice(-30); return this.save(); },
    stamp(id) { state.stamps = uniqueStrings([...state.stamps, id]); return this.save(); },
    restore(value) { const incoming = parseProgress(value); const meaningfulNotes=Object.fromEntries(Object.entries(state.notes).filter(([,note])=>note.trim().length));state = parseProgress({ ...state, read: [...state.read, ...incoming.read], bookmarks: [...state.bookmarks, ...incoming.bookmarks], stamps: [...state.stamps, ...incoming.stamps], notes: { ...state.notes, ...incoming.notes, ...meaningfulNotes }, routes: [...state.routes, ...incoming.routes], introSeen: state.introSeen }); return this.save(); },
  };
}

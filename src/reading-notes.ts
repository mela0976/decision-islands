import type { Article } from './types';

export const READING_NOTE_MAX_CHARS = 8000;
export const READING_NOTE_AUTOSAVE_DELAY_MS = 200;

const NOTE_KEY_PREFIX = 'decision-islands-reading-note-v1:';
const LEGACY_NOTE_KEY_PREFIX = 'decision-islands-reading-note:';

interface NoteIdentity {
  bookTitle: string;
  year: number;
  articleId: string;
}

interface StoredReadingNote {
  schemaVersion: 1;
  text: string;
  updatedAt: string;
}

type NoteStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface ReadingNoteReadResult {
  text: string;
  updatedAt: string | null;
  available: boolean;
  needsMigration: boolean;
}

export interface ReadingNoteWriteResult {
  saved: boolean;
  updatedAt: string | null;
}

function identityFor(bookTitle: string, article: Pick<Article, 'year' | 'id'>): NoteIdentity {
  return { bookTitle, year: article.year, articleId: article.id };
}

function identitySuffix(identity: NoteIdentity): string {
  return encodeURIComponent(JSON.stringify([identity.bookTitle, identity.year, identity.articleId]));
}

export function readingNoteStorageKey(bookTitle: string, article: Pick<Article, 'year' | 'id'>): string {
  return NOTE_KEY_PREFIX + identitySuffix(identityFor(bookTitle, article));
}

function legacyStorageKey(identity: NoteIdentity): string {
  return LEGACY_NOTE_KEY_PREFIX + identitySuffix(identity);
}

function asText(value: unknown): string | null {
  return typeof value === 'string' ? value.slice(0, READING_NOTE_MAX_CHARS) : null;
}

function decodeLegacyNote(value: string): { text: string; updatedAt: string | null } {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'string') return { text: parsed.slice(0, READING_NOTE_MAX_CHARS), updatedAt: null };
    if (parsed && typeof parsed === 'object' && 'text' in parsed) {
      const text = asText(parsed.text);
      const updatedAt = 'updatedAt' in parsed && typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null;
      if (text !== null) return { text, updatedAt };
    }
  } catch { /* An unquoted legacy value was stored as plain text. */ }
  return { text: value.slice(0, READING_NOTE_MAX_CHARS), updatedAt: null };
}

export function readReadingNote(
  storage: NoteStorage,
  bookTitle: string,
  article: Pick<Article, 'year' | 'id'>,
): ReadingNoteReadResult {
  const identity = identityFor(bookTitle, article);
  try {
    const current = storage.getItem(NOTE_KEY_PREFIX + identitySuffix(identity));
    if (current !== null) {
      try {
        const parsed: unknown = JSON.parse(current);
        if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed && parsed.schemaVersion === 1 && 'text' in parsed) {
          const text = asText(parsed.text);
          if (text !== null) {
            const updatedAt = 'updatedAt' in parsed && typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null;
            return { text, updatedAt, available: true, needsMigration: false };
          }
        }
      } catch { /* Corrupt current data is left untouched until the user saves a replacement. */ }
      return { text: '', updatedAt: null, available: true, needsMigration: false };
    }

    const legacy = storage.getItem(legacyStorageKey(identity));
    if (legacy !== null) {
      const decoded = decodeLegacyNote(legacy);
      return { ...decoded, available: true, needsMigration: true };
    }
    return { text: '', updatedAt: null, available: true, needsMigration: false };
  } catch {
    return { text: '', updatedAt: null, available: false, needsMigration: false };
  }
}

export function writeReadingNote(
  storage: NoteStorage | undefined,
  bookTitle: string,
  article: Pick<Article, 'year' | 'id'>,
  text: string,
  now: () => Date = () => new Date(),
): ReadingNoteWriteResult {
  if (!storage || text.length > READING_NOTE_MAX_CHARS) return { saved: false, updatedAt: null };
  const identity = identityFor(bookTitle, article);
  const updatedAt = now().toISOString();
  const value: StoredReadingNote = { schemaVersion: 1, text, updatedAt };
  try {
    storage.setItem(NOTE_KEY_PREFIX + identitySuffix(identity), JSON.stringify(value));
  } catch {
    return { saved: false, updatedAt: null };
  }

  try { storage.removeItem(legacyStorageKey(identity)); } catch { /* The versioned note takes precedence if cleanup is denied. */ }
  return { saved: true, updatedAt };
}

export function clearReadingNote(
  storage: NoteStorage | undefined,
  bookTitle: string,
  article: Pick<Article, 'year' | 'id'>,
  now: () => Date = () => new Date(),
): ReadingNoteWriteResult {
  return writeReadingNote(storage, bookTitle, article, '', now);
}

export interface TimerApi {
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

export interface DebouncedNoteWriter {
  schedule(text: string): void;
  flush(): boolean;
  cancel(): void;
}

export function createDebouncedNoteWriter(
  save: (text: string) => boolean,
  delay = READING_NOTE_AUTOSAVE_DELAY_MS,
  timers: TimerApi = globalThis,
): DebouncedNoteWriter {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: string | undefined;

  const flush = (): boolean => {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
    if (pending === undefined) return true;
    if (!save(pending)) return false;
    pending = undefined;
    return true;
  };

  return {
    schedule(text) {
      pending = text;
      if (timer !== null) timers.clearTimeout(timer);
      timer = timers.setTimeout(() => {
        timer = null;
        flush();
      }, delay);
    },
    flush,
    cancel() {
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
      pending = undefined;
    },
  };
}

function browserStorage(): NoteStorage | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

let nextInputId = 0;
const volatileDrafts = new Map<string, string>();

function applyStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, styles);
}

export function mountReadingNotes(container: HTMLElement, article: Article, bookTitle: string): () => void {
  const doc = container.ownerDocument;
  const storage = browserStorage();
  const storageKey = readingNoteStorageKey(bookTitle, article);
  const loaded = storage ? readReadingNote(storage, bookTitle, article) : { text: '', updatedAt: null, available: false, needsMigration: false };
  const hasVolatileDraft = volatileDrafts.has(storageKey);
  const section = doc.createElement('section');
  const heading = doc.createElement('h3');
  const privacy = doc.createElement('p');
  const label = doc.createElement('label');
  const textarea = doc.createElement('textarea');
  const footer = doc.createElement('div');
  const count = doc.createElement('span');
  const status = doc.createElement('span');
  const actions = doc.createElement('div');
  const copyButton = doc.createElement('button');
  const clearButton = doc.createElement('button');
  const inputId = `reading-note-${++nextInputId}`;

  section.setAttribute('aria-labelledby', `${inputId}-heading`);
  heading.id = `${inputId}-heading`;
  heading.textContent = '為這篇文章留下筆記';
  privacy.textContent = '筆記只儲存在這個瀏覽器，不會上傳。';
  label.htmlFor = inputId;
  label.textContent = `個人筆記（最多 ${READING_NOTE_MAX_CHARS.toLocaleString()} 字）`;
  textarea.id = inputId;
  textarea.name = 'reading-note';
  textarea.maxLength = READING_NOTE_MAX_CHARS;
  textarea.rows = 6;
  textarea.setAttribute('aria-label', '文章筆記');
  textarea.value = volatileDrafts.get(storageKey) ?? loaded.text;
  count.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-live', 'polite');
  copyButton.type = 'button';
  copyButton.textContent = '複製未儲存筆記';
  copyButton.hidden = true;
  clearButton.type = 'button';
  clearButton.textContent = '清除筆記';
  clearButton.disabled = textarea.value.length === 0;

  applyStyles(section, { marginTop: '1.5rem', padding: '1rem', border: '1px solid #d8d4c8', borderRadius: '12px', background: '#fffdf7' });
  applyStyles(heading, { margin: '0 0 0.35rem', fontSize: '1.05rem' });
  applyStyles(privacy, { margin: '0 0 0.85rem', fontSize: '0.9rem', color: '#5a5a52' });
  applyStyles(label, { display: 'block', marginBottom: '0.4rem', fontWeight: '600' });
  applyStyles(textarea, { boxSizing: 'border-box', display: 'block', width: '100%', minHeight: '8.5rem', padding: '0.75rem', border: '1px solid #8c8a7d', borderRadius: '8px', font: 'inherit', fontSize: '16px', lineHeight: '1.5', resize: 'vertical' });
  applyStyles(footer, { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'start', marginTop: '0.5rem', fontSize: '0.85rem' });
  applyStyles(actions, { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.65rem' });
  for (const button of [copyButton, clearButton]) {
    applyStyles(button, { minHeight: '44px', padding: '0.55rem 0.8rem', border: '1px solid #777568', borderRadius: '8px', background: '#fff', color: 'inherit', font: 'inherit', cursor: 'pointer' });
  }

  const updateCount = (): void => { count.textContent = `${textarea.value.length.toLocaleString()} / ${READING_NOTE_MAX_CHARS.toLocaleString()} 字`; };
  updateCount();
  status.textContent = loaded.available ? '筆記儲存在這個瀏覽器' : '此瀏覽器目前無法使用本機儲存';

  footer.append(count, status);
  actions.append(copyButton, clearButton);
  section.append(heading, privacy, label, textarea, footer, actions);
  container.append(section);

  const writer = createDebouncedNoteWriter((text) => {
    const result = writeReadingNote(storage, bookTitle, article, text);
    if (!result.saved) {
      volatileDrafts.set(storageKey, text);
      copyButton.hidden = false;
      status.textContent = '儲存失敗；筆記仍保留在此欄位，可複製保存。';
      return false;
    }
    volatileDrafts.delete(storageKey);
    copyButton.hidden = true;
    clearButton.disabled = text.length === 0;
    status.textContent = '已儲存在這個瀏覽器';
    return true;
  });

  if (hasVolatileDraft) {
    writer.schedule(textarea.value);
    copyButton.hidden = false;
    status.textContent = '有尚未儲存的草稿，正在重試…';
  } else if (!loaded.available) {
    copyButton.hidden = true;
  } else if (loaded.needsMigration) {
    writer.schedule(textarea.value);
    status.textContent = '正在移轉舊版筆記…';
  }

  const onInput = (): void => {
    const text = textarea.value.slice(0, READING_NOTE_MAX_CHARS);
    if (textarea.value !== text) textarea.value = text;
    volatileDrafts.set(storageKey, text);
    clearButton.disabled = text.length === 0;
    updateCount();
    status.textContent = '儲存中…';
    writer.schedule(text);
  };
  const onImmediateSave = (): void => { writer.flush(); };
  const onVisibility = (): void => { if (doc.visibilityState === 'hidden') writer.flush(); };
  const onCopy = async (): Promise<void> => {
    try {
      if (!doc.defaultView?.navigator.clipboard) throw new Error('Clipboard API unavailable');
      await doc.defaultView.navigator.clipboard.writeText(textarea.value);
      status.textContent = '已複製筆記';
    } catch {
      textarea.focus();
      textarea.select();
      status.textContent = '已選取筆記，請手動複製';
    }
  };
  const onClear = (): void => {
    if (textarea.value.length === 0) return;
    const result = clearReadingNote(storage, bookTitle, article);
    if (!result.saved) {
      volatileDrafts.set(storageKey, textarea.value);
      copyButton.hidden = false;
      status.textContent = '清除失敗；筆記仍保留在此欄位，可複製保存。';
      return;
    }
    writer.cancel();
    volatileDrafts.delete(storageKey);
    textarea.value = '';
    clearButton.disabled = true;
    copyButton.hidden = true;
    updateCount();
    status.textContent = '已清除這篇文章的筆記';
  };

  textarea.addEventListener('input', onInput);
  textarea.addEventListener('blur', onImmediateSave);
  doc.addEventListener('visibilitychange', onVisibility);
  doc.defaultView?.addEventListener('pagehide', onImmediateSave);
  copyButton.addEventListener('click', onCopy);
  clearButton.addEventListener('click', onClear);

  return () => {
    writer.flush();
    textarea.removeEventListener('input', onInput);
    textarea.removeEventListener('blur', onImmediateSave);
    doc.removeEventListener('visibilitychange', onVisibility);
    doc.defaultView?.removeEventListener('pagehide', onImmediateSave);
    copyButton.removeEventListener('click', onCopy);
    clearButton.removeEventListener('click', onClear);
    section.remove();
  };
}

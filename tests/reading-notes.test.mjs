import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/reading-notes.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const notes = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const article = { id: '2026-01', year: 2026 };
const otherYearArticle = { id: '2026-01', year: 2027 };

class MemoryStorage {
  values = new Map();
  failRead = false;
  failWrite = false;

  getItem(key) {
    if (this.failRead) throw new Error('storage denied');
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrite) throw new Error('quota exceeded');
    this.values.set(key, String(value));
  }

  removeItem(key) { this.values.delete(key); }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.listeners = new Map();
    this.style = {};
    this.attributes = {};
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.parentNode = null;
  }

  setAttribute(name, value) { this.attributes[name] = value; }
  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      this.children.push(child);
    }
  }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type, listener) { if (this.listeners.get(type) === listener) this.listeners.delete(type); }
  dispatch(type, event = {}) { this.listeners.get(type)?.({ target: this, ...event }); }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    this.parentNode = null;
  }
  focus() {}
  select() {}
}

class FakeDocument {
  listeners = new Map();
  visibilityState = 'visible';
  defaultView = {
    navigator: {},
    listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    removeEventListener(type, listener) { if (this.listeners.get(type) === listener) this.listeners.delete(type); },
  };
  createElement(tagName) { return new FakeElement(tagName, this); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type, listener) { if (this.listeners.get(type) === listener) this.listeners.delete(type); }
}

function findElement(root, tagName) {
  if (root.tagName === tagName.toUpperCase()) return root;
  for (const child of root.children) {
    const match = findElement(child, tagName);
    if (match) return match;
  }
  return null;
}

function withLocalStorage(storage, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try { return run(); }
  finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
}

test('versioned note schema stores a timestamp and migrates legacy plain-text data', () => {
  const storage = new MemoryStorage();
  const key = notes.readingNoteStorageKey('決策智慧 2026', article);
  const suffix = key.slice('decision-islands-reading-note-v1:'.length);
  const legacyKey = `decision-islands-reading-note:${suffix}`;
  storage.setItem(legacyKey, '舊版筆記');

  const migrated = notes.readReadingNote(storage, '決策智慧 2026', article);
  assert.deepEqual(migrated, { text: '舊版筆記', updatedAt: null, available: true, needsMigration: true });
  const saved = notes.writeReadingNote(storage, '決策智慧 2026', article, migrated.text, () => new Date('2026-10-24T02:00:00.000Z'));
  assert.deepEqual(saved, { saved: true, updatedAt: '2026-10-24T02:00:00.000Z' });
  assert.deepEqual(JSON.parse(storage.getItem(key)), {
    schemaVersion: 1,
    text: '舊版筆記',
    updatedAt: '2026-10-24T02:00:00.000Z',
  });
  assert.equal(storage.getItem(legacyKey), null);
  assert.equal(notes.readReadingNote(storage, '決策智慧 2026', article).needsMigration, false);
});

test('full book title, year, and article ID isolate notes even when IDs are reused', () => {
  const storage = new MemoryStorage();
  assert.equal(notes.writeReadingNote(storage, '決策智慧', article, '2026 note').saved, true);
  assert.equal(notes.writeReadingNote(storage, '決策智慧', otherYearArticle, '2027 note').saved, true);
  assert.equal(notes.writeReadingNote(storage, '決策智慧：精選版', article, 'other book').saved, true);
  assert.equal(notes.readReadingNote(storage, '決策智慧', article).text, '2026 note');
  assert.equal(notes.readReadingNote(storage, '決策智慧', otherYearArticle).text, '2027 note');
  assert.equal(notes.readReadingNote(storage, '決策智慧：精選版', article).text, 'other book');
});

test('storage errors preserve the note draft and never delete its legacy value', () => {
  const storage = new MemoryStorage();
  const key = notes.readingNoteStorageKey('決策智慧', article);
  const legacyKey = `decision-islands-reading-note:${key.slice('decision-islands-reading-note-v1:'.length)}`;
  storage.setItem(legacyKey, '原筆記');
  storage.failWrite = true;
  assert.equal(notes.writeReadingNote(storage, '決策智慧', article, '正在編輯的新筆記').saved, false);
  assert.equal(storage.getItem(legacyKey), '原筆記');
  assert.deepEqual(notes.readReadingNote({ ...storage, getItem: () => { throw new Error('denied'); } }, '決策智慧', article), {
    text: '', updatedAt: null, available: false, needsMigration: false,
  });
});

test('notes reject values above 8000 characters without silently truncating the caller draft', () => {
  const storage = new MemoryStorage();
  const oversized = 'x'.repeat(notes.READING_NOTE_MAX_CHARS + 1);
  assert.equal(notes.writeReadingNote(storage, '決策智慧', article, oversized).saved, false);
  assert.equal(storage.values.size, 0);
});

test('debounced autosave coalesces edits and flushes synchronously at lifecycle boundaries', () => {
  const callbacks = new Map();
  let nextId = 1;
  const timers = {
    setTimeout(callback, delay) {
      assert.equal(delay, 200);
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    clearTimeout(id) { callbacks.delete(id); },
  };
  const writes = [];
  const writer = notes.createDebouncedNoteWriter(value => { writes.push(value); return true; }, 200, timers);
  writer.schedule('第 1 次輸入');
  writer.schedule('最後輸入');
  assert.deepEqual(writes, []);
  assert.equal(callbacks.size, 1);
  const [timerId, callback] = callbacks.entries().next().value;
  callbacks.delete(timerId);
  callback();
  assert.deepEqual(writes, ['最後輸入']);

  writer.schedule('blur 立即寫入');
  assert.equal(writer.flush(), true);
  assert.deepEqual(writes, ['最後輸入', 'blur 立即寫入']);
});

test('failed autosave keeps its pending value for a later retry', () => {
  let writable = false;
  const attempts = [];
  const writer = notes.createDebouncedNoteWriter(value => {
    attempts.push(value);
    return writable;
  }, 200, {
    setTimeout: () => 1,
    clearTimeout() {},
  });
  writer.schedule('保留草稿');
  assert.equal(writer.flush(), false);
  writable = true;
  assert.equal(writer.flush(), true);
  assert.deepEqual(attempts, ['保留草稿', '保留草稿']);
});

test('mount reads saved text without overwriting it; cleanup flushes and clear requires a button action', () => {
  const storage = new MemoryStorage();
  const doc = new FakeDocument();
  const firstContainer = doc.createElement('main');
  notes.writeReadingNote(storage, '決策智慧 2026', article, '已存在的 <img onerror="x"> 筆記');
  const noteKey = notes.readingNoteStorageKey('決策智慧 2026', article);
  const originalUpdatedAt = JSON.parse(storage.getItem(noteKey)).updatedAt;

  withLocalStorage(storage, () => {
    const cleanupFirst = notes.mountReadingNotes(firstContainer, article, '決策智慧 2026');
    const firstInput = findElement(firstContainer, 'textarea');
    assert.equal(firstInput.value, '已存在的 <img onerror="x"> 筆記');
    assert.equal(firstInput.maxLength, 8000);
    cleanupFirst();

    const secondContainer = doc.createElement('main');
    const cleanupSecond = notes.mountReadingNotes(secondContainer, article, '決策智慧 2026');
    const secondInput = findElement(secondContainer, 'textarea');
    const firstButton = findElement(secondContainer, 'button');
    assert.equal(secondInput.value, '已存在的 <img onerror="x"> 筆記');
    assert.equal(JSON.parse(storage.getItem(noteKey)).text, secondInput.value);
    assert.equal(JSON.parse(storage.getItem(noteKey)).updatedAt, originalUpdatedAt);

    secondInput.value = 'blur 立即寫入';
    secondInput.dispatch('input');
    secondInput.dispatch('blur');
    assert.equal(notes.readReadingNote(storage, '決策智慧 2026', article).text, 'blur 立即寫入');

    secondInput.value = 'visibility 立即寫入';
    secondInput.dispatch('input');
    doc.visibilityState = 'hidden';
    doc.listeners.get('visibilitychange')?.();
    assert.equal(notes.readReadingNote(storage, '決策智慧 2026', article).text, 'visibility 立即寫入');

    secondInput.value = 'pagehide 立即寫入';
    secondInput.dispatch('input');
    doc.defaultView.listeners.get('pagehide')?.();
    assert.equal(notes.readReadingNote(storage, '決策智慧 2026', article).text, 'pagehide 立即寫入');

    secondInput.value = 'cleanup 立即寫入';
    secondInput.dispatch('input');
    cleanupSecond();
    assert.equal(notes.readReadingNote(storage, '決策智慧 2026', article).text, 'cleanup 立即寫入');

    const thirdContainer = doc.createElement('main');
    const cleanupThird = notes.mountReadingNotes(thirdContainer, article, '決策智慧 2026');
    const thirdInput = findElement(thirdContainer, 'textarea');
    const buttons = [];
    const collectButtons = node => { if (node.tagName === 'BUTTON') buttons.push(node); for (const child of node.children) collectButtons(child); };
    collectButtons(thirdContainer);
    const explicitClearButton = buttons.find(button => button.textContent === '清除筆記');
    assert.ok(explicitClearButton);
    assert.equal(thirdInput.value, 'cleanup 立即寫入');
    explicitClearButton.dispatch('click');
    assert.equal(thirdInput.value, '');
    assert.equal(notes.readReadingNote(storage, '決策智慧 2026', article).text, '');
    cleanupThird();
    assert.equal(firstButton.textContent, '複製未儲存筆記');
  });
});

test('a transient storage read error does not create an empty draft that overwrites the saved note', () => {
  const storage = new MemoryStorage();
  const doc = new FakeDocument();
  const title = '暫時讀取錯誤的書';
  notes.writeReadingNote(storage, title, article, '既有筆記');
  storage.failRead = true;

  withLocalStorage(storage, () => {
    const firstContainer = doc.createElement('main');
    const cleanupFirst = notes.mountReadingNotes(firstContainer, article, title);
    assert.equal(findElement(firstContainer, 'textarea').value, '');
    cleanupFirst();

    storage.failRead = false;
    const secondContainer = doc.createElement('main');
    const cleanupSecond = notes.mountReadingNotes(secondContainer, article, title);
    assert.equal(findElement(secondContainer, 'textarea').value, '既有筆記');
    cleanupSecond();
    assert.equal(notes.readReadingNote(storage, title, article).text, '既有筆記');
  });
});

test('quota failure keeps input visible, exposes copy, and retains an in-memory draft across rerender', () => {
  const storage = new MemoryStorage();
  const doc = new FakeDocument();
  const firstContainer = doc.createElement('main');
  storage.failWrite = true;

  withLocalStorage(storage, () => {
    const cleanup = notes.mountReadingNotes(firstContainer, article, '暫存書名');
    const input = findElement(firstContainer, 'textarea');
    input.value = '這段草稿不能因配額錯誤而消失';
    input.dispatch('input');
    input.dispatch('blur');
    assert.equal(input.value, '這段草稿不能因配額錯誤而消失');
    const buttons = [];
    const collectButtons = node => { if (node.tagName === 'BUTTON') buttons.push(node); for (const child of node.children) collectButtons(child); };
    collectButtons(firstContainer);
    const copyButton = buttons.find(button => button.textContent === '複製未儲存筆記');
    assert.ok(copyButton && !copyButton.hidden);
    const spans = [];
    const collectSpans = node => { if (node.tagName === 'SPAN') spans.push(node); for (const child of node.children) collectSpans(child); };
    collectSpans(firstContainer);
    assert.ok(spans.some(node => node.textContent.includes('儲存失敗')));
    cleanup();

    storage.failWrite = false;
    const secondContainer = doc.createElement('main');
    const cleanupSecond = notes.mountReadingNotes(secondContainer, article, '暫存書名');
    assert.equal(findElement(secondContainer, 'textarea').value, '這段草稿不能因配額錯誤而消失');
    cleanupSecond();
  });
});

// Node-only regression tests for the dashboard inline script.
// Run:  node tests/run-tests.mjs
// No downloads, no browser: the script is executed in a vm sandbox with
// minimal DOM/localStorage shims and a controllable clock.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(rootDir, 'index.html');
const tmpDir = path.join(rootDir, 'tests', 'tmp');
const checkPath = path.join(tmpDir, 'app-inline.js');

// ---------------------------------------------------------------- extraction

const html = fs.readFileSync(htmlPath, 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (blocks.length !== 1) {
  console.error(`Expected exactly one inline <script> block, found ${blocks.length}.`);
  process.exit(1);
}
const appCode = blocks[0];
if (appCode.length < 10000) {
  console.error('Extracted script looks suspiciously small; extraction regex may be stale.');
  process.exit(1);
}

// ------------------------------------------------------------------- harness

const registrations = [];
function test(name, fn) { registrations.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
async function runAll() {
  const results = [];
  for (const [name, fn] of registrations) {
    try { await fn(); results.push([name, true, '']); }
    catch (err) { results.push([name, false, err?.message || String(err)]); }
  }
  return results;
}

// ---------------------------------------------------------------- DOM shims

function makeEl(tag = 'div') {
  const el = {
    tagName: tag, children: [], _listeners: {},
    className: '', innerHTML: '', textContent: '', title: '', id: '',
    hidden: false, checked: false, value: '', href: '', download: '',
    dataset: {}, style: {}, files: [],
    classList: {
      add() {}, remove() {}, toggle() {}, contains() { return false; },
    },
    append(...kids) { el.children.push(...kids); },
    appendChild(kid) { el.children.push(kid); return kid; },
    remove() {},
    click() { for (const fn of el._listeners.click || []) fn({ target: el }); },
    focus() {},
    showModal() { el._open = true; },
    close() { el._open = false; },
    addEventListener(type, fn) { (el._listeners[type] ||= []).push(fn); },
    fire(type, ev) { for (const fn of el._listeners[type] || []) fn(ev ?? { target: el }); },
    querySelector() { return makeEl('button'); },
    querySelectorAll() { return []; },
  };
  return el;
}

const viewBtns = ['today', 'calendar', 'weekly'].map(v => {
  const el = makeEl('button');
  el.dataset.view = v;
  return el;
});

const bySelector = new Map();
const documentShim = {
  body: makeEl('body'),
  hidden: false,
  querySelector(sel) {
    if (!bySelector.has(sel)) bySelector.set(sel, makeEl('div'));
    return bySelector.get(sel);
  },
  querySelectorAll() { return viewBtns; },
  createElement(tag) { return makeEl(tag); },
  addEventListener() {},
};

const localStorageShim = {
  _data: new Map(),
  getItem(k) { return this._data.has(k) ? this._data.get(k) : null; },
  setItem(k, v) { this._data.set(k, String(v)); },
  removeItem(k) { this._data.delete(k); },
  clear() { this._data.clear(); },
  key(i) { return [...this._data.keys()][i] ?? null; },
  get length() { return this._data.size; },
};

// ------------------------------------------------------------- controllable clock

const RealDate = Date;
let fixedNowMs = null;
class FakeDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(FakeDate.now());
    else super(...args);
  }
  static now() { return fixedNowMs ?? RealDate.now(); }
}

function setNow(y, monthIdx, d, h, min) {
  fixedNowMs = RealDate.UTC(y, monthIdx, d, h, min);
}
function clearNow() { fixedNowMs = null; }

// Blob/URL shims so exportBackup() can run end to end.
const exportedBlobs = [];
class FakeBlob {
  constructor(parts, opts) { this._text = parts.join(''); this.type = opts?.type || ''; }
}
const urlShim = {
  createObjectURL(blob) { exportedBlobs.push(blob); return `blob:fake-${exportedBlobs.length}`; },
  revokeObjectURL() {},
};

// Notification shim: controllable permission, recorded requests and instances.
// Mirrors Chrome: constructing without 'granted' throws.
const notifyLog = { requests: 0, instances: [], grantResult: undefined };
class FakeNotification {
  static permission = 'default';
  static requestPermission() {
    notifyLog.requests += 1;
    return Promise.resolve(notifyLog.grantResult ?? FakeNotification.permission);
  }
  constructor(title, options = {}) {
    if (FakeNotification.permission !== 'granted') {
      throw new TypeError('Notification permission not granted');
    }
    this.title = title;
    this.options = options;
    this.onclick = null;
    this.closed = false;
    notifyLog.instances.push(this);
  }
  close() { this.closed = true; }
}

// ----------------------------------------------------------------- sandbox run

fs.mkdirSync(tmpDir, { recursive: true });
const sandbox = {
  document: documentShim,
  window: {
    localStorage: localStorageShim,
    addEventListener() {},
    AudioContext: undefined,
    webkitAudioContext: undefined,
  },
  Date: FakeDate,
  setInterval: () => 0,
  setTimeout: () => 0,
  clearInterval() {},
  clearTimeout() {},
  console,
  Blob: FakeBlob,
  URL: urlShim,
  Notification: FakeNotification,
  location: { reload() {} },
  confirm: () => false,
};
vm.createContext(sandbox);

// The bridge must be appended inside the same script so it can reach the
// script-scoped `let state` binding that never lands on the global object.
const bridge = `
;globalThis.__app = {
  get state() { return state; },
  set state(v) { state = v; },
  save, checkScheduledReminders, shiftIntervalsAround, overlapsShift, insideShift,
  civilMinute, reminderKey, dayIxFromIso, isoDate, dateFromIso,
  get exactPlan() { return exactPlan; }, shiftsFor, inExactRange,
};`;
try {
  vm.runInContext(appCode + bridge, sandbox, { filename: 'index.html-inline' });
} catch (err) {
  console.error('Inline script threw during load:');
  console.error(err?.stack || err);
  process.exit(1);
}
const app = sandbox.__app;

// ------------------------------------------------------------------- helpers

// Tehran wall-clock helpers: the engine evaluates reminders in Tehran time.
function tehranMinute(y, monthIdx, d, h, min) {
  // +03:30 offset, no DST since 2022:
  return RealDate.UTC(y, monthIdx, d, h - 3, min - 30) / 60000;
}

// Lazily create shims for selectors the app only touches on demand:
const stackEl = () => documentShim.querySelector('#reminderStack');
const cardCount = () => stackEl().children.length;

function resetScenario() {
  for (const t of app.state.tasks) delete t.reminder;
  app.state.reminderSent = {};
  app.state.done = {};
  app.state.remindersEnabled = true;
  app.state.systemNotifications = false;
  FakeNotification.permission = 'default';
  notifyLog.requests = 0;
  notifyLog.instances.length = 0;
  notifyLog.grantResult = undefined;
  stackEl().children.length = 0;
}

function configureStudyReminder({ time, days, lead }) {
  const study = app.state.tasks.find(t => t.id === 'study');
  study.reminder = { enabled: true, time, days, leadMinutes: lead };
}

function intervalListHas(list, start, end) {
  return list.some(s => s.start === start && s.end === end);
}

// Week Saturday..Friday = 2026-11-14 .. 2026-11-20.
const SAT = '2026-11-14', SUN = '2026-11-15', MON = '2026-11-16';
const TUE = '2026-11-17', WED = '2026-11-18', THU = '2026-11-19', FRI = '2026-11-20';

// -------------------------------------------------------------------- tests

test('inline script passes node --check', () => {
  fs.writeFileSync(checkPath, appCode, 'utf8');
  const res = spawnSync(process.execPath, ['--check', checkPath], { encoding: 'utf8' });
  assert(res.status === 0, `node --check failed:\n${res.stderr}`);
});

test('initial state: 16 tasks across the four zones, reminders on', () => {
  assert(app.state.tasks.length === 16, `expected 16 tasks, got ${app.state.tasks.length}`);
  const zones = new Set(app.state.tasks.map(t => t.zone));
  for (const z of ['wake', 'morning', 'day', 'sleep']) {
    assert(zones.has(z), `zone missing: ${z}`);
  }
  assert(app.state.remindersEnabled === true, 'remindersEnabled should default to true');
  assert(localStorageShim.getItem('toloe-aram-v1') !== null, 'state was never saved to storage');
});

test('civilMinute is plain UTC minutes of the civil frame', () => {
  assert(app.civilMinute(FRI, 0, 0) === RealDate.UTC(2026, 10, 20) / 60000, 'civilMinute mismatch');
  assert(app.dayIxFromIso(TUE) === 3, 'Tuesday should map to index 3');
  assert(app.dayIxFromIso(FRI) === 6, 'Friday should map to index 6');
});

test('all seven shift rules exist with exact intervals', () => {
  const cases = [
    [SAT, 20 * 60, 26 * 60],  // Sina, crosses midnight
    [SUN, 20 * 60, 32 * 60],  // Parsian overnight to Monday 08:00
    [TUE, 14 * 60, 20 * 60],  // Pardis
    [WED, 20 * 60, 24 * 60],  // Di
    [THU, 8 * 60, 14 * 60],   // Sina day
    [FRI, 8 * 60, 14 * 60],   // Parsian day
    [FRI, 20 * 60, 32 * 60],  // Parsian overnight to Saturday 08:00
  ];
  for (const [iso, startOff, endOff] of cases) {
    const base = app.civilMinute(iso, 0, 0);
    const list = app.shiftIntervalsAround(iso);
    assert(intervalListHas(list, base + startOff, base + endOff),
      `shift ${iso} +${startOff}..${endOff} not found`);
  }
});

test('Saturday Sina and Sunday Parsian shifts cross midnight', () => {
  const satBase = app.civilMinute(SAT, 0, 0);
  assert(app.insideShift(satBase + 25 * 60) === true, 'Sunday 01:00 must be inside Sina shift');
  const sunBase = app.civilMinute(SUN, 0, 0);
  const monBase = app.civilMinute(MON, 0, 0);
  assert(app.insideShift(monBase + 7 * 60) === true, 'Monday 07:00 must be inside Parsian overnight');
  assert(app.insideShift(monBase + 8 * 60) === false, 'Monday 08:00 must be outside (end exclusive)');
});

test('shift boundaries are end-exclusive (Thursday Sina)', () => {
  const thuBase = app.civilMinute(THU, 0, 0);
  // Activity 14:00-15:00 starts exactly at shift end -> free:
  assert(app.overlapsShift(thuBase + 14 * 60, thuBase + 15 * 60) === false,
    'activity starting at shift end should be free');
  // Activity 07:00-08:00 ends exactly at shift start -> free:
  assert(app.overlapsShift(thuBase + 7 * 60, thuBase + 8 * 60) === false,
    'activity ending at shift start should be free');
  // Activity 07:00-08:30 overlaps by half an hour -> conflict:
  assert(app.overlapsShift(thuBase + 7 * 60, thuBase + 8 * 60 + 30) === true,
    'overlapping activity should conflict');
});

test('free interval: Monday daytime', () => {
  const monBase = app.civilMinute(MON, 0, 0);
  assert(app.overlapsShift(monBase + 10 * 60, monBase + 12 * 60) === false,
    'Monday 10:00-12:00 must be free');
  assert(app.insideShift(monBase + 10 * 60) === false, 'Monday 10:00 must not be inside a shift');
});

test('reminder fires in a free slot and is recorded', () => {
  resetScenario();
  configureStudyReminder({ time: '10:00', days: [3], lead: 10 });  // Tuesday
  setNow(2026, 10, 17, 6, 21);  // 09:51 Tehran = 06:21 UTC, one minute after fireAt
  app.checkScheduledReminders();
  assert(cardCount() === 1, `expected 1 reminder card, got ${cardCount()}`);
  const card = stackEl().children[0];
  assert(card.innerHTML.includes('درس‌خواندن'), 'card should name the study task');
  const key = app.reminderKey('study', TUE, '10:00', 10);
  assert(Boolean(app.state.reminderSent[key]), 'occurrence key should be recorded');
});

test('same occurrence is not duplicated', () => {
  app.checkScheduledReminders();
  assert(cardCount() === 1, `duplicate card appeared (count ${cardCount()})`);
});

test('reminder suppressed when the activity crosses a shift', () => {
  resetScenario();
  // Tuesday 13:30 + 60 min task crosses the 14:00 Pardis start:
  configureStudyReminder({ time: '13:30', days: [3], lead: 10 });
  setNow(2026, 10, 17, 9, 51);  // 13:21 Tehran
  app.checkScheduledReminders();
  assert(cardCount() === 0, 'shift-crossing reminder must be suppressed');
  const key = app.reminderKey('study', TUE, '13:30', 10);
  assert(!app.state.reminderSent[key], 'suppressed occurrence must not be recorded');
});

test('no reminder for a task already done today', () => {
  resetScenario();
  configureStudyReminder({ time: '10:00', days: [3], lead: 10 });
  app.state.done.study = true;
  setNow(2026, 10, 17, 6, 21);
  app.checkScheduledReminders();
  assert(cardCount() === 0, 'done task must not remind');
});

test('global pause blocks all reminders without touching settings', () => {
  resetScenario();
  configureStudyReminder({ time: '10:00', days: [3], lead: 10 });
  app.state.remindersEnabled = false;
  setNow(2026, 10, 17, 6, 21);
  app.checkScheduledReminders();
  assert(cardCount() === 0, 'paused engine must not fire');
  const study = app.state.tasks.find(t => t.id === 'study');
  assert(study.reminder.enabled === true, 'per-task settings must survive the pause');
});

test('system notification fires alongside the in-page card', () => {
  resetScenario();
  configureStudyReminder({ time: '10:00', days: [3], lead: 10 });
  app.state.systemNotifications = true;
  FakeNotification.permission = 'granted';
  setNow(2026, 10, 17, 6, 21);
  app.checkScheduledReminders();
  assert(cardCount() === 1, 'in-page card must still appear');
  assert(notifyLog.instances.length === 1, `expected 1 system notification, got ${notifyLog.instances.length}`);
  const notice = notifyLog.instances[0];
  const key = app.reminderKey('study', TUE, '10:00', 10);
  assert(notice.options?.tag === key, 'notification tag should be the occurrence key');
  assert(notice.options?.dir === 'rtl' && notice.options?.lang === 'fa', 'notification should be rtl fa');
  assert(typeof notice.onclick === 'function', 'notification should focus the window on click');
});

test('system notification off: card only, nothing OS-level', () => {
  resetScenario();
  configureStudyReminder({ time: '10:00', days: [3], lead: 10 });
  FakeNotification.permission = 'granted';  // browser would allow it, but the setting is off
  setNow(2026, 10, 17, 6, 21);
  app.checkScheduledReminders();
  assert(cardCount() === 1, 'card must still appear');
  assert(notifyLog.instances.length === 0, 'no system notification expected');
});

test('denied permission falls back to card only, no throw', () => {
  resetScenario();
  configureStudyReminder({ time: '10:00', days: [3], lead: 10 });
  app.state.systemNotifications = true;
  FakeNotification.permission = 'denied';
  setNow(2026, 10, 17, 6, 21);
  app.checkScheduledReminders();
  assert(cardCount() === 1, 'card must still appear');
  assert(notifyLog.instances.length === 0, 'no system notification expected');
});

test('missing Notification API degrades gracefully', () => {
  resetScenario();
  configureStudyReminder({ time: '10:00', days: [3], lead: 10 });
  app.state.systemNotifications = true;
  sandbox.Notification = undefined;  // browser without the API
  try {
    setNow(2026, 10, 17, 6, 21);
    app.checkScheduledReminders();
    assert(cardCount() === 1, 'card must still appear');
    assert(notifyLog.instances.length === 0, 'no system notification expected');
  } finally {
    sandbox.Notification = FakeNotification;
  }
});

test('header button asks for permission on click, then enables', async () => {
  resetScenario();
  FakeNotification.permission = 'default';
  notifyLog.grantResult = 'granted';  // user approves the browser prompt
  const btn = documentShim.querySelector('#systemNotify');
  assert(typeof btn.onclick === 'function', 'enable button should be wired at load');
  await btn.onclick();
  assert(notifyLog.requests === 1, `one permission request expected, got ${notifyLog.requests}`);
  assert(app.state.systemNotifications === true, 'setting should turn on after grant');
  assert(btn.textContent === 'اعلان سیستم: روشن', 'button label should reflect on state');
  // Toggling back off must not ask the browser again:
  notifyLog.requests = 0;
  await btn.onclick();
  assert(app.state.systemNotifications === false, 'setting should turn off');
  assert(notifyLog.requests === 0, 'turning off must not re-request permission');
});

test('header button respects an explicit browser denial', async () => {
  resetScenario();
  FakeNotification.permission = 'denied';
  const btn = documentShim.querySelector('#systemNotify');
  await btn.onclick();
  assert(notifyLog.requests === 0, 'denied permission must not trigger another request');
  assert(app.state.systemNotifications === false, 'setting must stay off');
});

test('backup JSON contains reminder fields (schemaVersion 4)', () => {
  resetScenario();
  configureStudyReminder({ time: '10:00', days: [3], lead: 10 });
  app.state.systemNotifications = true;
  exportedBlobs.length = 0;
  bySelector.get('#backup').fire('click');
  assert(exportedBlobs.length === 1, 'export should produce one blob');
  const payload = JSON.parse(exportedBlobs[0]._text);
  assert(payload.app === 'routine-residency', 'payload app tag mismatch');
  assert(payload.schemaVersion === 4, 'schemaVersion should be 4');
  const study = payload.state.tasks.find(t => t.id === 'study');
  assert(study.reminder && study.reminder.enabled === true && study.reminder.time === '10:00',
    'exported task should keep its reminder config');
  assert(payload.state.systemNotifications === true, 'notification preference should be exported');
});

test('restore keeps the system-notification preference', async () => {
  resetScenario();
  configureStudyReminder({ time: '10:00', days: [3], lead: 10 });
  app.state.systemNotifications = true;
  app.save();
  const payload = {
    app: 'routine-residency', schemaVersion: 4,
    exportedAt: '2026-11-20T00:00:00.000Z', state: JSON.parse(localStorageShim.getItem('toloe-aram-v1')),
  };
  const fakeFile = { text: async () => JSON.stringify(payload) };
  // importBackup runs through the real #backupFile change handler:
  documentShim.querySelector('#backupFile').fire('change', { target: { files: [fakeFile], value: '' } });
  for (let i = 0; i < 5; i++) await Promise.resolve();  // let the async import settle
  assert(app.state.systemNotifications === true, 'preference lost on restore');
  const study = app.state.tasks.find(t => t.id === 'study');
  assert(study?.reminder?.time === '10:00', 'reminder config lost on restore');
});

test('save() persists reminder settings through the storage adapter', () => {
  resetScenario();
  configureStudyReminder({ time: '10:00', days: [3], lead: 10 });
  app.save();
  const raw = localStorageShim.getItem('toloe-aram-v1');
  assert(raw !== null, 'nothing written to storage');
  const persisted = JSON.parse(raw);
  const study = persisted.tasks.find(t => t.id === 'study');
  assert(study.reminder?.time === '10:00' && study.reminder?.days?.length === 1,
    'reminder config lost in persistence');
});

// ---------------------------------------------------- Stage C: PWA packaging

test('manifest is valid JSON with all install-required fields', () => {
  const manifestPath = path.join(rootDir, 'manifest.webmanifest');
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(m.name === 'روتین و دستیاری', `display name mismatch: ${m.name}`);
  assert(typeof m.short_name === 'string' && m.short_name.length > 0, 'short_name missing');
  assert(m.dir === 'rtl' && m.lang === 'fa', 'manifest should be rtl fa');
  assert(m.display === 'standalone', 'display must be standalone');
  assert(typeof m.start_url === 'string' && m.start_url.includes('index.html'), 'start_url wrong');
  assert(typeof m.scope === 'string' && typeof m.theme_color === 'string', 'scope/theme_color missing');
  const sizes = m.icons.map(i => i.sizes);
  assert(sizes.includes('192x192'), '192px icon entry missing');
  assert(sizes.includes('512x512'), '512px icon entry missing');
});

test('manifest icons exist on disk as real PNGs with matching dimensions', () => {
  const m = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.webmanifest'), 'utf8'));
  for (const icon of m.icons) {
    const iconPath = path.join(rootDir, icon.src);
    assert(fs.existsSync(iconPath), `icon file missing: ${icon.src}`);
    const buf = fs.readFileSync(iconPath);
    assert(buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a', `${icon.src} is not a PNG`);
    const [w, h] = icon.sizes.split('x').map(Number);
    assert(buf.readUInt32BE(16) === w, `${icon.src} width ${buf.readUInt32BE(16)} != ${w}`);
    assert(buf.readUInt32BE(20) === h, `${icon.src} height ${buf.readUInt32BE(20)} != ${h}`);
  }
});

test('index.html links the manifest and registers the SW behind a protocol guard', () => {
  assert(html.includes('<link rel="manifest" href="manifest.webmanifest">'), 'manifest link missing');
  assert(html.includes("navigator.serviceWorker.register('sw.js')"), 'SW registration missing');
  assert(html.includes("location.protocol === 'https:'"), 'registration must be guarded to http(s)');
});

test('sw.js passes node --check', () => {
  const swPath = path.join(rootDir, 'sw.js');
  const res = spawnSync(process.execPath, ['--check', swPath], { encoding: 'utf8' });
  assert(res.status === 0, `node --check failed for sw.js:\n${res.stderr}`);
});

test('sw install precaches the shell; activate cleans old cache versions', async () => {
  const swCode = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
  const cacheName = (swCode.match(/const CACHE = '([^']+)';/) || [])[1];
  assert(cacheName === 'toloe-aram-pwa-v2', `cache should be bumped to v2, got ${cacheName}`);
  const added = [];
  const deleted = [];
  let claimed = false;
  const listeners = {};
  const cacheMock = {
    addAll: (urls) => { added.push(...urls); return Promise.resolve(); },
    put: async () => {},
    match: async () => undefined,
  };
  const swSandbox = {
    caches: {
      open: async () => cacheMock,
      keys: async () => [cacheName, cacheName + '-old1', cacheName + '-old2'],
      delete: async (key) => { deleted.push(key); return true; },
    },
    location: { origin: 'http://127.0.0.1:8765' },
    fetch: async () => { throw new Error('offline'); },
    URL,
    console,
  };
  swSandbox.self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: async () => { claimed = true; } },
  };
  vm.createContext(swSandbox);
  vm.runInContext(swCode, swSandbox, { filename: 'sw.js' });

  assert(typeof listeners.install === 'function', 'install handler missing');
  assert(typeof listeners.activate === 'function', 'activate handler missing');
  assert(typeof listeners.fetch === 'function', 'fetch handler missing');

  const waiters = [];
  const eventMock = { waitUntil: (p) => waiters.push(p) };
  listeners.install(eventMock);
  listeners.activate(eventMock);
  await Promise.all(waiters);
  await new Promise(resolve => setTimeout(resolve, 10));

  for (const url of ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png']) {
    assert(added.includes(url), `shell asset not precached: ${url}`);
  }
  assert(deleted.includes(cacheName + '-old1') && deleted.includes(cacheName + '-old2'),
    'old cache versions must be deleted');
  assert(!deleted.includes(cacheName), 'current cache must survive activate');
  assert(claimed === true, 'activate should claim clients');
});

// ------------------------------------------------ Exact Azar 1405 day plan

test('exactPlan covers exactly 2026-11-21 through 2026-12-25', () => {
  const keys = Object.keys(app.exactPlan).sort();
  assert(keys.length === 32, `expected 32 dated entries, got ${keys.length}`);
  assert(keys[0] === '2026-11-21' && keys[keys.length - 1] === '2026-12-24', 'boundary keys');
  for (const k of keys) assert(k >= '2026-11-21' && k <= '2026-12-25', 'date out of range: ' + k);
  // Three days are intentionally shift- and event-free, yet still inside the exact
  // range (so the weekly pattern must NOT apply to them):
  for (const free of ['2026-11-30', '2026-12-21', '2026-12-25']) {
    assert(!app.exactPlan[free], `${free} should have no entry`);
    assert(app.inExactRange(free), `${free} must still count as exact-range`);
    assert(app.shiftsFor(app.dateFromIso(free)).length === 0, `${free} must display no shifts`);
  }
});

test('Sina nights run to 02:00, including the new Monday night of Dey 23', () => {
  assert(app.exactPlan['2026-11-21'].sh.some(([s, e, n]) => s === 1200 && e === 1560 && n === 'سینا'),
    'Saturday night Sina 20:00-02:00');
  assert(app.exactPlan['2026-12-14'].sh.some(([s, e, n]) => s === 1200 && e === 1560 && n === 'سینا'),
    'one-off Monday night Sina');
  assert(app.exactPlan['2026-11-22'].sh.some(([s, e, n]) => s === 1200 && e === 1920 && n === 'پارسیان'),
    'Parsian nights run to 08:00 next day');
  assert(app.exactPlan['2026-12-02'].sh.some(([s, e, n]) => s === 1200 && e === 1440 && n === 'دی'),
    'Di nights end at midnight');
});

test('engine uses exact data where it differs from the weekly pattern', () => {
  // Monday 2026-12-14 (Dey 23): exact Sina night, pattern says Mondays are free:
  const monBase = app.civilMinute('2026-12-14', 0, 0);
  assert(app.insideShift(monBase + 21 * 60) === true, '21:00 on Mon Dec 14 is inside exact Sina night');
  const patMonBase = app.civilMinute('2027-01-11', 0, 0);
  assert(app.insideShift(patMonBase + 21 * 60) === false, 'pattern Mondays stay free');
  // Friday 2026-12-04 (Dey 13): Di morning instead of the pattern Parsian:
  const friBase = app.civilMinute('2026-12-04', 0, 0);
  assert(app.overlapsShift(friBase + 10 * 60, friBase + 12 * 60) === true, 'Di 08:00-14:00 that Friday');
  assert(!app.shiftIntervalsAround('2026-12-04').some(iv => iv.name === 'پارسیان' && iv.start === friBase + 8 * 60),
    'no Parsian morning on that Friday');
  assert(app.overlapsShift(friBase + 15 * 60, friBase + 16 * 60) === false, 'that Friday afternoon is free');
});

test('night shifts spill into the next morning (Sunday night -> Monday tail)', () => {
  const monBase = app.civilMinute('2026-11-23', 0, 0);  // Azar 2
  const list = app.shiftIntervalsAround('2026-11-23');
  assert(list.some(iv => iv.name === 'پارسیان' && iv.start < monBase && iv.end === monBase + 8 * 60),
    'Sunday-night Parsian must cover Monday 00:00-08:00');
});

test('calendar display reflects the exact plan', () => {
  const monRows = app.shiftsFor(app.dateFromIso('2026-12-14'));
  assert(monRows.some(r => r.name === 'شیفت سینا' && r.time.includes('۲۰:۰۰')), 'Sina night row on Dec 14');
  const azar2Rows = app.shiftsFor(app.dateFromIso('2026-11-23'));
  assert(azar2Rows.some(r => r.name === 'پایان شیفت پارسیان'), 'tail row on Azar 2');
  assert(app.shiftsFor(app.dateFromIso('2027-01-08')).length > 0, 'pattern Fridays keep their rows');
});

test('reverts to the weekly pattern after Dey 4', () => {
  const friBase = app.civilMinute('2027-01-08', 0, 0);
  assert(app.overlapsShift(friBase + 9 * 60, friBase + 11 * 60) === true, 'pattern Parsian 08:00-14:00');
});

test('reminder suppressed by the new Monday-night shift, fires in exact free slots', () => {
  resetScenario();
  configureStudyReminder({ time: '21:00', days: [2], lead: 10 });  // Mondays
  setNow(2026, 11, 14, 17, 21);  // Mon Dec 14, 20:51 Tehran
  app.checkScheduledReminders();
  assert(cardCount() === 0, 'exact Sina night must suppress (pattern alone would not)');
  assert(!app.state.reminderSent[app.reminderKey('study', '2026-12-14', '21:00', 10)],
    'suppressed occurrence must not be recorded');
  resetScenario();
  stackEl().children.length = 0;
  configureStudyReminder({ time: '10:00', days: [2], lead: 10 });
  setNow(2026, 11, 7, 6, 21);  // Mon Dec 7 (Azar 16, rest-only), 09:51 Tehran
  app.checkScheduledReminders();
  assert(cardCount() === 1, 'rest-only Monday must let the reminder fire');
});

test('rest and events never suppress; sessions and the installment exist in day data', () => {
  assert(app.exactPlan['2026-11-23'].rest?.[0]?.[0] === 480, 'Azar 2 rest block present');
  resetScenario();
  configureStudyReminder({ time: '09:00', days: [2], lead: 10 });
  setNow(2026, 10, 23, 5, 21);  // Mon Nov 23 (Azar 2), 08:51 Tehran
  app.checkScheduledReminders();
  assert(cardCount() === 1, 'rest is informational, not a shift');
  const wed = app.exactPlan['2026-12-16'];
  assert(wed.ev.some(([s, e, n]) => n === 'امادگی جلسه' && s === 600 && e === 720), 'prep block');
  assert(wed.ev.some(([s, e, n]) => n === 'جلسه' && s === 840 && e === 960), 'session block');
  const thu = app.exactPlan['2026-12-17'];
  assert(thu.ev.some(([s, e, n]) => n === 'پرداخت اقساط' && s === 960 && e === 1080), 'installment event');
});

// ------------------------------------------------------------------- report

clearNow();
const results = await runAll();
let failed = 0;
console.log(`TEST RUN  ${new RealDate().toISOString()}`);
console.log('-'.repeat(72));
for (const [name, ok, msg] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      ${msg}`}`);
  if (!ok) failed += 1;
}
console.log('-'.repeat(72));
console.log(`${results.length - failed} / ${results.length} passed`);
process.exit(failed ? 1 : 0);

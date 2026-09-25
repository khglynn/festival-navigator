// The crash journal (2026-08-31), and since v88 (2026-09-24) the app's one
// door for sending errors out.
//
// The journal: twenty entries in localStorage, written by the global error
// hooks and by belt-and-suspenders catches (the zoom's airbag). It exists
// because a stranded UI in Safari was invisible to every tool we had — the
// suite is green, the server sees nothing, and the only witness was a screen
// recording. Settings → App → Diagnostics reads it back and copies a dump.
//
// The door: every recorded error also becomes one PostHog `$exception`
// event, queued on the phone and sent when there is signal — after a sync
// succeeds, when the page goes hidden, and on the browser's `online`. Kevin
// used to hear about a phone-only bug by word of mouth, if at all.
//
// Rules with teeth, all enforced here rather than trusted to callers:
//   - Nothing leaves that this file did not write. No SDK, no autocapture,
//     no page URL, no referrer, no DOM text. The report is built field by
//     field from the list in buildReport().
//   - Every string that can leave the phone (the message, each frame's
//     function and path, and the journal too, which Diagnostics hands to a
//     person to paste) goes through scrubText(): never a crew token, the
//     person token, a URL's query or hash, or a quoted snippet of a document
//     (claude-plans/2026-09-24-analytics/BUILD.md, decision 4).
//   - Off means nothing leaves: the "Send crash reports" toggle and Stay
//     offline are read from storage HERE, at every decision, so they hold
//     even when the rest of the app never loaded.
//   - A missing key, a blocked store, a dead network or a broken sender
//     never throws into the app. A journal must never be the thing that
//     throws.
//
// Written for old Safari on purpose: index.html loads this file in a module
// script of its own, before app.js, so it can report the parse error that
// stops the app's own modules from ever running. No lookbehind, no `?.`, no
// `??` — syntax an older iPhone cannot parse would take this file down with
// the rest.
const KEY = 'fn_errlog_v1';
const CAP = 20;

// App settings ({lowPower, stayOffline, crashReports}). The key lives here,
// in the leaf, because the reporter must read Off and Stay offline before any
// other module has run; settings.js imports it from here.
export const SETTINGS_KEY = 'fn_settings_v1';
// Where reports go: a same-origin path that vercel.json rewrites to PostHog's
// US ingestion host. The service worker never sees it (it only handles GETs,
// and this path is passed through untouched even for those).
export const REPORT_PATH = '/fn-i/batch';
const QUEUE_KEY = 'fn_telemetry_q_v1';
const DEVICE_KEY = 'fn_report_device_v1';
// The PostHog PROJECT key (`phc_…`) — a write-only ingestion key, public by
// design. It lives in index.html's `fn-report-key` meta, beside
// fn-canonical-host: one value, one home, and a fork that leaves it empty
// sends nothing. Only the `phc_` shape is accepted, so a personal API key
// (`phx_…`, a real secret) pasted there by mistake is never used.
const KEY_META = 'fn-report-key';
const KEY_RE = /^phc_[A-Za-z0-9_-]{20,80}$/;

// Queue bounds (DESIGN §2e). Errors expire after a week; usage events
// (not sent yet — they drop in later) after three days. When the queue is
// full the oldest usage event goes first, and errors are only ever pushed out
// by other errors.
const MAX_ENTRIES = 300;
const MAX_BYTES = 96 * 1024;
const ERROR_TTL = 7 * 24 * 3600 * 1000;
const USAGE_TTL = 3 * 24 * 3600 * 1000;
// One request carries at most this much. A page going hidden shares the
// browser's 64 KB keepalive budget with the crew's own last-second beacon
// (sync.js flushOnHide), so the report beacon stays small and goes second.
const BATCH_MAX = 50;
const FETCH_BYTES = 60 * 1024;
const BEACON_BYTES = 16 * 1024;
// A looping error must not flood the queue: identical unsent reports fold
// into one (its `count` grows), and one page load queues any one error at
// most this many times.
const PER_SESSION = 5;
const SEND_TIMEOUT_MS = 15000;
const BUILD_WAIT_MS = 3000;

// ---- storage: every touch in a try, the getter included -------------------
// Chrome with site data blocked throws from the GETTER itself (project rule,
// 2026-08-27). The global `localStorage` first, because it is the one the
// rest of the app reads; `window.localStorage` is the same object in a
// browser.
function ls() {
  try { if (typeof localStorage !== 'undefined' && localStorage) return localStorage; } catch { /* blocked */ }
  try { return window.localStorage || null; } catch { return null; }
}
function lsGet(k) { try { const s = ls(); return s ? s.getItem(k) : null; } catch { return null; } }
function lsSet(k, v) { try { const s = ls(); if (!s) return false; s.setItem(k, v); return true; } catch { return false; } }
function lsRemove(k) { try { const s = ls(); if (s) s.removeItem(k); } catch { /* nothing stored anyway */ } }

// ---- the journal (local) ----------------------------------------------------
// The session's journal lives in MEMORY, seeded once from storage; storage is
// best-effort persistence on top — a browser where storage is refused still
// keeps this session's entries, which is exactly the session someone is
// debugging.
let mem = null;
function seed() {
  if (mem) return mem;
  try { mem = JSON.parse(lsGet(KEY) || '[]'); } catch { mem = []; }
  if (!Array.isArray(mem)) mem = [];
  return mem;
}

function journal(kind, d, known, at) {
  const list = seed();
  let stack = d.stack ? scrubText(d.stack, known).slice(0, 700) : null;
  if (!stack) {
    const f = eventFrame(at, known);
    if (f) stack = '@' + f.filename + ':' + (f.lineno || 0) + ':' + (f.colno || 0);
  }
  list.push({
    t: new Date().toISOString(),
    kind,
    msg: scrubText(d.value || 'unknown', known).slice(0, 300),
    stack: stack,
  });
  if (list.length > CAP) list.splice(0, list.length - CAP);
  lsSet(KEY, JSON.stringify(list));
}

export function recent() {
  try { return seed().slice(); } catch { return []; }
}

// ---- what the app tells the reporter ----------------------------------------
// app.js hands over two functions at load: `context` ({fest, pid, name}) and
// `secrets` (every crew token and the person token this device holds). They
// are read at the moment of each report, never cached. Before app.js runs —
// or when it never does — both are empty, and the token-shape rule in
// scrubText is what stands between a token and the wire.
const provider = { context: null, secrets: null };
export function configureReports(p) {
  if (p && typeof p.context === 'function') provider.context = p.context;
  if (p && typeof p.secrets === 'function') provider.secrets = p.secrets;
}

function knownSecrets() {
  let list = [];
  try { list = provider.secrets ? provider.secrets() : []; } catch { list = []; }
  if (!Array.isArray(list)) return [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (typeof s === 'string' && s.length >= 12 && out.indexOf(s) < 0) out.push(s);
  }
  return out.sort((a, b) => b.length - a.length); // longest first: a token inside a longer one goes whole
}

// ---- scrubbing ----------------------------------------------------------------
// In order (BUILD.md decision 4): the device's own secrets, exactly; every
// URL's query and hash; any leftover `?x=`/`#x=`/`&x=` parameter; email
// addresses; a JSON parse message's quoted snippet (V8 quotes a window of the
// bad input, and that input can be a crew doc holding notes); and any run of
// 20+ token characters — TOKEN_RE's shape (api/_lib/crew-shared.mjs,
// {20,40}), unbounded above so a token glued to a key name goes with it.
// PID-shaped runs (10–16) are left alone on purpose: the pid is public, it
// rides along by Kevin's decision, and PID_RE's range is disjoint from
// TOKEN_RE's precisely so the two can never be confused (decision 5).
const TOKEN_RUN = /[A-Za-z0-9_-]{20,}/g;
const URL_TAIL = /([a-z][a-z0-9+.-]*:\/\/[^\s?#'"<>()]*)[?#][^\s'"<>()]*/gi;
const PARAM = /[?#&][A-Za-z_][A-Za-z0-9_.-]*=[^\s&#'"<>()]*/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
export const MARK = { token: '‹token›', param: '‹param›', email: '‹email›', text: '‹text›' };

export function scrubText(input, known) {
  let s = typeof input === 'string' ? input : String(input);
  const list = known || knownSecrets();
  for (let i = 0; i < list.length; i++) s = s.split(list[i]).join(MARK.token);
  s = s.replace(URL_TAIL, '$1');
  s = s.replace(PARAM, MARK.param);
  s = s.replace(EMAIL, MARK.email);
  if (/JSON/i.test(s)) {
    // First quote to last, greedily; with no closing quote, everything after
    // the lone one.
    const paired = s.replace(/["“][\s\S]*["”]/, '"' + MARK.text + '"');
    s = paired !== s ? paired : s.replace(/["“][\s\S]*$/, '"' + MARK.text);
  }
  return s.replace(TOKEN_RUN, MARK.token);
}

// ---- stacks -------------------------------------------------------------------
// V8:     `    at fn (https://host/js/a.js:12:34)` or `    at https://host/js/a.js:12:34`
// WebKit and Gecko: `fn@https://host/js/a.js:12:34`, `@…`, `forEach@[native code]`
// Frames come back outermost first, the throw last (PostHog's order). Each
// keeps only the PATH of its URL; a line that parses as neither is dropped,
// never sent raw.
const V8_LINE = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/;
const AT_LINE = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/;
const AT_NATIVE = /^\s*(.*?)@\[native code\]\s*$/;
const MAX_FRAMES = 40;

function where(loc, known) {
  if (loc === '[native code]' || loc === '<anonymous>') return { filename: loc, inApp: false };
  try {
    const u = new URL(loc);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { filename: u.protocol, inApp: false };
    const path = scrubText(u.pathname, known);
    let here = '';
    try { here = window.location.host; } catch { here = ''; }
    return { filename: path, inApp: u.host === here && path.indexOf('/vendor/') !== 0 };
  } catch {
    return { filename: '<other>', inApp: false };
  }
}

function frame(fn, loc, line, col, known) {
  const w = where(loc, known);
  const f = {
    platform: 'custom',
    lang: 'javascript',
    function: (fn ? scrubText(fn, known) : '').slice(0, 120) || '?',
    filename: w.filename,
    in_app: w.inApp,
  };
  if (line) { f.lineno = line; f.colno = col; }
  return f;
}

export function parseStack(stack, known) {
  const frames = [];
  if (typeof stack !== 'string' || !stack) return frames;
  const lines = stack.split('\n');
  for (let i = 0; i < lines.length && frames.length < MAX_FRAMES; i++) {
    const line = lines[i];
    let m = V8_LINE.exec(line);
    if (!m && line.indexOf('@') >= 0) m = AT_LINE.exec(line);
    if (m) { frames.push(frame(m[1], m[2], Number(m[3]), Number(m[4]), known)); continue; }
    const n = AT_NATIVE.exec(line);
    if (n) frames.push(frame(n[1], '[native code]', 0, 0, known));
  }
  return frames.reverse();
}

// ---- the device, coarse on purpose -------------------------------------------
// Enough to know where to test; the user agent itself never leaves.
function device() {
  let ua = '';
  try { ua = String(window.navigator.userAgent || ''); } catch { ua = ''; }
  let touch = 0;
  try { touch = Number(window.navigator.maxTouchPoints) || 0; } catch { touch = 0; }
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1); // iPadOS asks for the desktop site
  let os = 'other';
  let major = null;
  let m = null;
  if (iOS) {
    os = 'ios';
    m = /OS (\d+)_/.exec(ua) || /Version\/(\d+)/.exec(ua);
  } else if (/Android/.test(ua)) {
    os = 'android';
    m = /Android (\d+)/.exec(ua);
  } else if (/Mac OS X/.test(ua)) os = 'mac';
  else if (/Windows/.test(ua)) os = 'windows';
  if (m) major = Number(m[1]);
  let engine = 'other';
  if (iOS) engine = 'webkit'; // every iOS browser is WebKit underneath
  else if (/Firefox\//.test(ua)) engine = 'gecko';
  else if (/Chrome\/|Chromium\/|Edg\//.test(ua)) engine = 'blink';
  else if (/AppleWebKit\//.test(ua)) engine = 'webkit';
  return { engine: engine, os: os, os_major: major };
}

const round50 = (n) => Math.round((Number(n) || 0) / 50) * 50;

function standalone() {
  try { if (window.matchMedia('(display-mode: standalone)').matches) return true; } catch { /* no media queries */ }
  try { return window.navigator.standalone === true; } catch { return false; }
}

// Which screen is showing (app.js show() flips display on these).
const SCREEN_NAMES = [
  ['screen-app', 'wall'], ['screen-settings', 'settings'], ['screen-landing', 'landing'],
  ['screen-join', 'join'], ['screen-create', 'create'], ['screen-badlink', 'badlink'], ['screen-error', 'error'],
];
function screenNow() {
  try {
    for (let i = 0; i < SCREEN_NAMES.length; i++) {
      const el = window.document.getElementById(SCREEN_NAMES[i][0]);
      if (el && el.style.display !== 'none') return SCREEN_NAMES[i][1];
    }
    return window.document.getElementById('screen-boot') ? 'loading' : 'none';
  } catch { return null; }
}

// The sync dot's own word (sync.js setSyncStatus writes it here).
const SYNC_STATES = ['online', 'syncing', 'offline', 'error', 'blocked'];
function syncNow() {
  try {
    const el = window.document.getElementById('sync-label');
    const s = el ? String(el.textContent || '').trim() : '';
    return SYNC_STATES.indexOf(s) >= 0 ? s : null;
  } catch { return null; }
}

// Which deployment the page is on, so Kevin's own testing can be filtered.
function hostKind() {
  let h = '';
  try { h = window.location.hostname; } catch { h = ''; }
  if (h === 'fest.kevinhg.com' || h === 'festival.kevinhg.com' || h === 'crew.kevinhg.com') return h.split('.')[0];
  if (/(^|\.)stage\.fest\.kevinhg\.com$/.test(h)) return 'stage';
  if (/\.vercel\.app$/.test(h)) return 'preview';
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return 'local';
  return 'other';
}

// ---- which build threw ----------------------------------------------------------
// The worker that controlled this page when it loaded served its modules, so
// its CACHE_VERSION and ASSET_STAMP are this page's build — even after a
// newer worker takes over (the "v75 shell judging v76 code" case, 2026-09-01).
// It answers a postMessage (service-worker.js). No controller: the cache
// names are the best guess, and `sw` says so.
let buildInfo = null;
let buildStarted = false;
let buildWaiters = [];
const awaitingBuild = [];

function settleBuild(version, stamp, sw) {
  if (buildInfo) return;
  const v = typeof version === 'string' ? /^festival-nav-(v\d+)$/.exec(version) : null;
  buildInfo = {
    build: v ? v[1] : null,
    stamp: typeof stamp === 'string' && /^[0-9a-f]{8}$/.test(stamp) ? stamp : null,
    sw: sw,
  };
  // Reports queued before the answer arrived were made by THIS page: give
  // them its build now, before anything sends them.
  if (awaitingBuild.length) {
    const ids = awaitingBuild.splice(0);
    withQueue((q) => {
      for (let i = 0; i < q.length; i++) {
        const p = q[i].e && q[i].e.properties;
        if (p && ids.indexOf(q[i].id) >= 0 && p.build == null) { p.build = buildInfo.build; p.stamp = buildInfo.stamp; p.sw = buildInfo.sw; }
      }
    });
  }
  const w = buildWaiters.splice(0);
  for (let i = 0; i < w.length; i++) { try { w[i](); } catch { /* a waiter */ } }
}

function buildFromCaches(sw) {
  try {
    window.caches.keys().then((keys) => {
      let hit = null;
      for (let i = 0; i < keys.length; i++) if (/^festival-nav-v\d+$/.test(keys[i])) { hit = keys[i]; break; }
      settleBuild(hit, null, sw);
    }, () => settleBuild(null, null, sw));
  } catch { settleBuild(null, null, sw); }
}

function askBuild() {
  if (buildStarted) return;
  buildStarted = true;
  try {
    const container = window.navigator.serviceWorker;
    const controller = container && container.controller;
    if (!controller) { buildFromCaches('none'); return; }
    container.addEventListener('message', (e) => {
      const d = e && e.data;
      if (d && typeof d.fnBuild === 'string') settleBuild(d.fnBuild, d.fnStamp, 'controlled');
    });
    try { if (typeof container.startMessages === 'function') container.startMessages(); } catch { /* auto-started */ }
    controller.postMessage({ fn: 'build?' });
    // An older worker (v87 and before) never answers.
    setTimeout(() => { if (!buildInfo) buildFromCaches('controlled'); }, BUILD_WAIT_MS);
  } catch { buildFromCaches(null); }
}

function buildReady() {
  askBuild();
  if (buildInfo) return Promise.resolve();
  return new Promise((resolve) => {
    buildWaiters.push(resolve);
    setTimeout(resolve, BUILD_WAIT_MS + 500);
  });
}

// ---- identity -----------------------------------------------------------------
function uuid() {
  let c = null;
  try { c = window.crypto || null; } catch { c = null; }
  try { if (c && typeof c.randomUUID === 'function') return c.randomUUID(); } catch { /* insecure context */ }
  const b = new Uint8Array(16);
  try { c.getRandomValues(b); } catch { for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [];
  for (let i = 0; i < 16; i++) h.push((b[i] + 0x100).toString(16).slice(1));
  return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' + h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' + h.slice(10).join('');
}

const SESSION = uuid(); // one page load
let deviceMemo = null;
function deviceId() {
  if (deviceMemo) return deviceMemo;
  const stored = lsGet(DEVICE_KEY);
  if (stored && /^[0-9a-f-]{36}$/.test(stored)) { deviceMemo = stored; return stored; }
  deviceMemo = uuid();
  lsSet(DEVICE_KEY, deviceMemo);
  return deviceMemo;
}

// ---- settings and the key -------------------------------------------------------
function settings() {
  try {
    const v = JSON.parse(lsGet(SETTINGS_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}

export function reportKey() {
  try {
    const m = window.document.querySelector('meta[name="' + KEY_META + '"]');
    const k = m ? String(m.getAttribute('content') || '').trim() : '';
    return KEY_RE.test(k) ? k : null;
  } catch { return null; }
}

// The toggle: on unless the person switched it off.
export function reportsOn() { return settings().crashReports !== false; }
// Reports are being collected: a key is set and the person hasn't said no.
export function reporting() { return !!reportKey() && reportsOn(); }

function online() {
  try { return window.navigator.onLine !== false; } catch { return true; }
}
function maySend() {
  if (!reporting()) return false;
  if (settings().stayOffline === true) return false;
  return online();
}

// ---- the queue --------------------------------------------------------------------
// Storage is the source of truth whenever it works (two tabs share one
// queue); memory holds it when storage is refused — and when the last write
// did not land (a full store reads fine and refuses every write, and reading
// back the older copy would quietly lose what memory holds).
let memQueue = [];
let memHolds = false;
function readQueue() {
  if (memHolds) return memQueue;
  const raw = lsGet(QUEUE_KEY);
  if (raw == null) return ls() ? [] : memQueue;
  try {
    const q = JSON.parse(raw);
    return Array.isArray(q) ? q.filter((x) => x && typeof x.id === 'string' && x.e && typeof x.t === 'string') : [];
  } catch { return []; }
}
function writeQueue(q) {
  memQueue = q;
  if (!q.length) { lsRemove(QUEUE_KEY); memHolds = false; return; }
  memHolds = !lsSet(QUEUE_KEY, JSON.stringify(q));
}
function withQueue(fn) {
  const q = readQueue();
  const out = fn(q);
  bound(q);
  writeQueue(q);
  return out;
}

function bound(q) {
  const now = Date.now();
  for (let i = q.length - 1; i >= 0; i--) {
    const age = now - Date.parse(q[i].t);
    if (!(age < (q[i].k === 'usage' ? USAGE_TTL : ERROR_TTL))) q.splice(i, 1);
  }
  const sizes = q.map((x) => JSON.stringify(x).length + 1);
  let total = sizes.reduce((a, b) => a + b, 2);
  while (q.length && (q.length > MAX_ENTRIES || total > MAX_BYTES)) {
    let idx = -1;
    for (let i = 0; i < q.length; i++) if (q[i].k !== 'error') { idx = i; break; }
    if (idx < 0) idx = 0;
    total -= sizes[idx];
    sizes.splice(idx, 1);
    q.splice(idx, 1);
  }
}

export function pendingReports() {
  try { const q = readQueue(); bound(q); return q.length; } catch { return 0; }
}

// Switching reports off throws away what was waiting: off means nothing
// leaves, including what was queued before the switch.
export function clearReports() {
  memQueue = [];
  memHolds = false;
  lsRemove(QUEUE_KEY);
}

const perSession = {};

// The one place anything is queued. Errors today; allowlisted usage events
// (`track(name, props)`, DESIGN §2b) arrive through here later with
// kind 'usage', the same base properties and the same bounds.
function enqueue(kind, event, properties, fingerprint) {
  const seen = perSession[fingerprint] || 0;
  withQueue((q) => {
    // Folds only into this page load's own unsent report: an earlier load's
    // may be another build's.
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i].fp === fingerprint && q[i].s === SESSION && !q[i].b) { q[i].n = (q[i].n || 1) + 1; q[i].last = new Date().toISOString(); return; }
    }
    if (seen >= PER_SESSION) return;
    perSession[fingerprint] = seen + 1;
    const id = uuid();
    if (properties.build == null) awaitingBuild.push(id);
    q.push({ id: id, k: kind, t: new Date().toISOString(), n: 1, fp: fingerprint, s: SESSION, e: { event: event, properties: properties } });
  });
}

// Every report carries these (DESIGN §2b/§2c). Future usage events share it.
function baseProps() {
  const b = buildInfo || { build: null, stamp: null, sw: null };
  const d = device();
  const motion = motionFacts();
  let vw = 0;
  let vh = 0;
  try { vw = window.innerWidth; vh = window.innerHeight; } catch { /* no window */ }
  const p = {
    distinct_id: deviceId(),
    $process_person_profile: false,
    $geoip_disable: true,
    $lib: 'festival-navigator',
    build: b.build,
    stamp: b.stamp,
    sw: b.sw,
    session: SESSION,
    host: hostKind(),
    screen: screenNow(),
    sync_state: syncNow(),
    online: online(),
    standalone: standalone(),
    engine: d.engine,
    os: d.os,
    os_major: d.os_major,
    viewport: round50(vw) + 'x' + round50(vh),
    reduced_motion: motion.reducedMotion,
    low_power: motion.lowPower,
    strip_route: motion.stripRoute,
    strip_animation: motion.stripAnimation,
    fest: null,
    pid: null,
    name: null,
  };
  let c = null;
  try { c = provider.context ? provider.context() : null; } catch { c = null; }
  if (c && typeof c === 'object') {
    // Each is checked for its shape before it rides: a festival id (or
    // 'custom'/'unlisted' for a crew's own), a pid (PID_RE — disjoint from
    // every token's length, so a token can never pass here), a short name.
    if (typeof c.fest === 'string' && /^[a-z0-9-]{1,64}$/.test(c.fest)) p.fest = c.fest;
    if (typeof c.pid === 'string' && /^[A-Za-z0-9_-]{10,16}$/.test(c.pid)) p.pid = c.pid;
    if (typeof c.name === 'string' && c.name.length && c.name.length <= 40) p.name = c.name;
  }
  return p;
}

// ---- turning a thrown value into a report ------------------------------------------
function describe(kind, err) {
  if (err && typeof err === 'object') {
    const hasMessage = err.message !== undefined && err.message !== null;
    let text = '';
    try { text = hasMessage ? String(err.message) : String(err); } catch { text = 'unknown'; }
    let type = '';
    try { type = typeof err.name === 'string' ? err.name : ''; } catch { type = ''; }
    let stack = null;
    try { stack = typeof err.stack === 'string' ? err.stack : null; } catch { stack = null; }
    return { type: type || 'Error', value: text || 'unknown', stack: stack };
  }
  let text = 'unknown';
  try { text = err === undefined || err === null || err === '' ? 'unknown' : String(err); } catch { text = 'unknown'; }
  // A bare string names its own kind (`zoom-close-after-click: dismissed
  // (Escape)`); an error event without an Error object reads as an Error.
  return { type: kind === 'error' || kind === 'promise' ? 'Error' : kind, value: text, stack: null };
}

// Browser notices that are not the app's errors, and would only page Kevin.
function isNoise(d) {
  if (/^ResizeObserver loop/.test(d.value)) return true;
  return d.value === 'Script error.' && !d.stack; // a cross-origin script's, with nothing in it
}

const UNHANDLED = ['error', 'promise', 'module-load'];
const LEVEL = { boot: 'fatal', 'module-load': 'fatal', 'zoom-close-after-click': 'warning' };

// The error event's own file, line and column, when the error brought no
// stack worth parsing — a module that failed to PARSE (the old-Safari case)
// arrives exactly like that, and the file is the whole story.
function eventFrame(at, known) {
  if (!at || typeof at.filename !== 'string' || !at.filename) return null;
  const line = Number(at.lineno) || 0;
  return frame('?', at.filename, line, Number(at.colno) || 0, known);
}

function buildReport(kind, d, known, at) {
  const value = scrubText(d.value, known).slice(0, 300);
  const type = scrubText(d.type, known).slice(0, 60) || 'Error';
  let frames = parseStack(d.stack, known);
  let synthetic = !d.stack;
  if (!frames.length) {
    const f = eventFrame(at, known);
    if (f) { frames = [f]; synthetic = true; }
  }
  const exception = {
    type: type,
    value: value,
    mechanism: { handled: UNHANDLED.indexOf(kind) < 0, synthetic: synthetic, type: 'generic' },
  };
  if (frames.length) exception.stacktrace = { type: 'raw', frames: frames };
  const props = baseProps();
  props.$exception_list = [exception];
  props.$exception_level = LEVEL[kind] || 'error';
  props.kind = scrubText(String(kind), known).slice(0, 60);
  // With no stack there is nothing for PostHog to group on but the words, so
  // each cause is its own issue (DESIGN §2c.8).
  if (!frames.length) props.$exception_fingerprint = (props.kind + ':' + type + ':' + value).slice(0, 400);
  let top = '';
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].in_app) { top = frames[i].filename + ':' + frames[i].lineno + ':' + frames[i].colno; break; }
  }
  return { props: props, fingerprint: props.kind + '|' + type + '|' + value + '|' + top };
}

// `at` (optional): the error event's {filename, lineno, colno}.
export function record(kind, err, at) {
  try {
    const d = describe(kind, err);
    if (isNoise(d)) return;
    const known = knownSecrets();
    try { journal(kind, d, known, at); } catch { /* the journal is best-effort */ }
    if (!reporting()) return;
    askBuild();
    const r = buildReport(kind, d, known, at);
    enqueue('error', '$exception', r.props, r.fingerprint);
  } catch { /* a journal must never be the thing that throws */ }
}

// ---- sending ------------------------------------------------------------------------
function pick(q, budget, skipBeaconed) {
  const chosen = [];
  let bytes = 80;
  for (let i = 0; i < q.length && chosen.length < BATCH_MAX; i++) {
    if (skipBeaconed && q[i].b) continue;
    const ev = toEvent(q[i]);
    const size = JSON.stringify(ev).length + 1;
    if (bytes + size > budget) {
      if (!chosen.length && size + 80 > budget && !skipBeaconed) chosen.push({ id: q[i].id, ev: null }); // too big to ever go: let it drop
      break;
    }
    bytes += size;
    chosen.push({ id: q[i].id, ev: ev });
  }
  return chosen;
}

function toEvent(x) {
  const properties = {};
  const src = x.e.properties || {};
  for (const k in src) if (Object.prototype.hasOwnProperty.call(src, k)) properties[k] = src[k];
  properties.count = x.n || 1;
  return { uuid: x.id, event: x.e.event, timestamp: x.t, properties: properties };
}

function body(key, events) {
  return JSON.stringify({ api_key: key, sent_at: new Date().toISOString(), batch: events });
}

function drop(ids) {
  if (!ids.length) return;
  withQueue((q) => {
    for (let i = q.length - 1; i >= 0; i--) if (ids.indexOf(q[i].id) >= 0) q.splice(i, 1);
  });
}

let inFlight = false;

// Send what is waiting over fetch. Resolves true when a batch was accepted;
// never rejects — an unhandled rejection from here would be recorded as an
// error, and that is a loop.
export async function flushReports() {
  if (inFlight) return false;
  inFlight = true;
  try {
    if (!maySend()) return false;
    await buildReady();
    if (!maySend()) return false;
    const key = reportKey();
    const chosen = pick(readQueue(), FETCH_BYTES, false);
    const poisoned = chosen.filter((c) => !c.ev).map((c) => c.id);
    const events = chosen.filter((c) => c.ev).map((c) => c.ev);
    if (poisoned.length) drop(poisoned);
    if (!events.length) return false;
    let ctl = null;
    try { ctl = typeof AbortController === 'function' ? new AbortController() : null; } catch { ctl = null; }
    const timer = ctl ? setTimeout(() => { try { ctl.abort(); } catch { /* done */ } }, SEND_TIMEOUT_MS) : null;
    let res = null;
    try {
      res = await window.fetch(REPORT_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body(key, events),
        credentials: 'omit',
        cache: 'no-store',
        signal: ctl ? ctl.signal : undefined,
      });
    } catch { res = null; } finally { if (timer) clearTimeout(timer); }
    if (!res) return false;
    // Delivered — or refused for good (a malformed batch is refused the same
    // way every time, and retrying it would stall everything behind it).
    if (res.ok || res.status === 400 || res.status === 413) drop(events.map((ev) => ev.uuid));
    return !!res.ok;
  } catch {
    return false;
  } finally {
    inFlight = false;
  }
}

// The page is going away: hand what is waiting to the browser, which finishes
// a beacon even after the page is gone. A beacon's answer can't be read, so
// its reports stay queued, marked, and the next fetch sends them again with
// the SAME uuid and timestamp — PostHog's documented way to make a resend
// count once. A lost report is worse than a double-counted one.
export function beaconReports() {
  try {
    if (!maySend() || settings().lowPower === true) return false;
    const nav = window.navigator;
    if (!nav || typeof nav.sendBeacon !== 'function') return false;
    const key = reportKey();
    const chosen = pick(readQueue(), BEACON_BYTES, true).filter((c) => c.ev);
    if (!chosen.length) return false;
    // text/plain: a CORS-safelisted type in every browser; PostHog reads the
    // JSON regardless.
    const blob = new window.Blob([body(key, chosen.map((c) => c.ev))], { type: 'text/plain;charset=UTF-8' });
    let ok = false;
    // Called ON navigator: a bare or re-homed sendBeacon throws Illegal
    // invocation in every browser (CLAUDE.md, WebIDL receivers).
    try { ok = nav.sendBeacon(REPORT_PATH, blob) === true; } catch { ok = false; }
    if (ok) {
      const ids = chosen.map((c) => c.id);
      withQueue((q) => { for (let i = 0; i < q.length; i++) if (ids.indexOf(q[i].id) >= 0) q[i].b = 1; });
    }
    return ok;
  } catch { return false; }
}

// ---- the hooks ----------------------------------------------------------------------
let hooked = false;
function flushSoon() { flushReports().then(() => {}, () => {}); }

export function hookGlobalErrors() {
  if (hooked) return;
  hooked = true;
  try {
    window.addEventListener('error', (e) => record('error', e.error || e.message, e));
    window.addEventListener('unhandledrejection', (e) => record('promise', e.reason));
    // A module script that fails to LOAD (a file missing from the worker's
    // shell, a 404 on a bad deploy) fires on its <script>, not on window, and
    // leaves a blank page — so it is caught on the way down.
    window.addEventListener('error', (e) => {
      const t = e && e.target;
      if (!t || t === window || t.tagName !== 'SCRIPT' || t.type !== 'module') return;
      let path = '?';
      try { path = new URL(t.src).pathname; } catch { path = '?'; }
      record('module-load', 'the app\'s code did not load: ' + path);
    }, true);
    // Send after a sync succeeds (the network works and the radio is awake),
    // and when the browser says it is back online — never on a timer.
    window.addEventListener('fn:synced', flushSoon);
    window.addEventListener('online', () => { if (settings().lowPower !== true) flushSoon(); });
    // The hide beacon is wired at `load`, after app.js has wired its own:
    // listeners run in the order they were added, so the crew's beacon
    // (sync.js flushOnHide) always claims the keepalive budget first.
    const wireHide = () => {
      window.document.addEventListener('visibilitychange', () => { if (window.document.visibilityState === 'hidden') beaconReports(); });
      window.addEventListener('pagehide', () => { beaconReports(); });
    };
    if (window.document.readyState === 'complete') wireHide();
    else window.addEventListener('load', wireHide, { once: true });
    if (reporting()) askBuild();
  } catch { /* a journal must never be the thing that throws */ }
}

// The motion facts behind a "the stage names stutter" report (2026-09-23), so
// the next one answers itself in one paste: whether the phone asks for
// reduced motion, whether the app's Low power is on, and which way the stage
// strip on the current wall follows its columns — 'timeline' (the compositor
// moves it with the grid), 'transform' (a scroll handler, a frame behind on a
// phone) or 'none' (no grid on the wall right now). The route is the one the
// wall TOOK (wall.js followStrip writes it on the strip); `stripAnimation` is
// the engine's own word for the follow's animation, so a rule that froze it
// would show here as 'none'. Unknown is null, never a guess.
function motionFacts() {
  const facts = { reducedMotion: null, lowPower: null, stripRoute: 'none', stripAnimation: null };
  try { facts.reducedMotion = !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* no media queries */ }
  try { facts.lowPower = window.document.body.classList.contains('low-power'); } catch { /* no body yet */ }
  try {
    const strip = window.document.querySelector('#wall-root .stage-strip[data-follow]');
    if (strip) {
      facts.stripRoute = strip.dataset.follow;
      const row = strip.querySelector('.times-grid');
      facts.stripAnimation = (row && window.getComputedStyle(row).animationName) || null;
    }
  } catch { /* a journal must never be the thing that throws */ }
  return facts;
}

// The shareable dump: enough to see what a phone saw, nothing private. Since
// v88 it also says whether reports are on and how many are still waiting, so
// a friend's paste answers "did Kevin already get this?".
export async function diagnostics() {
  let build = 'unknown';
  try {
    const keys = await window.caches.keys();
    build = keys.find((k) => k.startsWith('festival-nav-v')) || 'no-cache';
  } catch { /* no SW, private mode */ }
  let ua = '';
  try { ua = window.navigator.userAgent; } catch { ua = ''; }
  return Object.assign({
    build: build,
    ua: ua,
    viewport: window.innerWidth + 'x' + window.innerHeight,
    online: online(),
  }, motionFacts(), {
    reports: reportKey() ? (reportsOn() ? 'on' : 'off') : 'not set up',
    reportsWaiting: pendingReports(),
    at: new Date().toISOString(),
    errors: recent(),
  });
}

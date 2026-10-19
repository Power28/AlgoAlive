// AlgoAlive 的 Service Worker：離線也能使用、重複造訪不必重新下載。
// - 網站檔案（含編輯器、教學、各語言 Worker）：安裝時全部存起來；檔名帶雜湊，之後直接從快取拿
// - 首頁 index.html：先上網抓（有新版本就用新的），離線時才用快取
// - Pyodide（jsdelivr，網址帶版本號、內容不會變）：第一次下載時存起來，之後直接從快取拿
// build 時由 vite.config.ts 填入 BUILD_ID 與 PRECACHE（開發模式不會註冊）
const BUILD_ID = '__BUILD_ID__';
const PRECACHE = /* __PRECACHE__ */ [];

const APP_CACHE = `algoalive-app-${BUILD_ID}`;
const CDN_CACHE = 'algoalive-cdn-v1';
const CDN_PREFIX = 'https://cdn.jsdelivr.net/pyodide/';
// Python 執行環境的檔案：第一次造訪時 Service Worker 還沒接管，啟用後主動存起來（大多直接來自瀏覽器的 HTTP 快取）
const PYODIDE_URL = `${CDN_PREFIX}v__PYODIDE_VERSION__/full/`;
const PYODIDE_FILES = ['pyodide.mjs', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  // 刪掉舊版本的網站快取（Pyodide 的快取依版本號區分網址，不用刪）
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('algoalive-app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
  // 不擋住啟用：失敗（例如剛好離線）就等下次頁面載入時經過 fetch 再存
  warmPyodide().catch(() => {});
});

// 頁面按下「更新」時才換成新版本（避免舊頁面載入到新版本的檔案）
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.href.startsWith(CDN_PREFIX)) {
    event.respondWith(cacheFirst(request, CDN_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request, APP_CACHE));
});

async function warmPyodide() {
  const cache = await caches.open(CDN_CACHE);
  for (const file of PYODIDE_FILES) {
    const url = PYODIDE_URL + file;
    if (!(await cache.match(url))) await cache.add(url);
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request, { ignoreSearch: name === APP_CACHE });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('./', response.clone());
    return response;
  } catch (err) {
    const hit = (await cache.match('./')) ?? (await cache.match('./index.html'));
    if (hit) return hit;
    throw err;
  }
}

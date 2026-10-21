// e2e：離線：全新的瀏覽器環境造訪一次後，斷網仍能打開並執行 Python
//
//   node scripts/e2e/offline.mjs                          # 自己啟動 vite preview（先 npm run build）
//   node scripts/e2e/offline.mjs --url http://localhost:5173/
import { record, openApp, runActiveTab, runSuite } from './harness.mjs';

async function testOffline(browser, url) {
  console.log('Offline');
  // 全新的瀏覽器環境（沒有快取）：只造訪一次，Service Worker 就會把網站與 Pyodide 存起來
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.evaluateOnNewDocument(() => localStorage.setItem('algoalive.tour.v1', 'done'));
  await openApp(page, url);
  const cached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    const files = async () => (await (await caches.open('algoalive-cdn-v1')).keys()).map((r) => r.url.split('/').pop());
    for (let i = 0; i < 300 && (await files()).length < 5; i++) await new Promise((r) => setTimeout(r, 200));
    const app = (await caches.keys()).find((n) => n.startsWith('algoalive-app-'));
    return {
      controlled: !!navigator.serviceWorker.controller,
      pyodide: await files(),
      app: app ? (await (await caches.open(app)).keys()).length : 0,
    };
  });
  record(
    'one visit caches the site and Pyodide',
    cached.controlled && cached.app > 10 && cached.pyodide.some((f) => f.endsWith('.wasm')) && cached.pyodide.some((f) => f.includes('stdlib'))
      ? null
      : `got ${JSON.stringify(cached)}`,
  );

  // 完全離線（頁面與 Worker 都斷網）重新載入：網站從快取打開，Python 也能執行
  const conditions = { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
  const onWorker = (w) => w.client.send('Network.emulateNetworkConditions', conditions).catch(() => {});
  await page.setOfflineMode(true);
  page.on('workercreated', onWorker);
  let result;
  try {
    await openApp(page, url);
    result = await runActiveTab(page);
  } catch (err) {
    result = { error: String(err).slice(0, 200) };
  }
  record('the app opens and runs Python offline', result?.returned ? null : `got ${JSON.stringify(result)}`);
  await ctx.close();
}

await runSuite(async ({ browser, url }) => {
  await testOffline(browser, url);
});

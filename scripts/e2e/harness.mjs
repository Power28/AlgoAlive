// e2e 測試的共用工具：啟動 preview、開啟網站、執行頁籤、從教學庫開範例、記錄結果。
// 每一組測試（scripts/e2e/<組>.mjs）各自是一個程式，用 runSuite 包起來：
// 啟動瀏覽器、開一個全新的頁面（沒有快取與 localStorage）、跑完印出結果並以結束碼表示成敗。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from '../browser.mjs';
import { loadJsExamples } from '../js_examples.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PREVIEW_PORT = 4179;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 命令列參數 --name value */
export function arg(name) {
  const args = process.argv.slice(2);
  return args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
}

// ─────────────── 讀取教學範例的 expected ───────────────

const EXAMPLE_RE = /id: '((?:lc|js)\d+)'.*?call: '((?:[^'\\]|\\.)*)',\s*expected: '((?:[^'\\]|\\.)*)',/gs;
const unescape = (s) => s.replace(/\\(.)/g, '$1');

export function loadExpected() {
  const dir = path.join(ROOT, 'src', 'tutorials');
  const expected = new Map();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of src.matchAll(EXAMPLE_RE)) expected.set(m[1], unescape(m[3]));
  }
  // Python 範例的 JavaScript 版本（key 為 lc206@js）
  for (const ex of loadJsExamples()) if (ex.key.endsWith('@js')) expected.set(ex.key, ex.expected);
  return expected;
}

// ─────────────── 伺服器 ───────────────

async function waitForServer(url, timeoutMs = 30_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // 還沒起來
    }
    await sleep(300);
  }
  throw new Error(`server did not start: ${url}`);
}

/** 以 vite preview 啟動 dist/（沒有傳 --url 時） */
export async function startPreview(port = PREVIEW_PORT) {
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    throw new Error('dist/ not found — run `npm run build` first, or pass --url');
  }
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const url = `http://localhost:${port}/`;
  await waitForServer(url);
  return { url, stop: () => child.kill() };
}

// ─────────────── 測試工具 ───────────────

export const results = [];
export function record(name, problem) {
  results.push({ name, problem });
  console.log(`  ${problem ? '✗' : '✓'} ${name}${problem ? `  — ${problem}` : ''}`);
}

export async function openApp(page, url) {
  const target = new URL(url);
  target.searchParams.set('lang', 'en');
  await page.goto(target.href, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-runtime="ready"]', { timeout: 120_000 });
}

/**
 * 按「視覺化」：先等按鈕可以按。執行環境還在載入（例如剛切到 JavaScript、第一次建立它的 Worker）時按鈕是停用的，
 * 這時按下去什麼都不會發生，後面就會白等到逾時
 */
export async function clickVisualize(page) {
  await page.waitForSelector('[data-action="visualize"]:not([disabled])', { timeout: 120_000 });
  await page.click('[data-action="visualize"]');
}

/** 執行目前頁籤並跳到最後一步，回傳畫面上的回傳值與錯誤 */
export async function runActiveTab(page) {
  await clickVisualize(page);
  await page.waitForFunction(
    () => /Step \d+ \/ [1-9]\d*/.test(document.body.innerText) || document.querySelector('main [data-error]'),
    { timeout: 30_000 },
  );
  await page.click('[data-action="last"]');
  await sleep(300);
  return page.evaluate(() => {
    const panel = document.querySelectorAll('main > section')[1];
    return {
      returned: panel.querySelector('[data-return]')?.textContent ?? null,
      error: panel.querySelector('[data-error]')?.textContent ?? null,
    };
  });
}

export const tabTitles = (page) => page.$$eval('[role="tab"]', (els) => els.map((e) => e.innerText.trim()));

/** 從教學庫開啟範例並執行，往前走到 selector 的內容包含 needle 為止 */
export async function openAndStepTo(page, topic, example, selector, needle, { keepOpen = false } = {}) {
  await page.click('[data-action="library"]');
  await page.waitForSelector(`[data-topic="${topic}"]`);
  await page.click(`[data-topic="${topic}"]`);
  await page.waitForSelector(`[data-example="${example}"]`);
  await page.click(`[data-example="${example}"]`);
  await sleep(250);
  await clickVisualize(page);
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  const text = () => page.evaluate((s) => document.querySelector(`main ${s}`)?.innerText ?? '', selector);
  // 標題有 CSS uppercase，innerText 會變成大寫，比對時不分大小寫
  const hit = async () => (await text()).toLowerCase().includes(needle.toLowerCase());
  for (let i = 0; i < 80 && !(await hit()); i++) await page.click('[data-action="next"]');
  const result = await text();
  if (!keepOpen) await page.click('[role="tab"][aria-selected="true"] button');
  return result;
}

// ─────────────── 執行一組測試 ───────────────

/**
 * 執行一組測試：fn 拿到 { browser, page, url }。
 * - 頁面已經開好網站並等到執行環境就緒；不跟著作業系統的「減少動態效果」設定（示範動畫要自動播放）
 * - firstVisit：當成第一次造訪（會出現首次使用導覽）；其他組直接略過導覽
 * - 最後檢查整組過程中瀏覽器主控台沒有錯誤
 */
export async function runSuite(fn, { firstVisit = false } = {}) {
  // 記住目前在跑哪一段（各測試開頭印出的標題），出錯時標出來
  let section = 'setup';
  const log = console.log;
  console.log = (...parts) => {
    const line = parts.join(' ');
    if (line.trim() && !line.startsWith(' ')) section = line.trim();
    log(...parts);
  };
  const server = arg('--url') ? { url: arg('--url'), stop: () => {} } : await startPreview(Number(arg('--port') ?? PREVIEW_PORT));
  const browser = await launchBrowser({ defaultViewport: { width: 1440, height: 860 } });
  const consoleErrors = [];
  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    if (!firstVisit) await page.evaluateOnNewDocument(() => localStorage.setItem('algoalive.tour.v1', 'done'));
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(String(e)));
    await openApp(page, server.url);
    await fn({ browser, page, url: server.url });
    console.log('Console');
    record('no console errors', consoleErrors.length ? consoleErrors.slice(0, 5).join(' | ') : null);
  } catch (err) {
    // 標出出錯時正在跑哪一段、測試檔的哪一行（puppeteer 的錯誤堆疊大多是它自己的檔案）
    const where = String(err?.stack ?? '')
      .split('\n')
      .filter((l) => /scripts[\\/]e2e[\\/]/.test(l))
      .map((l) => l.trim().replace(/^at /, '').replace(/^.*[\\/](scripts[\\/]e2e[\\/])/, '$1'))
      .join(' ← ');
    record(`test run (during ${section})`, `${String(err?.message ?? err).split('\n')[0]}${where ? ` at ${where}` : ''}`);
  }
  const failures = results.filter((r) => r.problem).length;
  console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${results.length - failures}/${results.length} checks`);
  // 幾個 Chrome 同時關閉時，browser.close() 偶爾會卡住好幾分鐘：最多等 5 秒，之後直接結束 Chrome 的程序
  const closed = await Promise.race([browser.close().then(() => true, () => false), sleep(5000).then(() => false)]);
  if (!closed) browser.process()?.kill('SIGKILL');
  server.stop();
  process.exit(failures ? 1 : 0);
}

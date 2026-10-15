// 端對端測試：用 headless Chrome 實際操作網站
//
//   npm run test:e2e                                   # 先 npm run build；自動以 vite preview 啟動 dist/
//   npm run test:e2e -- --url http://localhost:5173/   # 測本機 dev server
//   npm run test:e2e -- --url https://power28.github.io/AlgoAlive/
//
// 檢查：
// - 每個教學範例都能從教學庫開啟、執行到最後一步，畫面上的回傳值等於 src/tutorials 的 expected
// - 頁籤：預設頁籤、新增空白頁籤並執行、重新命名、重新整理後仍保留、關閉
// - 語言切換
// - 整個過程瀏覽器主控台沒有錯誤
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchOptions } from './browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW_PORT = 4179;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const urlArg = args.includes('--url') ? args[args.indexOf('--url') + 1] : undefined;

// ─────────────── 讀取教學範例的 expected ───────────────

const EXAMPLE_RE = /id: '(lc\d+)'.*?call: '((?:[^'\\]|\\.)*)',\s*expected: '((?:[^'\\]|\\.)*)',/gs;
const unescape = (s) => s.replace(/\\(.)/g, '$1');

function loadExpected() {
  const dir = path.join(ROOT, 'src', 'tutorials');
  const expected = new Map();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of src.matchAll(EXAMPLE_RE)) expected.set(m[1], unescape(m[3]));
  }
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

async function startPreview() {
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    throw new Error('dist/ not found — run `npm run build` first, or pass --url');
  }
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [vite, 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const url = `http://localhost:${PREVIEW_PORT}/`;
  await waitForServer(url);
  return { url, stop: () => child.kill() };
}

// ─────────────── 測試工具 ───────────────

const results = [];
function record(name, problem) {
  results.push({ name, problem });
  console.log(`  ${problem ? '✗' : '✓'} ${name}${problem ? `  — ${problem}` : ''}`);
}

async function openApp(page, url) {
  const target = new URL(url);
  target.searchParams.set('lang', 'en');
  await page.goto(target.href, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-runtime="ready"]', { timeout: 120_000 });
}

/** 執行目前頁籤並跳到最後一步，回傳畫面上的回傳值與錯誤 */
async function runActiveTab(page) {
  await page.click('[data-action="visualize"]');
  await page.waitForFunction(
    () => /Step \d+ \/ [1-9]\d*/.test(document.body.innerText) || document.querySelector('main .text-err'),
    { timeout: 30_000 },
  );
  await page.click('[data-action="last"]');
  await sleep(300);
  return page.evaluate(() => {
    const panel = document.querySelectorAll('main > section')[1];
    return {
      returned: panel.querySelector('[data-return]')?.textContent ?? null,
      error: panel.querySelector('.text-err')?.textContent ?? null,
    };
  });
}

const tabTitles = (page) => page.$$eval('[role="tab"]', (els) => els.map((e) => e.innerText.trim()));

// ─────────────── 測試 ───────────────

async function testExamples(page, expected) {
  console.log(`Tutorial examples (${expected.size})`);
  await page.click('[data-action="library"]');
  await page.waitForSelector('[data-topic]');
  const topics = await page.$$eval('[data-topic]', (els) => els.map((e) => e.dataset.topic));
  await page.keyboard.press('Escape');

  const seen = new Set();
  for (const topic of topics) {
    await page.click('[data-action="library"]');
    await page.waitForSelector(`[data-topic="${topic}"]`);
    await page.click(`[data-topic="${topic}"]`);
    const ids = await page.$$eval('[data-example]', (els) => els.map((e) => e.dataset.example));
    await page.keyboard.press('Escape');

    for (const id of ids) {
      seen.add(id);
      await page.click('[data-action="library"]');
      await page.waitForSelector(`[data-topic="${topic}"]`);
      await page.click(`[data-topic="${topic}"]`);
      await page.waitForSelector(`[data-example="${id}"]`);
      await page.click(`[data-example="${id}"]`);
      await sleep(250);
      const { returned, error } = await runActiveTab(page);
      const want = expected.get(id);
      let problem = null;
      if (error) problem = error;
      else if (want === undefined) problem = 'no expected value in src/tutorials';
      else if (returned !== want) problem = `expected ${JSON.stringify(want)}, got ${JSON.stringify(returned)}`;
      record(`${id} (${topic})`, problem);
      // 關掉剛開的頁籤，避免頁籤列無限變長
      await page.click('[role="tab"][aria-selected="true"] button');
    }
  }
  const missing = [...expected.keys()].filter((id) => !seen.has(id));
  record('every example is reachable from the library', missing.length ? `missing: ${missing.join(', ')}` : null);
}

async function testTabs(page, url) {
  console.log('Tabs');
  const initial = await tabTitles(page);
  record('three default tabs on first visit', initial.length === 3 ? null : `got ${JSON.stringify(initial)}`);

  // 新增空白頁籤並執行（BLANK_CALL = solve([1, 2, 3, 4]) → 10）
  await page.click('[data-action="new-tab"]');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Blank tab')).click());
  await sleep(400);
  const blank = await runActiveTab(page);
  record('new blank tab runs', blank.returned === '10' ? null : `got ${JSON.stringify(blank)}`);

  // 雙擊重新命名
  const active = await page.$('[role="tab"][aria-selected="true"]');
  await active.click({ count: 2 });
  await page.waitForSelector('[role="tab"] input');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.type('My practice');
  await page.keyboard.press('Enter');
  await sleep(200);
  const renamed = await tabTitles(page);
  record('double-click renames a tab', renamed.includes('My practice') ? null : `got ${JSON.stringify(renamed)}`);

  // 重新整理後仍保留（localStorage 會在 300ms 後寫入）
  await sleep(600);
  await openApp(page, url);
  const reloaded = await tabTitles(page);
  record('tabs survive a reload', reloaded.length === initial.length + 1 && reloaded.includes('My practice') ? null : `got ${JSON.stringify(reloaded)}`);

  // 關閉
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('[role="tab"]')].find((t) => t.innerText.includes('My practice'));
    tab.querySelector('button').click();
  });
  await sleep(200);
  const closed = await tabTitles(page);
  record('closing a tab removes it', closed.includes('My practice') ? `got ${JSON.stringify(closed)}` : null);
}

async function testDemo(page) {
  console.log('Tutorial demo');
  await page.click('[data-action="library"]');
  await page.waitForSelector('[data-topic="tree-dfs"]');
  await page.click('[data-topic="tree-dfs"]');
  const progress = () => page.$eval('[data-demo-progress]', (el) => el.textContent.trim());
  // 背景執行範例需要一點時間，之後應該自動往前播放
  await page.waitForFunction(() => /^\d+ \/ [1-9]\d*$/.test(document.querySelector('[data-demo-progress]')?.textContent.trim() ?? ''), {
    timeout: 30_000,
  });
  const first = await progress();
  await sleep(2500);
  const later = await progress();
  const step = (s) => Number(s.split('/')[0]);
  record('demo runs the example and auto-plays', step(later) > step(first) ? null : `progress stuck at ${first} → ${later}`);
  // 播放時高度不能變動，否則下方的教學內容會跟著跳
  const heights = new Set();
  for (let i = 0; i < 20; i++) {
    heights.add(Math.round(await page.$eval('[data-demo]', (el) => el.getBoundingClientRect().height)));
    await sleep(150);
  }
  record('demo keeps a fixed height while playing', heights.size === 1 ? null : `heights changed: ${[...heights].join(', ')}`);
  const hasTree = await page.$eval('[data-demo]', (el) => el.innerText.includes('TreeNode'));
  record('demo shows the tree view', hasTree ? null : 'no TreeNode view inside the demo');
  const busy = await page.$eval('[data-action="visualize"]', (b) => b.disabled);
  record('background demo runs do not block Visualize', busy ? 'Visualize button is disabled' : null);
  await page.keyboard.press('Escape');
}

async function testCondition(page) {
  console.log('Condition');
  // 預設頁籤 167：第一個條件是 while left < right → 0 < 6 → True
  await page.click('[data-tab-example="lc167"]');
  await sleep(300);
  await page.click('[data-action="visualize"]');
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  for (let i = 0; i < 5 && !(await page.$('main [data-condition]')); i++) await page.click('[data-action="next"]');
  const text = await page.evaluate(() => document.querySelector('main [data-condition]')?.innerText ?? '');
  record('condition card shows substituted values', /left < right[\s\S]*0 < 6[\s\S]*True/.test(text) ? null : `got ${JSON.stringify(text)}`);
  // Monaco 在下一個 animation frame 才重繪；並以不換行空白（ ）呈現空格，比對前先正規化
  await page.waitForSelector('.monaco-editor .aa-hint-true', { timeout: 3000 }).catch(() => {});
  const hint = await page.$eval('.monaco-editor', (el) => el.querySelector('.aa-hint-true')?.textContent.replace(/\s+/g, ' ').trim() ?? null);
  record('editor shows the inline result', hint?.includes('0 < 6 → True') ? null : `got ${JSON.stringify(hint)}`);
  const outlined = await page.$$eval('main section:nth-child(2) [style*="dashed"]', (els) => els.length);
  record('compared variables are outlined', outlined >= 2 ? null : `found ${outlined} outlined elements`);

  // 卡片時有時無，下面的內容（陣列、變數）位置也不能跳
  const tops = new Set();
  for (let i = 0; i < 15; i++) {
    tops.add(
      await page.evaluate(() => {
        const slot = document.querySelector('main [data-info-slot]');
        return slot ? Math.round(slot.nextElementSibling.getBoundingClientRect().top) : -1;
      }),
    );
    await page.click('[data-action="next"]');
    await sleep(60);
  }
  record('visualization content stays in place while cards change', tops.size === 1 && !tops.has(-1) ? null : `content moved: ${[...tops].join(', ')}`);
}

async function testCalc(page) {
  console.log('Calculation');
  // 預設頁籤 167 第 4 行：current_sum = numbers[left] + numbers[right] → 1 + 11 → 12
  await page.click('[data-tab-example="lc167"]');
  await sleep(300);
  await page.click('[data-action="visualize"]');
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  const atCalc = () => page.evaluate(() => document.querySelector('main [data-calc]')?.innerText.includes('current_sum') ?? false);
  for (let i = 0; i < 6 && !(await atCalc()); i++) await page.click('[data-action="next"]');
  const text = await page.evaluate(() => document.querySelector('main [data-calc]')?.innerText ?? '');
  record('calculation card reduces the expression', /1 \+ 11[\s\S]*12/.test(text) ? null : `got ${JSON.stringify(text)}`);
  // Monaco 在下一個 animation frame 才重繪，等提示出現再讀
  await page.waitForSelector('.monaco-editor .aa-hint-calc', { timeout: 3000 }).catch(() => {});
  const hint = await page.$eval('.monaco-editor', (el) => el.querySelector('.aa-hint-calc')?.textContent.replace(/\s+/g, ' ').trim() ?? null);
  record('editor shows the calculation result', hint?.includes('1 + 11 → 12') ? null : `got ${JSON.stringify(hint)}`);
  const reads = await page.$$eval('main section:nth-child(2) [style*="dashed"]', (els) => els.length);
  record('cells read by the calculation are outlined', reads >= 2 ? null : `found ${reads} outlined cells`);
}

/** 從教學庫開啟範例並執行，往前走到 selector 的內容包含 needle 為止 */
async function openAndStepTo(page, topic, example, selector, needle) {
  await page.click('[data-action="library"]');
  await page.waitForSelector(`[data-topic="${topic}"]`);
  await page.click(`[data-topic="${topic}"]`);
  await page.waitForSelector(`[data-example="${example}"]`);
  await page.click(`[data-example="${example}"]`);
  await sleep(250);
  await page.click('[data-action="visualize"]');
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  const text = () => page.evaluate((s) => document.querySelector(`main ${s}`)?.innerText ?? '', selector);
  // 標題有 CSS uppercase，innerText 會變成大寫，比對時不分大小寫
  const hit = async () => (await text()).toLowerCase().includes(needle.toLowerCase());
  for (let i = 0; i < 80 && !(await hit()); i++) await page.click('[data-action="next"]');
  const result = await text();
  await page.click('[role="tab"][aria-selected="true"] button');
  return result;
}

async function testLogic(page) {
  console.log('Logic');
  // 739：while stack and temperatures[stack[-1]] < t，stack 為空時短路
  const logic = await openAndStepTo(page, 'monotonic-stack', 'lc739', '[data-condition]', 'skipped');
  record('logic tree shows the short-circuit', /stack[\s\S]*empty container is False[\s\S]*and stops at the first False[\s\S]*skipped/.test(logic) ? null : `got ${JSON.stringify(logic)}`);
  // 191：n &= n - 1 → 1011 & 1010 = 1010
  const bits = await openAndStepTo(page, 'bit-manipulation', 'lc191', '[data-calc]', 'Bitwise');
  record('bitwise calculation shows binary rows', /11 & 10[\s\S]*bitwise[\s\S]*\(11\)[\s\S]*\(10\)/i.test(bits) ? null : `got ${JSON.stringify(bits)}`);
}

async function testContext(page) {
  console.log('Loops & calls');
  // 預設頁籤 283：for fast in range(len(nums)) → 第 1 / 5 圈；沒有遞迴，不顯示呼叫堆疊
  await page.click('[data-tab-example="lc283"]');
  await sleep(300);
  await page.click('[data-action="visualize"]');
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  // 走到第一次出現迴圈資訊為止（第 1 圈）
  const inLoop = () => page.evaluate(() => /pass \d/.test(document.querySelector('main [data-loops]')?.innerText ?? ''));
  for (let i = 0; i < 6 && !(await inLoop()); i++) await page.click('[data-action="next"]');
  const loopText = await page.evaluate(() => document.querySelector('main [data-loops]')?.innerText ?? '');
  record('loop row shows the pass number', /for fast in range\(len\(nums\)\)[\s\S]*pass 1 \/ 5/.test(loopText) ? null : `got ${JSON.stringify(loopText)}`);
  const hasStack = await page.$('main [data-call-stack]');
  record('no call stack row without nested calls', hasStack ? 'call stack row is shown for a single function' : null);
  // 104：遞迴到 root=None 時，堆疊有三層
  const stackText = await openAndStepTo(page, 'tree-dfs', 'lc104', '[data-call-stack]', 'root=None');
  const frames = (stackText.match(/maxDepth/g) ?? []).length;
  record('call stack shows each recursive call', frames >= 3 && /root=\(3\)/.test(stackText) ? null : `got ${JSON.stringify(stackText)}`);
}

async function testOps(page) {
  console.log('Container ops & heap');
  // 20：stack.append(ch) → 把 '(' 放到 stack 的尾端
  const push = await openAndStepTo(page, 'stack', 'lc20', '[data-op]', 'at the end of stack');
  record('op card describes a push', /stack\.append\(ch\)[\s\S]*Put '\(' at the end of stack/.test(push) ? null : `got ${JSON.stringify(push)}`);
  // 1046：heappop 卡片 + 堆積樹
  await page.click('[data-action="library"]');
  await page.waitForSelector('[data-topic="heap"]');
  await page.click('[data-topic="heap"]');
  await page.waitForSelector('[data-example="lc1046"]');
  await page.click('[data-example="lc1046"]');
  await sleep(250);
  await page.click('[data-action="visualize"]');
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  const opText = () => page.evaluate(() => document.querySelector('main [data-op]')?.innerText ?? '');
  for (let i = 0; i < 40 && !(await opText()).includes('Pop the smallest'); i++) await page.click('[data-action="next"]');
  const pop = await opText();
  record('op card explains heappop', /Pop the smallest value -8/.test(pop) ? null : `got ${JSON.stringify(pop)}`);
  const nodes = await page.$$eval('main [data-heap="heap"] .rounded-full', (els) => els.map((e) => e.textContent.trim()));
  record('heap is drawn as a tree with the minimum on top', nodes.length === 6 && nodes[0] === '-8' ? null : `got ${JSON.stringify(nodes)}`);
  await page.click('[role="tab"][aria-selected="true"] button');
}

async function testRecursionTree(page) {
  console.log('Recursion tree');
  await page.click('[data-action="library"]');
  await page.waitForSelector('[data-topic="recursion"]');
  await page.click('[data-topic="recursion"]');
  await page.waitForSelector('[data-example="lc509"]');
  await page.click('[data-example="lc509"]');
  await sleep(250);
  await page.click('[data-action="visualize"]');
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  await page.click('[data-action="last"]');
  await sleep(400);
  const calls = await page.$$eval('main [data-recursion-tree] button', (els) => els.length);
  record('recursion tree shows every call of fib(5)', calls === 15 ? null : `expected 15 calls, got ${calls}`);
  const returned = await page.$eval('main [data-recursion-tree] button', (el) => el.innerText.replace(/\s+/g, ' ').trim());
  record('root call shows its return value', returned === 'fib(5) → 5' ? null : `got ${JSON.stringify(returned)}`);
  // 播放途中：樹上標成「目前」的節點，必須和呼叫堆疊最內層是同一次呼叫
  await page.click('[data-action="first"]');
  const mismatches = [];
  for (let i = 0; i < 40; i++) {
    const pair = await page.evaluate(() => {
      const cur = document.querySelector('main [data-recursion-tree] button span.font-semibold')?.textContent.trim();
      // 剛回傳的那一層還在播離場動畫、仍在 DOM 中，所以用 data-current 找目前這一層
      const top = document.querySelector('main [data-call-stack] [data-current]')?.innerText.replace(/\s+/g, '') ?? '';
      return { cur, top };
    });
    const n = pair.top.match(/n=(-?\d+)/)?.[1];
    if (pair.cur && n !== undefined && pair.cur !== `fib(${n})`) mismatches.push(`${pair.cur} vs ${pair.top}`);
    await page.click('[data-action="next"]');
    await sleep(300); // 等呼叫堆疊的離場動畫結束，舊的那一層才會從 DOM 移除
  }
  record('current call in the tree matches the call stack', mismatches.length ? mismatches.slice(0, 3).join(' | ') : null);
  // 點第 2 次呼叫 fib(4)：跳到它開始的那一步
  await page.evaluate(() => document.querySelectorAll('main [data-recursion-tree] button')[1].click());
  await sleep(300);
  const stepText = await page.evaluate(() => document.body.innerText.match(/Step (\d+) \/ \d+/)?.[1]);
  const stack = await page.evaluate(() => document.querySelector('main [data-call-stack]')?.innerText ?? '');
  record('clicking a call jumps to where it starts', Number(stepText) < 10 && /n=4/.test(stack) ? null : `step ${stepText}, stack ${JSON.stringify(stack)}`);
  await page.click('[role="tab"][aria-selected="true"] button');
}

async function testStatements(page) {
  console.log('Swap, comprehension & slices');
  const swap = await openAndStepTo(page, 'fast-slow', 'lc283', '[data-multi]', 'Swap');
  record('swap card evaluates the right side first', /evaluate every value on the right first[\s\S]*then assign them all at once[\s\S]*no temporary variable/.test(swap) ? null : `got ${JSON.stringify(swap)}`);
  const comp = await openAndStepTo(page, 'heap', 'lc1046', '[data-comp]', 'Element #3');
  record('comprehension card builds the result', /Element #3: s = 4[\s\S]*add -4[\s\S]*-2[\s\S]*-7[\s\S]*-4/.test(comp) ? null : `got ${JSON.stringify(comp)}`);
  const slice = await openAndStepTo(page, 'backtracking', 'lc78', '[data-slice]', 'path[:] → [1, 2]');
  record('slice label shows the selected range', slice === 'path[:] → [1, 2]' ? null : `got ${JSON.stringify(slice)}`);
}

async function testLanguage(page) {
  console.log('Language');
  await page.click('[data-action="lang"]');
  await sleep(200);
  const zh = await page.$eval('[data-action="visualize"]', (b) => b.innerText.trim());
  record('switch to Chinese', zh === '視覺化' ? null : `visualize button says ${JSON.stringify(zh)}`);
  await page.click('[data-action="lang"]');
  await sleep(200);
  const en = await page.$eval('[data-action="visualize"]', (b) => b.innerText.trim());
  record('switch back to English', en === 'Visualize' ? null : `visualize button says ${JSON.stringify(en)}`);
}

// ─────────────── main ───────────────

const expected = loadExpected();
const server = urlArg ? { url: urlArg, stop: () => {} } : await startPreview();
console.log(`Testing ${server.url}`);

const browser = await puppeteer.launch(launchOptions({ defaultViewport: { width: 1440, height: 860 } }));
const consoleErrors = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await openApp(page, server.url);

  await testTabs(page, server.url);
  await testLanguage(page);
  await testCondition(page);
  await testCalc(page);
  await testLogic(page);
  await testContext(page);
  await testOps(page);
  await testRecursionTree(page);
  await testStatements(page);
  await testDemo(page);
  await testExamples(page, expected);

  console.log('Console');
  record('no console errors', consoleErrors.length ? consoleErrors.slice(0, 5).join(' | ') : null);
} catch (err) {
  record('test run', String(err?.stack ?? err));
} finally {
  await browser.close();
  server.stop();
}

const failures = results.filter((r) => r.problem).length;
console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${results.length - failures}/${results.length} checks`);
process.exit(failures ? 1 : 0);

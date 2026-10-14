// 重新產生 README 用的截圖與 GIF：
//   docs/screenshot.png   — 1. Two Sum，complement 命中 seen 字典的那一步
//   docs/tutorials.png    — 演算法教學（滑動視窗）
//   docs/tree.png         — 二元樹遞迴（104. Maximum Depth）
//   docs/move-zeroes.gif  — 283. Move Zeroes 以 1× 速度完整播放
//
// 用法：
//   npm run capture                                 # 錄線上網站
//   npm run capture -- --url http://localhost:5173/ # 錄本機 dev server（先 npm run dev）
//
// 需求：本機安裝 Chrome / Edge（或設定 CHROME_PATH），以及含 Pillow 的 Python 3。
import puppeteer from 'puppeteer-core';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const DEFAULT_URL = 'https://power28.github.io/AlgoAlive/';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const url = argValue('--url') ?? DEFAULT_URL;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ];
  const found = candidates.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('找不到 Chrome / Edge，請設定環境變數 CHROME_PATH 指向瀏覽器執行檔');
  return found;
}

/** 開啟網站（全新瀏覽器設定檔 → 預設頁籤 167 / 283 / 1），切到指定範例並執行視覺化。 */
async function openApp(browser, viewport, exampleId) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const target = new URL(url);
  target.searchParams.set('lang', 'en');
  await page.goto(target.href, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-runtime="ready"]', { timeout: 90_000 });
  await page.click(`[data-tab-example="${exampleId}"]`);
  await sleep(500);
  await page.click('[data-action="visualize"]');
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  // 移開滑鼠、取消焦點，避免 hover / focus 樣式出現在畫面上
  await page.mouse.move(5, viewport.height - 5);
  await page.evaluate(() => document.activeElement?.blur());
  return page;
}

async function captureScreenshot(browser) {
  const page = await openApp(browser, { width: 1440, height: 820, deviceScaleFactor: 2 }, 'lc1');
  // 跳到倒數第二步：complement 命中 seen 字典的那一刻
  await page.click('[data-action="last"]');
  await sleep(300);
  await page.click('[data-action="prev"]');
  await page.evaluate(() => document.activeElement?.blur());
  await sleep(2000);
  const out = path.join(DOCS, 'screenshot.png');
  await page.screenshot({ path: out, type: 'png' });
  await page.close();
  console.log(`✓ ${path.relative(ROOT, out)}`);
}

async function captureLibrary(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 820, deviceScaleFactor: 2 });
  const target = new URL(url);
  target.searchParams.set('lang', 'en');
  await page.goto(target.href, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-runtime="ready"]', { timeout: 90_000 });
  await page.click('[data-action="library"]');
  await page.waitForSelector('[data-topic="sliding-window"]');
  await page.click('[data-topic="sliding-window"]');
  await page.mouse.move(5, 815);
  await sleep(600);
  const out = path.join(DOCS, 'tutorials.png');
  await page.screenshot({ path: out, type: 'png' });
  await page.close();
  console.log(`✓ ${path.relative(ROOT, out)}`);
}

/** 二元樹：104. Maximum Depth 遞迴到第 4 層時，外層呼叫的路徑會被標出來 */
async function captureTree(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 820, deviceScaleFactor: 2 });
  const target = new URL(url);
  target.searchParams.set('lang', 'en');
  await page.goto(target.href, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-runtime="ready"]', { timeout: 90_000 });
  await page.click('[data-action="library"]');
  await page.waitForSelector('[data-topic="tree-dfs"]');
  await page.click('[data-topic="tree-dfs"]');
  await page.waitForSelector('[data-example="lc104"]');
  await page.click('[data-example="lc104"]');
  await sleep(400);
  await page.click('[data-action="visualize"]');
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  for (let i = 0; i < 18; i++) await page.click('[data-action="next"]');
  await page.mouse.move(5, 815);
  await page.evaluate(() => document.activeElement?.blur());
  await sleep(1500);
  const out = path.join(DOCS, 'tree.png');
  await page.screenshot({ path: out, type: 'png' });
  await page.close();
  console.log(`✓ ${path.relative(ROOT, out)}`);
}

/** 以 CDP screencast 錄下播放過程：畫面有變化才送影格，並附時間戳。 */
async function recordFrames(browser, framesDir) {
  const viewport = { width: 1200, height: 620, deviceScaleFactor: 1.5 };
  const page = await openApp(browser, viewport, 'lc283');
  await sleep(1200);

  const cdp = await page.createCDPSession();
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = path.join(framesDir, `f${String(frames.length).padStart(4, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  await sleep(900); // 開頭停一下

  await page.click('[data-action="play"]');
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForFunction(
    () => {
      const m = document.body.innerText.match(/Step (\d+) \/ (\d+)/);
      return m && m[1] === m[2];
    },
    { timeout: 60_000, polling: 100 },
  );
  await sleep(1500);
  await cdp.send('Page.stopScreencast');
  await sleep(300);

  // screencast 只在畫面變動時送影格，補一張最後畫面標記結束時間
  const endShot = path.join(framesDir, 'end.png');
  await page.screenshot({ path: endShot });
  frames.push({ file: endShot, t: frames.at(-1).t + 1.5 });
  fs.writeFileSync(path.join(framesDir, 'frames.json'), JSON.stringify(frames));
  await page.close();
  return frames.length;
}

function buildGif(framesDir) {
  const out = path.join(DOCS, 'move-zeroes.gif');
  const script = path.join(ROOT, 'scripts', 'make_gif.py');
  const pythons = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
  for (const py of pythons) {
    const res = spawnSync(py, [script, framesDir, out, '1200'], { stdio: 'inherit' });
    if (res.error?.code === 'ENOENT') continue;
    if (res.status !== 0) throw new Error(`make_gif.py 執行失敗（${py}），請確認已安裝 Pillow：pip install pillow`);
    console.log(`✓ ${path.relative(ROOT, out)}`);
    return;
  }
  throw new Error('找不到 Python 3，無法產生 GIF');
}

const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'algoalive-frames-'));
console.log(`Capturing ${url}`);
const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true });
try {
  await captureScreenshot(browser);
  await captureLibrary(browser);
  await captureTree(browser);
  const n = await recordFrames(browser, framesDir);
  console.log(`  recorded ${n} frames`);
} finally {
  await browser.close();
}
try {
  buildGif(framesDir);
} finally {
  fs.rmSync(framesDir, { recursive: true, force: true });
}

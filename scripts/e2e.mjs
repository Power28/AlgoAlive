// 端對端測試：用 headless Chrome 實際操作網站
//
//   npm run test:e2e                                   # 先 npm run build；自動以 vite preview 啟動 dist/
//   npm run test:e2e -- --url http://localhost:5173/   # 測本機 dev server
//   npm run test:e2e -- --url https://power28.github.io/AlgoAlive/
//   npm run test:e2e -- --only cards,limits            # 只跑某幾組
//   npm run test:e2e -- --jobs 1                       # 同時跑幾組（預設依 CPU 數，最多 3）
//
// 測試分成幾組（scripts/e2e/<組>.mjs），每組各自是一個程式、用全新的瀏覽器環境，
// 彼此不共用頁籤或 localStorage，所以可以平行執行，也可以單獨執行：node scripts/e2e/cards.mjs
//
// 某一組失敗時會再跑一次：第二次通過的標成「不穩定」，列在最後的總結裡（不算失敗，但要追查原因）；
// 兩次都失敗才算失敗。
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { arg, ROOT, startPreview } from './e2e/harness.mjs';

/** 每一組：名稱、檔案（scripts/e2e/<file>.mjs）與額外參數。由長到短排：最久的先開始，平行時比較早全部結束 */
const ALL = [
  { name: 'examples-py', file: 'examples', args: ['--lang', 'python'] },
  { name: 'examples-js', file: 'examples', args: ['--lang', 'javascript'] },
  { name: 'more-cards' },
  { name: 'cards' },
  { name: 'basics' },
  { name: 'onboarding' },
  { name: 'notes' },
  { name: 'limits' },
  { name: 'offline' },
];
const SUITES = ALL.map((s) => s.name);

const only = arg('--only')?.split(',');
const suites = only ? SUITES.filter((s) => only.includes(s)) : SUITES;
if (only && suites.length !== only.length) {
  console.error(`unknown suite: ${only.filter((s) => !SUITES.includes(s)).join(', ')} (suites: ${SUITES.join(', ')})`);
  process.exit(2);
}
const jobs = Number(arg('--jobs') ?? Math.max(1, Math.min(3, os.cpus().length - 1)));

const server = arg('--url') ? { url: arg('--url'), stop: () => {} } : await startPreview();
console.log(`Testing ${server.url} — ${suites.length} suites, ${jobs} at a time\n`);

/** 執行一組測試（子程序），收集輸出；結果由最後一行 PASSED / FAILED: x/y checks 讀出 */
function runSuite(name) {
  const { file = name, args = [] } = ALL.find((s) => s.name === name);
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'e2e', `${file}.mjs`), '--url', server.url, ...args], { cwd: ROOT });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    // 以程序結束（exit）為準，不等 close：子程序啟動的 Chrome 可能還握著輸出管線，
    // 等 close 會讓每一組都拖到其他組的 Chrome 也關掉為止。結束後稍等一下收完剩下的輸出
    child.on('exit', (code) => {
      setTimeout(() => {
        const seconds = (Date.now() - started) / 1000;
        const m = output.match(/(PASSED|FAILED): (\d+)\/(\d+) checks/);
        resolve({ name, ok: code === 0, passed: m ? Number(m[2]) : 0, total: m ? Number(m[3]) : 0, seconds, output });
      }, 200);
    });
  });
}

const results = [];
const queue = [...suites];
async function worker() {
  while (queue.length) {
    const name = queue.shift();
    console.log(`▶ ${name}`);
    let result = await runSuite(name);
    if (!result.ok) {
      // 再跑一次：區分「不穩定」與「真的壞了」
      const first = result;
      console.log(`↻ ${name} failed (${first.passed}/${first.total}), running it again`);
      result = await runSuite(name);
      result.firstTry = first;
      result.flaky = result.ok;
    }
    const mark = result.ok ? (result.flaky ? '⚠' : '✓') : '✗';
    console.log(`\n${mark} ${name} — ${result.passed}/${result.total} checks, ${result.seconds.toFixed(0)}s${result.flaky ? ' (passed on the second try)' : ''}`);
    if (result.flaky) console.log(indent(failedLines(result.firstTry.output)));
    console.log(indent(result.output.trim()));
    console.log('');
    results.push(result);
  }
}

const indent = (s) => s.replace(/^/gm, '  │ ');
const failedLines = (s) => s.split('\n').filter((l) => l.includes('✗')).join('\n') || '(no failed check printed)';

const started = Date.now();
try {
  await Promise.all(Array.from({ length: Math.min(jobs, suites.length) }, worker));
} finally {
  server.stop();
}

// ─────────────── 總結 ───────────────

const ordered = suites.map((s) => results.find((r) => r.name === s));
const failed = ordered.filter((r) => !r.ok);
const flaky = ordered.filter((r) => r.flaky);
console.log('Summary');
for (const r of ordered) {
  console.log(`  ${r.ok ? (r.flaky ? '⚠' : '✓') : '✗'} ${r.name.padEnd(11)} ${`${r.passed}/${r.total}`.padStart(7)}  ${r.seconds.toFixed(0).padStart(4)}s`);
}
if (flaky.length) {
  console.log(`\n⚠ flaky (failed once, passed on the second try): ${flaky.map((r) => r.name).join(', ')}`);
  for (const r of flaky) console.log(`  ${r.name}:\n${failedLines(r.firstTry.output).replace(/^/gm, '    ')}`);
}
const passed = ordered.reduce((s, r) => s + r.passed, 0);
const total = ordered.reduce((s, r) => s + r.total, 0);
console.log(`\n${failed.length ? 'FAILED' : 'PASSED'}: ${passed}/${total} checks in ${((Date.now() - started) / 1000).toFixed(0)}s`);
process.exit(failed.length ? 1 : 0);

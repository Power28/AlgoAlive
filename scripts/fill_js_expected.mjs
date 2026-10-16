// 新增 JavaScript 範例時：expected 先寫 '__FILL__'，執行這個腳本後填入實際的回傳值
//
//   node scripts/fill_js_expected.mjs
//
// 填入後請檢查值是否正確（例如和 Python 版的答案一致），再由 npm run test:js 驗證。
import fs from 'node:fs';
import path from 'node:path';
import { MAX_STEPS, traceJs } from '../src/languages/javascript/tracer.ts';
import { TUTORIALS_DIR, fmt, loadJsExamples } from './js_examples.mjs';

const pending = loadJsExamples().filter((ex) => ex.expected === '__FILL__');
// 同一個檔案由後往前替換，前面的位置才不會跑掉
pending.sort((a, b) => (a.file === b.file ? b.start - a.start : a.file.localeCompare(b.file)));
let failed = 0;
for (const ex of pending) {
  const r = traceJs(ex.code, ex.call);
  if (r.error) {
    console.log(`✗ ${ex.key}: ${r.error.message}`);
    failed++;
    continue;
  }
  const got = fmt(r.returnValue, r.returnHeap);
  const file = path.join(TUTORIALS_DIR, ex.file);
  const src = fs.readFileSync(file, 'utf8');
  const escaped = got.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  fs.writeFileSync(file, src.slice(0, ex.start) + escaped + src.slice(ex.end));
  console.log(`${r.steps.length >= MAX_STEPS ? '⚠' : '✓'} ${ex.key.padEnd(10)} ${String(r.steps.length).padStart(3)} steps → ${got}`);
}
console.log(pending.length ? `filled ${pending.length - failed} / ${pending.length}` : 'nothing to fill');
process.exit(failed ? 1 : 0);

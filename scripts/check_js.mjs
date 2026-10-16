// JavaScript 追蹤器的測試：直接在 Node 執行 src/languages/javascript/tracer.ts（不需要瀏覽器）
//
//   node scripts/check_js.mjs   （或 npm run test:js）
import { MAX_STEPS, traceJs } from '../src/languages/javascript/tracer.ts';

const results = [];
function check(name, fn) {
  let problem;
  try {
    problem = fn();
  } catch (e) {
    problem = `threw ${e?.stack ?? e}`;
  }
  results.push(!problem);
  console.log(`  ${problem ? '✗' : '✓'} ${name}${problem ? `  — ${problem}` : ''}`);
}

const int = (v) => (v?.type === 'int' || v?.type === 'float' ? v.value : undefined);
const ints = (v) => v?.items?.map(int);
/** 從 heap 走訪鏈結串列的值 */
function chain(ref, heap) {
  const out = [];
  let cur = ref?.type === 'ref' ? ref.id : null;
  while (cur && heap[cur] && out.length < 20) {
    out.push(int(heap[cur].fields.val));
    cur = heap[cur].fields.next?.type === 'ref' ? heap[cur].fields.next.id : null;
  }
  return out;
}

const TWO_SUM = `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
        const need = target - nums[i];
        if (seen.has(need)) return [seen.get(need), i];
        seen.set(nums[i], i);
    }
    return [];
};`;

console.log('JavaScript tracer');

check('LeetCode example input runs the function', () => {
  const r = traceJs(TWO_SUM, 'nums = [2,7,11,15], target = 9');
  if (r.error) return r.error.message;
  if (JSON.stringify(ints(r.returnValue)) !== '[0,1]') return `returned ${JSON.stringify(r.returnValue)}`;
  if (r.call?.display !== 'twoSum([2, 7, 11, 15], 9)') return `call display ${r.call?.display}`;
  const lines = r.steps.map((s) => `${s.event}:${s.lineNumber}`).join(' ');
  if (lines !== 'line:7 line:8 line:9 line:10 line:11 line:8 line:9 line:10 return:10') return `steps ${lines}`;
  const first = r.steps[0];
  if (!first.entered || Object.keys(first.variables).join(',') !== 'nums,target') return `first step ${JSON.stringify(first.variables)}`;
  const map = r.steps[5].variables.seen;
  if (map?.type !== 'dict' || map.cls !== 'Map' || map.entries.length !== 1) return `Map ${JSON.stringify(map)}`;
});

check('the same call written in the other formats', () => {
  for (const call of ['twoSum([2,7,11,15], 9)', '[2,7,11,15]\n9', '[2,7,11,15], 9']) {
    const r = traceJs(TWO_SUM, call);
    if (r.error || JSON.stringify(ints(r.returnValue)) !== '[0,1]') return `${JSON.stringify(call)}: ${r.error?.message ?? JSON.stringify(r.returnValue)}`;
  }
});

check('recursion records the call stack and each return', () => {
  const code = 'function fib(n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}';
  const r = traceJs(code, 'fib(4)');
  if (int(r.returnValue) !== 3) return `returned ${JSON.stringify(r.returnValue)}`;
  const calls = r.steps.filter((s) => s.entered).length;
  const deepest = Math.max(...r.steps.map((s) => s.depth));
  const top = r.steps.find((s) => s.depth === 4);
  if (calls !== 9 || deepest !== 4) return `calls ${calls}, depth ${deepest}`;
  if (JSON.stringify(top.stack.map((f) => f.args[0][1])) !== '["4","3","2","1"]') return `stack ${JSON.stringify(top.stack)}`;
  const returns = r.steps.filter((s) => s.event === 'return').map((s) => int(s.returnValue));
  if (returns.length !== 9 || returns.at(-1) !== 3) return `returns ${returns}`;
});

check('JSDoc ListNode turns an array into a linked list', () => {
  const code = `/**
 * @param {ListNode} head
 * @return {ListNode}
 */
var reverseList = function(head) {
    let prev = null, curr = head;
    while (curr) {
        const next = curr.next;
        curr.next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
};`;
  const r = traceJs(code, 'head = [1,2,3]');
  if (r.error) return r.error.message;
  if (JSON.stringify(chain(r.returnValue, r.returnHeap)) !== '[3,2,1]') return `returned ${JSON.stringify(chain(r.returnValue, r.returnHeap))}`;
  if (JSON.stringify(r.call?.conversions) !== '[{"param":"head","to":"ListNode"}]') return `conversions ${JSON.stringify(r.call)}`;
  const s = r.steps[0];
  if (s.variables.head?.type !== 'ref' || s.heap?.[s.variables.head.id]?.cls !== 'ListNode') return `head ${JSON.stringify(s.variables.head)}`;
});

check('trees: root = [...] builds a TreeNode; outer frames keep their nodes', () => {
  const code = 'var maxDepth = function(root) {\n  if (!root) return 0;\n  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));\n};';
  const r = traceJs(code, 'root = [3,9,20,null,null,15,7]');
  if (int(r.returnValue) !== 3) return `returned ${JSON.stringify(r.returnValue)}`;
  if (!r.steps.some((s) => s.stackRefs?.length)) return 'no stackRefs while recursing';
});

check('design problems run from the two arrays and show this.x', () => {
  const code = `class MinStack {
  constructor() {
    this.stack = [];
    this.mins = [];
  }
  push(val) {
    this.stack.push(val);
    if (!this.mins.length || val <= this.mins[this.mins.length - 1]) this.mins.push(val);
  }
  getMin() {
    return this.mins[this.mins.length - 1];
  }
}`;
  for (const call of ['["MinStack","push","push","getMin"], [[],[-2],[-3],[]]', '["MinStack","push","push","getMin"]\n[[],[-2],[-3],[]]']) {
    const r = traceJs(code, call);
    if (r.error) return r.error.message;
    const out = r.returnValue.items.map((x) => (x.type === 'none' ? null : int(x)));
    if (JSON.stringify(out) !== '[null,null,null,-3]') return `${JSON.stringify(call)} returned ${JSON.stringify(out)}`;
    if (JSON.stringify(r.design?.calls) !== '["MinStack()","push(-2)","push(-3)","getMin()"]') return `design ${JSON.stringify(r.design)}`;
    const last = r.steps.at(-1);
    if (last.design?.index !== 4 || JSON.stringify(ints(last.variables['this.stack'])) !== '[-2,-3]') return `last step ${JSON.stringify(last.design)} / ${Object.keys(last.variables)}`;
  }
});

check('infinite loops stop at MAX_STEPS, even inside try / catch', () => {
  for (const code of ['function f() { let i = 0; while (true) { i++; } }', 'function f() { let i = 0; for (;;) { try { i++; } catch (e) {} } }']) {
    const r = traceJs(code, 'f()');
    if (!r.error?.timeout || r.steps.length !== MAX_STEPS + 1) return `${code}: ${JSON.stringify(r.error)} / ${r.steps.length} steps`;
  }
});

check('syntax and runtime errors report the line', () => {
  const syntax = traceJs('function f() {\n  return 1 +;\n}', 'f()');
  if (syntax.error?.type !== 'SyntaxError' || syntax.error.line !== 2) return `syntax ${JSON.stringify(syntax.error)}`;
  const runtime = traceJs('function f(a) {\n  const x = 1;\n  return a.b.c;\n}', 'f({})');
  if (runtime.error?.type !== 'TypeError' || runtime.error.line !== 3) return `runtime ${JSON.stringify(runtime.error)}`;
  if (!runtime.steps.some((s) => s.event === 'exception')) return 'no exception step';
});

check('let / const before declaration are hidden (TDZ)', () => {
  const r = traceJs('function f() {\n  const a = 1;\n  const b = a + 1;\n  return b;\n}', 'f()');
  const keys = r.steps.filter((s) => s.event === 'line').map((s) => Object.keys(s.variables).join(','));
  if (JSON.stringify(keys) !== '["","a","a,b"]') return `variables per step ${JSON.stringify(keys)}`;
});

check('console.log is captured; comparator arrows add no steps', () => {
  const r = traceJs('function f(nums) {\n  nums.sort((a, b) => a - b);\n  console.log("sorted", nums);\n  return nums;\n}', 'f([3, 1, 2])');
  if (r.stdout !== 'sorted [1, 2, 3]\n') return `stdout ${JSON.stringify(r.stdout)}`;
  if (r.steps.length !== 4) return `${r.steps.length} steps`;
});

check('friendly hints for the test call', () => {
  const name = traceJs(TWO_SUM, 'twosum([2,7,11,15], 9)').error?.hint;
  if (name?.kind !== 'name' || name.suggest !== 'twoSum' || name.fix !== 'twoSum([2,7,11,15], 9)') return `name hint ${JSON.stringify(name)}`;
  const empty = traceJs(TWO_SUM, '  ').error?.hint;
  if (empty?.kind !== 'empty') return `empty hint ${JSON.stringify(empty)}`;
  const args = traceJs(TWO_SUM, 'foo = 1, bar = 2').error?.hint;
  if (args?.kind !== 'args') return `args hint ${JSON.stringify(args)}`;
});

// ─────────────── JavaScript 教學範例：回傳值依前端 jsFormat 的規則格式化後，等於 expected ───────────────

/** 與 src/lib/value.ts 的 formatValue（src/languages/javascript/format.ts）相同的格式化 */
function fmt(v, heap = {}) {
  const f = (x) => fmt(x, heap);
  const cell = (x) => (x?.type === 'str' ? x.value : f(x));
  switch (v.type) {
    case 'none':
      return 'null';
    case 'bool':
      return String(v.value);
    case 'int':
      return String(v.value);
    case 'float':
      return typeof v.value === 'string' ? ({ inf: 'Infinity', '-inf': '-Infinity', nan: 'NaN' })[v.value] : String(v.value);
    case 'str':
      return JSON.stringify(v.value);
    case 'list':
      return `[${v.items.map(f).join(', ')}]`;
    case 'set':
      return `Set {${v.items.map(f).join(', ')}}`;
    case 'dict':
      return `{${v.entries.map(([k, x]) => `${f(k)}: ${f(x)}`).join(', ')}}`;
    case 'repr':
      return v.value;
    case 'ref': {
      const obj = heap[v.id];
      if (!obj) return `${v.cls}(…)`;
      if ('next' in obj.fields) return chain(v, heap).join(' → ');
      if ('left' in obj.fields || 'right' in obj.fields) {
        const out = [];
        const queue = [v.id];
        while (queue.length) {
          const id = queue.shift();
          if (!id) {
            out.push('null');
            continue;
          }
          out.push(cell(heap[id].fields.val));
          const kid = (k) => (heap[id].fields[k]?.type === 'ref' ? heap[id].fields[k].id : null);
          queue.push(kid('left'), kid('right'));
        }
        while (out.at(-1) === 'null') out.pop();
        return `[${out.join(', ')}]`;
      }
      return `${obj.cls}(…)`;
    }
  }
  return '?';
}

console.log('\nJavaScript tutorial examples');
const fs = await import('node:fs');
const path = await import('node:path');
const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'src', 'tutorials');
const EXAMPLE = /id: '(js\d+)'.*?code: `(.*?)`,\s*call: '((?:[^'\\]|\\.)*)',\s*expected: '((?:[^'\\]|\\.)*)',/gs;
const unescape = (s) => s.replace(/\\(.)/g, '$1');
let found = 0;
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
  for (const m of fs.readFileSync(path.join(dir, file), 'utf8').matchAll(EXAMPLE)) {
    found++;
    const [, id, code, call, expected] = m;
    check(`${id} (${file})`, () => {
      const r = traceJs(code.replace(/\\`/g, '`').replace(/\\\$/g, '$'), unescape(call));
      if (r.error) return r.error.message;
      if (r.steps.length >= MAX_STEPS) return `${r.steps.length} steps — keep tutorial examples under ${MAX_STEPS}`;
      const got = fmt(r.returnValue, r.returnHeap);
      return got === unescape(expected) ? null : `expected ${unescape(expected)}, got ${got}`;
    });
  }
}
check('JavaScript tutorial examples were found', () => (found ? null : 'no js examples in src/tutorials'));

const failed = results.filter((ok) => !ok).length;
console.log(`\n${failed ? 'FAILED' : 'PASSED'}: ${results.length - failed}/${results.length} checks`);
process.exit(failed ? 1 : 0);

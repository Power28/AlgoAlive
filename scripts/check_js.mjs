// JavaScript 追蹤器的測試：直接在 Node 執行 src/languages/javascript/tracer.ts（不需要瀏覽器）
//
//   node scripts/check_js.mjs   （或 npm run test:js）
import { MAX_STEPS, traceJs } from '../src/languages/javascript/tracer.ts';
import { fmt, loadJsExamples } from './js_examples.mjs';

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
  // if (…) return …; 同一行：先判斷條件，再執行 return（各自有說明卡片）
  if (lines !== 'line:7 line:8 line:9 line:10 line:11 line:8 line:9 line:10 line:10 return:10') return `steps ${lines}`;
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

// ─────────────── 說明卡片 ───────────────

console.log('\nJavaScript cards');
const CARDS = `function f(nums, target) {
    let lo = 0, hi = nums.length - 1;
    const seen = new Map();
    const set = new Set([1]);
    const count = {};
    const stack = [];
    while (lo <= hi && nums.length > 0) {
        const mid = Math.floor((lo + hi) / 2);
        if (nums[mid] === target) break;
        seen.set(nums[mid], mid);
        set.add(nums[mid]);
        count[nums[mid]] = (count[nums[mid]] || 0) + 1;
        stack.push(nums[mid]);
        lo += 1;
    }
    [nums[0], nums[1]] = [nums[1], nums[0]];
    const top = stack.pop();
    if (stack.length && stack.pop() === top) lo ^= 3;
    const part = nums.slice(1, 3);
    for (const x of nums) {
        if (x > 3) continue;
        stack.unshift(x);
    }
    for (let i = 0; i < 2; i++) {}
    return !stack.length || part;
}`;
const C = traceJs(CARDS, 'f([1, 3, 5, 7, 9], 7)');
const at = (line, key, n = 0) => C.steps.filter((s) => s.lineNumber === line && s[key])[n]?.[key];

check('conditions use JavaScript operators and short-circuit', () => {
  const c = at(7, 'condition');
  if (c?.display !== '0 <= 4 && 5 > 0' || c.result !== true || c.tree?.op !== 'and' || c.parts.length !== 2) return `while test ${JSON.stringify(c)}`;
  // stack.pop() 會修改資料：不預先求值
  const impure = at(18, 'condition');
  const cmp = impure?.parts.find((p) => p.kind === 'cmp');
  if (!impure || cmp?.result !== null) return `impure condition ${JSON.stringify(impure)}`;
  const ret = at(25, 'condition');
  if (ret?.display !== '!false || …' && ret?.display !== '!true || …' && !/^!/.test(ret?.display ?? '')) return `return condition ${JSON.stringify(ret?.display)}`;
});

check('calculations reduce step by step (parentheses, +=, bits)', () => {
  const mid = at(8, 'calc');
  if (JSON.stringify(mid?.stages) !== '["Math.floor((0 + 4) / 2)","Math.floor(4 / 2)","Math.floor(2)","2"]' || mid.target !== 'mid') return `mid ${JSON.stringify(mid)}`;
  const aug = at(14, 'calc');
  if (aug?.kind !== 'aug' || JSON.stringify(aug.stages) !== '["0 + 1","1"]') return `lo += 1 ${JSON.stringify(aug)}`;
  const counter = at(12, 'calc');
  if (JSON.stringify(counter?.stages) !== '["(undefined || 0) + 1","0 + 1","1"]') return `count ${JSON.stringify(counter?.stages)}`;
});

check('container ops are described before they run', () => {
  const ops = C.steps.filter((s) => s.op).map((s) => `${s.op.kind}:${s.op.target}:${s.op.display ?? ''}:${s.op.index ?? ''}:${s.op.key ?? ''}:${s.op.existed ?? ''}`);
  // 迴圈跑兩圈（mid 都是 2）：第二圈的 key / 元素已經存在
  const want = [
    'setitem:seen:2::5:false', 'add:set:5:::false', 'setitem:count:1::5:false', 'push:stack:5:0::',
    'setitem:seen:2::5:true', 'add:set:5:::true', 'setitem:count:2::5:true', 'push:stack:5:1::',
    'pop:stack:5:1::', 'pushleft:stack:3:0::', 'pushleft:stack:1:0::',
  ];
  if (JSON.stringify(ops) !== JSON.stringify(want)) return `ops ${JSON.stringify(ops)}`;
});

check('destructuring swap, slices, continue and loop passes', () => {
  const multi = at(16, 'multi');
  if (!multi?.swap || JSON.stringify(multi.pairs.map((p) => [p.target, p.display, p.targetLoc])) !== '[["nums[0]","3",{"var":"nums","index":0}],["nums[1]","1",{"var":"nums","index":1}]]') return `multi ${JSON.stringify(multi)}`;
  const slice = at(19, 'slices')?.[0];
  if (JSON.stringify(slice) !== '{"var":"nums","src":"nums.slice(1, 3)","start":1,"stop":3,"step":1,"display":"[1, 5]"}') return `slice ${JSON.stringify(slice)}`;
  const jump = at(21, 'jump');
  if (JSON.stringify(jump) !== '{"kind":"continue","loopLine":20,"loopSrc":"for (const x of nums)"}') return `jump ${JSON.stringify(jump)}`;
  const forOf = C.steps.filter((s) => s.lineNumber === 20).map((s) => s.loops?.at(-1)?.iteration);
  if (JSON.stringify(forOf) !== '[1,2,3,4,5]' || at(20, 'loops')[0].total !== 5 || at(20, 'loops')[0].seq !== 'nums') return `for…of passes ${JSON.stringify(forOf)}`;
  const counted = C.steps.filter((s) => s.lineNumber === 24).map((s) => `${s.loops?.[0]?.iteration}/${s.loops?.[0]?.total}${s.loops?.[0]?.done ? ' done' : ''}`);
  if (JSON.stringify(counted) !== '["1/2","2/2","3/2 done"]') return `for passes ${JSON.stringify(counted)}`;
  if (C.steps.some((s) => s.lineNumber === 25 && s.loops)) return 'loops should end when leaving the loop';
});

// ─────────────── try / catch 與內建函式 ───────────────

console.log('\nJavaScript try / catch and built-ins');

check('try / catch / finally flow', () => {
  const code = `function check(x) {
    if (x < 0) throw new RangeError("negative: " + x);
    return x;
}
function f(xs) {
    let total = 0;
    for (const x of xs) {
        try {
            total += check(x);
        } catch (e) {
            total -= 1;
        } finally {
            total *= 1;
        }
    }
    return total;
}
function g(s) {
    try {
        return JSON.parse(s);
    } finally {
        s = null;
    }
}`;
  const r = traceJs(code, 'f([2, -1])');
  if (int(r.returnValue) !== 1) return `returned ${JSON.stringify(r.returnValue)}`;
  const flows = r.steps.filter((s) => s.tryFlow).map((s) => `${s.lineNumber}:${s.tryFlow.kind}${s.tryFlow.reraise === false ? ':handled' : ''}`);
  if (JSON.stringify(flows) !== '["8:try","12:finally","8:try","10:except","12:finally:handled"]') return `try flow ${JSON.stringify(flows)}`;
  const excs = r.steps.filter((s) => s.exc).map((s) => `${s.funcName}:${s.exc.type}:${s.exc.outcome.kind}:${s.exc.outcome.line ?? ''}`);
  if (JSON.stringify(excs) !== '["check:RangeError:propagate:9","f:RangeError:caught:10"]') return `exceptions ${JSON.stringify(excs)}`;
  const except = r.steps.find((s) => s.tryFlow?.kind === 'except').tryFlow;
  if (except.as !== 'e' || except.message !== 'negative: -1') return `except card ${JSON.stringify(except)}`;
  // try / finally：finally 之後繼續往外拋，不是「回傳 undefined」
  const g = traceJs(code, 'g("{")');
  const fin = g.steps.find((s) => s.tryFlow?.kind === 'finally')?.tryFlow;
  if (g.error?.type !== 'SyntaxError' || !fin?.reraise || g.steps.some((s) => s.event === 'return')) return `try / finally ${JSON.stringify({ error: g.error, fin })}`;
  const route = g.steps.find((s) => s.exc)?.exc;
  if (route?.outcome.kind !== 'uncaught' || route.route[0]?.finally !== 21) return `route ${JSON.stringify(route)}`;
});

check('built-in methods are explained item by item', () => {
  const code = `function f(nums, words) {
    const total = nums.reduce((acc, x) => acc + x, 0);
    const best = Math.max(...nums);
    nums.sort((a, b) => a - b);
    const byStr = [10, 9, 1].toSorted();
    const big = nums.some(x => x > 3);
    const s = words.join("-");
    const uniq = new Set(nums);
    const odd = nums.filter(x => x % 2 === 1);
    return total;
}`;
  const r = traceJs(code, 'f([3, 1, 4, 1, 5], ["ab", "abc", "a"])');
  const b = Object.fromEntries(r.steps.flatMap((s) => (s.builtins ?? []).map((x) => [x.label, x])));
  if (JSON.stringify(b.reduce?.running) !== '["3","4","8","9","14"]' || b.reduce.init !== '0') return `reduce ${JSON.stringify(b.reduce)}`;
  if (b['Math.max']?.pick !== 4) return `Math.max ${JSON.stringify(b['Math.max'])}`;
  if (JSON.stringify(b.sort?.order) !== '[1,3,0,2,4]' || b.sort.target !== 'nums') return `sort ${JSON.stringify(b.sort)}`;
  if (!b.toSorted?.byString || b.toSorted.result !== '[1, 10, 9]') return `toSorted ${JSON.stringify(b.toSorted)}`;
  if (b.some?.stop !== 3 || JSON.stringify(b.some.truth) !== '[false,false,false,true]') return `some ${JSON.stringify(b.some)}`;
  if (b.join?.result !== '"ab-abc-a"') return `join ${JSON.stringify(b.join)}`;
  if (JSON.stringify(b['new Set']?.kept) !== '[true,false,true,true,true]') return `new Set ${JSON.stringify(b['new Set'])}`;
  if (b.filter?.result !== '[1, 1, 3, 5]') return `filter ${JSON.stringify(b.filter)}`;
});

// ─────────────── JavaScript 教學範例：回傳值依前端 jsFormat 的規則格式化後，等於 expected ───────────────

console.log('\nJavaScript tutorial examples');
const examples = loadJsExamples();
for (const ex of examples) {
  check(`${ex.key} (${ex.file})`, () => {
    const r = traceJs(ex.code, ex.call);
    if (r.error) return r.error.message;
    if (r.steps.length >= MAX_STEPS) return `${r.steps.length} steps — keep tutorial examples under ${MAX_STEPS}`;
    const got = fmt(r.returnValue, r.returnHeap);
    return got === ex.expected ? null : `expected ${ex.expected}, got ${got}`;
  });
}
check('JavaScript tutorial examples were found', () => (examples.length ? null : 'no JavaScript examples in src/tutorials'));

const failed = results.filter((ok) => !ok).length;
console.log(`\n${failed ? 'FAILED' : 'PASSED'}: ${results.length - failed}/${results.length} checks`);
process.exit(failed ? 1 : 0);

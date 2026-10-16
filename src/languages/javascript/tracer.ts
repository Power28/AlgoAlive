/**
 * JavaScript 追蹤器：輸出與 Python 追蹤器相同格式的 TraceResult。
 *
 * 做法：用 Acorn 解析使用者程式碼，在原始碼中插入記錄用的呼叫（插樁），再執行插樁後的程式。
 * - 函式內每個敘述之前：__rt.step(行號, 可見變數的 getter)。if / while / for 的條件、switch 的值
 *   改成 (__rt.step(...), 條件)，每次重新檢查條件時都記錄一步（與 Python 的 line 事件相同）
 * - 函式本體：__rt.enter(...) 進入；return x 改成 return __rt.ret(行號, x)；
 *   catch 記錄例外後重新拋出；finally 離開（沒有 return 時記錄回傳 undefined）
 * - 只追蹤使用者函式內部；最外層（定義函式、class）與運算式本體的箭頭函式（例如排序的比較函式）不產生步驟
 *
 * 這個檔案不依賴 DOM，可以在 Web Worker 與 Node（scripts/check_js.mjs）中執行。
 */
import { parse } from 'acorn';
import type { CallHint, CallInfo, ExecutionStep, Heap, StackFrame, TraceResult, Value } from '../../types';
import { Ctx, Registry, inspect, ser, short } from './serialize.ts';
import { Analyzer, CardBuilder, Thunks, loopTotal, type LoopSpec, type Read, type StepSpec, type TrySpec } from './cards.ts';
import type { ExcFlow, TryFlow } from '../../types';

/** 預設的步數上限；到達上限後使用者可以選擇追蹤更多步 */
export const MAX_STEPS = 500;
/** 最多能追蹤的步數 */
export const MAX_STEPS_LIMIT = 5000;
const MAX_STDOUT = 10000;

// Acorn 的 AST 節點：這裡只讀取 ESTree 的欄位
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

// ─────────────────────────────── 插樁 ───────────────────────────────

interface Insert {
  pos: number;
  text: string;
  /** 同一位置的順序：先放「結束」再放「開始」；結束時內層先、開始時外層先 */
  kind: 0 | 1;
  depth: number;
}

interface Scope {
  names: Set<string>;
  fn: boolean;
}

/** 宣告中的所有識別字（含解構） */
function patternNames(p: N, out: string[] = []): string[] {
  if (!p) return out;
  switch (p.type) {
    case 'Identifier':
      out.push(p.name);
      break;
    case 'ObjectPattern':
      for (const prop of p.properties) patternNames(prop.type === 'RestElement' ? prop.argument : prop.value, out);
      break;
    case 'ArrayPattern':
      for (const el of p.elements) patternNames(el, out);
      break;
    case 'RestElement':
      patternNames(p.argument, out);
      break;
    case 'AssignmentPattern':
      patternNames(p.left, out);
      break;
  }
  return out;
}

const isFunction = (n: N) => n && (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');

/** 函式中以 var 宣告（會提升到整個函式）的名稱；不進入巢狀函式 */
function hoistedVars(body: N, out: Set<string>) {
  const visit = (n: N) => {
    if (!n || typeof n.type !== 'string' || isFunction(n)) return;
    if (n.type === 'VariableDeclaration' && n.kind === 'var') for (const d of n.declarations) patternNames(d.id).forEach((x) => out.add(x));
    for (const key of Object.keys(n)) {
      const v = n[key];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v.type === 'string' && key !== 'loc') visit(v);
    }
  };
  visit(body);
}

/** 區塊中直接宣告的 let / const / class / function */
function blockNames(stmts: N[]): string[] {
  const out: string[] = [];
  for (const s of stmts) {
    if (s.type === 'VariableDeclaration' && s.kind !== 'var') for (const d of s.declarations) patternNames(d.id, out);
    else if ((s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') && s.id) out.push(s.id.name);
  }
  return out;
}

/** 函式本體中出現的識別字（屬性名稱不算） */
function identifiers(body: N): Set<string> {
  const out = new Set<string>();
  const visit = (n: N, parent: N, key: string) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'Identifier') {
      const isProp = parent && ((parent.type === 'MemberExpression' && key === 'property' && !parent.computed) || (parent.type === 'Property' && key === 'key' && !parent.computed));
      if (!isProp) out.add(n.name);
      return;
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((x) => visit(x, n, k));
      else if (v && typeof v.type === 'string') visit(v, n, k);
    }
  };
  visit(body, null, '');
  return out;
}

function usesThis(body: N): boolean {
  let found = false;
  const visit = (n: N) => {
    if (found || !n || typeof n.type !== 'string') return;
    if (n.type === 'ThisExpression') {
      found = true;
      return;
    }
    // 一般函式有自己的 this；箭頭函式沿用外層的 this
    if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression') return;
    for (const key of Object.keys(n)) {
      const v = n[key];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v.type === 'string' && key !== 'loc') visit(v);
    }
  };
  visit(body);
  return found;
}

export interface Instrumented {
  code: string;
  /** 每個記錄點的說明卡片規格（__rt.step 的第三個參數是這裡的索引） */
  specs: StepSpec[];
  /** 所有 try 敘述（例外流程卡片用） */
  tries: TrySpec[];
  /** 最外層可以當成測試入口的函式 / 類別（依出現順序） */
  entries: EntryDef[];
}

export interface EntryDef {
  name: string;
  kind: 'function' | 'class';
  params: string[];
  /** JSDoc 的 @param 型別，例如 { head: 'ListNode' } */
  types: Record<string, string>;
}

const JSDOC_PARAM = /@param\s+\{([^}]*)\}\s+\[?([A-Za-z_$][\w$]*)/g;

export function instrument(source: string): Instrumented {
  const comments: { end: number; value: string }[] = [];
  const ast = parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'script',
    locations: true,
    allowReturnOutsideFunction: false,
    onComment: (block: boolean, text: string, _start: number, end: number) => {
      if (block) comments.push({ end, value: text });
    },
  }) as N;

  const inserts: Insert[] = [];
  const add = (pos: number, text: string, kind: 0 | 1, depth: number) => inserts.push({ pos, text, kind, depth });
  const scopes: Scope[] = [];
  let depth = 0;
  // 目前所在函式的資訊（用 this 時多一個 getter）
  /** 目前所在函式：用 this 時多一個 getter；used 是函式本體中出現的識別字（判斷用到哪些外層變數） */
  const fnStack: { thisGetter: boolean; used: Set<string> }[] = [];

  const visibleGetters = (): string => {
    // 從所在函式往內：參數、外層區塊的變數在前，與宣告順序一致
    let start = scopes.length - 1;
    while (start > 0 && !scopes[start].fn) start--;
    const names: string[] = [];
    // 巢狀函式用到的外層函式變數（閉包，例如 quickSort 裡的 nums）：與 Python 相同一併顯示；最外層（全域）不算
    const used = fnStack.at(-1)?.used;
    if (used) for (let i = 1; i < start; i++) for (const n of scopes[i].names) if (used.has(n) && !names.includes(n)) names.push(n);
    for (let i = start; i < scopes.length; i++) for (const n of scopes[i].names) if (!names.includes(n)) names.push(n);
    const parts = names.map((n) => `[${JSON.stringify(n)},()=>${n}]`);
    if (fnStack.at(-1)?.thisGetter) parts.push(`["this",()=>this]`);
    return `[${parts.join(',')}]`;
  };
  const analyzer = new Analyzer(source);
  const specs: StepSpec[] = [];
  /** 記錄一步；有說明卡片時一併傳入規格編號與 thunk（在原本的作用域中求值子運算式） */
  const step = (line: number, spec?: StepSpec, tl?: Thunks) => {
    const getters = visibleGetters();
    if (!spec || !Object.keys(spec).length) return `__rt.step(${line},${getters})`;
    specs.push(spec);
    const thunks = `[${(tl?.codes ?? []).map((c) => `()=>(${c})`).join(',')}]`;
    return `__rt.step(${line},${getters},${specs.length - 1},${thunks})`;
  };

  /** try 敘述；tryStack 是目前所在的 try 區塊（同一個函式內，由外而內） */
  const tries: TrySpec[] = [];
  let tryStack: number[] = [];

  /** break / continue 的目標：由內而外的迴圈與 switch */
  const breakables: { node: N; label?: string; loop: boolean; line: number; src: string }[] = [];
  let pendingLabel: string | undefined;
  const loopHeader = (s: N) =>
    s.type === 'DoWhileStatement' ? `do … while (${analyzer.src(s.test)})` : source.slice(s.start, s.body.start).trim().replace(/\{$/, '').trim();
  const withBreakable = (s: N, loop: boolean, body: () => void) => {
    breakables.push({ node: s, label: pendingLabel, loop, line: s.loc.start.line, src: loop ? loopHeader(s) : '' });
    pendingLabel = undefined;
    body();
    breakables.pop();
  };

  /** 一般敘述的卡片：條件、計算、容器操作、解構交換、切片、break / continue */
  const stmtSpec = (s: N): [StepSpec, Thunks] => {
    const tl = new Thunks();
    const spec: StepSpec = {};
    const multi = analyzer.multi(s, tl);
    if (multi) spec.multi = multi;
    const cond = analyzer.valueCond(s, tl);
    if (cond) spec.cond = cond;
    else if (!multi) {
      const calc = analyzer.calc(s, tl);
      if (calc) spec.calc = calc;
    }
    const op = analyzer.op(s, tl);
    if (op) spec.op = op;
    const slices = analyzer.slices(s, tl);
    if (slices.length) spec.slices = slices;
    const builtins = analyzer.builtins(s, tl);
    if (builtins.length) spec.builtins = builtins;
    if (s.type === 'BreakStatement' || s.type === 'ContinueStatement') {
      const target = s.label
        ? breakables.find((b) => b.label === s.label.name)
        : [...breakables].reverse().find((b) => b.loop || s.type === 'BreakStatement');
      if (target?.loop) spec.jump = { kind: s.type === 'BreakStatement' ? 'break' : 'continue', loopLine: target.line, loopSrc: target.src };
    }
    return [spec, tl];
  };

  /** 迴圈 / if 的條件：條件卡片，迴圈另外記錄圈數 */
  const testSpec = (test: N, loop: N | null): [StepSpec, Thunks] => {
    const tl = new Thunks();
    const spec: StepSpec = {};
    if (test) {
      spec.cond = analyzer.cond(test, 'test', tl);
      const builtins = analyzer.builtins(test, tl);
      if (builtins.length) spec.builtins = builtins;
    }
    if (loop) spec.loop = analyzer.loop(loop, tl);
    return [spec, tl];
  };

  /** 非區塊的單一敘述（if (x) return y;）先包上大括號，才能在前面插入記錄 */
  const ensureBlock = (stmt: N) => {
    if (stmt.type !== 'BlockStatement') {
      add(stmt.start, '{', 1, depth);
      add(stmt.end, '}', 0, depth);
    }
  };

  const functionName = (fn: N, parent: N): string => {
    if (fn.id?.name) return fn.id.name;
    if (!parent) return 'anonymous';
    if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') return parent.id.name;
    if (parent.type === 'AssignmentExpression') {
      const left = parent.left;
      if (left.type === 'Identifier') return left.name;
      if (left.type === 'MemberExpression' && !left.computed) return left.property.name;
    }
    if ((parent.type === 'Property' || parent.type === 'PropertyDefinition') && parent.key?.type === 'Identifier') return parent.key.name;
    return 'anonymous';
  };

  const visitFunction = (fn: N, name: string, ctor = false) => {
    if (fn.body.type !== 'BlockStatement') {
      // 運算式本體的箭頭函式（x => x * 2）：不產生步驟，但裡面的函式照樣處理
      visitExpr(fn.body);
      return;
    }
    const params = fn.params.flatMap((p: N) => patternNames(p));
    const fnScope: Scope = { names: new Set(params), fn: true };
    hoistedVars(fn.body, fnScope.names);
    for (const n of blockNames(fn.body.body)) fnScope.names.add(n);
    const thisGetter = fn.type !== 'ArrowFunctionExpression' && usesThis(fn.body);
    scopes.push(fnScope);
    fnStack.push({ thisGetter, used: identifiers(fn.body) });
    // 例外不會跨越函式邊界被同一個 try 接住：巢狀函式從空的 try 堆疊開始
    const outerTries = tryStack;
    tryStack = [];
    depth++;
    const args = `[${params.map((p: string) => `[${JSON.stringify(p)},()=>${p}]`).join(',')}]`;
    add(fn.body.start + 1, `__rt.enter(${JSON.stringify(name)},${fn.loc.start.line},${args},${thisGetter ? '()=>this' : 'undefined'}${ctor ? ',1' : ''});try{`, 1, depth);
    add(fn.body.end - 1, `}catch(__e){__rt.exc(__e);throw __e}finally{__rt.leave()}`, 0, depth);
    for (const s of fn.body.body) visitStmt(s);
    depth--;
    tryStack = outerTries;
    fnStack.pop();
    scopes.pop();
  };

  const visitStmts = (stmts: N[], scopeNames: string[]) => {
    scopes.push({ names: new Set(scopeNames), fn: false });
    for (const s of stmts) visitStmt(s);
    scopes.pop();
  };

  const inFunction = () => fnStack.length > 0;

  /** 條件 / 判斷值前面插入記錄：(__rt.step(...), 原本的運算式) */
  const wrapTest = (expr: N, line: number, spec?: [StepSpec, Thunks]) => {
    add(expr.start, `(${step(line, spec?.[0], spec?.[1])},`, 1, depth);
    add(expr.end, ')', 0, depth);
  };

  const visitStmt = (s: N) => {
    const line = s.loc.start.line;
    const traced = inFunction();
    switch (s.type) {
      case 'FunctionDeclaration':
        visitFunction(s, s.id?.name ?? 'anonymous');
        return;
      case 'ClassDeclaration':
        visitClass(s);
        return;
      case 'BlockStatement':
        visitStmts(s.body, blockNames(s.body));
        return;
      case 'IfStatement': {
        if (traced) wrapTest(s.test, line, testSpec(s.test, null));
        visitExpr(s.test);
        ensureBlock(s.consequent);
        visitBody(s.consequent);
        if (s.alternate) {
          if (s.alternate.type === 'IfStatement') visitStmt(s.alternate);
          else {
            ensureBlock(s.alternate);
            visitBody(s.alternate);
          }
        }
        return;
      }
      case 'WhileStatement':
        if (traced) wrapTest(s.test, line, testSpec(s.test, s));
        visitExpr(s.test);
        ensureBlock(s.body);
        withBreakable(s, true, () => visitBody(s.body));
        return;
      case 'DoWhileStatement':
        ensureBlock(s.body);
        withBreakable(s, true, () => visitBody(s.body));
        if (traced) wrapTest(s.test, s.test.loc.start.line, testSpec(s.test, null));
        visitExpr(s.test);
        return;
      case 'ForStatement': {
        const names = s.init?.type === 'VariableDeclaration' && s.init.kind !== 'var' ? s.init.declarations.flatMap((d: N) => patternNames(d.id)) : [];
        scopes.push({ names: new Set(names), fn: false });
        if (s.init) visitExpr(s.init.type === 'VariableDeclaration' ? s.init : s.init);
        ensureBlock(s.body);
        if (traced) {
          if (s.test) wrapTest(s.test, line, testSpec(s.test, s));
          // 沒有條件的 for(;;)：在本體開頭記錄
          else {
            const [spec, tl] = testSpec(null, s);
            add(s.body.type === 'BlockStatement' ? s.body.start + 1 : s.body.start, `;${step(line, spec, tl)};`, 1, depth + 1);
          }
        }
        if (s.test) visitExpr(s.test);
        if (s.update) visitExpr(s.update);
        withBreakable(s, true, () => visitBody(s.body));
        scopes.pop();
        return;
      }
      case 'ForOfStatement':
      case 'ForInStatement': {
        const names = s.left.type === 'VariableDeclaration' ? s.left.declarations.flatMap((d: N) => patternNames(d.id)) : [];
        scopes.push({ names: new Set(names), fn: false });
        visitExpr(s.right);
        ensureBlock(s.body);
        // 每一圈開始時記錄 header 這一行（迴圈變數已經是這一圈的值）
        if (traced) {
          const [spec, tl] = testSpec(null, s);
          add(s.body.type === 'BlockStatement' ? s.body.start + 1 : s.body.start, `;${step(line, spec, tl)};`, 1, depth + 1);
        }
        withBreakable(s, true, () => visitBody(s.body));
        scopes.pop();
        return;
      }
      case 'SwitchStatement':
        if (traced) wrapTest(s.discriminant, line);
        visitExpr(s.discriminant);
        scopes.push({ names: new Set(blockNames(s.cases.flatMap((c: N) => c.consequent))), fn: false });
        withBreakable(s, false, () => {
          for (const c of s.cases) {
            if (c.test) visitExpr(c.test);
            for (const x of c.consequent) visitStmt(x);
          }
        });
        scopes.pop();
        return;
      case 'TryStatement': {
        const h = s.handler;
        const id = tries.length;
        const spec: TrySpec = { line, end: s.loc.end.line, parent: tryStack.at(-1) ?? null };
        if (h) {
          spec.catchLine = h.loc.start.line;
          spec.catchSrc = h.param ? `catch (${analyzer.src(h.param)})` : 'catch';
          if (h.param?.type === 'Identifier') spec.param = h.param.name;
        }
        if (s.finalizer) spec.finallyLine = s.finalizer.loc.start.line;
        tries.push(spec);
        // try 這一行：說明如果出錯會跳到哪裡
        if (traced) {
          const flow: TryFlow = { kind: 'try', handlers: h ? [spec.catchSrc!] : [], finally: spec.finallyLine ?? null };
          add(s.start, `;${step(line, { tryFlow: flow })};`, 1, depth);
        }
        tryStack.push(id);
        visitStmt(s.block);
        tryStack.pop();
        if (h) {
          if (!h.param) add(h.body.start, '(__e)', 1, depth);
          // 例外被接住：記錄例外與 catch 這一行（使用者的 catch 也不能吞掉「超過步數上限」的中止訊號）
          const errName = h.param?.type === 'Identifier' ? h.param.name : h.param ? null : '__e';
          if (errName) {
            const catchStep = traced ? `${step(spec.catchLine!, { tryFlow: { kind: 'except', tryId: id } })};` : '';
            add(h.body.start + 1, `__rt.caught(${errName},${id});${catchStep}`, 1, depth + 1);
          }
          visitStmts(h.body.body, [...patternNames(h.param), ...blockNames(h.body.body)]);
        } else if (s.finalizer && traced) {
          // try / finally：例外經過時先記錄再原樣丟出（行為不變）
          add(s.block.end, `catch(__x){__rt.passing(__x,${id});throw __x}`, 1, depth);
        }
        if (s.finalizer) {
          if (traced) add(s.finalizer.start + 1, `;${step(spec.finallyLine!, { tryFlow: { kind: 'finally', tryId: id } })};`, 1, depth + 1);
          visitStmt(s.finalizer);
        }
        return;
      }
      case 'LabeledStatement':
        pendingLabel = s.label.name;
        visitStmt(s.body);
        pendingLabel = undefined;
        return;
      case 'ReturnStatement':
        if (inFunction()) {
          if (traced) {
            const [spec, tl] = stmtSpec(s);
            add(s.start, `;${step(line, spec, tl)};`, 1, depth);
          }
          if (s.argument) {
            add(s.argument.start, `__rt.ret(${line},`, 1, depth);
            add(s.argument.end, ')', 0, depth);
          } else add(s.start + 'return'.length, ` __rt.ret(${line},undefined)`, 1, depth);
        }
        if (s.argument) visitExpr(s.argument);
        return;
      case 'EmptyStatement':
        return;
      default:
        // ExpressionStatement、VariableDeclaration、throw、break、continue…
        if (traced) {
          const [spec, tl] = stmtSpec(s);
          add(s.start, `;${step(line, spec, tl)};`, 1, depth);
        }
        visitExpr(s);
        return;
    }
  };

  /** 迴圈 / if 的本體（已確保是區塊） */
  const visitBody = (body: N) => {
    if (body.type === 'BlockStatement') visitStmts(body.body, blockNames(body.body));
    else visitStmts([body], blockNames([body]));
  };

  const visitClass = (cls: N) => {
    if (cls.superClass) visitExpr(cls.superClass);
    for (const m of cls.body.body) {
      if (m.type === 'MethodDefinition') {
        const name = m.kind === 'constructor' ? (cls.id?.name ?? 'constructor') : m.key.type === 'Identifier' ? m.key.name : 'method';
        visitFunction(m.value, name, m.kind === 'constructor');
      } else if (m.type === 'PropertyDefinition' && m.value) visitExpr(m.value, m);
    }
  };

  /** 運算式中的函式（function、箭頭函式、class） */
  const visitExpr = (n: N, parent: N = null) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') {
      visitFunction(n, functionName(n, parent));
      return;
    }
    if (n.type === 'ClassExpression') {
      visitClass(n);
      return;
    }
    for (const key of Object.keys(n)) {
      if (key === 'loc') continue;
      const v = n[key];
      if (Array.isArray(v)) v.forEach((x) => visitExpr(x, n));
      else if (v && typeof v.type === 'string') visitExpr(v, n);
    }
  };

  scopes.push({ names: new Set(), fn: true });
  for (const s of ast.body) visitStmt(s);

  // 由後往前套用插入，位置才不會跑掉
  inserts.sort((a, b) => a.pos - b.pos || a.kind - b.kind || (a.kind === 0 ? b.depth - a.depth : a.depth - b.depth));
  let out = '';
  let last = 0;
  for (const ins of inserts) {
    out += source.slice(last, ins.pos) + ins.text;
    last = ins.pos;
  }
  out += source.slice(last);

  return { code: out, specs, tries, entries: findEntries(ast, comments) };
}

/** 最外層的函式、指定成函式的變數、類別，以及前面 JSDoc 的參數型別 */
function findEntries(ast: N, comments: { end: number; value: string }[]): EntryDef[] {
  const docFor = (start: number) => {
    const before = comments.filter((c) => c.end <= start).at(-1);
    const types: Record<string, string> = {};
    if (before && /^\s*\*/.test(before.value)) for (const m of before.value.matchAll(JSDOC_PARAM)) types[m[2]] = m[1].trim();
    return types;
  };
  const out: EntryDef[] = [];
  for (const s of ast.body) {
    if (s.type === 'FunctionDeclaration' && s.id) {
      out.push({ name: s.id.name, kind: 'function', params: s.params.flatMap((p: N) => patternNames(p).slice(0, 1)), types: docFor(s.start) });
    } else if (s.type === 'ClassDeclaration' && s.id) {
      out.push({ name: s.id.name, kind: 'class', params: [], types: {} });
    } else if (s.type === 'VariableDeclaration') {
      for (const d of s.declarations) {
        if (d.id.type === 'Identifier' && isFunction(d.init)) {
          out.push({ name: d.id.name, kind: 'function', params: d.init.params.flatMap((p: N) => patternNames(p).slice(0, 1)), types: docFor(s.start) });
        } else if (d.id.type === 'Identifier' && d.init?.type === 'ClassExpression') {
          out.push({ name: d.id.name, kind: 'class', params: [], types: {} });
        }
      }
    }
  }
  return out;
}

// ─────────────────────────────── 執行期 ───────────────────────────────

type Getters = [string, () => unknown][];

interface ActiveLoop {
  spec: LoopSpec;
  count: number;
  total?: number;
  done?: boolean;
}

interface Frame {
  /** 由外而內正在進行的迴圈 */
  loops: ActiveLoop[];
  func: string;
  line: number;
  args: [string, string][];
  getters: Getters;
  thisGetter?: () => unknown;
  entered: boolean;
  returned: boolean;
  raised: boolean;
  /** 不記錄步驟的建構子（演算法中途 new 出來的物件） */
  silent?: boolean;
  /** 這個 frame 已經記錄過的例外（同一個例外一路經過 finally、catch 只記一次） */
  excRecorded?: unknown;
  /** 目前處理中的例外：經過哪些 try、被哪個 catch 接住 */
  pending?: { error: unknown; route: number[]; catcher: number | null; caught: boolean };
}

/** 步數超過上限時的中止訊號（使用者的 catch 會重新拋出它） */
class StopSignal extends Error {}

export class JsRuntime {
  maxSteps = MAX_STEPS;
  steps: ExecutionStep[] = [];
  stdout = '';
  private frames: Frame[] = [];
  private registry = new Registry();
  /** 每個記錄點的說明卡片規格（由 instrument 產生） */
  specs: StepSpec[] = [];
  tries: TrySpec[] = [];
  /** 設計題：目前第幾個操作與已完成的輸出 */
  design: { index: number; outputs: string[] } | null = null;
  enabled = false;
  /** 演算法中途 new 出來的物件：建構子不記錄步驟（與 Python 不追蹤 TrieNode() 的 __init__ 相同） */
  private muted = 0;
  private get active() {
    return this.enabled && this.muted === 0;
  }
  lastLine: number | null = null;

  console = {
    log: (...args: unknown[]) => {
      if (this.stdout.length < MAX_STDOUT) this.stdout += `${args.map((a) => inspect(a)).join(' ')}\n`;
    },
  };

  /** build：與變數共用同一個 heap 的額外欄位（說明卡片） */
  private record(event: ExecutionStep['event'], extra: Partial<ExecutionStep> = {}, build?: (ctx: Ctx) => Partial<ExecutionStep>) {
    if (this.steps.length >= this.maxSteps) throw new StopSignal();
    const ctx = new Ctx(this.registry);
    const frame = this.frames.at(-1)!;
    const variables: Record<string, Value> = {};
    const read = (getters: Getters, thisGetter?: () => unknown) => {
      const out: [string, unknown][] = [];
      for (const [name, get] of getters) {
        if (name === 'this') continue;
        try {
          const v = get();
          if (typeof v !== 'function') out.push([name, v]);
        } catch {
          // 暫時性死區（let 宣告之前）或不在範圍內：不顯示
        }
      }
      const self = thisGetter ?? getters.find(([n]) => n === 'this')?.[1];
      if (self) {
        try {
          const obj = self();
          // 設計題的狀態在 this 上：this.stack、this.cache…
          if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) if (typeof v !== 'function') out.push([`this.${k}`, v]);
        } catch {
          // 建構子中 super() 之前不能讀 this
        }
      }
      return out;
    };
    for (const [name, v] of read(frame.getters, frame.thisGetter)) variables[name] = ser(v, ctx);
    // 外層呼叫中指向節點的變數：遞迴時整棵樹仍畫得出來，並標出遞迴路徑
    const stackRefs: { depth: number; name: string; id: string }[] = [];
    this.frames.slice(0, -1).forEach((f, i) => {
      for (const [name, v] of read(f.getters, f.thisGetter)) {
        const s = ser(v, ctx);
        if (s.type === 'ref') stackRefs.push({ depth: i + 1, name, id: s.id });
      }
    });
    const step: ExecutionStep = {
      stepIndex: this.steps.length,
      lineNumber: frame.line,
      event,
      funcName: frame.func,
      depth: this.frames.length,
      variables,
      stdout: this.stdout.slice(0, MAX_STDOUT),
      stack: this.frames.map((f): StackFrame => ({ func: f.func, line: f.line, args: f.args })),
      ...extra,
    };
    if (stackRefs.length) step.stackRefs = stackRefs;
    if (event === 'line' && !frame.entered) {
      frame.entered = true;
      step.entered = true;
    }
    if (this.design) step.design = { index: this.design.index, outputs: [...this.design.outputs] };
    if (extra.returnValue === undefined && 'returnValue' in extra) delete step.returnValue;
    if (build) Object.assign(step, build(ctx));
    const heap = ctx.drain();
    if (Object.keys(heap).length) step.heap = heap;
    this.steps.push(step);
  }

  /** 把 extra 中的回傳值序列化（需要和變數共用同一個 heap） */
  private recordReturn(value: unknown) {
    const ctx = new Ctx(this.registry);
    const ret = ser(value, ctx);
    const before = this.steps.length;
    this.record('return', { returnValue: ret });
    const extra = ctx.drain();
    const step = this.steps[before];
    if (step && Object.keys(extra).length) step.heap = { ...(step.heap ?? {}), ...extra };
  }

  step(line: number, getters: Getters, specIndex?: number, thunks?: (() => unknown)[]) {
    if (!this.active) return;
    const frame = this.frames.at(-1);
    if (!frame) return;
    frame.getters = getters;
    frame.line = line;
    this.lastLine = line;
    // 已經離開的迴圈（目前這一行不在迴圈範圍內）
    frame.loops = frame.loops.filter((l) => line >= l.spec.start && line <= l.spec.end);
    // 已經離開處理例外的 try：之前的例外不再相關
    if (frame.pending) {
      const outer = this.tries[frame.pending.route.at(-1) ?? -1];
      if (!outer || line < outer.line || line > outer.end) frame.pending = undefined;
    }
    const spec = specIndex === undefined ? undefined : this.specs[specIndex];
    // 子運算式的值：每個 thunk 只求值一次，失敗（null 的屬性、暫時性死區…）就當成無法得知
    const cache = new Map<number, { ok: boolean; v: unknown }>();
    const read: Read = (th) => {
      let r = cache.get(th);
      if (!r) {
        try {
          r = { ok: true, v: thunks![th]() };
        } catch {
          r = { ok: false, v: undefined };
        }
        cache.set(th, r);
      }
      return r;
    };
    if (spec?.loop) {
      const active = frame.loops.find((l) => l.spec.line === spec.loop!.line);
      if (active) active.count++;
      else frame.loops.push({ spec: spec.loop, count: 1, total: loopTotal(spec.loop, read) });
    }
    this.record('line', {}, (ctx) => {
      const out: Partial<ExecutionStep> = {};
      if (spec) {
        const cards = new CardBuilder(read, ctx, this.registry);
        if (spec.cond) out.condition = cards.condition(spec.cond);
        if (spec.calc) {
          const calc = cards.calc(spec.calc);
          if (calc) out.calc = calc;
        }
        if (spec.op) {
          const op = cards.op(spec.op);
          if (op) out.op = op;
        }
        if (spec.multi) {
          const multi = cards.multi(spec.multi);
          if (multi) out.multi = multi;
        }
        if (spec.slices) {
          const slices = cards.slices(spec.slices);
          if (slices.length) out.slices = slices;
        }
        if (spec.jump) out.jump = spec.jump;
        if (spec.builtins) {
          const calls = cards.builtins(spec.builtins);
          if (calls.length) out.builtins = calls;
        }
        if (spec.tryFlow) {
          const flow = this.tryFlow(frame, spec.tryFlow);
          if (flow) out.tryFlow = flow;
        }
        // 迴圈條件為 false：最後一次檢查，迴圈即將結束
        if (spec.loop && out.condition?.result === false) {
          const active = frame.loops.find((l) => l.spec.line === spec.loop!.line);
          if (active) active.done = true;
        }
      }
      if (frame.loops.length) {
        out.loops = frame.loops.map((l) => {
          const info: NonNullable<ExecutionStep['loops']>[number] = { line: l.spec.line, kind: l.spec.kind, src: l.spec.src, iteration: l.count };
          if (l.total !== undefined) info.total = l.total;
          if (l.done || (l.total !== undefined && l.count > l.total)) info.done = true;
          if (l.spec.seq) info.seq = l.spec.seq;
          if (l.spec.item) info.item = l.spec.item;
          return info;
        });
      }
      return out;
    });
  }

  enter(func: string, line: number, params: Getters, thisGetter?: () => unknown, ctor?: number) {
    // 建構子在使用者的函式裡被呼叫（例如 insert 裡的 new TrieNode()）：這一層與它呼叫的函式都不記錄
    const silent = !!ctor && this.frames.length > 0;
    if (silent) this.muted++;
    if (!this.active) {
      this.frames.push({ func, line, args: [], getters: [], loops: [], entered: true, returned: false, raised: false, silent });
      return;
    }
    const args: [string, string][] = [];
    for (const [name, get] of params) {
      try {
        args.push([name, short(get())]);
      } catch {
        // 參數預設值中的 TDZ 之類：略過
      }
    }
    this.frames.push({ func, line, args, getters: params, thisGetter, loops: [], entered: false, returned: false, raised: false });
  }

  ret<T>(line: number, value: T): T {
    const frame = this.frames.at(-1);
    if (this.active && frame) {
      frame.line = line;
      frame.returned = true;
      this.recordReturn(value);
    }
    return value;
  }

  /** 從 tryId 開始由內往外：經過的 try，直到第一個有 catch 的 */
  private route(tryId: number | null): { ids: number[]; catcher: number | null } {
    const ids: number[] = [];
    for (let t = tryId; t !== null; t = this.tries[t].parent) {
      ids.push(t);
      if (this.tries[t].catchLine !== undefined) return { ids, catcher: t };
    }
    return { ids, catcher: null };
  }

  /** 例外發生：記錄一次「例外」步驟（經過的 try、被哪裡接住或往外拋） */
  private recordExc(frame: Frame, e: unknown, tryId: number | null) {
    const { ids, catcher } = this.route(tryId);
    frame.pending = { error: e, route: ids, catcher, caught: false };
    frame.raised = catcher === null;
    if (frame.excRecorded === e) return;
    frame.excRecorded = e;
    if (!this.active) return;
    const flow: ExcFlow = {
      type: e instanceof Error ? e.name : 'Uncaught',
      message: e instanceof Error ? e.message : short(e, 40),
      route: ids.map((t) => {
        const spec = this.tries[t];
        const caughtHere = t === catcher;
        return {
          line: spec.line,
          handlers: spec.catchLine !== undefined ? [{ line: spec.catchLine, src: spec.catchSrc!, match: true }] : [],
          finally: caughtHere ? null : (spec.finallyLine ?? null),
        };
      }),
      outcome: { kind: 'uncaught' },
    };
    if (catcher !== null) flow.outcome = { kind: 'caught', line: this.tries[catcher].catchLine! };
    else {
      const caller = this.frames.at(-2);
      if (caller) flow.outcome = { kind: 'propagate', func: caller.func, line: caller.line };
    }
    this.record('exception', { exception: describe(e), exc: flow });
  }

  /** 例外離開函式（函式外層的 catch） */
  exc(e: unknown) {
    const frame = this.frames.at(-1);
    if (!frame || e instanceof StopSignal) return;
    if (frame.excRecorded === e) {
      frame.raised = true;
      return;
    }
    if (frame.raised) return;
    this.recordExc(frame, e, null);
  }

  /** 例外經過沒有 catch 的 try（try / finally） */
  passing(e: unknown, tryId: number) {
    const frame = this.frames.at(-1);
    if (!frame || e instanceof StopSignal) return;
    this.recordExc(frame, e, tryId);
  }

  /** 例外被 catch 接住 */
  caught(e: unknown, tryId: number) {
    if (e instanceof StopSignal) throw e;
    const frame = this.frames.at(-1);
    if (!frame) return;
    if (frame.excRecorded !== e) this.recordExc(frame, e, tryId);
    frame.pending = { ...(frame.pending ?? { route: [tryId] }), error: e, catcher: tryId, caught: true };
    frame.raised = false;
  }

  /** try / catch / finally 這幾行的說明卡片 */
  private tryFlow(frame: Frame, flow: NonNullable<StepSpec['tryFlow']>): TryFlow | null {
    if (flow.kind === 'try') {
      frame.pending = undefined;
      return flow;
    }
    const spec = this.tries[flow.tryId];
    const pending = frame.pending;
    if (flow.kind === 'except') {
      const e = pending?.error;
      const info: TryFlow = {
        kind: 'except',
        src: spec.catchSrc ?? 'catch',
        type: e instanceof Error ? e.name : 'Uncaught',
        message: e instanceof Error ? e.message : short(e, 40),
        match: true,
      };
      if (spec.param) info.as = spec.param;
      return info;
    }
    if (pending && pending.route.includes(flow.tryId)) {
      const e = pending.error;
      return {
        kind: 'finally',
        exc: describe(e),
        // 不是接住它的那個 try，或還沒被 catch 處理：finally 結束後例外繼續往外拋
        reraise: !(pending.caught && pending.catcher === flow.tryId),
      };
    }
    return { kind: 'finally' };
  }

  leave() {
    const frame = this.frames.at(-1);
    if (frame?.silent) {
      this.frames.pop();
      this.muted--;
      return;
    }
    if (frame && this.active && !frame.returned && !frame.raised) {
      // 沒有 return 就結束：回傳 undefined
      frame.returned = true;
      try {
        this.recordReturn(undefined);
      } finally {
        this.frames.pop();
      }
      return;
    }
    this.frames.pop();
  }

  guard(e: unknown) {
    if (e instanceof StopSignal) throw e;
  }

  /** 與步驟共用同一組物件 id 的序列化（最後的回傳值） */
  serialize(v: unknown): { value: Value; heap: Heap } {
    const ctx = new Ctx(this.registry);
    const value = ser(v, ctx);
    return { value, heap: ctx.drain() };
  }

  isStop(e: unknown) {
    return e instanceof StopSignal;
  }
}

function describe(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return `Uncaught ${short(e, 40)}`;
}

// ─────────────────────────────── 預先定義 ───────────────────────────────

/** 與 LeetCode 的 JavaScript 環境相同的節點定義與建立測資的輔助函式 */
const PRELUDE = `
function ListNode(val, next) { this.val = (val === undefined ? 0 : val); this.next = (next === undefined ? null : next); }
function TreeNode(val, left, right) { this.val = (val === undefined ? 0 : val); this.left = (left === undefined ? null : left); this.right = (right === undefined ? null : right); }
function _Node(val, neighbors) { this.val = (val === undefined ? 0 : val); this.neighbors = (neighbors === undefined ? [] : neighbors); }
function buildList(values, pos = -1) {
  const dummy = new ListNode(0); let cur = dummy; const nodes = [];
  for (const v of values) { cur.next = new ListNode(v); cur = cur.next; nodes.push(cur); }
  if (pos >= 0 && pos < nodes.length) cur.next = nodes[pos];
  return dummy.next;
}
function buildTree(values) {
  if (!values.length || values[0] === null) return null;
  const root = new TreeNode(values[0]); const queue = [root]; let i = 1;
  while (queue.length && i < values.length) {
    const node = queue.shift();
    if (i < values.length && values[i] !== null) { node.left = new TreeNode(values[i]); queue.push(node.left); } i++;
    if (i < values.length && values[i] !== null) { node.right = new TreeNode(values[i]); queue.push(node.right); } i++;
  }
  return root;
}
function buildGraph(adj) {
  if (!adj.length) return null;
  const nodes = adj.map((_, i) => new _Node(i + 1));
  adj.forEach((ns, i) => { nodes[i].neighbors = ns.map((j) => nodes[j - 1]); });
  return nodes[0];
}
`;

// ─────────────────────────────── 測試呼叫 ───────────────────────────────

class CallHintError extends Error {
  hint: CallHint;
  constructor(hint: CallHint, message: string) {
    super(message);
    this.hint = hint;
  }
}

const LITERAL_IDS = new Set(['null', 'undefined', 'true', 'false', 'Infinity', 'NaN']);
const LITERAL_CALLS = new Set(['buildList', 'buildTree', 'buildGraph']);

/** 測資的值：常數、陣列、物件、負號、null、buildList(...) 這類建立測資的呼叫 */
function literalish(n: N): boolean {
  switch (n?.type) {
    case 'Literal':
      return true;
    case 'Identifier':
      return LITERAL_IDS.has(n.name);
    case 'ArrayExpression':
      return n.elements.every((e: N) => e === null || literalish(e));
    case 'ObjectExpression':
      return n.properties.every((p: N) => p.type === 'Property' && !p.computed && literalish(p.value));
    case 'UnaryExpression':
      return (n.operator === '-' || n.operator === '+') && literalish(n.argument);
    case 'CallExpression':
      return n.callee.type === 'Identifier' && LITERAL_CALLS.has(n.callee.name) && n.arguments.every(literalish);
    case 'TemplateLiteral':
      return n.expressions.length === 0;
    default:
      return false;
  }
}

type Parsed =
  | { form: 'call'; node: N }
  | { form: 'keywords'; pairs: [string, N][] }
  | { form: 'positional'; values: N[] }
  | { form: 'design'; ops: string[]; args: N[] }
  | null;

function parseCall(text: string): Parsed {
  let program: N;
  try {
    program = parse(text, { ecmaVersion: 'latest', sourceType: 'script' });
  } catch {
    // [2,7,11,15] 換行 9 以外的多行寫法：接成逗號再試
    try {
      program = parse(text.replace(/\s*\n\s*/g, ', '), { ecmaVersion: 'latest', sourceType: 'script' });
    } catch {
      return null;
    }
  }
  const exprs: N[] = program.body.every((s: N) => s.type === 'ExpressionStatement') ? program.body.map((s: N) => s.expression) : [];
  if (!exprs.length) return null;
  // 設計題：["MinStack","push"] 與 [[],[1]]
  const lists = exprs.length === 1 && exprs[0].type === 'SequenceExpression' ? exprs[0].expressions : exprs;
  if (
    lists.length === 2 &&
    lists.every((e: N) => e.type === 'ArrayExpression') &&
    lists[0].elements.length > 0 &&
    lists[0].elements.every((e: N) => e?.type === 'Literal' && typeof e.value === 'string') &&
    lists[1].elements.every((e: N) => e?.type === 'ArrayExpression')
  ) {
    return { form: 'design', ops: lists[0].elements.map((e: N) => e.value), args: lists[1].elements };
  }
  // ["MinStack","push"][[],[1]]（兩行貼進單行輸入框）
  if (exprs.length === 1 && exprs[0].type === 'MemberExpression' && exprs[0].computed && exprs[0].object.type === 'ArrayExpression') {
    const ops = exprs[0].object;
    const prop = exprs[0].property;
    const argList = prop.type === 'SequenceExpression' ? prop.expressions : [prop];
    if (ops.elements.every((e: N) => e?.type === 'Literal' && typeof e.value === 'string') && argList.every((e: N) => e.type === 'ArrayExpression')) {
      return { form: 'design', ops: ops.elements.map((e: N) => e.value), args: argList };
    }
  }
  const flat = exprs.flatMap((e) => (e.type === 'SequenceExpression' ? e.expressions : [e]));
  if (flat.length === 1 && flat[0].type === 'CallExpression' && !literalish(flat[0])) return { form: 'call', node: flat[0] };
  // nums = [2,7,11,15], target = 9
  if (flat.every((e: N) => e.type === 'AssignmentExpression' && e.operator === '=' && e.left.type === 'Identifier' && literalish(e.right))) {
    return { form: 'keywords', pairs: flat.map((e: N) => [e.left.name, e.right]) };
  }
  if (flat.every(literalish)) return { form: 'positional', values: flat };
  return null;
}

const evalLiteral = (src: string, prelude: Record<string, unknown>) =>
  // 只會是 literalish 檢查過的值（常數、陣列、buildList(...)）
  new Function(...Object.keys(prelude), `return (${src});`)(...Object.values(prelude));

function closest(name: string, pool: string[]): string | undefined {
  const lower = pool.find((p) => p.toLowerCase() === name.toLowerCase());
  if (lower) return lower;
  let best: string | undefined;
  let bestScore = 0;
  for (const p of pool) {
    const score = similarity(name, p);
    if (score > bestScore) [best, bestScore] = [p, score];
  }
  return bestScore >= 0.6 ? best : undefined;
}

/** 兩個字串的相似度（0~1，與 difflib 的 ratio 類似） */
function similarity(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return (2 * dp[m][n]) / (m + n || 1);
}

/** 依 JSDoc 型別（或參數名稱）把陣列轉成鏈結串列 / 樹 / 圖 */
function convert(value: unknown, type: string, param: string, pos: unknown, prelude: Record<string, (...a: never[]) => unknown>) {
  if (!Array.isArray(value)) return { value, to: null };
  if (/ListNode/.test(type) || (!type && /^(head|l1|l2|list1|list2|headA|headB)$/.test(param))) {
    return { value: (prelude.buildList as (v: unknown[], p: number) => unknown)(value, typeof pos === 'number' ? pos : -1), to: 'ListNode' as const };
  }
  if (/TreeNode/.test(type) || (!type && /^(root|root1|root2|subRoot)$/.test(param))) {
    return { value: (prelude.buildTree as (v: unknown[]) => unknown)(value), to: 'TreeNode' as const };
  }
  if (/\b_?Node\b/.test(type) && value.every(Array.isArray)) return { value: (prelude.buildGraph as (v: unknown[]) => unknown)(value), to: 'Node' as const };
  return { value, to: null };
}

// ─────────────────────────────── 進入點 ───────────────────────────────

export function traceJs(code: string, call: string, maxSteps: number = MAX_STEPS): TraceResult {
  const rt = new JsRuntime();
  rt.maxSteps = Math.min(maxSteps, MAX_STEPS_LIMIT);
  const result: TraceResult = { steps: rt.steps, stdout: '' };
  let inst: Instrumented;
  try {
    inst = instrument(code);
  } catch (e) {
    const err = e as SyntaxError & { loc?: { line: number } };
    result.error = { type: 'SyntaxError', message: `SyntaxError: ${err.message.replace(/\s*\(\d+:\d+\)$/, '')}`, line: err.loc?.line ?? null, timeout: false };
    return result;
  }

  try {
    // 定義使用者的函式；回傳一個在同一個作用域中執行運算式的函式（才看得到 let / const / class）
    rt.specs = inst.specs;
    rt.tries = inst.tries;
    const factory = new Function('__rt', 'console', `${PRELUDE}\n${inst.code}\n;return [(__src) => eval(__src), { ListNode, TreeNode, _Node, buildList, buildTree, buildGraph }];`);
    const [evaluate, prelude] = factory(rt, rt.console) as [(src: string) => unknown, Record<string, (...a: never[]) => unknown>];
    const parsed = parseCall(call);
    const entries = inst.entries;
    const funcs = entries.filter((e) => e.kind === 'function');
    if (!call.trim()) throw new CallHintError({ kind: 'empty', funcs: funcs.map((f) => f.name).slice(0, 3) }, 'The test call is empty');

    const run = (fn: () => unknown) => {
      rt.enabled = true;
      try {
        return fn();
      } finally {
        rt.enabled = false;
      }
    };

    let value: unknown;
    if (parsed?.form === 'design') {
      const Cls = evaluate(parsed.ops[0]) as new (...a: unknown[]) => Record<string, (...a: unknown[]) => unknown>;
      const argList = parsed.args.map((n) => evalLiteral(call.slice(n.start, n.end), prelude) as unknown[]);
      result.design = { ops: parsed.ops, calls: parsed.ops.map((op, k) => `${op}(${(argList[k] ?? []).map((a) => short(a, 24)).join(', ')})`) };
      const outputs: unknown[] = [];
      rt.design = { index: 0, outputs: [] };
      value = run(() => {
        const obj = new Cls(...(argList[0] ?? []));
        outputs.push(null);
        rt.design!.outputs.push('null');
        for (let k = 1; k < parsed.ops.length; k++) {
          rt.design!.index = k;
          const out = obj[parsed.ops[k]](...(argList[k] ?? []));
          outputs.push(out === undefined ? null : out);
          rt.design!.outputs.push(out === undefined ? 'null' : short(out, 24));
        }
        rt.design!.index = parsed.ops.length;
        return outputs;
      });
      if (rt.steps.length) {
        // 最後補一步：所有操作都做完，回傳每個操作的輸出（LeetCode 的輸出格式）
        const last = rt.steps.at(-1)!;
        const out = rt.serialize(value);
        rt.steps.push({
          stepIndex: rt.steps.length,
          lineNumber: last.lineNumber,
          event: 'return',
          funcName: last.funcName,
          depth: last.depth,
          variables: last.variables,
          stdout: rt.stdout,
          heap: { ...(last.heap ?? {}), ...out.heap },
          returnValue: out.value,
          design: { index: parsed.ops.length, outputs: [...rt.design.outputs] },
        });
      }
    } else if (parsed?.form === 'keywords' || parsed?.form === 'positional') {
      if (!funcs.length) throw new CallHintError({ kind: 'noFunction' }, 'No function is defined');
      const values = (parsed.form === 'keywords' ? parsed.pairs.map(([, n]) => n) : parsed.values).map((n: N) => evalLiteral(call.slice(n.start, n.end), prelude));
      const keys = parsed.form === 'keywords' ? parsed.pairs.map(([k]) => k) : [];
      const target =
        parsed.form === 'keywords'
          ? funcs.find((f) => keys.filter((k) => k !== 'pos').every((k) => f.params.includes(k)))
          : funcs.find((f) => f.params.length === values.length) ?? funcs.find((f) => f.params.length >= values.length);
      if (!target) {
        const f = funcs[0];
        throw new CallHintError({ kind: 'args', func: f.name, params: f.params.map((p) => (f.types[p] ? `${p}: ${f.types[p]}` : p)), got: keys.length ? keys : values.length }, `the input does not match the parameters of ${f.name}()`);
      }
      const byName = Object.fromEntries(keys.map((k, i) => [k, values[i]]));
      const raw = parsed.form === 'keywords' ? target.params.map((p) => byName[p]) : values;
      const conversions: CallInfo['conversions'] = [];
      const args = raw.map((v, i) => {
        const p = target.params[i] ?? '';
        const c = convert(v, target.types[p] ?? '', p, byName.pos, prelude);
        if (c.to) conversions.push({ param: p, to: c.to });
        return c.value;
      });
      result.call = { display: `${target.name}(${raw.map((v) => short(v, 40)).join(', ')}${byName.pos !== undefined && conversions.length ? `, pos=${short(byName.pos)}` : ''})`, inferred: true, conversions };
      const fn = evaluate(target.name) as (...a: unknown[]) => unknown;
      value = run(() => fn(...args));
    } else if (parsed?.form === 'call' && parsed.node.callee.type === 'Identifier') {
      // twoSum([2,7,11,15], 9)：名稱打錯時給提示；參數是單純的值時依 JSDoc 轉成鏈結串列 / 樹
      const name = parsed.node.callee.name;
      const entry = entries.find((e) => e.name === name);
      let fn: unknown;
      try {
        fn = evaluate(name);
      } catch {
        fn = undefined;
      }
      if (typeof fn !== 'function') {
        const pool = entries.map((e) => e.name);
        const suggest = closest(name, pool);
        const hint: CallHint = { kind: 'name', got: name, funcs: funcs.map((f) => f.name).slice(0, 5) };
        if (suggest) Object.assign(hint, { suggest, fix: call.replace(new RegExp(`\\b${name}\\b`), suggest) });
        throw new CallHintError(hint, `${name} is not defined`);
      }
      const argNodes: N[] = parsed.node.arguments;
      if (entry && argNodes.every(literalish)) {
        const raw = argNodes.map((n) => evalLiteral(call.slice(n.start, n.end), prelude));
        const conversions: CallInfo['conversions'] = [];
        const args = raw.map((v, i) => {
          const p = entry.params[i] ?? '';
          const c = convert(v, entry.types[p] ?? '', p, undefined, prelude);
          if (c.to) conversions.push({ param: p, to: c.to });
          return c.value;
        });
        if (conversions.length) result.call = { display: `${name}(${raw.map((v) => short(v, 40)).join(', ')})`, inferred: false, conversions };
        value = run(() => (fn as (...a: unknown[]) => unknown)(...args));
      } else {
        value = run(() => evaluate(call));
      }
    } else {
      // 其他寫法：照原樣在使用者程式的作用域中執行
      value = run(() => evaluate(call));
    }

    const out = rt.serialize(value);
    result.returnValue = out.value;
    if (Object.keys(out.heap).length) result.returnHeap = out.heap;
  } catch (e) {
    const timeout = rt.isStop(e);
    if (e instanceof CallHintError) {
      result.error = { type: 'CallError', message: e.message, line: null, timeout: false, hint: e.hint };
    } else if (timeout) {
      const message = `TimeoutError: Execution exceeded ${rt.maxSteps} steps (possible infinite loop)`;
      result.error = { type: 'TimeoutError', message, line: rt.lastLine, timeout: true };
      const last = rt.steps.at(-1);
      if (last) rt.steps.push({ ...last, stepIndex: rt.steps.length, event: 'exception', exception: message });
    } else {
      const err = e as Error;
      result.error = { type: err?.name ?? 'Error', message: describe(e), line: rt.lastLine, timeout: false };
    }
  }
  result.stdout = rt.stdout;
  return result;
}

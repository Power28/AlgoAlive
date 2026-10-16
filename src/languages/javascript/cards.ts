/**
 * JavaScript 的說明卡片：條件判斷、計算過程、容器操作、解構交換、切片範圍。
 *
 * Python 追蹤器在每一行執行前，用 eval 在當下的 frame 中算出子運算式的值。JavaScript 無法從外部讀取
 * 函式內的作用域，所以改在插樁時一起產生：
 * - 插樁時（analyze*）：分析敘述，產生與值無關的「規格」（運算式的結構、原文、位置），並替每個需要的
 *   子運算式產生 thunk 的原始碼（() => 子運算式），跟著 __rt.step 一起傳入，在原本的作用域中求值
 * - 執行時（build*）：照規格呼叫 thunk 取得值（只呼叫沒有副作用的運算式），組成與 Python 相同格式的卡片
 *
 * 只有沒有副作用的子運算式才會產生 thunk（例如 stack.pop() 不會），與 Python 的 _is_pure 相同。
 */
import type { Calc, Condition, ConditionPart, ConditionTerm, ContainerOp, LogicNode, MultiAssign, SliceInfo, TermLocation } from '../../types';
import { isNodeObject, ser, short, type Ctx, type Registry } from './serialize.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

// ─────────────────────────────── 規格 ───────────────────────────────

/** 運算元在畫面上的位置；數字是 thunk 的編號（執行時才知道的索引 / 物件） */
type LocSpec = { var: string } | { var: string; idx: number } | { var: string; row: number; col: number } | { obj: number };

interface Operand {
  src: string;
  /** thunk 編號；-1 代表含有副作用，不能預先求值 */
  th: number;
  loc?: LocSpec;
}

type CondNode =
  | { t: 'logic'; op: 'and' | 'or'; src: string; kids: CondNode[] }
  | { t: 'not'; src: string; kid: CondNode }
  | { t: 'cmp'; src: string; op: string; a: Operand; b: Operand }
  | { t: 'leaf'; src: string; x: Operand };

export interface CondSpec {
  src: string;
  context: 'test' | 'value';
  tree: CondNode;
}

/** 計算過程的樣板：文字片段與子節點，代入數值後重組出每個階段 */
interface TNode {
  th: number;
  /** paren：原本包著這個子運算式的括號；代入的是單一個值時就不需要了（(4) / 2 → 4 / 2） */
  parts?: (string | { n: number; wrap: boolean; paren?: boolean })[];
  leaf?: Operand;
  lit?: string;
  /** 位元運算：運算子與左右子節點 */
  bit?: { op: string; kids: number[] };
}

export interface CalcSpec {
  kind: 'assign' | 'aug' | 'return';
  src: string;
  expr: string;
  nodes: TNode[];
  root: number;
  leaves: number[];
  /** 由內而外（後序）要算出的運算 */
  composites: number[];
  target?: { src: string; loc?: LocSpec };
}

export interface OpSpec {
  method: 'push' | 'pushleft' | 'pop' | 'popleft' | 'add' | 'delete' | 'mapset' | 'clear' | 'setitem' | 'delitem';
  target: string;
  targetTh: number;
  args: number[];
  /** obj[key] = value：key / value 的 thunk */
  key?: number;
  value?: number;
  assignTo?: string;
  src: string;
  from?: { target: string; th: number; end: 'back' | 'front' };
}

export interface MultiSpec {
  src: string;
  pairs: { target: string; tLoc?: LocSpec; valueSrc: string; th: number; vLoc?: LocSpec }[];
  swap: boolean;
}

export interface SliceSpec {
  var: string;
  src: string;
  kind: 'slice' | 'substring';
  seq: number;
  start: number | null;
  end: number | null;
  result: number;
}

export interface LoopSpec {
  line: number;
  kind: 'for' | 'while';
  src: string;
  /** 迴圈敘述（含本體）的行範圍：離開這個範圍就代表迴圈結束了 */
  start: number;
  end: number;
  seq?: string;
  item?: string;
  /** 總圈數：for…of 的序列長度，或 for (let i = a; i < n; i++) 這類計數迴圈 */
  total?: { k: 'seq'; th: number } | { k: 'range'; varTh: number; boundTh: number; cmp: string; dir: 1 | -1 };
}

export interface StepSpec {
  cond?: CondSpec;
  calc?: CalcSpec;
  op?: OpSpec;
  multi?: MultiSpec;
  slices?: SliceSpec[];
  jump?: { kind: 'break' | 'continue'; loopLine: number; loopSrc: string };
  loop?: LoopSpec;
}

/** 一個 step 的 thunk 原始碼清單 */
export class Thunks {
  codes: string[] = [];
  add(expr: string): number {
    const i = this.codes.indexOf(expr);
    if (i >= 0) return i;
    this.codes.push(expr);
    return this.codes.length - 1;
  }
}

// ─────────────────────────────── 插樁時：分析 ───────────────────────────────

const PURE_MEMBER_CALLS = new Set([
  'has', 'get', 'includes', 'indexOf', 'lastIndexOf', 'charAt', 'charCodeAt', 'codePointAt', 'at', 'slice', 'substring',
  'toLowerCase', 'toUpperCase', 'startsWith', 'endsWith', 'trim', 'join', 'concat', 'toString', 'localeCompare',
]);
const PURE_GLOBALS: Record<string, Set<string> | true> = {
  Math: new Set(['max', 'min', 'floor', 'ceil', 'abs', 'trunc', 'round', 'sqrt', 'pow', 'sign', 'log2', 'log10', 'log']),
  Number: new Set(['isInteger', 'isFinite', 'isNaN', 'parseInt', 'parseFloat']),
  Array: new Set(['isArray']),
  Object: new Set(['keys', 'values', 'entries']),
  String: new Set(['fromCharCode']),
  parseInt: true,
  parseFloat: true,
  String_: true,
};
const PURE_FUNCS = new Set(['parseInt', 'parseFloat', 'String', 'Number', 'Boolean', 'isNaN']);
const CALC_CALLS = new Set(['max', 'min', 'floor', 'ceil', 'abs', 'trunc', 'round', 'sqrt', 'pow']);
const CMP_OPS = new Set(['===', '!==', '==', '!=', '<', '<=', '>', '>=', 'in', 'instanceof']);
const ARITH_OPS = new Set(['+', '-', '*', '/', '%', '**', '&', '|', '^', '<<', '>>', '>>>']);
export const BIT_OPS = new Set(['&', '|', '^', '<<', '>>', '>>>']);

function pureCall(n: N): boolean {
  const c = n.callee;
  if (c.type === 'Identifier') return PURE_FUNCS.has(c.name);
  if (c.type !== 'MemberExpression' || c.computed) return false;
  const name = c.property.name;
  if (c.object.type === 'Identifier' && c.object.name in PURE_GLOBALS) {
    const allowed = PURE_GLOBALS[c.object.name];
    return allowed === true || allowed.has(name);
  }
  return PURE_MEMBER_CALLS.has(name) && isPure(c.object);
}

/** 沒有副作用、可以預先求值的運算式（getter 等極端情況不考慮） */
export function isPure(n: N): boolean {
  if (!n) return true;
  switch (n.type) {
    case 'Identifier':
    case 'Literal':
    case 'ThisExpression':
      return true;
    case 'TemplateLiteral':
      return n.expressions.every(isPure);
    case 'MemberExpression':
      return isPure(n.object) && (!n.computed || isPure(n.property));
    case 'BinaryExpression':
    case 'LogicalExpression':
      return isPure(n.left) && isPure(n.right);
    case 'UnaryExpression':
      return n.operator !== 'delete' && isPure(n.argument);
    case 'ConditionalExpression':
      return isPure(n.test) && isPure(n.consequent) && isPure(n.alternate);
    case 'ArrayExpression':
      return n.elements.every((e: N) => e && e.type !== 'SpreadElement' && isPure(e));
    case 'CallExpression':
      return !n.optional && n.arguments.every((a: N) => a.type !== 'SpreadElement' && isPure(a)) && pureCall(n);
    default:
      return false;
  }
}

/** 畫面上的變數名稱：x，或 this.x */
export function varName(n: N): string | null {
  if (n?.type === 'Identifier') return n.name;
  if (n?.type === 'MemberExpression' && !n.computed && n.object.type === 'ThisExpression') return `this.${n.property.name}`;
  return null;
}

export class Analyzer {
  private source: string;
  constructor(source: string) {
    this.source = source;
  }

  src(n: N): string {
    return this.source.slice(n.start, n.end);
  }

  private operand(n: N, tl: Thunks): Operand {
    const op: Operand = { src: this.src(n), th: isPure(n) ? tl.add(this.src(n)) : -1 };
    const loc = this.locate(n, tl);
    if (loc) op.loc = loc;
    return op;
  }

  /** 運算元的位置：變數、陣列的某格、grid 的某格、節點的欄位 */
  locate(n: N, tl: Thunks): LocSpec | undefined {
    const name = varName(n);
    if (name) return { var: name };
    if (n.type !== 'MemberExpression') return undefined;
    if (n.computed && isPure(n.property)) {
      const outer = varName(n.object);
      if (outer) return { var: outer, idx: tl.add(this.src(n.property)) };
      const inner = n.object;
      if (inner.type === 'MemberExpression' && inner.computed && varName(inner.object) && isPure(inner.property)) {
        return { var: varName(inner.object)!, row: tl.add(this.src(inner.property)), col: tl.add(this.src(n.property)) };
      }
    }
    if (!n.computed && isPure(n.object)) return { obj: tl.add(this.src(n.object)) };
    return undefined;
  }

  // ── 條件判斷 ──

  private condNode(n: N, tl: Thunks): CondNode {
    if (n.type === 'LogicalExpression' && (n.operator === '&&' || n.operator === '||')) {
      const op = n.operator === '&&' ? 'and' : 'or';
      // a && b && c 攤平成一個節點（與 Python 的 BoolOp 相同）
      const kids: N[] = [];
      const flatten = (x: N) => {
        if (x.type === 'LogicalExpression' && x.operator === n.operator) {
          flatten(x.left);
          kids.push(x.right);
        } else kids.push(x);
      };
      flatten(n);
      return { t: 'logic', op, src: this.src(n), kids: kids.map((k) => this.condNode(k, tl)) };
    }
    if (n.type === 'UnaryExpression' && n.operator === '!') return { t: 'not', src: this.src(n), kid: this.condNode(n.argument, tl) };
    if (n.type === 'BinaryExpression' && CMP_OPS.has(n.operator)) {
      return { t: 'cmp', src: this.src(n), op: n.operator, a: this.operand(n.left, tl), b: this.operand(n.right, tl) };
    }
    return { t: 'leaf', src: this.src(n), x: this.operand(n, tl) };
  }

  cond(expr: N, context: 'test' | 'value', tl: Thunks): CondSpec {
    return { src: this.src(expr), context, tree: this.condNode(expr, tl) };
  }

  /** 賦值 / 回傳中的條件式：比較、&& / ||、!、三元運算子的條件 */
  valueCond(stmt: N, tl: Thunks): CondSpec | null {
    const value = statementValue(stmt);
    if (!value) return null;
    if (value.type === 'ConditionalExpression') return this.cond(value.test, 'test', tl);
    const logic = value.type === 'LogicalExpression' && value.operator !== '??';
    const cmp = value.type === 'BinaryExpression' && CMP_OPS.has(value.operator);
    const not = value.type === 'UnaryExpression' && value.operator === '!';
    return logic || cmp || not ? this.cond(value, 'value', tl) : null;
  }

  // ── 計算過程 ──

  private tmpl(n: N, nodes: TNode[], tl: Thunks, leaves: number[], composites: number[]): number {
    const src = this.src(n);
    if (n.type === 'Literal' || (n.type === 'TemplateLiteral' && n.expressions.length === 0) || (n.type === 'Identifier' && ['undefined', 'NaN', 'Infinity'].includes(n.name))) {
      nodes.push({ th: tl.add(src), lit: src });
      return nodes.length - 1;
    }
    if (n.type === 'Identifier' || n.type === 'ThisExpression' || n.type === 'MemberExpression') {
      nodes.push({ th: tl.add(src), leaf: this.operand(n, tl) });
      leaves.push(nodes.length - 1);
      return nodes.length - 1;
    }
    // 要逐步計算的子節點（函式本身、屬性名稱不算）
    const kids: { node: N; wrap: boolean }[] = [];
    switch (n.type) {
      case 'BinaryExpression':
      case 'LogicalExpression':
        kids.push({ node: n.left, wrap: n.operator === '**' }, { node: n.right, wrap: true });
        break;
      case 'UnaryExpression':
        kids.push({ node: n.argument, wrap: true });
        break;
      case 'CallExpression':
        for (const a of n.arguments) kids.push({ node: a, wrap: false });
        break;
      case 'ConditionalExpression':
        kids.push({ node: n.test, wrap: false }, { node: n.consequent, wrap: false }, { node: n.alternate, wrap: false });
        break;
      case 'ArrayExpression':
        for (const e of n.elements) kids.push({ node: e, wrap: false });
        break;
      case 'TemplateLiteral':
        for (const e of n.expressions) kids.push({ node: e, wrap: false });
        break;
    }
    const parts: TNode['parts'] = [];
    let pos = n.start;
    const childIdx: number[] = [];
    for (const k of kids.sort((a, b) => a.node.start - b.node.start)) {
      let before = this.source.slice(pos, k.node.start);
      let after = k.node.end;
      // (lo + hi) / 2 的括號：Acorn 不保留括號節點，從原始碼判斷（函式呼叫的括號不算）
      const paren = n.type !== 'CallExpression' && /\(\s*$/.test(before) && /^\s*\)/.test(this.source.slice(k.node.end, n.end));
      if (paren) {
        before = before.replace(/\(\s*$/, '');
        after = this.source.indexOf(')', k.node.end) + 1;
      }
      parts.push(before);
      const idx = this.tmpl(k.node, nodes, tl, leaves, composites);
      childIdx.push(idx);
      parts.push(paren ? { n: idx, wrap: k.wrap, paren } : { n: idx, wrap: k.wrap });
      pos = after;
    }
    parts.push(this.source.slice(pos, n.end));
    const node: TNode = { th: tl.add(src), parts };
    if (n.type === 'BinaryExpression' && BIT_OPS.has(n.operator)) node.bit = { op: n.operator, kids: childIdx };
    if (n.type === 'UnaryExpression' && n.operator === '~') node.bit = { op: '~', kids: childIdx };
    nodes.push(node);
    composites.push(nodes.length - 1);
    return nodes.length - 1;
  }

  calc(stmt: N, tl: Thunks): CalcSpec | null {
    const nodes: TNode[] = [];
    const leaves: number[] = [];
    const composites: number[] = [];
    // x += y、x++：把目前的 x 與 y 合成一個運算
    const aug = (target: N, op: string, value: N | null, src: string): CalcSpec | null => {
      if (!isPure(target) || (value && !isPure(value))) return null;
      const t = this.tmpl(target, nodes, tl, leaves, composites);
      const right = value ? this.src(value) : '1';
      const v = value ? this.tmpl(value, nodes, tl, leaves, composites) : (nodes.push({ th: tl.add('1'), lit: '1' }), nodes.length - 1);
      const root: TNode = { th: tl.add(`(${this.src(target)}) ${op} (${right})`), parts: [{ n: t, wrap: false }, ` ${op} `, { n: v, wrap: true }] };
      if (BIT_OPS.has(op)) root.bit = { op, kids: [t, v] };
      nodes.push(root);
      composites.push(nodes.length - 1);
      return { kind: 'aug', src, expr: `${this.src(target)} ${op} ${right}`, nodes, root: nodes.length - 1, leaves, composites, target: this.target(target, tl) };
    };
    const plain = (kind: CalcSpec['kind'], target: N | null, value: N, src: string): CalcSpec | null => {
      if (!hasArith(value) || !isPure(value)) return null;
      const root = this.tmpl(value, nodes, tl, leaves, composites);
      const spec: CalcSpec = { kind, src, expr: this.src(value), nodes, root, leaves, composites };
      if (target) spec.target = this.target(target, tl);
      return spec;
    };
    const src = this.src(stmt).replace(/;\s*$/, '');
    if (stmt.type === 'ExpressionStatement') {
      const e = stmt.expression;
      if (e.type === 'AssignmentExpression' && e.left.type !== 'ArrayPattern' && e.left.type !== 'ObjectPattern') {
        if (e.operator === '=') return plain('assign', e.left, e.right, src);
        const op = e.operator.slice(0, -1);
        if (ARITH_OPS.has(op)) return aug(e.left, op, e.right, src);
      }
      if (e.type === 'UpdateExpression') return aug(e.argument, e.operator === '++' ? '+' : '-', null, src);
      return null;
    }
    if (stmt.type === 'VariableDeclaration' && stmt.declarations.length === 1) {
      const d = stmt.declarations[0];
      if (d.id.type === 'Identifier' && d.init) return plain('assign', d.id, d.init, src);
    }
    if (stmt.type === 'ReturnStatement' && stmt.argument) return plain('return', null, stmt.argument, src);
    return null;
  }

  private target(n: N, tl: Thunks): { src: string; loc?: LocSpec } {
    const loc = this.locate(n, tl);
    return loc ? { src: this.src(n), loc } : { src: this.src(n) };
  }

  // ── 容器操作 ──

  op(stmt: N, tl: Thunks): OpSpec | null {
    const src = this.src(stmt).replace(/;\s*$/, '');
    let call: N = null;
    let assignTo: string | undefined;
    if (stmt.type === 'ExpressionStatement') {
      const e = stmt.expression;
      if (e.type === 'CallExpression') call = e;
      else if (e.type === 'AssignmentExpression' && e.operator === '=') {
        // obj[key] = value（只算物件 / Map；陣列的 nums[i] = x 交給一般賦值）
        if (e.left.type === 'MemberExpression' && e.left.computed && varName(e.left.object) && isPure(e.left.property) && isPure(e.right)) {
          const target = varName(e.left.object)!;
          return { method: 'setitem', target, targetTh: tl.add(this.src(e.left.object)), args: [], key: tl.add(this.src(e.left.property)), value: tl.add(this.src(e.right)), src };
        }
        if (e.right.type === 'CallExpression') {
          call = e.right;
          assignTo = this.src(e.left);
        }
      } else if (e.type === 'UnaryExpression' && e.operator === 'delete' && e.argument.type === 'MemberExpression' && e.argument.computed && varName(e.argument.object) && isPure(e.argument.property)) {
        const m = e.argument;
        return { method: 'delitem', target: varName(m.object)!, targetTh: tl.add(this.src(m.object)), args: [], key: tl.add(this.src(m.property)), src };
      }
    } else if (stmt.type === 'VariableDeclaration' && stmt.declarations.length === 1 && stmt.declarations[0].init?.type === 'CallExpression') {
      call = stmt.declarations[0].init;
      assignTo = this.src(stmt.declarations[0].id);
    } else if (stmt.type === 'ReturnStatement' && stmt.argument?.type === 'CallExpression') {
      call = stmt.argument;
    }
    if (!call || call.callee.type !== 'MemberExpression' || call.callee.computed) return null;
    const target = varName(call.callee.object);
    if (!target) return null;
    const method = METHODS[`${call.callee.property.name}/${call.arguments.length}`];
    if (!method) return null;
    const spec: OpSpec = { method, target, targetTh: tl.add(this.src(call.callee.object)), args: [], src };
    if (assignTo) spec.assignTo = assignTo;
    for (const a of call.arguments) {
      if (a.type === 'SpreadElement') return null;
      if (isPure(a)) spec.args.push(tl.add(this.src(a)));
      else {
        // b.push(a.pop())：放入的元素是另一個容器取出來的
        const inner = a.type === 'CallExpression' && a.arguments.length === 0 && a.callee.type === 'MemberExpression' && !a.callee.computed ? a.callee : null;
        const from = inner && varName(inner.object) && (inner.property.name === 'pop' || inner.property.name === 'shift') ? inner : null;
        if (!from || (method !== 'push' && method !== 'pushleft')) return null;
        spec.from = { target: varName(from.object)!, th: tl.add(this.src(from.object)), end: from.property.name === 'shift' ? 'front' : 'back' };
        spec.args.push(-1);
      }
    }
    return spec;
  }

  // ── 解構交換 ──

  multi(stmt: N, tl: Thunks): MultiSpec | null {
    let pattern: N = null;
    let values: N = null;
    if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'AssignmentExpression' && stmt.expression.operator === '=') {
      pattern = stmt.expression.left;
      values = stmt.expression.right;
    } else if (stmt.type === 'VariableDeclaration' && stmt.declarations.length === 1) {
      pattern = stmt.declarations[0].id;
      values = stmt.declarations[0].init;
    }
    if (pattern?.type !== 'ArrayPattern' || values?.type !== 'ArrayExpression') return null;
    if (pattern.elements.length !== values.elements.length || pattern.elements.some((e: N) => !e || e.type === 'RestElement')) return null;
    if (values.elements.some((e: N) => !e || !isPure(e))) return null;
    const pairs = pattern.elements.map((t: N, i: number) => {
      const v = values.elements[i];
      return { target: this.src(t), tLoc: this.locate(t, tl), valueSrc: this.src(v), th: tl.add(this.src(v)), vLoc: this.locate(v, tl) };
    });
    const ts = pairs.map((p: { target: string }) => p.target).sort().join('\n');
    const vs = pairs.map((p: { valueSrc: string }) => p.valueSrc).sort().join('\n');
    return { src: this.src(stmt).replace(/;\s*$/, ''), pairs, swap: pairs.length > 1 && ts === vs && pairs.some((p: { target: string; valueSrc: string }) => p.target !== p.valueSrc) };
  }

  // ── 切片 ──

  slices(stmt: N, tl: Thunks): SliceSpec[] {
    const out: SliceSpec[] = [];
    const visit = (n: N) => {
      if (!n || typeof n.type !== 'string' || n.type.includes('Function')) return;
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed && n.arguments.length <= 2) {
        const kind = n.callee.property.name;
        const name = varName(n.callee.object);
        if ((kind === 'slice' || kind === 'substring') && name && n.arguments.every(isPure)) {
          out.push({
            var: name,
            src: this.src(n),
            kind,
            seq: tl.add(this.src(n.callee.object)),
            start: n.arguments[0] ? tl.add(this.src(n.arguments[0])) : null,
            end: n.arguments[1] ? tl.add(this.src(n.arguments[1])) : null,
            result: tl.add(this.src(n)),
          });
        }
      }
      for (const key of Object.keys(n)) {
        if (key === 'loc') continue;
        const v = n[key];
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v.type === 'string') visit(v);
      }
    };
    visit(stmt);
    return out;
  }

  // ── 迴圈 ──

  loop(stmt: N, tl: Thunks): LoopSpec {
    const header = this.source.slice(stmt.start, stmt.body.start).trim().replace(/\{$/, '').trim();
    const spec: LoopSpec = { line: stmt.loc.start.line, kind: stmt.type === 'WhileStatement' ? 'while' : 'for', src: header, start: stmt.loc.start.line, end: stmt.loc.end.line };
    if (stmt.type === 'ForOfStatement') {
      const seq = varName(stmt.right);
      const left = stmt.left.type === 'VariableDeclaration' ? stmt.left.declarations[0].id : stmt.left;
      if (seq) spec.seq = seq;
      if (left.type === 'Identifier') spec.item = left.name;
      if (isPure(stmt.right)) spec.total = { k: 'seq', th: tl.add(this.src(stmt.right)) };
    } else if (stmt.type === 'ForStatement' && stmt.test?.type === 'BinaryExpression' && stmt.update) {
      // for (let i = a; i < n; i++) / for (let i = n - 1; i >= 0; i--)
      const v = stmt.test.left;
      const u = stmt.update;
      const step = u.type === 'UpdateExpression' && u.argument.type === 'Identifier' && u.argument.name === v.name ? (u.operator === '++' ? 1 : -1) : 0;
      const cmp = stmt.test.operator;
      if (v.type === 'Identifier' && step && isPure(stmt.test.right) && ((step === 1 && (cmp === '<' || cmp === '<=')) || (step === -1 && (cmp === '>' || cmp === '>=')))) {
        spec.total = { k: 'range', varTh: tl.add(v.name), boundTh: tl.add(this.src(stmt.test.right)), cmp, dir: step };
      }
    }
    return spec;
  }
}

const METHODS: Record<string, OpSpec['method']> = {
  'push/1': 'push',
  'unshift/1': 'pushleft',
  'pop/0': 'pop',
  'shift/0': 'popleft',
  'add/1': 'add',
  'delete/1': 'delete',
  'set/2': 'mapset',
  'clear/0': 'clear',
};

function hasArith(n: N): boolean {
  let found = false;
  const visit = (x: N) => {
    if (found || !x || typeof x.type !== 'string' || x.type.includes('Function')) return;
    if (x.type === 'BinaryExpression' && ARITH_OPS.has(x.operator)) found = true;
    else if (x.type === 'UnaryExpression' && (x.operator === '-' || x.operator === '~') && x.argument.type !== 'Literal') found = true;
    else if (x.type === 'CallExpression' && x.callee.type === 'MemberExpression' && x.callee.object.type === 'Identifier' && x.callee.object.name === 'Math' && CALC_CALLS.has(x.callee.property.name)) found = true;
    for (const key of Object.keys(x)) {
      if (key === 'loc') continue;
      const v = x[key];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v.type === 'string') visit(v);
    }
  };
  visit(n);
  return found;
}

/** 賦值 / 宣告 / 回傳 / 運算式敘述的值 */
function statementValue(stmt: N): N {
  if (stmt.type === 'ReturnStatement') return stmt.argument;
  if (stmt.type === 'VariableDeclaration' && stmt.declarations.length === 1) return stmt.declarations[0].init;
  if (stmt.type === 'ExpressionStatement') {
    const e = stmt.expression;
    return e.type === 'AssignmentExpression' && e.operator === '=' ? e.right : null;
  }
  return null;
}

// ─────────────────────────────── 執行時：組卡片 ───────────────────────────────

const MAX_DISPLAY = 14;
const MAX_STAGES = 6;
const MAX_BITS = 2 ** 32;
const MIN_BITS = -(2 ** 31);

/** thunk 的值；求值失敗（例如 null 的屬性、TDZ）時 ok 為 false */
export type Read = (th: number) => { ok: boolean; v: unknown };

const CMP: Record<string, (a: unknown, b: unknown) => boolean> = {
  '===': (a, b) => a === b,
  '!==': (a, b) => a !== b,
  // eslint-disable-next-line eqeqeq
  '==': (a, b) => a == b,
  // eslint-disable-next-line eqeqeq
  '!=': (a, b) => a != b,
  '<': (a, b) => (a as number) < (b as number),
  '<=': (a, b) => (a as number) <= (b as number),
  '>': (a, b) => (a as number) > (b as number),
  '>=': (a, b) => (a as number) >= (b as number),
  in: (a, b) => (a as string) in (b as object),
  instanceof: (a, b) => a instanceof (b as new () => unknown),
};

const scalar = (v: unknown) => v === null || v === undefined || ['number', 'string', 'boolean', 'bigint'].includes(typeof v);

/** 短的純量顯示值，其他（容器、物件）顯示原本的寫法 */
function display(src: string, v: unknown): string {
  if (scalar(v)) {
    const r = short(v, MAX_DISPLAY + 4);
    if (r.length <= MAX_DISPLAY) return r;
  }
  return src;
}

/** 計算結果的顯示：純量照寫法；短的陣列照寫法，長的只標長度 */
function resultShort(v: unknown): string {
  return short(v, 40);
}

export class CardBuilder {
  private read: Read;
  private ctx: Ctx;
  private registry: Registry;
  constructor(read: Read, ctx: Ctx, registry: Registry) {
    this.read = read;
    this.ctx = ctx;
    this.registry = registry;
  }

  private loc(spec: LocSpec | undefined): TermLocation | undefined {
    if (!spec) return undefined;
    if ('obj' in spec) {
      const o = this.read(spec.obj);
      return o.ok && o.v && typeof o.v === 'object' && isNodeObject(o.v) ? { ref: this.registry.sid(o.v) } : undefined;
    }
    if ('row' in spec) {
      const r = this.read(spec.row);
      const c = this.read(spec.col);
      return r.ok && c.ok && Number.isInteger(r.v) && Number.isInteger(c.v) ? { var: spec.var, index: r.v as number, col: c.v as number } : undefined;
    }
    if ('idx' in spec) {
      const i = this.read(spec.idx);
      return i.ok && Number.isInteger(i.v) ? { var: spec.var, index: i.v as number } : undefined;
    }
    return { var: spec.var };
  }

  private term(op: Operand): { term: ConditionTerm; value: unknown; known: boolean } {
    const term: ConditionTerm = { src: op.src, display: op.src };
    const loc = this.loc(op.loc);
    if (loc) term.loc = loc;
    if (op.th < 0) return { term, value: undefined, known: false };
    const r = this.read(op.th);
    if (!r.ok) return { term, value: undefined, known: false };
    term.value = ser(r.v, this.ctx);
    term.display = display(op.src, r.v);
    return { term, value: r.v, known: true };
  }

  // ── 條件判斷（與 Python 的 _walk 相同的規則） ──

  condition(spec: CondSpec): Condition {
    const parts: ConditionPart[] = [];
    const order: string[] = [];
    const walk = (n: CondNode, skip: boolean): { text: string; t: boolean | null; v: unknown; tree: LogicNode } => {
      if (n.t === 'logic') {
        const enteredSkipped = skip;
        const shown: string[] = [];
        const children: LogicNode[] = [];
        let truthy: boolean | null = null;
        let value: unknown;
        let shortAt: number | undefined;
        n.kids.forEach((k, i) => {
          const r = walk(k, skip);
          shown.push(r.text);
          children.push(r.tree);
          if (skip) return;
          truthy = r.t;
          value = r.v;
          const stop = r.t === null || (n.op === 'and' && !r.t) || (n.op === 'or' && r.t);
          if (stop) {
            skip = true;
            if (r.t !== null && i < n.kids.length - 1) shortAt = i;
          }
        });
        const tree: LogicNode = { op: n.op, src: n.src, children, truthy, skipped: enteredSkipped };
        if (truthy !== null) tree.value = ser(value, this.ctx);
        if (shortAt !== undefined) tree.shortCircuitAt = shortAt;
        return { text: shown.join(n.op === 'and' ? ' && ' : ' || '), t: truthy, v: value, tree };
      }
      if (n.t === 'not') {
        const r = walk(n.kid, skip);
        const truthy = r.t === null ? null : !r.t;
        const tree: LogicNode = { op: 'not', src: n.src, children: [r.tree], truthy, skipped: skip };
        if (truthy !== null) tree.value = ser(truthy, this.ctx);
        return { text: `!${r.text}`, t: truthy, v: truthy, tree };
      }
      if (n.t === 'cmp') {
        if (skip) {
          parts.push({ kind: 'cmp', src: n.src, skipped: true });
          return { text: '…', t: null, v: undefined, tree: { op: 'cmp', src: n.src, skipped: true } };
        }
        const a = this.term(n.a);
        const b = this.term(n.b);
        let result: boolean | null = null;
        if (a.known && b.known) {
          try {
            result = CMP[n.op](a.value, b.value);
          } catch {
            result = null;
          }
        }
        const text = `${a.term.display} ${n.op} ${b.term.display}`;
        parts.push({ kind: 'cmp', src: n.src, terms: [a.term, b.term], ops: [n.op], display: text, result });
        const tree: LogicNode = { op: 'cmp', src: n.src, display: text, truthy: result, skipped: false, order: order.length };
        order.push(n.src);
        if (result !== null) tree.value = ser(result, this.ctx);
        return { text, t: result, v: result, tree };
      }
      // 其他運算式（例如 while (queue.length) 的 queue.length）：看它的真假值
      if (skip) {
        parts.push({ kind: 'truth', src: n.src, skipped: true });
        return { text: '…', t: null, v: undefined, tree: { op: 'leaf', src: n.src, skipped: true } };
      }
      const x = this.term(n.x);
      const truthy = x.known ? Boolean(x.value) : null;
      parts.push({ kind: 'truth', src: n.src, terms: [x.term], display: x.term.display, result: truthy });
      const tree: LogicNode = { op: 'leaf', src: n.src, display: x.term.display, truthy, skipped: false, order: order.length };
      order.push(n.src);
      if (x.known) tree.value = x.term.value;
      return { text: x.term.display, t: truthy, v: x.value, tree };
    };
    const r = walk(spec.tree, false);
    const cond: Condition = { src: spec.src, display: r.text, result: r.t, parts, tree: r.tree, context: spec.context };
    if (r.t !== null) cond.value = ser(r.v, this.ctx);
    return cond;
  }

  // ── 計算過程（與 Python 的 _calc 相同的規則） ──

  calc(spec: CalcSpec): Calc | null {
    const repl = new Map<number, string>();
    const terms: ConditionTerm[] = [];
    for (const i of spec.leaves) {
      const t = this.term(spec.nodes[i].leaf!);
      if (!t.known) return null;
      terms.push(t.term);
      if (t.term.display !== t.term.src) repl.set(i, t.term.display);
    }
    const render = (i: number, wrap = false): string => {
      const text = repl.get(i);
      if (text !== undefined) return wrap && text.startsWith('-') ? `(${text})` : text;
      const node = spec.nodes[i];
      if (node.lit !== undefined) return node.lit;
      if (node.leaf) return node.leaf.src;
      return node.parts!
        .map((p) => {
          if (typeof p === 'string') return p;
          const text = render(p.n, p.wrap && !p.paren);
          // 原本有括號：代入成單一個值（沒有空白）就拿掉，否則保留
          return p.paren && /\s/.test(text) ? `(${text})` : text;
        })
        .join('');
    };
    const stages = [render(spec.root)];
    const bits: NonNullable<Calc['bits']> = [];
    for (const i of spec.composites) {
      const r = this.read(spec.nodes[i].th);
      if (!r.ok) return null;
      repl.set(i, resultShort(r.v));
      stages.push(render(spec.root));
      const bit = spec.nodes[i].bit;
      if (bit) {
        const vals = bit.kids.map((k) => this.read(spec.nodes[k].th));
        const left = vals[0]?.v;
        const right = bit.op === '~' ? 0 : vals[1]?.v;
        const all = [left, right, r.v];
        if (vals.every((x) => x.ok) && all.every((x) => Number.isInteger(x) && (x as number) >= MIN_BITS && (x as number) < MAX_BITS)) {
          bits.push({ op: bit.op, left: left as number, right: right as number, result: r.v as number });
        }
      }
    }
    const result = this.read(spec.nodes[spec.root].th);
    if (!result.ok) return null;
    const resultDisplay = resultShort(result.v);
    stages.push(resultDisplay);
    let dedup = stages.filter((s, i) => i === 0 || s !== stages[i - 1]);
    if (dedup.length > MAX_STAGES) dedup = [...dedup.slice(0, 2), ...dedup.slice(-(MAX_STAGES - 2))];
    const calc: Calc = { kind: spec.kind, src: spec.src, expr: spec.expr, stages: dedup, result: ser(result.v, this.ctx), resultDisplay, terms };
    if (bits.length) calc.bits = bits;
    if (spec.target) {
      calc.target = spec.target.src;
      const loc = this.loc(spec.target.loc);
      if (loc) calc.targetLoc = loc;
    }
    return calc;
  }

  // ── 容器操作（執行前以唯讀方式算出會放入 / 取出的值） ──

  op(spec: OpSpec): ContainerOp | null {
    const c = this.read(spec.targetTh);
    if (!c.ok || !c.v || typeof c.v !== 'object') return null;
    const box = c.v as object;
    const container: ContainerOp['container'] | null = Array.isArray(box) ? 'list' : box instanceof Set ? 'set' : box instanceof Map ? 'dict' : Object.getPrototypeOf(box) === Object.prototype ? 'dict' : null;
    if (!container) return null;
    const args: unknown[] = [];
    for (const th of spec.args) {
      if (th < 0) {
        // b.push(a.pop())：取出的值可以唯讀算出
        const from = spec.from && this.read(spec.from.th);
        const src = from?.ok ? from.v : null;
        if (!Array.isArray(src) || !src.length) return null;
        args.push(spec.from!.end === 'front' ? src[0] : src[src.length - 1]);
        continue;
      }
      const a = this.read(th);
      if (!a.ok) return null;
      args.push(a.v);
    }
    const size = Array.isArray(box) ? box.length : box instanceof Set || box instanceof Map ? box.size : Object.keys(box).length;
    const op: ContainerOp = { kind: 'push', target: spec.target, container, src: spec.src, size };
    if (spec.assignTo) op.assignTo = spec.assignTo;
    if (spec.from) op.from = { target: spec.from.target, end: spec.from.end };
    const put = (v: unknown) => {
      op.value = ser(v, this.ctx);
      op.display = resultShort(v);
    };
    switch (spec.method) {
      case 'push':
      case 'pushleft':
        if (container !== 'list') return null;
        op.kind = spec.method;
        put(args[0]);
        op.index = spec.method === 'push' ? size : 0;
        return op;
      case 'pop':
      case 'popleft':
        if (container !== 'list') return null;
        op.kind = spec.method;
        if (!size) op.empty = true;
        else {
          const arr = box as unknown[];
          put(spec.method === 'pop' ? arr[size - 1] : arr[0]);
          op.index = spec.method === 'pop' ? size - 1 : 0;
        }
        return op;
      case 'add':
        if (!(box instanceof Set)) return null;
        op.kind = 'add';
        op.existed = box.has(args[0]);
        put(args[0]);
        return op;
      case 'delete':
        if (box instanceof Set) {
          op.kind = 'discard';
          op.existed = box.has(args[0]);
          put(args[0]);
          return op;
        }
        if (box instanceof Map) {
          op.kind = 'delitem';
          op.key = short(args[0]);
          if (box.has(args[0])) put(box.get(args[0]));
          else op.missing = true;
          return op;
        }
        return null;
      case 'mapset':
        if (!(box instanceof Map)) return null;
        op.kind = 'setitem';
        op.key = short(args[0]);
        op.existed = box.has(args[0]);
        put(args[1]);
        return op;
      case 'clear':
        if (container === 'list') return null;
        op.kind = 'clear';
        return op;
      case 'setitem':
      case 'delitem': {
        if (container !== 'dict' || box instanceof Map) return null;
        const k = this.read(spec.key!);
        if (!k.ok) return null;
        const key = String(k.v);
        const has = Object.prototype.hasOwnProperty.call(box, key);
        op.kind = spec.method;
        op.key = short(k.v);
        if (spec.method === 'setitem') {
          const v = this.read(spec.value!);
          if (!v.ok) return null;
          op.existed = has;
          put(v.v);
        } else if (has) put((box as Record<string, unknown>)[key]);
        else op.missing = true;
        return op;
      }
    }
    return null;
  }

  multi(spec: MultiSpec): MultiAssign | null {
    const pairs: MultiAssign['pairs'] = [];
    for (const p of spec.pairs) {
      const r = this.read(p.th);
      if (!r.ok) return null;
      const pair: MultiAssign['pairs'][number] = { target: p.target, valueSrc: p.valueSrc, value: ser(r.v, this.ctx), display: resultShort(r.v) };
      const loc = this.loc(p.vLoc);
      const tLoc = this.loc(p.tLoc);
      if (loc) pair.loc = loc;
      if (tLoc) pair.targetLoc = tLoc;
      pairs.push(pair);
    }
    return { src: spec.src, pairs, swap: spec.swap };
  }

  slices(specs: SliceSpec[]): SliceInfo[] {
    const out: SliceInfo[] = [];
    for (const s of specs) {
      const seq = this.read(s.seq);
      if (!seq.ok || !(Array.isArray(seq.v) || typeof seq.v === 'string')) continue;
      const len = (seq.v as unknown[] | string).length;
      const arg = (th: number | null, dflt: number) => {
        if (th === null) return dflt;
        const r = this.read(th);
        const n = Number(r.v);
        return r.ok && !Number.isNaN(n) ? Math.trunc(n) : r.ok && r.v === undefined ? dflt : 0;
      };
      let start = arg(s.start, 0);
      let stop = arg(s.end, len);
      if (s.kind === 'slice') {
        start = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
        stop = stop < 0 ? Math.max(len + stop, 0) : Math.min(stop, len);
      } else {
        start = Math.min(Math.max(start, 0), len);
        stop = Math.min(Math.max(stop, 0), len);
        if (start > stop) [start, stop] = [stop, start];
      }
      const result = this.read(s.result);
      if (!result.ok) continue;
      out.push({ var: s.var, src: s.src, start, stop, step: 1, display: resultShort(result.v) });
    }
    return out;
  }
}

/** 計數迴圈的總圈數 */
export function loopTotal(spec: LoopSpec, read: Read): number | undefined {
  const total = spec.total;
  if (!total) return undefined;
  if (total.k === 'seq') {
    const r = read(total.th);
    if (!r.ok) return undefined;
    const v: unknown = r.v;
    return typeof v === 'string' ? v.length : Array.isArray(v) ? v.length : v instanceof Set || v instanceof Map ? v.size : undefined;
  }
  const a = read(total.varTh);
  const b = read(total.boundTh);
  if (!a.ok || !b.ok || typeof a.v !== 'number' || typeof b.v !== 'number') return undefined;
  const from = a.v;
  const to = b.v;
  const n = total.dir === 1 ? Math.ceil(to - from) + (total.cmp === '<=' ? 1 : 0) : Math.ceil(from - to) + (total.cmp === '>=' ? 1 : 0);
  return Number.isFinite(n) ? Math.max(0, n) : undefined;
}

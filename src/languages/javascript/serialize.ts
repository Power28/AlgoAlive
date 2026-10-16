/**
 * JavaScript 值 → 帶型別標籤的 Value（與 Python 追蹤器的 _ser 相同格式）。
 * class 實例（ListNode、TreeNode…）以參照放進 heap，陣列 / Set / Map / 一般物件依結構展開。
 */
import type { Heap, Value } from '../../types';

const MAX_ITEMS = 100;
const MAX_DEPTH = 5;
const MAX_STR = 200;
const MAX_NODES = 120;
// 超過 MAX_ITEMS 的陣列：開頭、結尾，以及每個指針（整數變數）附近的格子（與 Python 追蹤器相同）
const SPARSE_HEAD = 10;
const SPARSE_TAIL = 5;
const SPARSE_AROUND = 4;
const SPARSE_MAX = 150;

/** 大的 Map / Set / 物件要送出的位置：開頭、結尾，以及 key（元素）等於目前變數值的項目 */
export function sparseEntries(keys: unknown[], focusValues: Set<unknown>): number[] {
  const n = keys.length;
  const keep = new Set<number>();
  for (let i = 0; i < Math.min(SPARSE_HEAD, n); i++) keep.add(i);
  for (let i = Math.max(0, n - SPARSE_TAIL); i < n; i++) keep.add(i);
  if (focusValues.size) {
    for (let i = 0; i < n && keep.size < SPARSE_MAX; i++) if (focusValues.has(keys[i])) keep.add(i);
  }
  return [...keep].sort((a, b) => a - b).slice(0, SPARSE_MAX);
}

/** 大陣列要送出的位置（由小到大，最多 SPARSE_MAX 格） */
export function sparseIndexes(n: number, focus: Iterable<number>): number[] {
  const keep = new Set<number>();
  for (let i = 0; i < Math.min(SPARSE_HEAD, n); i++) keep.add(i);
  for (let i = Math.max(0, n - SPARSE_TAIL); i < n; i++) keep.add(i);
  for (const f of [...focus].sort((a, b) => a - b)) {
    for (let i = f - SPARSE_AROUND; i <= f + SPARSE_AROUND; i++) if (i >= 0 && i < n) keep.add(i);
    if (keep.size >= SPARSE_MAX) break;
  }
  return [...keep].sort((a, b) => a - b).slice(0, SPARSE_MAX);
}


export const isNodeObject = (v: object) => {
  const proto = Object.getPrototypeOf(v);
  return proto !== null && proto !== Object.prototype && !Array.isArray(v) && !(v instanceof Map) && !(v instanceof Set) && !(v instanceof Error) && typeof v !== 'function';
};

export class Registry {
  private ids = new WeakMap<object, string>();
  private next = 1;
  sid(o: object): string {
    let id = this.ids.get(o);
    if (!id) {
      id = `o${this.next++}`;
      this.ids.set(o, id);
    }
    return id;
  }
}

export class Ctx {
  heap: Record<string, Heap[string] | null> = {};
  /** 這一步的整數變數：大陣列只送出這些位置（可能是指針）附近的格子 */
  focus = new Set<number>();
  /** 這一步的變數值：大的 Map / Set / 物件只送出 key 等於這些值的項目，以及開頭、結尾 */
  focusValues = new Set<unknown>();
  private queue: [string, object][] = [];
  private registry: Registry;
  constructor(registry: Registry) {
    this.registry = registry;
  }

  ref(o: object): Value {
    const id = this.registry.sid(o);
    if (!(id in this.heap) && Object.keys(this.heap).length < MAX_NODES) {
      this.heap[id] = null;
      this.queue.push([id, o]);
    }
    return { type: 'ref', id, cls: o.constructor?.name || 'Object' };
  }

  drain(): Heap {
    while (this.queue.length) {
      const [id, o] = this.queue.shift()!;
      const fields: Record<string, Value> = {};
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'function' || typeof v === 'symbol') continue;
        fields[k] = ser(v, this);
      }
      this.heap[id] = { cls: o.constructor?.name || 'Object', fields };
    }
    const out: Heap = {};
    for (const [k, v] of Object.entries(this.heap)) if (v) out[k] = v;
    return out;
  }
}

export function ser(v: unknown, ctx: Ctx | null, depth = 0, seen: Set<object> = new Set()): Value {
  if (v === null) return { type: 'none' };
  if (v === undefined) return { type: 'repr', value: 'undefined', cls: 'undefined' };
  if (typeof v === 'boolean') return { type: 'bool', value: v };
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return { type: 'float', value: 'nan' };
    if (!Number.isFinite(v)) return { type: 'float', value: v > 0 ? 'inf' : '-inf' };
    return Number.isInteger(v) ? { type: 'int', value: v } : { type: 'float', value: v };
  }
  if (typeof v === 'bigint') return { type: 'int', value: v.toString() };
  if (typeof v === 'string') return { type: 'str', value: v.length <= MAX_STR ? v : `${v.slice(0, MAX_STR)}…` };
  if (typeof v === 'function') return { type: 'repr', value: `ƒ ${v.name || 'anonymous'}`, cls: 'function' };
  if (typeof v === 'symbol') return { type: 'repr', value: v.toString(), cls: 'symbol' };
  const o = v as object;
  if (ctx && isNodeObject(o)) return ctx.ref(o);
  if (depth >= MAX_DEPTH) return { type: 'repr', value: '…' };
  if (seen.has(o)) return { type: 'repr', value: '[circular]' };
  const next = new Set(seen).add(o);
  const items = (xs: unknown[]) => xs.slice(0, MAX_ITEMS).map((x) => ser(x, ctx, depth + 1, next));
  const trunc = (n: number) => (n > MAX_ITEMS ? { truncated: n - MAX_ITEMS } : {});
  if (Array.isArray(o)) {
    if (o.length > MAX_ITEMS && depth === 0 && ctx) {
      const keep = sparseIndexes(o.length, ctx.focus);
      return { type: 'list', items: keep.map((i) => ser(o[i], ctx, depth + 1, next)), index: keep, length: o.length };
    }
    return { type: 'list', items: items(o), ...trunc(o.length) };
  }
  if (o instanceof Set) {
    const xs = [...o];
    if (xs.length > MAX_ITEMS && depth === 0 && ctx) {
      const keep = sparseEntries(xs, ctx.focusValues);
      return { type: 'set', items: keep.map((i) => ser(xs[i], ctx, depth + 1, next)), index: keep, length: xs.length };
    }
    return { type: 'set', items: items(xs), ...trunc(xs.length) };
  }
  if (o instanceof Map) {
    const es = [...o.entries()];
    if (es.length > MAX_ITEMS && depth === 0 && ctx) {
      const keep = sparseEntries(es.map(([k]) => k), ctx.focusValues);
      return {
        type: 'dict',
        cls: 'Map',
        entries: keep.map((i) => [ser(es[i][0], ctx, depth + 1, next), ser(es[i][1], ctx, depth + 1, next)] as [Value, Value]),
        index: keep,
        length: es.length,
      };
    }
    return {
      type: 'dict',
      cls: 'Map',
      entries: es.slice(0, MAX_ITEMS).map(([k, x]) => [ser(k, ctx, depth + 1, next), ser(x, ctx, depth + 1, next)] as [Value, Value]),
      ...trunc(es.length),
    };
  }
  if (o instanceof Error) return { type: 'repr', value: `${o.name}: ${o.message}`, cls: o.name };
  const es = Object.entries(o).filter(([, x]) => typeof x !== 'function');
  if (es.length > MAX_ITEMS && depth === 0 && ctx) {
    // 物件的 key 都是字串：用變數值的字串比對
    const keys = new Set([...ctx.focusValues].map(String));
    const keep = sparseEntries(es.map(([k]) => k), keys);
    return {
      type: 'dict',
      cls: 'Object',
      entries: keep.map((i) => [{ type: 'str', value: es[i][0] }, ser(es[i][1], ctx, depth + 1, next)] as [Value, Value]),
      index: keep,
      length: es.length,
    };
  }
  return {
    type: 'dict',
    cls: 'Object',
    entries: es.slice(0, MAX_ITEMS).map(([k, x]) => [{ type: 'str', value: k }, ser(x, ctx, depth + 1, next)] as [Value, Value]),
    ...trunc(es.length),
  };
}

/** 簡短顯示（呼叫堆疊上的參數、console.log、設計題的輸出） */
export function short(v: unknown, limit = 16): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') {
    const s = JSON.stringify(v);
    return s.length <= limit ? s : `${s.slice(0, limit - 2)}…"`;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : String(v);
  if (typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v === 'function') return `ƒ ${v.name}`;
  if (typeof v === 'object') {
    if (isNodeObject(v)) {
      const val = (v as { val?: unknown }).val;
      return val !== undefined && typeof val !== 'object' ? `(${short(val)})` : (v.constructor?.name ?? 'Object');
    }
    const text = inspect(v, 2);
    if (text.length <= limit) return text;
    if (Array.isArray(v)) return `Array(${v.length})`;
    if (v instanceof Map || v instanceof Set) return `${v.constructor.name}(${v.size})`;
    return '{…}';
  }
  return String(v);
}

/** console.log 的顯示 */
export function inspect(v: unknown, depth = 3, seen: Set<object> = new Set()): string {
  if (typeof v === 'string') return depth === 3 ? v : JSON.stringify(v);
  if (v === null || v === undefined || typeof v !== 'object') return typeof v === 'function' ? `[Function: ${v.name}]` : String(v);
  if (seen.has(v)) return '[Circular]';
  if (depth <= 0) return Array.isArray(v) ? '[Array]' : '[Object]';
  const next = new Set(seen).add(v);
  const f = (x: unknown) => (typeof x === 'string' ? JSON.stringify(x) : inspect(x, depth - 1, next));
  if (Array.isArray(v)) return `[${v.map(f).join(', ')}]`;
  if (v instanceof Set) return `Set(${v.size}) {${[...v].map(f).join(', ')}}`;
  if (v instanceof Map) return `Map(${v.size}) {${[...v].map(([k, x]) => `${f(k)} => ${f(x)}`).join(', ')}}`;
  const name = isNodeObject(v) ? `${v.constructor?.name ?? ''} ` : '';
  return `${name}{${Object.entries(v).map(([k, x]) => `${k}: ${f(x)}`).join(', ')}}`;
}


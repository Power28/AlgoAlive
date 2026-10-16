import type { Heap, Value } from '../types';
import { formatCell, formatValue, isScalar, nodeKind } from './value';
import { pointerColor } from './pointers';

export interface GraphNode {
  /** 物件圖為 heap id，鄰接串列為 key 的 Python repr（例如 "0"、"'a'"） */
  key: string;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight?: string;
}

export interface GraphModel {
  /** 用來當 React key 與標題 */
  name: string;
  kind: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** 變數名稱看起來是鄰接串列 */
const ADJ_NAME = /^(graph|adj|adjacency|adj_?list|g|neighbors|nbrs|edges_from|children)$/i;
export const isAdjacencyName = (name: string) => ADJ_NAME.test(name);

/** 鄰接串列的節點 key：Python repr，與變數值比對用 */
export const scalarKey = (v: Value) => formatValue(v);

/** 任何值對應到的節點 key（物件 → heap id，純量 → repr），不是節點則為 null */
export function nodeKeyOf(v: Value | undefined): string | null {
  if (!v) return null;
  if (v.type === 'ref') return v.id;
  return isScalar(v) && v.type !== 'none' ? scalarKey(v) : null;
}

const containerItems = (v: Value): Value[] | null =>
  v.type === 'list' || v.type === 'tuple' || v.type === 'set' || v.type === 'deque' ? v.items : null;

/** 鄰接串列的一個元素：純量 → 鄰居；(鄰居, 權重) → 帶權重的邊 */
function neighborOf(item: Value): { key: string; label: string; weight?: string } | null {
  if (isScalar(item) && item.type !== 'none') return { key: scalarKey(item), label: formatCell(item) };
  const pair = containerItems(item);
  if (pair && pair.length === 2 && isScalar(pair[0])) {
    return { key: scalarKey(pair[0]), label: formatCell(pair[0]), weight: isScalar(pair[1]) ? formatCell(pair[1]) : undefined };
  }
  return null;
}

/** dict / list[list] 形式的鄰接串列 → 圖；結構不符時回傳 null */
export function adjacencyGraph(name: string, v: Value): GraphModel | null {
  const rows: [Value, Value][] =
    v.type === 'dict'
      ? v.entries
      : v.type === 'list'
        ? v.items.map((row, i) => [{ type: 'int', value: i }, row] as [Value, Value])
        : [];
  if (!rows.length) return null;

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const addNode = (key: string, label: string) => nodes.has(key) || nodes.set(key, { key, label });

  for (const [k, row] of rows) {
    if (!isScalar(k) || k.type === 'none') return null;
    const items = containerItems(row);
    if (!items) return null;
    const from = scalarKey(k);
    addNode(from, formatCell(k));
    for (const item of items) {
      const nb = neighborOf(item);
      if (!nb) return null;
      addNode(nb.key, nb.label);
      edges.push({ from, to: nb.key, weight: nb.weight });
    }
  }
  return { name, kind: v.type === 'dict' ? (v.cls ?? 'dict') : 'list[list]', nodes: sortNodes([...nodes.values()]), edges };
}

/** 物件圖：heap 中有「節點清單」欄位（neighbors…）的物件 */
export function objectGraph(heap: Heap): GraphModel | null {
  const ids = Object.keys(heap).filter((id) => nodeKind(heap[id]) === 'graph');
  if (!ids.length) return null;
  const edges: GraphEdge[] = [];
  for (const id of ids) {
    for (const field of Object.values(heap[id].fields)) {
      for (const item of containerItems(field) ?? []) {
        if (item.type === 'ref' && heap[item.id] && nodeKind(heap[item.id]) === 'graph') edges.push({ from: id, to: item.id });
      }
    }
  }
  const nodes = ids.map((id) => {
    const val = heap[id].fields.val;
    return { key: id, label: val ? formatCell(val, heap) : heap[id].cls };
  });
  // 依建立順序（id 數字）排列，原圖與複製出的新圖各自穩定
  nodes.sort((a, b) => Number(a.key.slice(1)) - Number(b.key.slice(1)));
  return { name: 'graph', kind: heap[ids[0]].cls, nodes, edges };
}

function sortNodes(nodes: GraphNode[]): GraphNode[] {
  const num = (k: string) => (/^-?\d+$/.test(k) ? Number(k) : NaN);
  return nodes.sort((a, b) => {
    const na = num(a.key);
    const nb = num(b.key);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.key.localeCompare(b.key);
  });
}

// ─────────────── 疊加在圖上的走訪狀態 ───────────────

/**
 * 代表「目前所在節點」或「下一個節點」的變數名稱。
 * 刻意不含 u / v / course / pre：它們多半是建圖迴圈 `for u, v in edges` 留下的舊值，會造成誤標。
 */
const FROM_NAMES = new Set(['node', 'cur', 'curr', 'start', 'src', 'source', 'parent', 'root', 'city']);
const TO_NAMES = new Set(['nxt', 'next_node', 'nei', 'neighbor', 'nb', 'child', 'dst', 'dest', 'target']);
const VISITED_NAMES = /^(visited|seen|vis|done|explored|clones|cloned|old_to_new)$/i;
const FRONTIER_NAMES = /^(queue|q|stack|frontier|todo|to_visit)$/i;
const PATH_NAMES = /^(path|route|trail|cur_path|current_path)$/i;
/** 每個節點一個值的陣列 / dict，顯示成節點旁的小標籤 */
const ATTR_NAMES = /^(indegree|in_degree|indeg|outdegree|out_degree|degree|dist|distance|distances|cost|depth|level|parent|parents|order|rank|low|disc|color|colors|side|group)$/i;
const COLOR_NAMES = /^(color|colors|side|group)$/i;

export const GROUP_COLORS = ['#ffa116', '#0a84ff', '#2cbb5d', '#b07cff', '#ff6ec7'];

export interface GraphOverlay {
  labels: Map<string, { name: string; color: string }[]>;
  visited: Set<string>;
  frontier: Set<string>;
  /** 節點 → ["indegree 1", "dist 3"] */
  badges: Map<string, string[]>;
  /** 節點 → 分組顏色（color / side 陣列） */
  fill: Map<string, string>;
  /** 要強調的邊 "from→to" */
  activeEdges: Set<string>;
}

/** 依目前的區域變數，算出每個節點的標籤、拜訪狀態、屬性與要強調的邊 */
export function graphOverlay(graph: GraphModel, vars: Record<string, Value>, exclude: Set<string>): GraphOverlay {
  const keys = new Set(graph.nodes.map((n) => n.key));
  const isObjectGraph = graph.nodes.length > 0 && /^o\d+$/.test(graph.nodes[0].key);
  const o: GraphOverlay = { labels: new Map(), visited: new Set(), frontier: new Set(), badges: new Map(), fill: new Map(), activeEdges: new Set() };
  const edgeSet = new Set(graph.edges.map((e) => `${e.from}→${e.to}`));
  const froms: string[] = [];
  const tos: string[] = [];

  for (const [name, v] of Object.entries(vars)) {
    if (exclude.has(name)) continue;
    const key = nodeKeyOf(v);

    // 指向節點的變數：物件圖看參照，鄰接串列只認「節點名稱」的變數，避免 count = 2 之類被誤標
    if (key && keys.has(key) && (isObjectGraph ? v.type === 'ref' : FROM_NAMES.has(name) || TO_NAMES.has(name))) {
      o.labels.set(key, [...(o.labels.get(key) ?? []), { name, color: pointerColor(name) }]);
      if (FROM_NAMES.has(name)) froms.push(key);
      if (TO_NAMES.has(name)) tos.push(key);
      continue;
    }

    const items = containerItems(v);
    if (VISITED_NAMES.test(name)) {
      if (items) {
        // visited 也可能是布林陣列：visited[i] = True
        if (items.every((x) => x.type === 'bool')) items.forEach((x, i) => x.type === 'bool' && x.value && keys.has(String(i)) && o.visited.add(String(i)));
        else for (const x of items) {
          const k = nodeKeyOf(x);
          if (k && keys.has(k)) o.visited.add(k);
        }
      } else if (v.type === 'dict') {
        for (const [k] of v.entries) {
          const nk = nodeKeyOf(k);
          if (nk && keys.has(nk)) o.visited.add(nk);
        }
      }
    }
    if (FRONTIER_NAMES.test(name) && items) {
      for (const x of items) {
        const k = nodeKeyOf(x);
        if (k && keys.has(k)) o.frontier.add(k);
      }
    }
    if (PATH_NAMES.test(name) && items) {
      const ks = items.map(nodeKeyOf);
      for (let i = 0; i + 1 < ks.length; i++) {
        const [a, b] = [ks[i], ks[i + 1]];
        if (a && b && edgeSet.has(`${a}→${b}`)) o.activeEdges.add(`${a}→${b}`);
      }
    }
    if (ATTR_NAMES.test(name) && !isObjectGraph) {
      // list：索引就是節點 key；dict：key 就是節點
      const pairs: [string, Value][] =
        v.type === 'list' ? v.items.map((x, i) => [String(i), x]) : v.type === 'dict' ? v.entries.map(([k, x]) => [nodeKeyOf(k) ?? '', x]) : [];
      for (const [k, x] of pairs) {
        if (!keys.has(k) || !isScalar(x)) continue;
        if (COLOR_NAMES.test(name)) {
          if (x.type === 'int' && typeof x.value === 'number' && x.value >= 0) o.fill.set(k, GROUP_COLORS[x.value % GROUP_COLORS.length]);
          continue;
        }
        o.badges.set(k, [...(o.badges.get(k) ?? []), `${name} ${formatCell(x)}`]);
      }
    }
  }

  // 目前正在走的邊：node → nxt
  for (const a of froms) for (const b of tos) if (edgeSet.has(`${a}→${b}`)) o.activeEdges.add(`${a}→${b}`);
  return o;
}

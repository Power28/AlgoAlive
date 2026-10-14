import { LayoutGroup, motion } from 'framer-motion';
import type { Heap } from '../types';
import { formatCell, formatPy, nodeKind, refTarget, valueKey } from '../lib/pyValue';
import { useT } from '../i18n';
import { Header } from './ArrayView';

/** 指向某節點的變數標籤 */
export interface NodeLabel {
  name: string;
  color: string;
}

interface Props {
  heap: Heap;
  prevHeap?: Heap;
  /** 節點 id → 指向它的變數 */
  labels: Map<string, NodeLabel[]>;
  /** 節點 id → 外層呼叫中指向它的變數（例如 "root·2"），標出遞迴路徑 */
  trail?: Map<string, string[]>;
}

const spring = { type: 'spring', stiffness: 380, damping: 34 } as const;
const idNum = (id: string) => Number(id.slice(1));

function nodeState(id: string, heap: Heap, prevHeap?: Heap) {
  const prev = prevHeap?.[id];
  const cur = heap[id];
  return {
    isNew: !!prevHeap && !prev,
    valChanged: !!prev && valueKey(prev.fields.val) !== valueKey(cur.fields.val),
  };
}

function Labels({ labels, trail }: { labels?: NodeLabel[]; trail?: string[] }) {
  if (!labels?.length && !trail?.length) return null;
  return (
    <div className="mt-1 flex flex-col items-center gap-0.5">
      {labels?.map((l) => (
        <span key={l.name} className="rounded px-1.5 font-mono text-[11px] leading-4 font-semibold text-ink-900" style={{ backgroundColor: l.color }}>
          {l.name}
        </span>
      ))}
      {trail?.map((name) => (
        <span key={name} className="rounded bg-ink-850 px-1 font-mono text-[10px] leading-3 whitespace-nowrap text-ink-400">
          {name}
        </span>
      ))}
    </div>
  );
}

function nodeStyle(labels: NodeLabel[] | undefined, isNew: boolean, valChanged: boolean, onTrail = false) {
  const accent = labels?.[0]?.color;
  return {
    borderColor: accent ?? (onTrail ? '#9a7a4a' : '#4a4a4a'),
    borderStyle: !accent && onTrail ? 'dashed' : 'solid',
    boxShadow: accent ? `0 0 0 1px ${accent}55, 0 0 14px ${accent}33` : 'none',
    backgroundColor: isNew ? 'rgba(44,187,93,0.22)' : valChanged ? 'rgba(255,161,22,0.28)' : '#2a2a2a',
  };
}

// ───────────────────────────── 鏈結串列 ─────────────────────────────

interface Chain {
  ids: string[];
  /** 結尾：None、接回本鏈第 k 個節點（環）、或併入另一條鏈的某節點 */
  end: { kind: 'none' } | { kind: 'cycle'; index: number } | { kind: 'merge'; id: string } | { kind: 'more' };
}

function buildChains(heap: Heap): Chain[] {
  const ids = Object.keys(heap).filter((id) => nodeKind(heap[id]) === 'list');
  const next = (id: string) => {
    const t = refTarget(heap[id].fields.next, heap);
    return t && nodeKind(heap[t]) === 'list' ? t : null;
  };
  const incoming = new Set(ids.map(next).filter(Boolean) as string[]);
  const byId = (a: string, b: string) => idNum(a) - idNum(b);
  const heads = ids.filter((id) => !incoming.has(id)).sort(byId);
  const visited = new Set<string>();
  const chains: Chain[] = [];

  const walk = (start: string) => {
    const seq: string[] = [];
    let cur: string | null = start;
    while (cur && !visited.has(cur)) {
      visited.add(cur);
      seq.push(cur);
      cur = next(cur);
    }
    const lastNext = heap[seq.at(-1)!].fields.next;
    let end: Chain['end'];
    if (cur) end = seq.includes(cur) ? { kind: 'cycle', index: seq.indexOf(cur) } : { kind: 'merge', id: cur };
    else end = lastNext?.type === 'ref' ? { kind: 'more' } : { kind: 'none' };
    chains.push({ ids: seq, end });
  };

  heads.forEach(walk);
  // 沒有起點的純環
  for (const id of [...ids].sort(byId)) if (!visited.has(id)) walk(id);
  // 依建立順序排列，讓反轉等操作中各列的上下位置穩定
  return chains.sort((a, b) => Math.min(...a.ids.map(idNum)) - Math.min(...b.ids.map(idNum)));
}

export function LinkedListView({ heap, prevHeap, labels, trail }: Props) {
  const t = useT();
  const chains = buildChains(heap);
  if (!chains.length) return null;
  const signature = chains.map((c) => c.ids.join('>')).join('|');
  const total = chains.reduce((n, c) => n + c.ids.length, 0);

  const nextChanged = (id: string) =>
    !!prevHeap?.[id] && valueKey(prevHeap[id].fields.next) !== valueKey(heap[id].fields.next);

  return (
    <section>
      <Header name={t('linkedList')} kind="ListNode" meta={t('nodeCount', { n: total })} />
      <LayoutGroup>
        <div className="scrollbar-thin flex flex-col gap-4 overflow-x-auto pb-1">
          {chains.map((chain, ci) => (
            <div key={ci} className="flex items-start">
              {chain.ids.map((id, i) => {
                const { isNew, valChanged } = nodeState(id, heap, prevHeap);
                const nodeLabels = labels.get(id);
                const val = heap[id].fields.val;
                return (
                  <motion.div key={id} layoutId={`ll-${id}`} layoutDependency={signature} transition={spring} className="flex items-start">
                    <div className="flex flex-col items-center">
                      <div
                        title={formatPy(val ?? { type: 'none' }, heap)}
                        className="flex h-11 min-w-11 items-center justify-center rounded-lg border-2 px-2 font-mono text-[15px] font-semibold transition-colors duration-300"
                        style={nodeStyle(nodeLabels, isNew, valChanged, trail?.has(id))}
                      >
                        {val ? formatCell(val, heap) : '·'}
                      </div>
                      <Labels labels={nodeLabels} trail={trail?.get(id)} />
                    </div>
                    {/* next 箭頭；這一步剛改過 next 的節點，箭頭以橘色標示 */}
                    {(i < chain.ids.length - 1 || chain.end.kind !== 'none') && (
                      <span
                        className="mx-1 mt-2.5 font-mono text-lg leading-none transition-colors duration-300"
                        style={{ color: nextChanged(id) ? '#ffa116' : '#6b6b6b' }}
                      >
                        →
                      </span>
                    )}
                    {i === chain.ids.length - 1 && <ChainEnd chain={chain} heap={heap} nextChanged={nextChanged(id)} />}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </LayoutGroup>
    </section>
  );
}

function ChainEnd({ chain, heap, nextChanged }: { chain: Chain; heap: Heap; nextChanged: boolean }) {
  const base = 'mt-1 flex h-9 items-center rounded-md border border-dashed px-2 font-mono text-xs';
  const color = nextChanged ? '#ffa116' : '#8a8a8a';
  switch (chain.end.kind) {
    case 'none':
      return (
        <span className="mx-1 mt-2.5 flex items-center gap-1 font-mono text-lg leading-none" style={{ color: nextChanged ? '#ffa116' : '#6b6b6b' }}>
          → <span className="text-xs text-ink-400">None</span>
        </span>
      );
    case 'cycle': {
      const target = chain.ids[chain.end.index];
      return (
        <span className={base} style={{ borderColor: '#ef4743', color: '#ef4743' }} title="cycle">
          ↺ {formatCell(heap[target].fields.val ?? { type: 'none' }, heap)} (#{chain.end.index})
        </span>
      );
    }
    case 'merge':
      return (
        <span className={base} style={{ borderColor: color, color }}>
          ⤷ {formatCell(heap[chain.end.id].fields.val ?? { type: 'none' }, heap)}
        </span>
      );
    default:
      return <span className={base}>…</span>;
  }
}

// ───────────────────────────── 二元樹 ─────────────────────────────

const X_STEP = 52;
const Y_STEP = 78;
const NODE = 40;

interface Placed {
  id: string;
  x: number;
  y: number;
  parent?: string;
}

/** 以中序走訪決定 x、深度決定 y；多棵樹（例如子樹被拆開）依序並排。 */
function layoutTrees(heap: Heap): { placed: Placed[]; width: number; height: number } {
  const ids = Object.keys(heap).filter((id) => nodeKind(heap[id]) === 'tree');
  const child = (id: string, side: 'left' | 'right') => {
    const t = refTarget(heap[id].fields[side], heap);
    return t && nodeKind(heap[t]) === 'tree' ? t : null;
  };
  const isChild = new Set<string>();
  for (const id of ids) for (const side of ['left', 'right'] as const) {
    const c = child(id, side);
    if (c) isChild.add(c);
  }
  const roots = ids.filter((id) => !isChild.has(id)).sort((a, b) => idNum(a) - idNum(b));
  const placed: Placed[] = [];
  const visited = new Set<string>();
  let col = 0;
  let maxDepth = 0;

  const visit = (id: string, depth: number, parent?: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const l = child(id, 'left');
    if (l) visit(l, depth + 1, id);
    placed.push({ id, x: col++ * X_STEP, y: depth * Y_STEP, parent });
    maxDepth = Math.max(maxDepth, depth);
    const r = child(id, 'right');
    if (r) visit(r, depth + 1, id);
  };
  for (const root of roots) {
    visit(root, 0);
    col += 1; // 樹與樹之間留空
  }
  // 環狀參照等沒有根的節點
  for (const id of ids) if (!visited.has(id)) visit(id, 0);

  return { placed, width: Math.max(1, col) * X_STEP, height: (maxDepth + 1) * Y_STEP };
}

export function TreeView({ heap, prevHeap, labels, trail }: Props) {
  const t = useT();
  const { placed, width, height } = layoutTrees(heap);
  if (!placed.length) return null;
  const pos = new Map(placed.map((p) => [p.id, p]));
  const center = (p: Placed) => ({ cx: p.x + NODE / 2, cy: p.y + NODE / 2 });
  // 遞迴路徑上的節點（外層呼叫 + 目前變數），連線以橘色標示；沒有遞迴時不標
  const recursing = !!trail?.size;
  const onPath = (id: string) => recursing && (trail!.has(id) || labels.has(id));

  return (
    <section>
      <Header name={t('binaryTree')} kind="TreeNode" meta={t('nodeCount', { n: placed.length })} />
      <div className="scrollbar-thin overflow-x-auto pb-1">
        <div className="relative" style={{ width, height: height + 12 }}>
          <svg className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height}>
            {placed
              .filter((p) => p.parent)
              .map((p) => {
                const a = center(pos.get(p.parent!)!);
                const b = center(p);
                return (
                  <motion.line
                    key={`${p.parent}-${p.id}`}
                    initial={false}
                    animate={{ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy }}
                    transition={spring}
                    stroke={onPath(p.parent!) && onPath(p.id) ? '#c98a2e' : '#555'}
                    strokeWidth={onPath(p.parent!) && onPath(p.id) ? 2.5 : 1.5}
                  />
                );
              })}
          </svg>
          {placed.map((p) => {
            const { isNew, valChanged } = nodeState(p.id, heap, prevHeap);
            const nodeLabels = labels.get(p.id);
            const val = heap[p.id].fields.val;
            return (
              <motion.div
                key={p.id}
                className="absolute top-0 left-0 flex flex-col items-center"
                style={{ width: NODE }}
                initial={false}
                animate={{ x: p.x, y: p.y }}
                transition={spring}
              >
                <div
                  title={formatPy(val ?? { type: 'none' }, heap)}
                  className="flex items-center justify-center rounded-full border-2 font-mono text-sm font-semibold transition-colors duration-300"
                  style={{ width: NODE, height: NODE, ...nodeStyle(nodeLabels, isNew, valChanged, trail?.has(p.id)) }}
                >
                  {val ? formatCell(val, heap) : '·'}
                </div>
                <div className="relative z-10">
                  <Labels labels={nodeLabels} trail={trail?.get(p.id)} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

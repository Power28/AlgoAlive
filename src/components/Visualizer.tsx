import type { ReactNode } from 'react';
import { CornerDownLeft, TriangleAlert } from 'lucide-react';
import type { ExecutionStep, PyValue, SequenceValue } from '../types';
import { charItems, formatPy, intValue, isDict, isGrid, isSequence, isSet, nodeKind } from '../lib/pyValue';
import { HeapContext } from '../lib/heapContext';
import { isPointerName, pointerColor, pointersFor } from '../lib/pointers';
import type { IndexMap } from '../lib/indexing';
import { useT } from '../i18n';
import { ArrayView } from './ArrayView';
import { DictView, ScalarGrid, SetView } from './CollectionViews';
import { GridView, type GridMark } from './GridView';
import { LinkedListView, TreeView, type NodeLabel } from './StructureViews';
import { GraphView } from './GraphView';
import { ConditionPanel } from './ConditionPanel';
import { CalcPanel } from './CalcPanel';
import { cellsOf, gridCellsOf, stepMarks } from '../lib/stepMarks';
import { adjacencyGraph, graphOverlay, isAdjacencyName, objectGraph, type GraphModel } from '../lib/graph';

interface Props {
  step: ExecutionStep;
  prev?: ExecutionStep;
  cellKeys: Record<string, string[]>;
  indexMap: IndexMap;
}

const MAX_CHAR_CELLS = 60;
const GRID_MARK_COLORS = ['#ffa116', '#0a84ff', '#2cbb5d', '#b07cff'];

export function Visualizer({ step, prev, cellKeys, indexMap }: Props) {
  const t = useT();
  // 只有同一個 frame 的前一步才拿來做「變化」比對
  const sameFrame = prev && prev.depth === step.depth && prev.funcName === step.funcName;
  const prevVars = sameFrame ? prev.variables : undefined;
  const vars = step.variables;
  const entries = Object.entries(vars);
  const heap = step.heap ?? {};
  // 節點 id 是整次執行穩定的，跨 frame 也能比對
  const prevHeap = prev ? (prev.heap ?? {}) : undefined;

  // 指向鏈結串列 / 樹節點的變數 → 畫成節點下方的標籤
  const nodeLabels = new Map<string, NodeLabel[]>();
  const structureVars = new Set<string>();
  for (const [name, v] of entries) {
    if (v.type !== 'ref' || !heap[v.id] || nodeKind(heap[v.id]) === 'object') continue;
    nodeLabels.set(v.id, [...(nodeLabels.get(v.id) ?? []), { name, color: pointerColor(name) }]);
    structureVars.add(name);
  }
  const kinds = new Set(Object.values(heap).map(nodeKind));
  const { reads: marks, writes } = stepMarks(step);
  const trail = new Map<string, string[]>();
  for (const ref of step.stackRefs ?? []) trail.set(ref.id, [...(trail.get(ref.id) ?? []), `${ref.name}·${ref.depth}`]);

  // 2D 格子：依程式碼中的 grid[a][b] 組合標出目前位置
  // 一般圖：自訂節點物件（neighbors…）或名為 graph / adj 的鄰接串列
  const graphs: { graph: GraphModel; prev?: GraphModel }[] = [];
  const graphVars = new Set<string>();
  if (kinds.has('graph')) {
    const g = objectGraph(heap)!;
    graphs.push({ graph: g, prev: prev?.heap ? (objectGraph(prev.heap) ?? undefined) : undefined });
  }
  for (const [name, v] of entries) {
    if (!isAdjacencyName(name)) continue;
    const g = adjacencyGraph(name, v);
    if (!g) continue;
    const p = prevVars?.[name];
    graphs.push({ graph: g, prev: p ? (adjacencyGraph(name, p) ?? undefined) : undefined });
    graphVars.add(name);
  }

  const grids = entries.filter(([n, v]) => !graphVars.has(n) && isGrid(v)) as [string, SequenceValue][];
  const gridVars = new Set<string>();
  const gridMarks = new Map<string, GridMark[]>();
  for (const [name, v] of grids) {
    const marks: GridMark[] = [];
    for (const pair of indexMap.get(name)?.pairs ?? []) {
      const [a, b] = pair.split(',');
      const r = intValue(vars[a]);
      const c = intValue(vars[b]);
      const row = r !== null ? (v.items[r] as SequenceValue | undefined) : undefined;
      if (r === null || c === null || !row || c < 0 || c >= row.items.length) continue;
      marks.push({ label: `${a}, ${b}`, row: r, col: c, color: GRID_MARK_COLORS[marks.length % GRID_MARK_COLORS.length] });
      gridVars.add(a).add(b);
    }
    gridMarks.set(name, marks);
  }

  // 1D 序列：list / tuple / deque，以及「被當成陣列使用」的字串
  const sequences: { name: string; kind: string; items: PyValue[]; truncated?: number; prevItems?: PyValue[] }[] = [];
  const shownAsCells = new Set<string>();
  for (const [name, v] of entries) {
    const p = prevVars?.[name];
    if (graphVars.has(name)) continue;
    if (isSequence(v) && !isGrid(v)) {
      sequences.push({ name, kind: v.type, items: v.items, truncated: v.truncated, prevItems: p && isSequence(p) ? p.items : undefined });
      shownAsCells.add(name);
    } else if (v.type === 'str' && v.value.length >= 2 && v.value.length <= MAX_CHAR_CELLS) {
      // 程式碼有 s[...]，或有指針型變數落在範圍內（例如 enumerate 走訪的滑動視窗）
      const indexed = indexMap.has(name);
      const hasPointer = entries.some(([n, x]) => {
        const i = intValue(x);
        return i !== null && isPointerName(n) && i >= 0 && i <= v.value.length;
      });
      if (indexed || hasPointer) {
        const prevItems = p?.type === 'str' ? charItems(p.value) : undefined;
        sequences.push({ name, kind: 'str', items: charItems(v.value), prevItems });
        shownAsCells.add(name);
      }
    }
  }

  const pointerColors = new Map<string, string>();
  const pointersByList = sequences.map((s) => {
    const ps = pointersFor(vars, s.name, s.items.length, indexMap, gridVars);
    ps.forEach((p) => pointerColors.set(p.name, p.color));
    return ps;
  });
  for (const name of gridVars) if (!pointerColors.has(name)) pointerColors.set(name, pointerColor(name));

  const gridNames = new Set(grids.map(([n]) => n));
  const dicts = entries.filter(([n, v]) => !graphVars.has(n) && isDict(v));
  const sets = entries.filter(([, v]) => isSet(v));
  const scalars = entries.filter(
    ([n, v]) => !gridNames.has(n) && !shownAsCells.has(n) && !structureVars.has(n) && !isSequence(v) && !isDict(v) && !isSet(v),
  );

  // scalar 值 → 持有該值的變數名（用來標示 dict 中被查詢的 key）
  const lookups = new Map<string, string[]>();
  for (const [name, v] of scalars) {
    if (v.type !== 'int' && v.type !== 'str') continue;
    const k = JSON.stringify(v);
    lookups.set(k, [...(lookups.get(k) ?? []), name]);
  }

  return (
    <HeapContext.Provider value={heap}>
    <div className="flex flex-col gap-6">
      {step.event === 'line' && step.condition && <ConditionPanel condition={step.condition} heap={heap} line={step.lineNumber} />}
      {step.event === 'line' && step.calc && <CalcPanel calc={step.calc} line={step.lineNumber} />}
      {step.event === 'return' && step.returnValue && (
        <Banner tone="ok" icon={<CornerDownLeft size={16} />}>
          <span className="text-ink-300">{t('returned', { f: step.funcName })}</span>
          <code className="font-semibold" data-return>{formatPy(step.returnValue, heap)}</code>
        </Banner>
      )}
      {step.event === 'exception' && (
        <Banner tone="err" icon={<TriangleAlert size={16} />}>
          <code>{step.exception}</code>
        </Banner>
      )}

      {kinds.has('list') && <LinkedListView heap={heap} prevHeap={prevHeap} labels={nodeLabels} trail={trail} compared={marks.refs} />}
      {kinds.has('tree') && <TreeView heap={heap} prevHeap={prevHeap} labels={nodeLabels} trail={trail} compared={marks.refs} />}
      {graphs.map(({ graph, prev: prevGraph }) => (
        <GraphView key={graph.name} graph={graph} prev={prevGraph} overlay={graphOverlay(graph, vars, graphVars)} />
      ))}
      {sequences.map((s, i) => (
        <ArrayView
          key={s.name}
          name={s.name}
          kind={s.kind}
          items={s.items}
          truncated={s.truncated}
          keys={cellKeys[s.name] ?? []}
          prevItems={s.prevItems}
          pointers={pointersByList[i]}
          compared={cellsOf(marks, s.name)}
          wholeCompared={marks.vars.has(s.name)}
          written={cellsOf(writes, s.name)}
          wholeWritten={writes.vars.has(s.name)}
        />
      ))}
      {grids.map(([name, v]) => (
        <GridView key={name} name={name} value={v} prev={prevVars?.[name]} marks={gridMarks.get(name) ?? []} compared={gridCellsOf(marks, name)} written={gridCellsOf(writes, name)} />
      ))}
      {dicts.map(([name, v]) => (
        <DictView
          key={name}
          name={name}
          value={v as Extract<PyValue, { type: 'dict' }>}
          prev={prevVars?.[name]}
          lookups={lookups}
          compared={marks.vars.has(name)}
        />
      ))}
      {sets.map(([name, v]) => (
        <SetView key={name} name={name} value={v as SequenceValue} prev={prevVars?.[name]} compared={marks.vars.has(name)} />
      ))}
      <ScalarGrid entries={scalars} prevVars={prevVars} pointerColors={pointerColors} compared={marks.vars} written={writes.vars} />

      {entries.length === 0 && step.event === 'line' && <p className="text-sm text-ink-400">{t('noLocals')}</p>}
    </div>
    </HeapContext.Provider>
  );
}

function Banner({ tone, icon, children }: { tone: 'ok' | 'err'; icon: ReactNode; children: ReactNode }) {
  const cls = tone === 'ok' ? 'border-ok/40 bg-ok/10 text-ok' : 'border-err/40 bg-err/10 text-err';
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm ${cls}`}>
      {icon}
      {children}
    </div>
  );
}

import type { ReactNode } from 'react';
import { CornerDownLeft, TriangleAlert } from 'lucide-react';
import type { ExecutionStep, Value, SequenceValue } from '../types';
import { charItems, formatValue, intValue, isDict, isGrid, isSequence, isSet, nodeKind } from '../lib/value';
import { HeapContext } from '../lib/heapContext';
import { isPointerName, pointerColor, pointersFor } from '../lib/pointers';
import type { IndexMap } from '../lib/indexing';
import { useT } from '../i18n';
import { ArrayView } from './ArrayView';
import { DictView, ScalarGrid, SetView } from './CollectionViews';
import { GridView, type GridMark } from './GridView';
import { LinkedListView, TreeView, TrieView, type NodeLabel } from './StructureViews';
import { GraphView } from './GraphView';
import { ConditionPanel } from './ConditionPanel';
import { CalcPanel } from './CalcPanel';
import { ContextBar } from './ContextBar';
import { OpPanel } from './OpPanel';
import { CompPanel, JumpPanel, MultiPanel } from './StatementPanels';
import { ExcPanel, TryPanel } from './TryPanels';
import { BuiltinPanel } from './BuiltinPanel';
import { DesignTimeline, type DesignInfo } from './DesignTimeline';
import { HeapView } from './HeapView';
import { RecursionTree } from './RecursionTree';
import type { CallTree } from '../lib/callTree';
import { cellsOf, gridCellsOf, stepMarks } from '../lib/stepMarks';
import { adjacencyGraph, graphOverlay, isAdjacencyName, objectGraph, type GraphModel } from '../lib/graph';

interface Props {
  step: ExecutionStep;
  prev?: ExecutionStep;
  /** 下一步：break / continue 卡片用來說明接著執行哪一行 */
  next?: ExecutionStep;
  cellKeys: Record<string, string[]>;
  indexMap: IndexMap;
  /** 最上方卡片欄位的固定高度（px，見 infoSlotHeight）；沒給時卡片直接疊在內容上方 */
  slotHeight?: number;
  /** 呼叫堆疊 / 迴圈列（見 contextInfo）；沒給時不顯示 */
  context?: { stack: boolean; loops: boolean; frameKeys: string[] };
  /** 被 heapq 操作的 list 名稱（見 analyzeHeaps），額外畫成堆積樹 */
  heapNames?: Set<string>;
  /** 二維格子每一格的身分 key（見 computeGridKeys） */
  gridKeys?: Record<string, string[][]>;
  /** 遞迴樹（見 buildCallTree）；只在有遞迴的程式傳入 */
  callTree?: { tree: CallTree; index: number; onSeek?: (step: number) => void };
  /** 設計類題目的操作順序 */
  design?: DesignInfo;
}

const MAX_CHAR_CELLS = 60;
const GRID_MARK_COLORS = ['#ffa116', '#0a84ff', '#2cbb5d', '#b07cff'];

export function Visualizer({ step, prev, next, cellKeys, gridKeys, indexMap, slotHeight, context, heapNames, callTree, design }: Props) {
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
  const sequences: { name: string; kind: string; items: Value[]; truncated?: number; prevItems?: Value[] }[] = [];
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
    // for num in nums：沒有索引變數，用迴圈目前的圈數在 nums 上標出 num
    for (const loop of step.event === 'line' ? (step.loops ?? []) : []) {
      if (loop.seq !== s.name || !loop.item || loop.done || ps.some((p) => p.name === loop.item)) continue;
      const index = loop.iteration - 1;
      if (index >= 0 && index < s.items.length) ps.push({ name: loop.item, label: loop.item, index, color: pointerColor(loop.item) });
    }
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

  // 最上方的卡片：條件判斷、計算、回傳、例外（以步驟編號當 key：連續兩步都有卡片時也會重新播放動畫）
  const cond = step.event === 'line' ? step.condition : undefined;
  const calc = step.event === 'line' ? step.calc : undefined;
  const op = step.event === 'line' ? step.op : undefined;
  const multi = step.event === 'line' ? step.multi : undefined;
  const comp = step.event === 'line' ? step.comp : undefined;
  const jump = step.event === 'line' ? step.jump : undefined;
  const tryFlow = step.event === 'line' ? step.tryFlow : undefined;
  const builtinCalls = step.event === 'line' ? step.builtins : undefined;
  const returned = step.event === 'return' ? step.returnValue : undefined;
  const hasCard = !!(cond || calc || op || multi || comp || jump || tryFlow || builtinCalls?.length || returned || step.event === 'exception');
  const cards = (
    <>
      {cond && <ConditionPanel key={`cond-${step.stepIndex}`} condition={cond} heap={heap} line={step.lineNumber} />}
      {calc && <CalcPanel key={`calc-${step.stepIndex}`} calc={calc} line={step.lineNumber} />}
      {op && <OpPanel key={`op-${step.stepIndex}`} op={op} line={step.lineNumber} />}
      {multi && <MultiPanel key={`multi-${step.stepIndex}`} multi={multi} line={step.lineNumber} />}
      {builtinCalls?.map((b, i) => <BuiltinPanel key={`builtin-${step.stepIndex}-${i}`} call={b} line={step.lineNumber} />)}
      {tryFlow && <TryPanel key={`try-${step.stepIndex}`} flow={tryFlow} line={step.lineNumber} />}
      {jump && <JumpPanel key={`jump-${step.stepIndex}`} jump={jump} line={step.lineNumber} next={next} />}
      {comp && <CompPanel key={`comp-${step.stepIndex}`} comp={comp} line={step.lineNumber} heap={heap} />}
      {returned && (
        <Banner tone="ok" icon={<CornerDownLeft size={16} />}>
          <span className="text-ink-300">
            {design && (step.design?.index ?? 0) >= design.calls.length ? t('designOutput') : t('returned', { f: step.funcName })}
          </span>
          <code className="font-semibold" data-return>{formatValue(returned, heap)}</code>
        </Banner>
      )}
      {step.event === 'exception' && step.exc && <ExcPanel key={`exc-${step.stepIndex}`} exc={step.exc} line={step.lineNumber} func={step.funcName} />}
      {step.event === 'exception' && !step.exc && (
        <Banner tone="err" icon={<TriangleAlert size={16} />}>
          <code>{step.exception}</code>
        </Banner>
      )}
    </>
  );

  return (
    <HeapContext.Provider value={heap}>
    <div className="flex flex-col gap-6">
      {design && <DesignTimeline design={design} step={step} />}
      {context && (
        <ContextBar step={step} heap={heap} showStack={context.stack} showLoops={context.loops} frameKeys={context.frameKeys} />
      )}
      {slotHeight === undefined ? (
        cards
      ) : (
        // 固定高度的卡片欄位：卡片時有時無、高低不同，也不會推動下面的內容
        <div className="scrollbar-thin shrink-0 overflow-y-auto [overflow-anchor:none]" style={{ height: slotHeight }} data-info-slot>
          {hasCard ? (
            <div className="flex flex-col gap-3">{cards}</div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-ink-700 text-xs text-ink-600">
              {t('slotEmpty')}
            </div>
          )}
        </div>
      )}

      {callTree && <RecursionTree tree={callTree.tree} index={callTree.index} onSeek={callTree.onSeek} />}
      {kinds.has('list') && <LinkedListView heap={heap} prevHeap={prevHeap} labels={nodeLabels} trail={trail} compared={marks.refs} />}
      {kinds.has('trie') && <TrieView heap={heap} prevHeap={prevHeap} labels={nodeLabels} />}
      {kinds.has('tree') && <TreeView heap={heap} prevHeap={prevHeap} labels={nodeLabels} trail={trail} compared={marks.refs} />}
      {graphs.map(({ graph, prev: prevGraph }) => (
        <GraphView key={graph.name} graph={graph} prev={prevGraph} overlay={graphOverlay(graph, vars, graphVars)} />
      ))}
      {sequences.map((s, i) => (
        <div key={s.name} className="flex flex-col gap-3">
        {s.kind === 'list' && (heapNames?.has(s.name) || /^(heap|min_?heap|max_?heap|pq|priority_?queue)$/i.test(s.name)) && (
          <HeapView name={s.name} items={s.items} keys={cellKeys[s.name] ?? []} prevItems={s.prevItems} written={cellsOf(writes, s.name)} />
        )}
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
          slices={step.event === 'line' ? step.slices?.filter((sl) => sl.var === s.name) : undefined}
        />
        </div>
      ))}
      {grids.map(([name, v]) => (
        <GridView key={name} name={name} value={v} prev={prevVars?.[name]} marks={gridMarks.get(name) ?? []} compared={gridCellsOf(marks, name)} written={gridCellsOf(writes, name)} keys={gridKeys?.[name]} />
      ))}
      {dicts.map(([name, v]) => (
        <DictView
          key={name}
          name={name}
          value={v as Extract<Value, { type: 'dict' }>}
          prev={prevVars?.[name]}
          lookups={lookups}
          compared={marks.vars.has(name)}
          written={writes.vars.has(name)}
        />
      ))}
      {sets.map(([name, v]) => (
        <SetView key={name} name={name} value={v as SequenceValue} prev={prevVars?.[name]} compared={marks.vars.has(name)} written={writes.vars.has(name)} />
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

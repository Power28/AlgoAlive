import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { GraphEdge, GraphModel, GraphOverlay } from '../lib/graph';
import { useT } from '../i18n';
import { Header } from './ArrayView';

const NODE = 40;
const R = NODE / 2;
/** 圓周上相鄰節點的間距 */
const ARC = 104;
const MIN_RADIUS = 66;
const PAD = 48;

const spring = { type: 'spring', stiffness: 300, damping: 32 } as const;

interface Props {
  graph: GraphModel;
  prev?: GraphModel;
  overlay: GraphOverlay;
}

/** 以無向連通分量分組，每組排成一個圓，由左到右並排；位置只取決於節點 key 的順序，跨步驟穩定 */
function layout(graph: GraphModel) {
  const parent = new Map(graph.nodes.map((n) => [n.key, n.key]));
  const find = (k: string): string => (parent.get(k) === k ? k : find(parent.get(k)!));
  for (const e of graph.edges) {
    const a = find(e.from);
    const b = find(e.to);
    if (a !== b) parent.set(a, b);
  }
  const groups = new Map<string, string[]>();
  for (const n of graph.nodes) {
    const root = find(n.key);
    groups.set(root, [...(groups.get(root) ?? []), n.key]);
  }

  const pos = new Map<string, { x: number; y: number }>();
  let offsetX = 0;
  let height = 0;
  for (const keys of groups.values()) {
    const n = keys.length;
    const radius = n === 1 ? 0 : Math.max(MIN_RADIUS, (n * ARC) / (2 * Math.PI));
    keys.forEach((k, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
      pos.set(k, { x: offsetX + radius + radius * Math.cos(angle), y: radius + radius * Math.sin(angle) });
    });
    offsetX += 2 * radius + NODE + PAD;
    height = Math.max(height, 2 * radius + NODE);
  }
  return { pos, width: Math.max(offsetX - PAD, NODE), height };
}

/** 互相連接的一對邊只畫一條無箭頭的線；單向的邊畫箭頭 */
function dedupeEdges(edges: GraphEdge[]) {
  const set = new Set(edges.map((e) => `${e.from}→${e.to}`));
  const out: (GraphEdge & { both: boolean })[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (e.from === e.to) continue;
    const both = set.has(`${e.to}→${e.from}`);
    const id = both ? [e.from, e.to].sort().join('↔') : `${e.from}→${e.to}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...e, both });
  }
  return out;
}

export function GraphView({ graph, prev, overlay }: Props) {
  const t = useT();
  const { pos, width, height } = layout(graph);
  const edges = dedupeEdges(graph.edges);
  const prevNodes = prev ? new Set(prev.nodes.map((n) => n.key)) : undefined;
  const prevEdges = prev ? new Set(prev.edges.map((e) => `${e.from}→${e.to}`)) : undefined;
  const hasBadges = overlay.badges.size > 0;

  return (
    <section>
      <Header name={graph.name} kind={graph.kind} meta={t('graphMeta', { n: graph.nodes.length, e: edges.length })} />
      <div className="scrollbar-thin overflow-x-auto pb-1">
        <div className="relative" style={{ width: width + (hasBadges ? 70 : 0), height: height + 40 }}>
          <svg className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height}>
            <defs>
              {['#6b6b6b', '#ffa116', '#2cbb5d'].map((c) => (
                <marker key={c} id={`arrow-${c.slice(1)}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
                </marker>
              ))}
            </defs>
            {edges.map((e) => {
              const a = pos.get(e.from)!;
              const b = pos.get(e.to)!;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const len = Math.hypot(dx, dy) || 1;
              // 線段從圓周開始、到圓周結束，箭頭才不會被節點蓋住
              const [x1, y1] = [a.x + R + (dx / len) * R, a.y + R + (dy / len) * R];
              const [x2, y2] = [b.x + R - (dx / len) * (R + 2), b.y + R - (dy / len) * (R + 2)];
              const active = overlay.activeEdges.has(`${e.from}→${e.to}`) || (e.both && overlay.activeEdges.has(`${e.to}→${e.from}`));
              const isNew = !!prevEdges && !prevEdges.has(`${e.from}→${e.to}`);
              const color = active ? '#ffa116' : isNew ? '#2cbb5d' : '#6b6b6b';
              return (
                <g key={`${e.from}→${e.to}`}>
                  <motion.line
                    initial={false}
                    animate={{ x1, y1, x2, y2 }}
                    transition={spring}
                    stroke={color}
                    strokeWidth={active ? 2.5 : 1.5}
                    markerEnd={e.both ? undefined : `url(#arrow-${color.slice(1)})`}
                  />
                  {e.weight && (
                    <motion.text
                      initial={false}
                      // 權重標在邊的中點、往法線方向偏移，避免壓在線或箭頭上
                      animate={{ x: (x1 + x2) / 2 - (dy / len) * 11, y: (y1 + y2) / 2 + (dx / len) * 11 + 4 }}
                      transition={spring}
                      textAnchor="middle"
                      className="fill-ink-300 font-mono text-[11px]"
                      style={{ paintOrder: 'stroke', stroke: '#1e1e1e', strokeWidth: 4 }}
                    >
                      {e.weight}
                    </motion.text>
                  )}
                </g>
              );
            })}
          </svg>

          {graph.nodes.map((n) => {
            const p = pos.get(n.key)!;
            const labels = overlay.labels.get(n.key);
            const accent = labels?.[0]?.color;
            const visited = overlay.visited.has(n.key);
            const frontier = overlay.frontier.has(n.key);
            const fill = overlay.fill.get(n.key);
            const isNew = !!prevNodes && !prevNodes.has(n.key);
            return (
              <motion.div
                key={n.key}
                className="absolute top-0 left-0 flex flex-col items-center"
                style={{ width: NODE }}
                initial={false}
                animate={{ x: p.x, y: p.y }}
                transition={spring}
              >
                <div
                  className="flex items-center justify-center rounded-full border-2 font-mono text-sm font-semibold transition-colors duration-300"
                  style={{
                    width: NODE,
                    height: NODE,
                    borderStyle: frontier && !accent ? 'dashed' : 'solid',
                    borderColor: accent ?? (frontier ? '#ffa116' : '#4a4a4a'),
                    boxShadow: accent ? `0 0 0 1px ${accent}55, 0 0 14px ${accent}33` : 'none',
                    backgroundColor: fill ? `${fill}55` : isNew ? 'rgba(44,187,93,0.25)' : visited ? 'rgba(10,132,255,0.22)' : '#2a2a2a',
                    color: fill ? '#fff' : undefined,
                  }}
                  title={[visited && t('graphVisited'), frontier && t('graphFrontier')].filter(Boolean).join(' · ') || undefined}
                >
                  {n.label}
                </div>
                <div className="relative z-10 mt-1 flex flex-col items-center gap-0.5">
                  {labels?.map((l) => (
                    <span key={l.name} className="rounded px-1.5 font-mono text-[11px] leading-4 font-semibold text-ink-900" style={{ backgroundColor: l.color }}>
                      {l.name}
                    </span>
                  ))}
                </div>
                {overlay.badges.get(n.key) && (
                  <div className="absolute top-0 left-full ml-1 flex flex-col gap-0.5">
                    {overlay.badges.get(n.key)!.map((b) => (
                      <span key={b} className="rounded bg-ink-700/90 px-1 font-mono text-[10px] leading-4 whitespace-nowrap text-ink-300">
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
      <Legend />
    </section>
  );
}

function Legend() {
  const t = useT();
  const item = (style: CSSProperties, label: string) => (
    <span className="flex items-center gap-1.5">
      <span className="inline-block size-3 rounded-full border-2" style={style} />
      {label}
    </span>
  );
  return (
    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-ink-400">
      {item({ borderColor: '#4a4a4a', backgroundColor: 'rgba(10,132,255,0.22)' }, t('graphVisited'))}
      {item({ borderColor: '#ffa116', borderStyle: 'dashed' }, t('graphFrontier'))}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 bg-brand" />
        {t('graphActiveEdge')}
      </span>
    </div>
  );
}

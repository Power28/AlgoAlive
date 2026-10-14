import type { PyValue, SequenceValue } from '../types';
import { formatCell, formatPy, valueKey } from '../lib/pyValue';
import { Header, STR_COLOR } from './ArrayView';
import { useHeap } from '../lib/heapContext';

const CELL = 40;

export interface GridMark {
  /** 例如 "r, c" */
  label: string;
  row: number;
  col: number;
  color: string;
}

interface Props {
  name: string;
  value: SequenceValue;
  prev?: PyValue;
  marks: GridMark[];
}

export function GridView({ name, value, prev, marks }: Props) {
  const heap = useHeap();
  const rows = value.items as SequenceValue[];
  const prevRows = prev?.type === 'list' ? (prev.items as SequenceValue[]) : undefined;
  const cols = Math.max(...rows.map((r) => r.items.length));
  const markAt = new Map<string, GridMark>();
  for (const m of marks) if (!markAt.has(`${m.row},${m.col}`)) markAt.set(`${m.row},${m.col}`, m);

  return (
    <section>
      <Header name={name} kind="list[list]" meta={`${rows.length} × ${cols}`} />
      <div className="scrollbar-thin overflow-x-auto pb-1">
        <table className="border-separate font-mono" style={{ borderSpacing: 4 }}>
          <thead>
            <tr>
              <th />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="text-center text-[11px] font-normal text-ink-400">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <th className="pr-1 text-right text-[11px] font-normal text-ink-400">{r}</th>
                {row.items.length === 0 && <td className="text-xs text-ink-400">[ ]</td>}
                {row.items.map((cell, c) => {
                  const prevCell = prevRows?.[r]?.items?.[c];
                  const changed = prevRows !== undefined && valueKey(prevCell) !== valueKey(cell);
                  const mark = markAt.get(`${r},${c}`);
                  const text = formatCell(cell, heap);
                  return (
                    <td
                      key={c}
                      title={formatPy(cell, heap)}
                      className="rounded-md border text-center align-middle font-semibold transition-colors duration-300"
                      style={{
                        width: CELL,
                        height: CELL,
                        minWidth: CELL,
                        fontSize: text.length > 4 ? 10 : 14,
                        color: cell.type === 'str' ? STR_COLOR : undefined,
                        borderColor: mark?.color ?? '#3e3e3e',
                        boxShadow: mark ? `0 0 0 1px ${mark.color}66, 0 0 12px ${mark.color}33` : undefined,
                        backgroundColor: changed ? 'rgba(255,161,22,0.28)' : '#2a2a2a',
                      }}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {marks.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2 pl-6">
          {marks.map((m) => (
            <span
              key={m.label}
              className="rounded px-1.5 font-mono text-[11px] leading-4 font-semibold text-ink-900"
              style={{ backgroundColor: m.color }}
            >
              [{m.label}] = ({m.row}, {m.col})
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

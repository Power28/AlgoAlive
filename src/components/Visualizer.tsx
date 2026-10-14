import type { ReactNode } from 'react';
import { CornerDownLeft, TriangleAlert } from 'lucide-react';
import type { ExecutionStep, PyValue } from '../types';
import { formatPy, isDict, isScalar, isSequence, isSet } from '../lib/pyValue';
import { pointersFor } from '../lib/pointers';
import { ArrayView } from './ArrayView';
import { DictView, ScalarGrid, SetView } from './CollectionViews';

interface Props {
  step: ExecutionStep;
  prev?: ExecutionStep;
  cellKeys: Record<string, string[]>;
}

export function Visualizer({ step, prev, cellKeys }: Props) {
  // 只有同一個 frame 的前一步才拿來做「變化」比對
  const sameFrame = prev && prev.depth === step.depth && prev.funcName === step.funcName;
  const prevVars = sameFrame ? prev.variables : undefined;

  const entries = Object.entries(step.variables);
  const sequences = entries.filter(([, v]) => isSequence(v));
  const dicts = entries.filter(([, v]) => isDict(v));
  const sets = entries.filter(([, v]) => isSet(v));
  const scalars = entries.filter(([, v]) => isScalar(v));

  const pointerColors = new Map<string, string>();
  const pointersByList = sequences.map(([name, v]) => {
    const ps = pointersFor(step.variables, isSequence(v) ? v.items.length : 0).filter((p) => p.name !== name);
    ps.forEach((p) => pointerColors.set(p.name, p.color));
    return ps;
  });

  // scalar 值 → 持有該值的變數名（用來標示 dict 中被查詢的 key）
  const lookups = new Map<string, string[]>();
  for (const [name, v] of scalars) {
    if (v.type !== 'int' && v.type !== 'str') continue;
    const k = JSON.stringify(v);
    lookups.set(k, [...(lookups.get(k) ?? []), name]);
  }

  return (
    <div className="flex flex-col gap-6">
      {step.event === 'return' && step.returnValue && (
        <Banner tone="ok" icon={<CornerDownLeft size={16} />}>
          <span className="text-ink-300">{step.funcName}() returned</span>
          <code className="font-semibold">{formatPy(step.returnValue)}</code>
        </Banner>
      )}
      {step.event === 'exception' && (
        <Banner tone="err" icon={<TriangleAlert size={16} />}>
          <code>{step.exception}</code>
        </Banner>
      )}

      {sequences.map(([name, v], i) => (
        <ArrayView
          key={name}
          name={name}
          value={v as Extract<PyValue, { items: PyValue[] }>}
          keys={cellKeys[name] ?? []}
          prev={prevVars?.[name]}
          pointers={pointersByList[i]}
        />
      ))}
      {dicts.map(([name, v]) => (
        <DictView key={name} name={name} value={v as Extract<PyValue, { type: 'dict' }>} prev={prevVars?.[name]} lookups={lookups} />
      ))}
      {sets.map(([name, v]) => (
        <SetView key={name} name={name} value={v as Extract<PyValue, { items: PyValue[] }>} prev={prevVars?.[name]} />
      ))}
      <ScalarGrid entries={scalars} prevVars={prevVars} pointerColors={pointerColors} />

      {entries.length === 0 && step.event === 'line' && (
        <p className="text-sm text-ink-400">No local variables yet.</p>
      )}
    </div>
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

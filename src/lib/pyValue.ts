import type { DictValue, PyValue, SequenceValue } from '../types';

export const isSequence = (v: PyValue): v is SequenceValue =>
  v.type === 'list' || v.type === 'tuple' || v.type === 'deque';
export const isSet = (v: PyValue): v is SequenceValue => v.type === 'set';
export const isDict = (v: PyValue): v is DictValue => v.type === 'dict';
export const isScalar = (v: PyValue) => !isSequence(v) && !isSet(v) && !isDict(v);

/** 結構相等比較用的穩定字串鍵。 */
export const valueKey = (v: PyValue | undefined) => (v === undefined ? '' : JSON.stringify(v));

export function intValue(v: PyValue | undefined): number | null {
  return v && v.type === 'int' && typeof v.value === 'number' ? v.value : null;
}

/** 依 Python repr 規則格式化值。 */
export function formatPy(v: PyValue): string {
  const more = (n?: number) => (n ? `, …+${n}` : '');
  switch (v.type) {
    case 'none':
      return 'None';
    case 'bool':
      return v.value ? 'True' : 'False';
    case 'int':
      return String(v.value);
    case 'float':
      if (typeof v.value === 'string') return v.value === 'inf' || v.value === '-inf' || v.value === 'nan' ? `float('${v.value}')` : v.value;
      return Number.isInteger(v.value) ? v.value.toFixed(1) : String(v.value);
    case 'str':
      return `'${v.value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
    case 'list':
      return `[${v.items.map(formatPy).join(', ')}${more(v.truncated)}]`;
    case 'deque':
      return `deque([${v.items.map(formatPy).join(', ')}${more(v.truncated)}])`;
    case 'tuple':
      return v.items.length === 1 ? `(${formatPy(v.items[0])},)` : `(${v.items.map(formatPy).join(', ')}${more(v.truncated)})`;
    case 'set':
      return v.items.length === 0 ? 'set()' : `{${v.items.map(formatPy).join(', ')}${more(v.truncated)}}`;
    case 'dict': {
      const body = v.entries.map(([k, x]) => `${formatPy(k)}: ${formatPy(x)}`).join(', ');
      return `{${body}${more(v.truncated)}}`;
    }
    case 'repr':
      return v.value;
  }
}

/** 格子內的精簡顯示：字串不加引號（改用顏色區分）、無限大顯示為 ∞。 */
export function formatCell(v: PyValue): string {
  if (v.type === 'str') return v.value;
  if (v.type === 'float' && typeof v.value === 'string') {
    if (v.value === 'inf') return '∞';
    if (v.value === '-inf') return '-∞';
  }
  if (v.type === 'bool') return v.value ? 'T' : 'F';
  return formatPy(v);
}

/** 字串拆成字元格子用的 items。 */
export const charItems = (s: string): PyValue[] => [...s].map((ch) => ({ type: 'str', value: ch }));

const GRID_MAX = 40;

/** list 的每一列都是只含純量的 list → 以 2D 格子顯示（DP 表、grid BFS…）。 */
export function isGrid(v: PyValue): boolean {
  if (v.type !== 'list' || v.items.length === 0 || v.items.length > GRID_MAX) return false;
  return v.items.every(
    (row) => row.type === 'list' && row.items.length <= GRID_MAX && row.items.every(isScalar),
  );
}

/** 給 UI 標籤用的簡短型別名稱。 */
export function typeLabel(v: PyValue): string {
  if (v.type === 'dict' && v.cls) return v.cls;
  if (v.type === 'repr') return v.cls ?? 'object';
  if (v.type === 'none') return 'NoneType';
  return v.type;
}

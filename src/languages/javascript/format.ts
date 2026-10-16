import type { ValueFormat } from '../types';
import type { Value } from '../../types';
import type { StringKey } from '../../i18n';

/** JavaScript 的真假值規則：null、undefined、0、NaN、空字串為 false；物件與陣列（即使是空的）都是 true */
function truthReason(value: Value): StringKey | null {
  switch (value.type) {
    case 'none':
      return 'truthNullJs';
    case 'repr':
      return value.cls === 'undefined' ? 'truthUndefinedJs' : null;
    case 'int':
    case 'float':
      return value.value === 'nan' ? 'truthNaNJs' : Number(value.value) === 0 ? 'truthZeroJs' : 'truthNonZeroJs';
    case 'str':
      return value.value === '' ? 'truthEmptyStrJs' : 'truthNonEmptyStrJs';
    case 'list':
    case 'tuple':
    case 'set':
    case 'deque':
    case 'dict':
    case 'ref':
      return 'truthObjectJs';
    default:
      return null;
  }
}

/** JavaScript 的寫法：null、true、"字串"、Infinity、Set {…}（Map 與物件都顯示成 {key: value}） */
export const jsFormat: ValueFormat = {
  none: 'null',
  noneType: 'null',
  bool: (b) => (b ? 'true' : 'false'),
  float: (v) => {
    if (typeof v === 'string') return v === 'inf' ? 'Infinity' : v === '-inf' ? '-Infinity' : v === 'nan' ? 'NaN' : v;
    return String(v);
  },
  str: (s) => JSON.stringify(s),
  container: (type, parts, more) => {
    const body = parts.join(', ') + more;
    switch (type) {
      case 'set':
        return `Set {${body}}`;
      case 'dict':
        return `{${body}}`;
      default:
        return `[${body}]`;
    }
  },
  logic: { and: '&&', or: '||', not: '!' },
  truthReason,
  shortCircuit: { and: 'shortAndJs', or: 'shortOrJs' },
  handler: 'catch',
};

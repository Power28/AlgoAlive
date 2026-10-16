import type { ValueFormat } from '../types';
import type { Value } from '../../types';
import type { StringKey } from '../../i18n';

/** Python 的真假值規則：None、0、空字串、空容器為 False */
function truthReason(value: Value): StringKey | null {
  switch (value.type) {
    case 'none':
      return 'truthNone';
    case 'int':
    case 'float':
      return Number(value.value) === 0 ? 'truthZero' : 'truthNonZero';
    case 'str':
      return value.value === '' ? 'truthEmptyStr' : 'truthNonEmpty';
    case 'list':
    case 'tuple':
    case 'set':
    case 'deque':
      return value.items.length === 0 ? 'truthEmpty' : 'truthNonEmpty';
    case 'dict':
      return value.entries.length === 0 ? 'truthEmpty' : 'truthNonEmpty';
    case 'ref':
      return 'truthObject';
    default:
      return null;
  }
}

/** Python repr 的寫法：None、True、'字串'、(1,)、set()、deque([...])、float('inf') */
export const pythonFormat: ValueFormat = {
  none: 'None',
  noneType: 'NoneType',
  bool: (b) => (b ? 'True' : 'False'),
  float: (v) => {
    if (typeof v === 'string') return v === 'inf' || v === '-inf' || v === 'nan' ? `float('${v}')` : v;
    return Number.isInteger(v) ? v.toFixed(1) : String(v);
  },
  str: (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`,
  container: (type, parts, more) => {
    const body = parts.join(', ') + more;
    switch (type) {
      case 'list':
        return `[${body}]`;
      case 'deque':
        return `deque([${body}])`;
      case 'tuple':
        return parts.length === 1 && !more ? `(${parts[0]},)` : `(${body})`;
      case 'set':
        return parts.length === 0 && !more ? 'set()' : `{${body}}`;
      case 'dict':
        return `{${body}}`;
    }
  },
  logic: { and: 'and', or: 'or', not: 'not' },
  truthReason,
  shortCircuit: { and: 'shortAnd', or: 'shortOr' },
};

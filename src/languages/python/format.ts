import type { ValueFormat } from '../types';

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
};

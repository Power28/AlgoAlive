import type { ValueFormat } from '../types';

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
};

import type { Language, LanguageRuntime } from '../types';
import { analyzeIndexing } from '../../lib/indexing';
import { analyzeHeaps } from './analysis';
import { pythonFormat } from './format';
import { callNeedsHelp, exampleCall, findFunctions } from './functions';
import { PyodideRuntime } from './runtime';

let runtime: LanguageRuntime | null = null;

export const python: Language = {
  id: 'python',
  label: 'Python 3',
  runtimeName: 'Python',
  monaco: 'python',
  // 第一次需要時才建立 Worker、開始下載 Pyodide
  runtime: () => (runtime ??= new PyodideRuntime()),
  format: pythonFormat,
  blank: {
    code: `def solve(nums: List[int]) -> int:
    total = 0
    for i in range(len(nums)):
        total += nums[i]
    return total
`,
    call: 'solve([1, 2, 3, 4])',
  },
  analyzeIndexing,
  analyzeHeaps,
  findFunctions,
  exampleCall,
  callNeedsHelp,
  callPlaceholder: 'nums = [2,7,11,15], target = 9',
  callFormats: [
    { example: 'twoSum([2, 7, 11, 15], 9)', note: 'fmtCall' },
    { example: 'nums = [2,7,11,15], target = 9', note: 'fmtLeetCode' },
    { example: '[2,7,11,15] ⏎ 9', note: 'fmtLines' },
    { example: 'head = [1,2,3]、root = [3,9,20,null,null,15,7]', note: 'fmtNodes' },
    { example: '["MinStack","push"], [[],[1]]', note: 'fmtDesign' },
  ],
};

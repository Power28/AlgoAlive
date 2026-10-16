import type { Language, LanguageRuntime } from '../types';
import { analyzeIndexing } from '../../lib/indexing';
import { WorkerRuntime } from '../workerRuntime';
import { jsFormat } from './format';
import { callNeedsHelp, exampleCall, findFunctions } from './functions';

let runtime: LanguageRuntime | null = null;

export const javascript: Language = {
  id: 'javascript',
  label: 'JavaScript',
  runtimeName: 'JavaScript',
  monaco: 'javascript',
  // 追蹤器（含 Acorn）放在 Worker 裡，第一次執行 JavaScript 時才載入
  runtime: () => (runtime ??= new WorkerRuntime(() => new Worker(new URL('./js.worker.ts', import.meta.url), { type: 'module' }), 'JavaScript')),
  format: jsFormat,
  blank: {
    code: `/**
 * @param {number[]} nums
 * @return {number}
 */
var solve = function(nums) {
    let total = 0;
    for (let i = 0; i < nums.length; i++) {
        total += nums[i];
    }
    return total;
};
`,
    call: 'solve([1, 2, 3, 4])',
  },
  analyzeIndexing,
  // JavaScript 沒有內建的 heapq，不另外畫堆積樹
  analyzeHeaps: () => new Set(),
  findFunctions,
  exampleCall,
  callNeedsHelp,
  callPlaceholder: 'nums = [2,7,11,15], target = 9',
  callFormats: [
    { example: 'twoSum([2, 7, 11, 15], 9)', note: 'fmtCall' },
    { example: 'nums = [2,7,11,15], target = 9', note: 'fmtLeetCode' },
    { example: '[2,7,11,15] ⏎ 9', note: 'fmtLines' },
    { example: 'head = [1,2,3]、root = [3,9,20,null,null,15,7]', note: 'fmtNodesJs' },
    { example: '["MinStack","push"], [[],[1]]', note: 'fmtDesign' },
  ],
};

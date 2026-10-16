import type { ExecutionStep } from '../types';
import { formatValue } from './value';

export interface CallNode {
  id: number;
  parent: number | null;
  depth: number;
  /** 例如 "fib(4)"、"backtrack(start=1)" */
  label: string;
  /** 這次呼叫第一個步驟（點節點時跳到這裡） */
  startStep: number;
  /** 回傳的那一步；拋出例外而結束時沒有 */
  endStep?: number;
  /** 回傳值的簡短顯示 */
  returned?: string;
  /** 因為例外而結束 */
  raised?: boolean;
  children: number[];
  /** 依整棵最終的樹排好的位置（格數，不是 px） */
  x: number;
}

export interface CallTree {
  nodes: CallNode[];
  /** stackIds[stepIndex]：那一步由外而內在堆疊上的呼叫節點 */
  stackIds: number[][];
  maxDepth: number;
  /** 最底層的總寬度（格數） */
  width: number;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** 參數只有一個時省略名稱：fib(4)；多個時保留：dfs(i=0, j=2) */
function callLabel(func: string, args: [string, string][]): string {
  const text = args.length === 1 ? args[0][1] : args.map(([n, v]) => `${n}=${v}`).join(', ');
  return `${func}(${clip(text, 22)})`;
}

/**
 * 由每一步的呼叫堆疊建出整棵呼叫樹（遞迴樹）。
 * 進入新呼叫的步驟（entered）新增節點；回傳步驟記下回傳值；堆疊變淺但沒有回傳事件的，是因例外而結束。
 */
export function buildCallTree(steps: ExecutionStep[]): CallTree {
  const nodes: CallNode[] = [];
  let stack: number[] = [];
  const stackIds: number[][] = [];

  steps.forEach((step, i) => {
    const frames = step.stack ?? [];
    const depth = frames.length;
    const finish = (id: number) => {
      const node = nodes[id];
      if (node.endStep === undefined) node.raised = true;
    };
    if (step.entered) {
      while (stack.length >= depth) finish(stack.pop()!);
      const frame = frames[depth - 1];
      const parent = stack.length ? stack[stack.length - 1] : null;
      const node: CallNode = {
        id: nodes.length,
        parent,
        depth: depth - 1,
        label: frame ? callLabel(frame.func, frame.args) : '?',
        startStep: i,
        children: [],
        x: 0,
      };
      nodes.push(node);
      if (parent !== null) nodes[parent].children.push(node.id);
      stack = [...stack, node.id];
    } else {
      while (stack.length > depth) finish(stack.pop()!);
    }
    if (step.event === 'return' && stack.length) {
      const node = nodes[stack[stack.length - 1]];
      node.endStep = i;
      node.returned = step.returnValue ? clip(formatValue(step.returnValue, step.heap), 14) : undefined;
    }
    // 存副本：之後的 pop() 會修改 stack，不能讓前面步驟的紀錄跟著變
    stackIds.push([...stack]);
  });

  // 排版：葉節點依序佔一格，父節點置中在子節點上方（位置只取決於最終的樹，播放時不會移動）
  let next = 0;
  const place = (id: number) => {
    const node = nodes[id];
    if (!node.children.length) {
      node.x = next++;
      return;
    }
    node.children.forEach(place);
    const first = nodes[node.children[0]].x;
    const last = nodes[node.children[node.children.length - 1]].x;
    node.x = (first + last) / 2;
  };
  nodes.filter((n) => n.parent === null).forEach((root) => {
    place(root.id);
    next += 0.5; // 多棵樹之間留空
  });

  return {
    nodes,
    stackIds,
    maxDepth: nodes.reduce((m, n) => Math.max(m, n.depth), 0),
    width: Math.max(1, next),
  };
}

/** 有遞迴（同一個函式被呼叫兩次以上）或至少三次呼叫時才顯示遞迴樹 */
const funcOf = (n: CallNode) => n.label.slice(0, n.label.indexOf('('));

/** 有函式呼叫自己（真正的遞迴） */
export function hasRecursion(tree: CallTree): boolean {
  return tree.nodes.some((n) => n.parent !== null && funcOf(tree.nodes[n.parent]) === funcOf(n));
}

export function showCallTree(tree: CallTree): boolean {
  if (tree.nodes.length < 3) return false;
  const counts = new Map<string, number>();
  for (const n of tree.nodes) {
    const func = n.label.slice(0, n.label.indexOf('('));
    counts.set(func, (counts.get(func) ?? 0) + 1);
  }
  return [...counts.values()].some((c) => c >= 2);
}

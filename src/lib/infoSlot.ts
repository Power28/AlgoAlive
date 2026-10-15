import type { Condition, ExecutionStep, LogicNode } from '../types';

/**
 * 視覺化最上方「卡片欄位」的高度（px）。
 *
 * 條件判斷、計算、回傳、例外這些卡片每一步時有時無、高度也不同；若直接放在內容最上方，
 * 下面的陣列、樹、變數會跟著上下跳。所以整段執行過程只算一次高度：取所有步驟中最高的卡片，
 * 播放時這一格高度固定，卡片比它高時在格子裡捲動。
 */
export function infoSlotHeight(steps: ExecutionStep[]): number {
  let height = 0;
  for (const step of steps) height = Math.max(height, stepCardHeight(step));
  return Math.min(height, MAX_SLOT);
}

const MAX_SLOT = 360;
const BANNER = 44;
const CARD_BASE = 82;
const CALC_CARD = 108;
const BITS_EXTRA = 128;
const LEAF_ROW = 34;
const GATE_EXTRA = 34;

const OP_CARD = 104;
const MULTI_CARD = 190;
const COMP_CARD = 128;
const JUMP_CARD = 92;
const TRY_CARD = 120;
const EXC_BASE = 104;
const EXC_ROW = 30;
const CARD_GAP = 12;

function stepCardHeight(step: ExecutionStep): number {
  if (step.event === 'line') {
    const cards = [
      step.condition ? conditionHeight(step.condition) : 0,
      step.calc ? CALC_CARD + (step.calc.bits?.length ? BITS_EXTRA : 0) : 0,
      step.op ? OP_CARD : 0,
      step.multi ? MULTI_CARD - (step.multi.swap ? 0 : 22) : 0,
      step.comp ? COMP_CARD : 0,
      step.jump ? JUMP_CARD : 0,
      step.tryFlow ? TRY_CARD : 0,
    ].filter(Boolean);
    return cards.reduce((a, b) => a + b, 0) + Math.max(0, cards.length - 1) * CARD_GAP;
  }
  if (step.exc) return EXC_BASE + Math.max(1, step.exc.route.length) * EXC_ROW;
  return step.returnValue || step.exception ? BANNER : 0;
}

function conditionHeight(c: Condition): number {
  let h = CARD_BASE;
  // 賦值 / 回傳中的 and / or：多一行實際值的說明
  if (c.context === 'value' && c.value && c.value.type !== 'bool') h += 22;
  if (c.tree && isLogic(c.tree)) h += 12 + treeHeight(c.tree);
  else if (c.parts.length > 1) h += 12 + c.parts.length * 26;
  return h;
}

const isLogic = (n: LogicNode): boolean => n.op === 'and' || n.op === 'or' || n.op === 'not' || !!n.children?.some(isLogic);

/** 邏輯樹的大約高度：每個葉節點一列，每個邏輯閘多一列閘門標籤與結果 */
function treeHeight(n: LogicNode): number {
  if (n.op === 'cmp' || n.op === 'leaf') return LEAF_ROW;
  const children = (n.children ?? []).reduce((sum, c) => sum + treeHeight(c), 0);
  const gateChips = n.op === 'not' ? 24 : Math.max(0, (n.children?.length ?? 1) - 1) * 24;
  return children + gateChips + GATE_EXTRA;
}

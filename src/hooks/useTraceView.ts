import { useMemo } from 'react';
import { designStarts } from '../components/DesignTimeline';
import type { Language } from '../languages/types';
import { buildCallTree, hasRecursion, showCallTree } from '../lib/callTree';
import { computeCellKeys, computeGridKeys } from '../lib/cellKeys';
import { contextInfo } from '../lib/context';
import { infoSlotHeight } from '../lib/infoSlot';
import type { TraceResult } from '../types';

/**
 * 由整段執行結果算出、播放時不變的畫面資料：格子的身分（交換動畫）、卡片欄位高度、
 * 迴圈與呼叫堆疊、遞迴樹、設計類題目的操作起點，以及程式碼的索引 / 節點分析。
 * 每次執行只算一次。
 */
export function useTraceView(language: Language, trace: TraceResult | null, steps: TraceResult['steps'], code: string) {
  const cellKeys = useMemo(() => computeCellKeys(steps), [steps]);
  const gridKeys = useMemo(() => computeGridKeys(steps), [steps]);
  const indexMap = useMemo(() => language.analyzeIndexing(code), [language, code]);
  const heapNames = useMemo(() => language.analyzeHeaps(code), [language, code]);
  // 卡片欄位高度整段執行只算一次，播放時固定
  const slotHeight = useMemo(() => infoSlotHeight(steps) || undefined, [steps]);
  const context = useMemo(() => contextInfo(steps), [steps]);
  // 設計類題目由操作順序說明，每個方法各自一次呼叫，不另外畫遞迴樹（除非方法內真的有遞迴）
  const callTree = useMemo(() => {
    const tree = buildCallTree(steps, language.format);
    if (trace?.design && !hasRecursion(tree)) return null;
    return showCallTree(tree) ? tree : null;
  }, [steps, trace?.design, language]);
  const designCalls = trace?.design?.calls;
  const starts = useMemo(() => (designCalls ? designStarts(steps, designCalls.length) : []), [steps, designCalls]);

  return { cellKeys, gridKeys, indexMap, heapNames, slotHeight, context, callTree, designCalls, starts };
}

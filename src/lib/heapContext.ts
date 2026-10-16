import { createContext, useContext } from 'react';
import type { Heap } from '../types';
import type { ValueFormat } from '../languages/types';
import { pythonFormat } from '../languages/python/format';

/** 目前步驟的 heap，讓各視圖把容器中的節點參照顯示成 (val) */
export const HeapContext = createContext<Heap | undefined>(undefined);
export const useHeap = () => useContext(HeapContext);

/** 目前這份追蹤結果所屬語言的值格式（None / null、True / true…） */
export const ValueFormatContext = createContext<ValueFormat>(pythonFormat);
export const useValueFormat = () => useContext(ValueFormatContext);

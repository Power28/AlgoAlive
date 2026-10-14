import { createContext, useContext } from 'react';
import type { Heap } from '../types';

/** 目前步驟的 heap，讓各視圖把容器中的節點參照顯示成 (val) */
export const HeapContext = createContext<Heap | undefined>(undefined);
export const useHeap = () => useContext(HeapContext);

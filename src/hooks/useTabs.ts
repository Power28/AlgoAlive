import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_EXAMPLE_IDS, getExample, type Example } from '../tutorials';

export interface Tab {
  id: string;
  /** 使用者自訂名稱；空字串代表自動命名（範例題名或「未命名 N」，跟著語言切換） */
  title: string;
  code: string;
  call: string;
  /** 從教學範例開啟時記錄來源，用來顯示「教學」面板 */
  tutorialId?: string;
  exampleId?: string;
}

interface TabsState {
  tabs: Tab[];
  activeId: string;
}

const STORAGE_KEY = 'algoalive.tabs.v1';

export const BLANK_CODE = `def solve(nums: List[int]) -> int:
    total = 0
    for i in range(len(nums)):
        total += nums[i]
    return total
`;
export const BLANK_CALL = 'solve([1, 2, 3, 4])';

const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function tabFromExample(example: Example, tutorialId: string): Tab {
  return {
    id: newId(),
    title: '',
    code: example.code,
    call: example.call,
    tutorialId,
    exampleId: example.id,
  };
}

function defaultState(): TabsState {
  const tabs = DEFAULT_EXAMPLE_IDS.flatMap((id) => {
    const found = getExample(id);
    return found ? [tabFromExample(found.example, found.tutorial.id)] : [];
  });
  return { tabs, activeId: tabs[0].id };
}

function isTab(x: unknown): x is Tab {
  const t = x as Tab;
  return !!t && typeof t.id === 'string' && typeof t.title === 'string' && typeof t.code === 'string' && typeof t.call === 'string';
}

function load(): TabsState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as TabsState;
    const tabs = Array.isArray(data.tabs) ? data.tabs.filter(isTab) : [];
    if (!tabs.length) return null;
    const activeId = tabs.some((t) => t.id === data.activeId) ? data.activeId : tabs[0].id;
    return { tabs, activeId };
  } catch {
    return null;
  }
}

/** 使用者頁籤：新增 / 關閉 / 重新命名 / 編輯內容，並存到 localStorage。 */
export function useTabs() {
  const [state, setState] = useState<TabsState>(() => load() ?? defaultState());
  const saveTimer = useRef<number>(undefined);

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // 無法寫入（私密模式、容量滿）時就只保留在記憶體中
      }
    }, 300);
  }, [state]);

  const select = useCallback((id: string) => setState((s) => ({ ...s, activeId: id })), []);

  const update = useCallback(
    (id: string, patch: Partial<Omit<Tab, 'id'>>) =>
      setState((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    [],
  );

  /** 新增頁籤並切換過去；回傳新頁籤 id */
  const add = useCallback((tab: Omit<Tab, 'id'> | Tab) => {
    const full: Tab = { id: newId(), ...tab };
    setState((s) => ({ tabs: [...s.tabs, full], activeId: full.id }));
    return full.id;
  }, []);

  const close = useCallback((id: string) => {
    setState((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      if (idx < 0) return s;
      const tabs = s.tabs.filter((t) => t.id !== id);
      if (!tabs.length) {
        const blank: Tab = { id: newId(), title: '', code: BLANK_CODE, call: BLANK_CALL };
        return { tabs: [blank], activeId: blank.id };
      }
      // 關掉目前頁籤時，切到右邊那個（沒有就左邊）
      const activeId = s.activeId === id ? tabs[Math.min(idx, tabs.length - 1)].id : s.activeId;
      return { tabs, activeId };
    });
  }, []);

  const active = state.tabs.find((t) => t.id === state.activeId) ?? state.tabs[0];

  return { tabs: state.tabs, active, select, update, add, close };
}

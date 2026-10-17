import { useCallback, useState } from 'react';

const KEY = 'algoalive.tour.v1';
/** 已經有存下來的頁籤 = 以前用過，不再自動跳出導覽（右上角的 ? 仍可重看） */
const TABS_KEY = 'algoalive.tabs.v1';

function firstVisit(): boolean {
  try {
    return !localStorage.getItem(KEY) && !localStorage.getItem(TABS_KEY);
  } catch {
    return false;
  }
}

/** 首次使用的導覽：第一次打開時自動出現一次，看完或略過後記住 */
export function useTour() {
  const [open, setOpen] = useState(firstVisit);
  const start = useCallback(() => setOpen(true), []);
  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, 'done');
    } catch {
      // 無法存取 storage 時，下次打開還會再出現
    }
  }, []);
  return { open, start, close };
}

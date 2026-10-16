import { useCallback, useEffect, useState } from 'react';
import type { LanguageId } from '../languages/types';

const KEY = 'algoalive.tutorialLang';
const EVENT = 'algoalive:tutorial-lang';

function read(): LanguageId {
  try {
    return localStorage.getItem(KEY) === 'javascript' ? 'javascript' : 'python';
  } catch {
    return 'python';
  }
}

/** 教學頁要用哪個語言顯示範例；記在瀏覽器裡，教學庫與左側教學面板同步 */
export function useTutorialLanguage(): [LanguageId, (language: LanguageId) => void] {
  const [language, setLanguage] = useState<LanguageId>(read);
  useEffect(() => {
    const sync = () => setLanguage(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const update = useCallback((next: LanguageId) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // 無痕模式等不能存：只在這次使用
    }
    setLanguage(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [language, update];
}

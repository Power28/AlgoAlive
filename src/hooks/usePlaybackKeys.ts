import { useEffect } from 'react';
import type { usePlayback } from './usePlayback';

/**
 * 播放的鍵盤快捷鍵：← → 逐步、空白鍵播放 / 暫停、Home / End 跳到開頭 / 結尾。
 * 焦點在輸入框、按鈕或編輯器時不攔截；enabled 為 false（教學視窗、導覽開著，或還沒有步驟）時停用。
 */
export function usePlaybackKeys(playback: ReturnType<typeof usePlayback>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, button, .monaco-editor')) return;
      if (e.key === 'ArrowRight') playback.next();
      else if (e.key === 'ArrowLeft') playback.prev();
      else if (e.key === ' ') playback.togglePlay();
      else if (e.key === 'Home') playback.seek(0);
      else if (e.key === 'End') playback.seek(playback.last);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playback, enabled]);
}

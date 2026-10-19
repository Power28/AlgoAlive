import { useCallback, useEffect, useState } from 'react';

/** 使用者按了「更新」：新版本接管後重新整理（第一次安裝時接管不用重新整理） */
let updating = false;

/**
 * 註冊 Service Worker（只在正式版）：離線也能使用、重複造訪不必重新下載。
 * 網站更新後，新版本會在背景下載好；按「更新」才切換並重新整理，
 * 避免正在使用的舊頁面中途載入到新版本的檔案。
 */
export function useServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let alive = true;
    const onControllerChange = () => {
      if (updating) location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        const track = (sw: ServiceWorker | null) => {
          if (!sw) return;
          const check = () => {
            if (alive && sw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(sw);
          };
          check();
          sw.addEventListener('statechange', check);
        };
        track(reg.waiting);
        reg.addEventListener('updatefound', () => track(reg.installing));
      })
      .catch(() => {
        // 不支援或被瀏覽器擋下時照常使用，只是沒有離線功能
      });

    return () => {
      alive = false;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const update = useCallback(() => {
    updating = true;
    waiting?.postMessage({ type: 'SKIP_WAITING' });
  }, [waiting]);
  return { updateReady: !!waiting, update };
}

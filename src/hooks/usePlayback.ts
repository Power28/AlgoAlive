import { useCallback, useEffect, useState } from 'react';

export const SPEEDS = [0.5, 1, 2, 4] as const;
const BASE_INTERVAL_MS = 900;

/** 步驟播放控制：上一步 / 下一步 / 播放暫停 / 跳轉 / 速度。 */
export function usePlayback(total: number, resetKey: unknown) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  const last = Math.max(0, total - 1);

  // 新的 trace 載入時回到第 0 步
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [resetKey]);

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setIndex((i) => Math.min(i + 1, last)), BASE_INTERVAL_MS / speed);
    return () => window.clearTimeout(t);
  }, [playing, index, last, speed]);

  const seek = useCallback((i: number) => setIndex(Math.max(0, Math.min(i, last))), [last]);
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, last)), [last]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      // 已在最後一步時按播放 → 從頭開始
      if (!p) setIndex((i) => (i >= last ? 0 : i));
      return !p;
    });
  }, [last]);

  return { index, playing, speed, setSpeed, seek, next, prev, togglePlay, setPlaying, last };
}

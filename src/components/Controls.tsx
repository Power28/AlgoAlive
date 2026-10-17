import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { SPEEDS } from '../hooks/usePlayback';
import { useT } from '../i18n';

interface Props {
  index: number;
  last: number;
  playing: boolean;
  speed: number;
  disabled: boolean;
  onSeek: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onSpeed: (s: number) => void;
}

export function Controls({ index, last, playing, speed, disabled, onSeek, onPrev, onNext, onTogglePlay, onSpeed }: Props) {
  const t = useT();
  const btn =
    'flex size-9 items-center justify-center rounded-md text-ink-300 transition hover:bg-ink-700 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-30';
  return (
    <div className="flex flex-col gap-2 border-t border-ink-700 bg-ink-850 px-4 py-3" data-tour="controls">
      <input
        type="range"
        className="aa-timeline w-full"
        min={0}
        max={last}
        value={index}
        disabled={disabled}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label={t('timeline')}
      />
      <div className="flex items-center gap-1">
        <button className={btn} disabled={disabled || index === 0} onClick={() => onSeek(0)} title={t('first')} data-action="first">
          <SkipBack size={16} />
        </button>
        <button className={btn} disabled={disabled || index === 0} onClick={onPrev} title={t('prev')} data-action="prev">
          <ChevronLeft size={18} />
        </button>
        <button
          className="mx-1 flex size-10 items-center justify-center rounded-full bg-brand text-ink-900 transition hover:brightness-110 disabled:opacity-30"
          disabled={disabled}
          onClick={onTogglePlay}
          title={t('playPause')}
          data-action="play"
        >
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
        <button className={btn} disabled={disabled || index === last} onClick={onNext} title={t('next')} data-action="next">
          <ChevronRight size={18} />
        </button>
        <button className={btn} disabled={disabled || index === last} onClick={() => onSeek(last)} title={t('last')} data-action="last">
          <SkipForward size={16} />
        </button>

        <span className="ml-3 font-mono text-xs text-ink-400">
          {t('step')} <span className="text-ink-100">{disabled ? 0 : index + 1}</span> / {disabled ? 0 : last + 1}
        </span>

        <div className="ml-auto flex items-center gap-1 rounded-md bg-ink-800 p-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeed(s)}
              className={`rounded px-2 py-1 font-mono text-xs transition ${
                s === speed ? 'bg-ink-600 text-ink-100' : 'text-ink-400 hover:text-ink-100'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useT, type StringKey } from '../i18n';

/** 導覽的一步：target 是要框起來的元素（找不到或沒有 target 時，說明卡置中） */
export interface TourStep {
  id: string;
  target?: string;
  title: StringKey;
  body: StringKey;
  /** 按「下一步」離開這一步時要做的事（例如先執行一次，下一步才有動畫可看） */
  onNext?: () => void;
}

interface Props {
  steps: TourStep[];
  onClose: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const GAP = 12;
const MARGIN = 16;
const CARD_WIDTH = 340;
/** 導覽時畫面其他地方的遮罩顏色 */
const DIM = 'rgb(0 0 0 / 0.72)';

function measure(selector?: string): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  // 框線比元素大一點，並且不超出視窗
  const top = Math.max(MARGIN / 2, r.top - PAD);
  const left = Math.max(MARGIN / 2, r.left - PAD);
  const bottom = Math.min(window.innerHeight - MARGIN / 2, r.bottom + PAD);
  const right = Math.min(window.innerWidth - MARGIN / 2, r.right + PAD);
  return { top, left, width: right - left, height: bottom - top };
}

/** 說明卡的位置：優先放在框的下方，其次上方、右邊、左邊；都放不下就蓋在框的下緣內側 */
function place(rect: Rect | null, card: { width: number; height: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(MARGIN, x), vw - card.width - MARGIN);
  const clampY = (y: number) => Math.min(Math.max(MARGIN, y), vh - card.height - MARGIN);
  if (!rect) return { top: (vh - card.height) / 2, left: (vw - card.width) / 2 };
  const centerX = clampX(rect.left + rect.width / 2 - card.width / 2);
  const centerY = clampY(rect.top + rect.height / 2 - card.height / 2);
  if (rect.top + rect.height + GAP + card.height <= vh - MARGIN) return { top: rect.top + rect.height + GAP, left: centerX };
  if (rect.top - GAP - card.height >= MARGIN) return { top: rect.top - GAP - card.height, left: centerX };
  if (rect.left + rect.width + GAP + card.width <= vw - MARGIN) return { top: centerY, left: rect.left + rect.width + GAP };
  if (rect.left - GAP - card.width >= MARGIN) return { top: centerY, left: rect.left - GAP - card.width };
  return { top: clampY(rect.top + rect.height - card.height - GAP), left: centerX };
}

/** 首次使用的導覽：畫面變暗、框出目前介紹的區塊，旁邊一張說明卡 */
export function Tour({ steps, onClose }: Props) {
  const t = useT();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const lastIndex = steps.length - 1;

  // 量目標元素與說明卡，算出位置；視窗大小改變、版面變動時重算
  const layout = useCallback(() => {
    const r = measure(step.target);
    setRect(r);
    const card = cardRef.current;
    const size = card ? { width: card.offsetWidth, height: card.offsetHeight } : { width: CARD_WIDTH, height: 200 };
    setPos(place(r, size));
  }, [step.target]);

  useLayoutEffect(() => {
    const el = step.target ? document.querySelector(step.target) : null;
    // 小螢幕上目標可能在畫面外：先捲進畫面再量
    el?.scrollIntoView({ block: 'nearest' });
    layout();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(layout) : null;
    if (el) ro?.observe(el);
    if (cardRef.current) ro?.observe(cardRef.current);
    window.addEventListener('resize', layout);
    window.addEventListener('scroll', layout, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', layout);
      window.removeEventListener('scroll', layout, true);
    };
  }, [layout, step.target]);

  useEffect(() => {
    primaryRef.current?.focus();
  }, [index]);

  const next = useCallback(() => {
    step.onNext?.();
    if (index >= lastIndex) onClose();
    else setIndex(index + 1);
  }, [step, index, lastIndex, onClose]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [next, back, onClose]);

  const transition = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 380, damping: 36 };
  // 說明卡第一次出現時直接放在定位，之後換步驟才滑動
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!pos || settled) return;
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, [pos, settled]);

  return (
    <div className="fixed inset-0 z-50" data-tour-step={step.id}>
      {/* 擋住底下的操作；有框的時候由框的陰影把其他地方變暗 */}
      <div className="absolute inset-0" style={{ background: rect ? undefined : DIM }} onClick={(e) => e.stopPropagation()} />
      {rect && (
        <motion.div
          className="pointer-events-none absolute rounded-lg ring-2 ring-brand"
          style={{ boxShadow: `0 0 0 9999px ${DIM}` }}
          initial={false}
          animate={{ ...rect }}
          transition={transition}
        />
      )}
      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute rounded-xl border border-ink-600 bg-ink-850 p-4 shadow-2xl"
        style={{ width: `min(${CARD_WIDTH}px, calc(100vw - ${MARGIN * 2}px))`, visibility: pos ? 'visible' : 'hidden' }}
        initial={false}
        animate={pos ?? { top: 0, left: 0 }}
        transition={settled ? transition : { duration: 0 }}
        data-tour-card
      >
        <div className="mb-1 text-[11px] font-semibold tracking-wide text-brand uppercase" data-tour-progress>
          {index + 1} / {steps.length}
        </div>
        <h2 id="tour-title" className="mb-1.5 text-base font-bold text-ink-100">
          {t(step.title)}
        </h2>
        <p id="tour-body" className="text-sm leading-relaxed text-ink-300">
          {t(step.body)}
        </p>
        <div className="mt-4 flex items-center gap-2">
          {index < lastIndex && (
            <button onClick={onClose} className="rounded-md px-2 py-1.5 text-xs text-ink-400 transition hover:text-ink-100" data-tour-action="skip">
              {t('tourSkip')}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <button
                onClick={back}
                className="rounded-md border border-ink-600 px-3 py-1.5 text-xs text-ink-100 transition hover:bg-ink-700"
                data-tour-action="back"
              >
                {t('tourBack')}
              </button>
            )}
            <button
              ref={primaryRef}
              onClick={next}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:brightness-110"
              data-tour-action="next"
            >
              {index === 0 ? t('tourStart') : index === lastIndex ? t('tourDone') : t('tourNext')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Search, X } from 'lucide-react';
import { useL, useT } from '../i18n';
import { CATEGORIES, TUTORIALS, type Example, type Tutorial } from '../tutorials';
import { TutorialView } from './TutorialView';

interface Props {
  initialTopicId?: string;
  onClose: () => void;
  onOpenExample: (example: Example, tutorial: Tutorial) => void;
}

/** 演算法教學總覽：左側主題清單（可搜尋），右側教學內容。 */
export function Library({ initialTopicId, onClose, onOpenExample }: Props) {
  const t = useT();
  const l = useL();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(initialTopicId ?? TUTORIALS[0].id);
  // 手機版：選了主題後只顯示內容
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(!!initialTopicId);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TUTORIALS;
    return TUTORIALS.filter((tu) => {
      const hay = [
        tu.title.en, tu.title.zh, tu.tagline.en, tu.tagline.zh,
        ...tu.examples.flatMap((e) => [String(e.number), e.title.en, e.title.zh]),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const selected = TUTORIALS.find((tu) => tu.id === selectedId) ?? TUTORIALS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={t('library')}
    >
      <div className="flex w-full max-w-6xl flex-col overflow-hidden border border-ink-700 bg-ink-850 shadow-2xl sm:rounded-xl">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-700 px-4">
          <BookOpen size={16} className="text-brand" />
          <h2 className="text-sm font-semibold">{t('library')}</h2>
          <span className="text-xs text-ink-400">· {TUTORIALS.length}</span>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-ink-400 hover:bg-ink-700 hover:text-ink-100" title={t('close')}>
            <X size={18} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* 主題清單 */}
          <nav className={`w-full shrink-0 flex-col border-r border-ink-700 sm:flex sm:w-72 ${showDetailOnMobile ? 'hidden' : 'flex'}`}>
            <div className="p-3">
              <div className="flex items-center gap-2 rounded-md border border-ink-600 bg-ink-900 px-2.5 focus-within:border-brand">
                <Search size={14} className="text-ink-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('searchTopics')}
                  className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
                />
              </div>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
              {filtered.length === 0 && <p className="px-2 text-sm text-ink-400">{t('noResults')}</p>}
              {CATEGORIES.map((cat) => {
                const items = filtered.filter((tu) => tu.category === cat.id);
                if (!items.length) return null;
                return (
                  <div key={cat.id} className="mb-3">
                    <div className="px-2 py-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">{l(cat.title)}</div>
                    {items.map((tu) => (
                      <button
                        key={tu.id}
                        data-topic={tu.id}
                        onClick={() => {
                          setSelectedId(tu.id);
                          setShowDetailOnMobile(true);
                        }}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                          tu.id === selected.id ? 'bg-ink-700 text-ink-100' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{l(tu.title)}</span>
                        <span className="font-mono text-[10px] text-ink-400">{tu.examples.length}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* 教學內容 */}
          <div ref={detailRef} className={`scrollbar-thin min-w-0 flex-1 overflow-y-auto px-5 py-5 sm:block sm:px-8 ${showDetailOnMobile ? 'block' : 'hidden'}`}>
            <button
              onClick={() => setShowDetailOnMobile(false)}
              className="mb-3 flex items-center gap-1 text-xs text-ink-400 hover:text-ink-100 sm:hidden"
            >
              <ArrowLeft size={14} />
              {t('backToList')}
            </button>
            <div className="max-w-3xl">
              <TutorialView tutorial={selected} onOpenExample={(ex) => onOpenExample(ex, selected)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

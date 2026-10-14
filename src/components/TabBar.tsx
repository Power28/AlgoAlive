import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, FilePlus2, Plus, X } from 'lucide-react';
import { useL, useT } from '../i18n';
import { getExample } from '../tutorials';
import type { Tab } from '../hooks/useTabs';

interface Props {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onNewBlank: () => void;
  onOpenLibrary: () => void;
}

/** 頁籤顯示名稱：自訂名稱 > 範例題名（依語言）> 未命名 N */
export function useTabLabel(tabs: Tab[]) {
  const t = useT();
  const l = useL();
  return (tab: Tab) => {
    if (tab.title) return tab.title;
    const ex = getExample(tab.exampleId)?.example;
    if (ex) return `${ex.number}. ${l(ex.title)}`;
    const blanks = tabs.filter((x) => !x.title && !getExample(x.exampleId));
    return t('untitled', { n: blanks.indexOf(tab) + 1 });
  };
}

export function TabBar({ tabs, activeId, onSelect, onClose, onRename, onNewBlank, onOpenLibrary }: Props) {
  const t = useT();
  const label = useTabLabel(tabs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const commit = () => {
    if (editingId) onRename(editingId, draft.trim());
    setEditingId(null);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <div className="scrollbar-thin flex min-w-0 items-center gap-1 overflow-x-auto py-1" role="tablist">
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          const text = label(tab);
          return (
            <div
              key={tab.id}
              ref={active ? activeRef : undefined}
              role="tab"
              aria-selected={active}
              data-tab-example={tab.exampleId}
              onClick={() => onSelect(tab.id)}
              onDoubleClick={() => {
                setEditingId(tab.id);
                setDraft(text);
              }}
              onAuxClick={(e) => e.button === 1 && onClose(tab.id)}
              title={`${text} · ${t('renameHint')}`}
              className={`group flex max-w-56 shrink-0 cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-1 pl-3 text-xs transition ${
                active ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'
              }`}
            >
              {tab.tutorialId && <BookOpen size={12} className={active ? 'text-brand' : 'text-ink-400'} />}
              {editingId === tab.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-36 rounded bg-ink-900 px-1 py-px text-xs text-ink-100 outline-none ring-1 ring-brand"
                />
              ) : (
                <span className="truncate">{text}</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                className={`rounded p-0.5 transition hover:bg-ink-600 hover:text-ink-100 ${active ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'}`}
                title={t('closeTab')}
                aria-label={t('closeTab')}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex size-7 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-700 hover:text-ink-100"
          title={t('newTab')}
          aria-label={t('newTab')}
          data-action="new-tab"
        >
          <Plus size={16} />
        </button>
        {menuOpen && (
          <div className="absolute top-9 left-0 z-40 w-60 overflow-hidden rounded-lg border border-ink-600 bg-ink-800 shadow-xl">
            <MenuItem
              icon={<FilePlus2 size={16} />}
              title={t('newBlank')}
              desc={t('newBlankDesc')}
              onClick={() => {
                setMenuOpen(false);
                onNewBlank();
              }}
            />
            <MenuItem
              icon={<BookOpen size={16} />}
              title={t('newFromLibrary')}
              desc={t('newFromLibraryDesc')}
              onClick={() => {
                setMenuOpen(false);
                onOpenLibrary();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon, title, desc, onClick }: { icon: ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-ink-700">
      <span className="mt-0.5 text-brand">{icon}</span>
      <span>
        <span className="block text-sm text-ink-100">{title}</span>
        <span className="block text-xs text-ink-400">{desc}</span>
      </span>
    </button>
  );
}

import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, Lightbulb, ListChecks, Timer } from 'lucide-react';
import { useL, useT, type L } from '../i18n';
import { inLanguage, type Difficulty, type Example, type Tutorial } from '../tutorials';
import { getLanguage } from '../languages';
import { useTutorialLanguage } from '../hooks/useTutorialLanguage';
import { TutorialDemo } from './TutorialDemo';

/** 支援 **粗體** 與 `程式碼` 的簡易行內格式 */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') ? (
          <strong key={i} className="font-semibold text-ink-100">
            {p.slice(2, -2)}
          </strong>
        ) : p.startsWith('`') ? (
          <code key={i} className="rounded bg-ink-700 px-1 py-px font-mono text-[0.9em] text-brand">
            {p.slice(1, -1)}
          </code>
        ) : (
          p
        ),
      )}
    </>
  );
}

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: 'text-ok bg-ok/10',
  medium: 'text-brand bg-brand/10',
  hard: 'text-err bg-err/10',
};

export function DifficultyBadge({ d }: { d: Difficulty }) {
  const t = useT();
  return <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${DIFFICULTY_STYLE[d]}`}>{t(d)}</span>;
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function BulletList({ items, ordered }: { items: L[]; ordered?: boolean }) {
  const l = useL();
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`space-y-1.5 pl-5 text-sm leading-relaxed text-ink-300 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-ink-600`}>
      {items.map((it, i) => (
        <li key={i}>
          <Rich text={l(it)} />
        </li>
      ))}
    </Tag>
  );
}

function CodeBlock({ code }: { code: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪貼簿不可用時忽略
    }
  };
  return (
    <div className="group relative">
      <pre className="scrollbar-thin overflow-x-auto rounded-lg border border-ink-700 bg-ink-900 p-3 font-mono text-[13px] leading-relaxed text-ink-300">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 flex items-center gap-1 rounded bg-ink-700 px-2 py-1 text-[11px] text-ink-300 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? t('copied') : t('copy')}
      </button>
    </div>
  );
}

interface Props {
  tutorial: Tutorial;
  onOpenExample: (example: Example) => void;
  /** 目前頁籤對應的範例（在教學面板中標示） */
  currentExampleId?: string;
}

export function TutorialView({ tutorial: base, onOpenExample, currentExampleId }: Props) {
  const t = useT();
  const l = useL();
  // 有 JavaScript 版本的主題可以切換語言：動畫示範、範例清單、在新頁籤開啟都跟著換
  const [preferred, setPreferred] = useTutorialLanguage();
  const hasJs = base.examples.some((e) => e.js);
  const language = hasJs ? preferred : 'python';
  const tutorial = useMemo(() => ({ ...base, examples: base.examples.map((e) => inLanguage(e, language)) }), [base, language]);
  return (
    <article>
      <h2 className="text-xl font-bold tracking-tight text-ink-100">{l(tutorial.title)}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-300">
        <Rich text={l(tutorial.tagline)} />
      </p>

      {hasJs && (
        <div className="mt-4 flex items-center gap-2 text-xs text-ink-400">
          {t('tutorialLanguage')}
          <div className="flex rounded-md border border-ink-600 p-0.5">
            {(['python', 'javascript'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreferred(id)}
                className={`rounded px-2 py-0.5 transition ${language === id ? 'bg-ink-600 font-semibold text-ink-100' : 'hover:text-ink-200'}`}
                data-tutorial-lang={id}
                aria-pressed={language === id}
              >
                {getLanguage(id).label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 切換主題或語言時重新掛載，回到第一個範例 */}
      <TutorialDemo key={`${tutorial.id}:${language}`} tutorial={tutorial} onOpenExample={onOpenExample} />

      <Section icon={<ListChecks size={14} />} title={t('whenToUse')}>
        <BulletList items={tutorial.whenToUse} />
      </Section>

      <Section icon={<Lightbulb size={14} />} title={t('coreIdea')}>
        <BulletList items={tutorial.idea} ordered />
      </Section>

      {tutorial.template && (
        <Section icon={<span className="font-mono text-[11px]">{'</>'}</span>} title={t('template')}>
          <CodeBlock code={tutorial.template} />
        </Section>
      )}

      <Section icon={<Timer size={14} />} title={t('complexity')}>
        <div className="flex flex-wrap gap-2 font-mono text-sm">
          <span className="rounded-md border border-ink-600 px-2 py-1">
            <span className="text-ink-400">{t('time')} </span>
            {tutorial.complexity.time}
          </span>
          <span className="rounded-md border border-ink-600 px-2 py-1">
            <span className="text-ink-400">{t('space')} </span>
            {tutorial.complexity.space}
          </span>
        </div>
        {tutorial.complexity.note && (
          <p className="mt-2 text-xs text-ink-400">
            <Rich text={l(tutorial.complexity.note)} />
          </p>
        )}
      </Section>

      <Section icon={<AlertTriangle size={14} />} title={t('pitfalls')}>
        <BulletList items={tutorial.pitfalls} />
      </Section>

      <Section icon={<ExternalLink size={14} />} title={t('practice')}>
        <div className="grid gap-2">
          {tutorial.examples.map((ex) => {
            const current = ex.id === currentExampleId;
            return (
              <div
                key={ex.id}
                className={`rounded-lg border p-3 ${current ? 'border-brand/50 bg-brand/5' : 'border-ink-700 bg-ink-800/50'}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-brand">{ex.number}.</span>
                  <span className="text-sm font-semibold text-ink-100">{l(ex.title)}</span>
                  <DifficultyBadge d={ex.difficulty} />
                  <button
                    onClick={() => onOpenExample(ex)}
                    data-example={ex.id}
                    data-example-lang={ex.language ?? 'python'}
                    className="ml-auto flex items-center gap-1 rounded-md bg-ok/90 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-ok"
                  >
                    <ExternalLink size={12} />
                    {t('openInNewTab')}
                  </button>
                </div>
                {ex.note && (
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
                    <Rich text={l(ex.note)} />
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </article>
  );
}

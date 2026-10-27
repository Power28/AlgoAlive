import type { ReactNode } from 'react';
import { safeUrl } from '../lib/notes';

/**
 * 筆記用的簡易 Markdown：標題（#、##、###）、條列（- / 1.）、程式碼區塊（```）、
 * 行內程式碼、粗體、斜體、連結。只產生 React 元素，不會把文字當成 HTML（匯入的筆記可能來自別人），
 * 連結只接受 http(s)。
 */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  return <div className={`space-y-2 text-sm leading-relaxed text-ink-100 ${className}`}>{blocks(text)}</div>;
}

function blocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 程式碼區塊
    if (line.trimStart().startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) body.push(lines[i++]);
      i++;
      out.push(
        <pre key={out.length} className="scrollbar-thin overflow-x-auto rounded-md border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-xs text-ink-100">
          {body.join('\n')}
        </pre>,
      );
      continue;
    }
    // 標題
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const size = ['text-base', 'text-sm', 'text-sm'][h[1].length - 1];
      out.push(
        <div key={out.length} className={`${size} font-semibold text-ink-100`}>
          {inline(h[2])}
        </div>,
      );
      i++;
      continue;
    }
    // 條列（- 或 1.）
    const isItem = (l: string) => /^\s*([-*]|\d+[.)])\s+/.test(l);
    if (isItem(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && isItem(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+[.)])\s+/, ''));
      const List = ordered ? 'ol' : 'ul';
      out.push(
        <List key={out.length} className={`space-y-0.5 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((item, k) => (
            <li key={k}>{inline(item)}</li>
          ))}
        </List>,
      );
      continue;
    }
    // 空行分段
    if (!line.trim()) {
      i++;
      continue;
    }
    // 段落：連續的非空行
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isItem(lines[i]) && !/^#{1,3}\s/.test(lines[i]) && !lines[i].trimStart().startsWith('```')) {
      para.push(lines[i++]);
    }
    out.push(
      <p key={out.length} className="whitespace-pre-wrap">
        {inline(para.join('\n'))}
      </p>,
    );
  }
  return out;
}

/** 行內格式：`code`、**粗體**、*斜體*、[文字](https://…) */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = out.length;
    if (m[1] !== undefined) out.push(<code key={key} className="rounded bg-ink-700 px-1 py-px font-mono text-[0.85em] text-ink-100">{m[1]}</code>);
    else if (m[2] !== undefined) out.push(<strong key={key} className="font-semibold text-ink-100">{m[2]}</strong>);
    else if (m[3] !== undefined) out.push(<em key={key}>{m[3]}</em>);
    else {
      const href = safeUrl(m[5]);
      out.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">
            {m[4]}
          </a>
        ) : (
          m[0]
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

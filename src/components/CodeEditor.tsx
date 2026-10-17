import { useEffect, useRef } from 'react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import '../lib/monaco';

type MonacoEditor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];

interface Props {
  /** 每個頁籤一個 Monaco model，切換頁籤時各自保留復原紀錄 */
  path: string;
  /** Monaco 的語言 id（語法上色） */
  language: string;
  value: string;
  onChange: (v: string) => void;
  /** 即將執行的行 */
  currentLine?: number;
  /** 上一步執行過的行 */
  prevLine?: number;
  errorLine?: number | null;
  /** 目前行的行尾提示：條件式 "0 < 6 → True"、計算 "(0 + 7) // 2 → 3" */
  hint?: { text: string; tone: 'true' | 'false' | 'unknown' | 'calc' };
  onRun: () => void;
}

const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('algoalive-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.lineHighlightBackground': '#00000000',
      'editor.lineHighlightBorder': '#00000000',
      'editorLineNumber.foreground': '#5a5a5a',
      'editorLineNumber.activeForeground': '#b3b3b3',
    },
  });
};

export function CodeEditor({ path, language, value, onChange, currentLine, prevLine, errorLine, hint, onRun }: Props) {
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorations = useRef<ReturnType<MonacoEditor['createDecorationsCollection']> | null>(null);
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    decorations.current = editor.createDecorationsCollection();
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current());
    applyDecorations();
  };

  const applyDecorations = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !decorations.current) return;
    const lineDeco = (line: number, className: string, glyph?: string) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: true, className, glyphMarginClassName: glyph },
    });
    const list = [];
    if (prevLine && prevLine !== currentLine) list.push(lineDeco(prevLine, 'aa-prev-line'));
    if (currentLine) list.push(lineDeco(currentLine, 'aa-current-line', 'aa-glyph-current'));
    if (errorLine) list.push(lineDeco(errorLine, 'aa-error-line'));
    const model = editor.getModel();
    if (hint && currentLine && model && currentLine <= model.getLineCount()) {
      const end = model.getLineMaxColumn(currentLine);
      list.push({
        range: new monaco.Range(currentLine, end, currentLine, end),
        options: {
          // 空範圍的裝飾預設不畫，要明確打開才會顯示行尾提示
          showIfCollapsed: true,
          after: {
            content: `    ${hint.text}`,
            inlineClassName: `aa-hint-${hint.tone}`,
          },
        },
      });
    }
    decorations.current.set(list);
    const focus = currentLine ?? errorLine;
    if (focus) editor.revealLineInCenterIfOutsideViewport(focus);
  };

  useEffect(applyDecorations, [path, currentLine, prevLine, errorLine, hint?.text, hint?.tone]);

  return (
    <Editor
      path={path}
      language={language}
      theme="algoalive-dark"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      beforeMount={defineTheme}
      onMount={handleMount}
      loading={<div className="p-4 text-sm text-ink-400">Loading editor…</div>}
      options={{
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
        minimap: { enabled: false },
        glyphMargin: true,
        scrollBeyondLastLine: false,
        tabSize: 4,
        insertSpaces: true,
        automaticLayout: true,
        padding: { top: 12 },
        renderLineHighlight: 'none',
        lineNumbersMinChars: 3,
      }}
    />
  );
}

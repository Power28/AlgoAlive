/**
 * 編輯器還在下載時，先用純文字顯示程式碼：字型、行高、行號位置與 Monaco 相同，
 * 換成編輯器時畫面幾乎不會跳動。很小，放在主程式裡。
 */
export function CodePreview({ code }: { code: string }) {
  const lines = code.split('\n');
  return (
    <div
      className="scrollbar-thin h-full overflow-auto bg-[#1e1e1e] pt-3 font-mono text-[14px] leading-[19px]"
      // Monaco 不使用連字（-> 不會變成 →）
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace", fontVariantLigatures: 'none' }}
      aria-busy="true"
      data-code-preview
    >
      {lines.map((line, i) => (
        <div key={i} className="flex whitespace-pre">
          <span className="w-[71px] shrink-0 pr-[35px] text-right text-[#5a5a5a] select-none">{i + 1}</span>
          <span className="text-ink-100">{line || ' '}</span>
        </div>
      ))}
    </div>
  );
}

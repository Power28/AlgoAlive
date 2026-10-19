import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * 內容安全政策（CSP）：GitHub Pages 不能設定 HTTP header，改用 <meta>。
 * - 程式只能來自自己的網站；Pyodide 從 jsdelivr 載入（'wasm-unsafe-eval' 給 WebAssembly 用）
 * - 樣式允許 inline：Monaco 與 framer-motion 會動態加入樣式
 * 只在 build 時加入：開發模式的 Vite 會插入 inline script
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "worker-src 'self'",
  "connect-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/**
 * 編輯器（Monaco）是 lazy 載入的另一個檔案，平常要等主程式執行後才開始下載。
 * 首頁一定會用到它，所以在 index.html 加上 modulepreload，讓它和主程式同時下載。
 */
const preloadEditor = (): Plugin => ({
  name: 'algoalive-preload-editor',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (_html, ctx) => {
      const chunks = Object.values(ctx.bundle ?? {});
      const editor = chunks.find((c) => c.type === 'chunk' && c.isDynamicEntry && /CodeEditor/.test(c.fileName));
      if (!editor || editor.type !== 'chunk') return [];
      const css = [...(editor.viteMetadata?.importedCss ?? [])];
      return [
        { tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: `./${editor.fileName}` }, injectTo: 'head' },
        ...css.map((href) => ({ tag: 'link', attrs: { rel: 'preload', as: 'style', href: `./${href}` }, injectTo: 'head' as const })),
      ];
    },
  },
});

const csp = (): Plugin => ({
  name: 'algoalive-csp',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
});

/**
 * Service Worker（public/sw.js）：build 完成後填入要預先存起來的檔案清單與版本號。
 * 版本號由所有檔案的內容算出，網站有任何改變就會換新的快取。
 */
/** Pyodide 的版本號以 pyodide.worker.ts 為準 */
const pyodideVersion = (root: string) => {
  const src = fs.readFileSync(path.join(root, 'src/languages/python/pyodide.worker.ts'), 'utf8');
  const m = src.match(/PYODIDE_VERSION = '([\d.]+)'/);
  if (!m) throw new Error('PYODIDE_VERSION not found in pyodide.worker.ts');
  return m[1];
};

const serviceWorker = (): Plugin => {
  let config: ResolvedConfig;
  return {
    name: 'algoalive-service-worker',
    apply: 'build',
    configResolved: (c) => void (config = c),
    closeBundle() {
      const out = path.resolve(config.root, config.build.outDir);
      const swPath = path.join(out, 'sw.js');
      if (!fs.existsSync(swPath)) return;
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          if (fs.statSync(full).isDirectory()) walk(full);
          else files.push(path.relative(out, full).split(path.sep).join('/'));
        }
      };
      walk(out);
      const precache = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map')).sort();
      const hash = createHash('sha256');
      for (const f of precache) hash.update(f).update(fs.readFileSync(path.join(out, f)));
      const urls = ['./', ...precache.map((f) => `./${f}`)];
      const sw = fs
        .readFileSync(swPath, 'utf8')
        .replace("'__BUILD_ID__'", JSON.stringify(hash.digest('hex').slice(0, 12)))
        .replace('/* __PRECACHE__ */ []', JSON.stringify(urls))
        .replace('__PYODIDE_VERSION__', pyodideVersion(config.root));
      fs.writeFileSync(swPath, sw);
    },
  };
};

export default defineConfig({
  // 相對路徑，方便直接部署到 GitHub Pages 等任意子路徑
  base: './',
  plugins: [react(), tailwindcss(), csp(), preloadEditor(), serviceWorker()],
  // Worker 需使用 ES module 格式，才能動態 import Pyodide CDN 的 pyodide.mjs
  worker: { format: 'es' },
});

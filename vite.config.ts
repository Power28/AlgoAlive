import { defineConfig, type Plugin } from 'vite';
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

const csp = (): Plugin => ({
  name: 'algoalive-csp',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
});

export default defineConfig({
  // 相對路徑，方便直接部署到 GitHub Pages 等任意子路徑
  base: './',
  plugins: [react(), tailwindcss(), csp()],
  // Worker 需使用 ES module 格式，才能動態 import Pyodide CDN 的 pyodide.mjs
  worker: { format: 'es' },
});

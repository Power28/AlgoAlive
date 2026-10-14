import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // 相對路徑，方便直接部署到 GitHub Pages 等任意子路徑
  base: './',
  plugins: [react(), tailwindcss()],
  // Worker 需使用 ES module 格式，才能動態 import Pyodide CDN 的 pyodide.mjs
  worker: { format: 'es' },
});

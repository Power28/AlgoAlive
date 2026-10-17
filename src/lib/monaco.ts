/// Monaco 從本地打包載入，不再由 @monaco-editor/react 在執行時從 CDN 下載：
/// 程式碼跟網站一起部署，不會被第三方替換，也能用 CSP 限制來源。
/// 只帶入編輯器功能與 Python / JavaScript 的語法上色（不含 TypeScript 語言服務）。
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/features/register.all';
import 'monaco-editor/languages/definitions/python/register';
import 'monaco-editor/languages/definitions/javascript/register';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

loader.config({ monaco });

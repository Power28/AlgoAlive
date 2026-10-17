/// Monaco 從本地打包載入，不再由 @monaco-editor/react 在執行時從 CDN 下載：
/// 程式碼跟網站一起部署，不會被第三方替換，也能用 CSP 限制來源。
/// 只帶入寫題目用得到的編輯功能與 Python / JavaScript 的語法上色：
/// 不含 TypeScript 語言服務，也不含 AI 行內補全、diff、色彩選擇器、跳到定義等用不到的功能（打包後小很多）。
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/features/codicon/register';
import 'monaco-editor/features/codeEditor/register';
// 編輯
import 'monaco-editor/features/bracketMatching/register';
import 'monaco-editor/features/caretOperations/register';
import 'monaco-editor/features/clipboard/register';
import 'monaco-editor/features/comment/register';
import 'monaco-editor/features/contextmenu/register';
import 'monaco-editor/features/cursorUndo/register';
import 'monaco-editor/features/indentation/register';
import 'monaco-editor/features/lineSelection/register';
import 'monaco-editor/features/linesOperations/register';
import 'monaco-editor/features/multicursor/register';
import 'monaco-editor/features/smartSelect/register';
import 'monaco-editor/features/wordOperations/register';
import 'monaco-editor/features/wordPartOperations/register';
// 瀏覽與輔助
import 'monaco-editor/features/find/register';
import 'monaco-editor/features/folding/register';
// 自動完成：完整版是透過 AI 行內補全間接帶入建議清單，這裡不要行內補全，直接帶入建議清單
import 'monaco-editor/editor/contrib/suggest/browser/suggestController';
import 'monaco-editor/features/suggest/register';
import 'monaco-editor/features/tokenization/register';
import 'monaco-editor/features/wordHighlighter/register';
// 語法上色
import 'monaco-editor/languages/definitions/python/register';
import 'monaco-editor/languages/definitions/javascript/register';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

loader.config({ monaco });

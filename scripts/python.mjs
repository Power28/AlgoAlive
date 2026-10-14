// 共用：用本機可用的 Python 3 執行腳本（Windows 通常是 python / py，Linux / macOS 是 python3）
//
// 當成指令使用：node scripts/python.mjs <script.py> [args...]  （結束碼與該腳本相同）
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function runPython(args) {
  const candidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
  // 讓 → 、∞ 等字元在 Windows 主控台也能正常輸出
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
  for (const py of candidates) {
    const res = spawnSync(py, args, { stdio: 'inherit', env });
    if (res.error?.code === 'ENOENT') continue;
    return { python: py, status: res.status ?? 1 };
  }
  throw new Error('找不到 Python 3（python3 / python / py）');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { status } = runPython(process.argv.slice(2));
  process.exit(status);
}

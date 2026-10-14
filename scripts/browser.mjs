// 共用：找到本機的 Chrome / Edge，並給出 puppeteer 的啟動參數
import fs from 'node:fs';

export function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ];
  const found = candidates.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('找不到 Chrome / Edge，請設定環境變數 CHROME_PATH 指向瀏覽器執行檔');
  return found;
}

/** puppeteer.launch() 的參數；Linux CI（例如 GitHub Actions）上 Chrome 的沙箱無法啟用，需要關掉 */
export function launchOptions(extra = {}) {
  return {
    executablePath: findBrowser(),
    headless: true,
    args: process.platform === 'linux' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
    ...extra,
  };
}

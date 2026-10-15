// 共用：找到本機的 Chrome / Edge，並給出 puppeteer 的啟動參數
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

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
    args: process.platform === 'linux' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] : [],
    ...extra,
  };
}

/**
 * 啟動瀏覽器；失敗時自動重試。
 * CI 上 Chrome 偶爾會卡住、等不到 WS endpoint（TimeoutError），重開一次通常就好
 */
export async function launchBrowser(extra = {}, { attempts = 3, timeout = 60_000 } = {}) {
  for (let i = 1; ; i++) {
    try {
      return await puppeteer.launch(launchOptions({ timeout, ...extra }));
    } catch (err) {
      if (i >= attempts) throw err;
      console.warn(`瀏覽器啟動失敗（第 ${i} / ${attempts} 次）：${err.message.split('\n')[0]}，${i * 2} 秒後重試`);
      await new Promise((r) => setTimeout(r, i * 2000));
    }
  }
}

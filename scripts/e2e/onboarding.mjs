// e2e：第一次造訪：首頁載入、導覽、步驟跳轉、CSP（依序執行：步驟跳轉用的是導覽中執行過的頁籤）
//
//   node scripts/e2e/onboarding.mjs                          # 自己啟動 vite preview（先 npm run build）
//   node scripts/e2e/onboarding.mjs --url http://localhost:5173/
import { record, sleep, openApp, runSuite, clickVisualize } from './harness.mjs';

async function testInitialLoad(page) {
  console.log('Initial load');
  // 首頁：編輯器以 modulepreload 和主程式同時下載；教學視窗、教學頁要打開時才載入
  const load = await page.evaluate(() => ({
    preload: [...document.querySelectorAll('link[rel="modulepreload"]')].some((l) => /CodeEditor-/.test(l.getAttribute('href'))),
    files: performance.getEntriesByType('resource').map((e) => e.name.split('/').pop()),
  }));
  const loaded = (name) => load.files.some((f) => f.startsWith(`${name}-`));
  record(
    'the editor is preloaded and the tutorials load on demand',
    load.preload && loaded('CodeEditor') && !loaded('Library') && !loaded('TutorialView') ? null : `got ${JSON.stringify(load)}`,
  );
}

async function testTour(page, url) {
  console.log('Tour');
  const state = () => page.evaluate(() => ({
    step: document.querySelector('[data-tour-step]')?.dataset.tourStep ?? null,
    progress: document.querySelector('[data-tour-progress]')?.textContent.trim() ?? null,
    playback: document.body.innerText.match(/Step (\d+) \/ (\d+)/)?.[0] ?? null,
  }));
  // 第一次打開（沒有存過頁籤）：自動出現導覽
  const first = await state();
  record('the tour opens on the first visit', first.step === 'welcome' && first.progress === '1 / 8' ? null : `got ${JSON.stringify(first)}`);

  // 用方向鍵往下走；在「視覺化」那一步按下一步，會先幫使用者執行範例
  const order = [first.step];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowRight');
    await sleep(250);
    order.push((await state()).step);
  }
  await page.waitForFunction(() => /Step 1 \/ [1-9]\d*/.test(document.body.innerText), { timeout: 30_000 }).catch(() => {});
  const ran = await state();
  // 框住的區塊在畫面上，說明卡不會蓋住它
  const placement = await page.evaluate(() => {
    const t = document.querySelector('[data-tour="viz"]').getBoundingClientRect();
    const c = document.querySelector('[data-tour-card]').getBoundingClientRect();
    return { inView: t.top >= 0 && t.top < innerHeight, cardInView: c.top >= 0 && c.bottom <= innerHeight && c.left >= 0 && c.right <= innerWidth };
  });
  record(
    'the tour walks through the editor, the input and Visualize, then runs the example',
    order.join(',') === 'welcome,editor,call,run,viz' && ran.playback?.startsWith('Step 1 /') && placement.inView && placement.cardInView
      ? null
      : `got ${JSON.stringify({ order, ran, placement })}`,
  );

  // 導覽開著時，方向鍵只換導覽的步驟，不會移動播放
  await page.keyboard.press('ArrowRight');
  await sleep(250);
  const controls = await state();
  await page.keyboard.press('ArrowRight');
  await sleep(250);
  const learn = await state();
  await page.keyboard.press('ArrowRight');
  await sleep(250);
  const notes = await state();
  record(
    'arrow keys move the tour, not the playback',
    controls.step === 'controls' && learn.step === 'learn' && notes.step === 'notes' && notes.playback === ran.playback
      ? null
      : `got ${JSON.stringify({ controls, learn, notes, ran })}`,
  );

  // 最後一步按「開始使用」關閉，之後重新整理不會再出現；右上角的 ? 可以重看，Esc 關閉
  await page.click('[data-tour-action="next"]');
  await sleep(200);
  const closed = await state();
  await openApp(page, url);
  const again = await state();
  await page.click('[data-action="tour"]');
  await sleep(300);
  const replay = await state();
  await page.keyboard.press('Escape');
  await sleep(200);
  const escaped = await state();
  record(
    'the tour is shown once and can be replayed from the ? button',
    closed.step === null && again.step === null && replay.step === 'welcome' && escaped.step === null
      ? null
      : `got ${JSON.stringify({ closed, again, replay, escaped })}`,
  );
}

async function testStepJump(page) {
  console.log('Step search');
  // 預設頁籤（167. 兩數之和 II）已經在導覽中執行過
  await clickVisualize(page);
  await page.waitForFunction(() => /Step 1 \/ [1-9]\d*/.test(document.body.innerText), { timeout: 30_000 });
  const state = () => page.evaluate(() => ({
    step: Number(document.body.innerText.match(/Step (\d+) \//)?.[1]),
    chip: document.querySelector('[data-visit]')?.textContent.trim() ?? null,
    right: [...document.querySelectorAll('main section')].map((el) => el.innerText).join(' ').match(/right\s+(\d+)/)?.[1] ?? null,
    selection: !!document.querySelector('.monaco-editor .selected-text'),
  }));
  await page.waitForSelector('.monaco-editor .line-numbers.aa-line-jump');
  const lineNumber = async (n, shift = false) => {
    // Monaco 換步驟時會重畫行號：用座標點，不要拿著元素
    const at = await page.evaluate((n) => {
      const el = [...document.querySelectorAll('.monaco-editor .line-numbers.aa-line-jump')].find((x) => x.textContent.trim() === String(n));
      const r = el?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    }, n);
    if (!at) return { missing: n };
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.click(at.x, at.y);
    if (shift) await page.keyboard.up('Shift');
    await sleep(300);
    return state();
  };
  // 點行號：跳到下一次執行第 7 行；再點一次是下一次；Shift + 點回到上一次
  const a = await lineNumber(7);
  const b = await lineNumber(7);
  const c = await lineNumber(7, true);
  record(
    'clicking a line number jumps to the next time the line runs',
    a.chip === 'run 1 / 5' && b.chip === 'run 2 / 5' && b.step > a.step && c.chip === 'run 1 / 5' && c.step === a.step && !a.selection
      ? null
      : `got ${JSON.stringify({ a, b, c })}`,
  );

  // 點變數名稱：跳到 right 下一次改變（值和上一次看到的不同）
  // 變數改變的步驟在畫面畫出後才算，算好才變成可以點的名稱
  await page.waitForSelector('[data-var-jump="right"]');
  const before = await state();
  await page.click('[data-var-jump="right"]');
  await sleep(300);
  const after = await state();
  const title = await page.$eval('[data-var-jump="right"]', (el) => el.title);
  record(
    'clicking a variable name jumps to its next change',
    after.step > before.step && after.right !== before.right && /right changes \d+ times/.test(title) ? null : `got ${JSON.stringify({ before, after, title })}`,
  );

  // 播放的鍵盤快捷鍵（焦點不在輸入框、按鈕或編輯器時）：End 最後一步、Home 第一步、→ 下一步
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
  const total = await page.evaluate(() => Number(document.body.innerText.match(/Step \d+ \/ (\d+)/)?.[1]));
  const keys = [];
  for (const key of ['End', 'Home', 'ArrowRight']) {
    await page.keyboard.press(key);
    await sleep(200);
    keys.push((await state()).step);
  }
  record('the playback keyboard shortcuts move between steps', keys.join(',') === `${total},1,2` ? null : `got ${keys} of ${total}`);
}

async function testSecurity(page) {
  console.log('Security');
  // Monaco 從本地打包載入（不從 CDN 下載），頁面帶有 CSP；違反 CSP 會出現在 console 錯誤的檢查裡
  const security = await page.evaluate(() => ({
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? '',
    cdnMonaco: performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('monaco-editor')),
    editor: !!document.querySelector('.monaco-editor'),
  }));
  record(
    'Monaco is bundled locally and the page has a CSP',
    /script-src 'self'/.test(security.csp) && !security.cdnMonaco.length && security.editor ? null : `got ${JSON.stringify(security)}`,
  );
}

await runSuite(async ({ page, url }) => {
  await testInitialLoad(page);
  await testTour(page, url);
  await testStepJump(page);
  await testSecurity(page);
}, { firstVisit: true });

// e2e：頁籤、介面語言、舊的動畫、測試呼叫的輔助、JavaScript
//
//   node scripts/e2e/basics.mjs                          # 自己啟動 vite preview（先 npm run build）
//   node scripts/e2e/basics.mjs --url http://localhost:5173/
import { record, sleep, openApp, runActiveTab, tabTitles, openAndStepTo, runSuite, clickVisualize } from './harness.mjs';

async function testTabs(page, url) {
  console.log('Tabs');
  const initial = await tabTitles(page);
  record('three default tabs on first visit', initial.length === 3 ? null : `got ${JSON.stringify(initial)}`);

  // 新增空白頁籤並執行（BLANK_CALL = solve([1, 2, 3, 4]) → 10）
  await page.click('[data-action="new-tab"]');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Blank tab')).click());
  await sleep(400);
  const blank = await runActiveTab(page);
  record('new blank tab runs', blank.returned === '10' ? null : `got ${JSON.stringify(blank)}`);

  // 雙擊重新命名
  const active = await page.$('[role="tab"][aria-selected="true"]');
  await active.click({ count: 2 });
  await page.waitForSelector('[role="tab"] input');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.type('My practice');
  await page.keyboard.press('Enter');
  await sleep(200);
  const renamed = await tabTitles(page);
  record('double-click renames a tab', renamed.includes('My practice') ? null : `got ${JSON.stringify(renamed)}`);

  // 重新整理後仍保留（localStorage 會在 300ms 後寫入）
  await sleep(600);
  await openApp(page, url);
  const reloaded = await tabTitles(page);
  record('tabs survive a reload', reloaded.length === initial.length + 1 && reloaded.includes('My practice') ? null : `got ${JSON.stringify(reloaded)}`);

  // 關閉
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('[role="tab"]')].find((t) => t.innerText.includes('My practice'));
    tab.querySelector('button').click();
  });
  await sleep(200);
  const closed = await tabTitles(page);
  record('closing a tab removes it', closed.includes('My practice') ? `got ${JSON.stringify(closed)}` : null);
}

async function testLanguage(page) {
  console.log('Language');
  await page.click('[data-action="lang"]');
  await sleep(200);
  const zh = await page.$eval('[data-action="visualize"]', (b) => b.innerText.trim());
  record('switch to Chinese', zh === '視覺化' ? null : `visualize button says ${JSON.stringify(zh)}`);
  await page.click('[data-action="lang"]');
  await sleep(200);
  const en = await page.$eval('[data-action="visualize"]', (b) => b.innerText.trim());
  record('switch back to English', en === 'Visualize' ? null : `visualize button says ${JSON.stringify(en)}`);
}

async function testStale(page) {
  console.log('Stale animation');
  // 預設頁籤：執行後修改測資 → 右邊標出「舊的結果」；改回原樣 → 提示消失；按提示卡上的按鈕重新執行 → 提示消失
  await page.click('[role="tab"]');
  await clickVisualize(page);
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  const input = 'input[placeholder]';
  const original = await page.$eval(input, (e) => e.value);
  const staleState = () => page.evaluate(() => ({
    stale: document.querySelector('[data-stale]')?.getAttribute('data-stale') ?? null,
    badge: !!document.querySelector('[data-stale-badge]'),
  }));
  await page.$eval(input, (e) => e.select());
  await page.keyboard.type(original.replace(/\)$/, ' )'));
  await sleep(200);
  const edited = await staleState();
  await page.$eval(input, (e) => e.select());
  await page.keyboard.type(original);
  await sleep(200);
  const reverted = await staleState();
  record('editing the test call marks the animation as old, reverting clears it', edited.stale === 'call' && edited.badge && reverted.stale === null && !reverted.badge ? null : `got ${JSON.stringify({ edited, reverted })}`);

  await page.$eval(input, (e) => e.select());
  await page.keyboard.type(original.replace(/\)$/, ' )'));
  await sleep(200);
  await page.click('[data-action="revisualize"]');
  await page.waitForFunction(() => !document.querySelector('[data-stale]'), { timeout: 30_000 }).catch(() => {});
  const rerun = await staleState();
  // 還原測資，避免影響後面的測試
  await page.$eval(input, (e) => e.select());
  await page.keyboard.type(original);
  await clickVisualize(page);
  await sleep(300);
  record('the button on the notice runs the new code', rerun.stale === null && !rerun.badge ? null : `got ${JSON.stringify(rerun)}`);
}

async function testCallAssist(page) {
  console.log('Test call assistance');
  await page.click('[role="tab"]');
  const input = 'input[placeholder]';
  const original = await page.$eval(input, (e) => e.value);
  const setCall = async (v) => {
    await page.$eval(input, (e) => e.select());
    if (v) await page.keyboard.type(v);
    else await page.keyboard.press('Backspace');
    await sleep(150);
  };
  const run = async () => {
    await clickVisualize(page);
    await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText) || document.querySelector('main [data-error]'), { timeout: 30_000 });
    await sleep(200);
  };
  const text = (sel) => page.evaluate((s) => document.querySelector(s)?.innerText.replace(/\s+/g, ' ').trim() ?? null, sel);

  // 直接貼 LeetCode 的範例輸入
  await setCall('numbers = [2,7,11,15], target = 9');
  await run();
  const info = await text('[data-call-info]');
  record('LeetCode example input is understood', info === 'Read as twoSum(numbers=[2, 7, 11, 15], target=9)' ? null : `got ${JSON.stringify(info)}`);

  // 名稱大小寫打錯：說明 + 一鍵修正並執行
  await setCall('TwoSum([2,7,11,15], 9)');
  await run();
  const hint = await text('[data-call-hint="name"]');
  const extraSuggest = await text('[data-call-suggest]');
  await page.click('[data-action="apply-fix"]');
  await page.waitForFunction(() => !document.querySelector('[data-call-hint]') && /Step 1 \/ \d+/.test(document.body.innerText), { timeout: 30_000 }).catch(() => {});
  const fixed = await page.$eval(input, (e) => e.value);
  record('a misspelled function gets a one-click fix', /no function called TwoSum — did you mean twoSum\?/.test(hint ?? '') && extraSuggest === null && fixed === 'twoSum([2,7,11,15], 9)' ? null : `got ${JSON.stringify({ hint, extraSuggest, fixed })}`);

  // 清空：建議依函式定義填入範例
  await setCall('');
  const suggest = await text('[data-call-suggest]');
  await page.click('[data-call-suggest] button');
  await sleep(150);
  const filled = await page.$eval(input, (e) => e.value);
  record('an empty test call suggests an example', /Fill in an example/.test(suggest ?? '') && filled === 'twoSum(numbers=[1, 2, 3, 4], target=5)' ? null : `got ${JSON.stringify({ suggest, filled })}`);

  await setCall(original);
  await run();
}

async function testJavaScript(page) {
  console.log('JavaScript');
  // 教學範例的頁籤切換語言：不覆蓋程式碼，改開新的 JavaScript 頁籤
  await page.click('[role="tab"]');
  const before = (await tabTitles(page)).length;
  await page.select('[data-action="language"]', 'javascript');
  await sleep(300);
  const opened = await page.evaluate(() => ({
    badge: !!document.querySelector('[role="tab"][aria-selected="true"] [data-tab-lang="javascript"]'),
    code: document.querySelector('.monaco-editor')?.innerText.replace(/ /g, ' ').includes('var solve') ?? false,
  }));
  const { returned, error } = await runActiveTab(page);
  const ready = await page.evaluate(() => document.querySelector('[data-runtime="ready"]')?.innerText ?? '');
  record(
    'switching an example tab to JavaScript opens a new JS tab that runs',
    (await tabTitles(page)).length === before + 1 && opened.badge && opened.code && returned === '10' && !error && /JavaScript ready/.test(ready)
      ? null
      : `got ${JSON.stringify({ opened, returned, error, ready })}`,
  );
  // 沒修改過的空白頁籤：原地切回 Python
  await page.select('[data-action="language"]', 'python');
  await sleep(300);
  const back = await page.evaluate(() => ({
    badge: !!document.querySelector('[role="tab"][aria-selected="true"] [data-tab-lang]'),
    code: document.querySelector('.monaco-editor')?.innerText.replace(/ /g, ' ').includes('def solve') ?? false,
  }));
  record('an untouched blank tab switches language in place', (await tabTitles(page)).length === before + 1 && !back.badge && back.code ? null : `got ${JSON.stringify(back)}`);
  await page.click('[role="tab"][aria-selected="true"] button');

  // JavaScript 的值用 JavaScript 的寫法顯示：鏈結串列尾端是 null
  await openAndStepTo(page, 'javascript', 'js206', 'section', 'ListNode', { keepOpen: true });
  const end = await page.evaluate(() => document.querySelector('main')?.innerText.match(/→\s*(null|None)/)?.[1] ?? null);
  await page.click('[role="tab"][aria-selected="true"] button');
  record('JavaScript values use JavaScript literals', end === 'null' ? null : `got ${JSON.stringify(end)}`);

  // 說明卡片：JavaScript 的運算子、true / false 與短路說明
  const cond = await openAndStepTo(page, 'javascript', 'js155', '[data-condition]', '||');
  record('JavaScript condition cards use || and true', /0 === 0 \|\| …[\s\S]*true[\s\S]*\|\| stops at the first truthy value/.test(cond) ? null : `got ${JSON.stringify(cond)}`);
  const op = await openAndStepTo(page, 'javascript', 'js1', '[data-op]', 'seen');
  record('JavaScript container ops get a card', /seen\.set\(nums\[i\], i\)[\s\S]*seen\[2\] = 0/.test(op) ? null : `got ${JSON.stringify(op)}`);

  // 內建函式：JavaScript 的 sort 依比較函式排序，格子滑到新位置
  await openAndStepTo(page, 'javascript', 'js1984', '[data-builtin]', 'sort', { keepOpen: true });
  await sleep(1200);
  const sorted = await page.evaluate(() => ({
    title: document.querySelector('main [data-builtin]')?.innerText.split('\n')[0] ?? '',
    order: document.querySelector('main [data-reorder]')?.innerText.split(/\s+/).join(' ') ?? '',
  }));
  await page.click('[role="tab"][aria-selected="true"] button');
  record('JavaScript sort gets a built-in card', /sort/i.test(sorted.title) && sorted.order === '1 4 7 9' ? null : `got ${JSON.stringify(sorted)}`);
}

await runSuite(async ({ page, url }) => {
  await testTabs(page, url);
  await testLanguage(page);
  await testStale(page);
  await testCallAssist(page);
  await testJavaScript(page);
});

// e2e：步數上限、無窮迴圈、大陣列 / 大字典
//
//   node scripts/e2e/limits.mjs                          # 自己啟動 vite preview（先 npm run build）
//   node scripts/e2e/limits.mjs --url http://localhost:5173/
import { record, sleep, openApp, runActiveTab, runSuite, clickVisualize } from './harness.mjs';

async function testStepLimit(page, url) {
  console.log('Step limit');
  // 放入自訂程式碼：暫時改寫儲存的頁籤再重新載入，測完還原
  const saved = await page.evaluate(() => localStorage.getItem('algoalive.tabs.v1'));
  const tabs = {
    tabs: [
      { id: 'long', title: 'long', code: 'def total(n):\n    t = 0\n    for i in range(n):\n        t += i\n    return t\n', call: 'total(300)' },
      { id: 'spin', title: 'spin', code: 'def spin(n):\n    i = 0\n    while i < n:\n        i = i * 1\n    return i\n', call: 'spin(3)' },
      {
        id: 'big',
        title: 'big',
        code: 'def search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        elif nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n',
        call: 'search(list(range(0, 3000, 3)), 2400)',
      },
      { id: 'dict', title: 'dict', code: 'def f():\n    seen = {i: -i for i in range(300)}\n    nums = set(range(300))\n    x = 150\n    return seen[x]\n', call: 'f()' },
    ],
    activeId: 'long',
  };
  await page.evaluate((v) => localStorage.setItem('algoalive.tabs.v1', v), JSON.stringify(tabs));
  await openApp(page, url);
  const box = () => page.evaluate(() => {
    const el = document.querySelector('[data-step-limit]');
    return el ? { kind: el.dataset.stepLimit, text: el.innerText.replace(/\s+/g, ' ') } : null;
  });

  // 需要比較多步的正常程式：可以繼續追蹤到 2,000 步，之後順利跑完
  const first = await runActiveTab(page);
  const more = await box();
  await page.click('[data-action="more-steps"]');
  await page.waitForFunction(() => !document.querySelector('[data-step-limit]') && /Step \d+ \/ [1-9]\d*/.test(document.body.innerText), { timeout: 60_000 }).catch(() => {});
  await page.click('[data-action="last"]');
  await sleep(300);
  const finished = await page.evaluate(() => document.querySelector('main [data-return]')?.textContent ?? null);
  record(
    'a long run offers to keep tracing and then finishes',
    first.returned === null && more?.kind === 'more' && /500-step limit[\s\S]*Keep tracing up to 2,000 steps/.test(more.text) && finished === '44850'
      ? null
      : `got ${JSON.stringify({ first, more, finished })}`,
  );

  // 狀態重複的無窮迴圈：直接說明是無窮迴圈，不提供繼續追蹤
  await page.click('[role="tab"]:nth-child(2)');
  await runActiveTab(page);
  const loop = await box();
  const moreButton = await page.$('[data-action="more-steps"]');
  record(
    'a repeating state is reported as an infinite loop',
    loop?.kind === 'loop' && /Steps \d+ and \d+ are in exactly the same state/.test(loop.text) && !moreButton ? null : `got ${JSON.stringify(loop)}`,
  );

  // 大陣列（1,000 個元素）：只畫出開頭、結尾與指針附近的格子，索引是真實的位置
  await page.click('[role="tab"]:nth-child(3)');
  await clickVisualize(page);
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  for (let i = 0; i < 5; i++) await page.click('[data-action="next"]');
  await sleep(400);
  const big = await page.evaluate(() => {
    const section = [...document.querySelectorAll('main section')].find((el) => el.innerText.startsWith('nums'));
    return {
      header: section?.innerText.split('\n').slice(0, 3).join(' ') ?? '',
      gaps: section?.querySelectorAll('[data-gap]').length ?? 0,
      labels: section ? [...section.querySelectorAll('.text-center')].map((e) => e.textContent) : [],
      pointers: section?.innerText.includes('mid') ?? false,
    };
  });
  record(
    'large arrays show the cells around the pointers with their real indexes',
    /len 1000/.test(big.header) && big.gaps >= 2 && big.labels.includes('499') && big.labels.includes('999') && big.pointers ? null : `got ${JSON.stringify({ ...big, labels: big.labels.slice(0, 30) })}`,
  );

  // 大的 dict / set（300 項）：只畫出開頭、結尾，以及 key 等於變數值的項目
  await page.click('[role="tab"]:nth-child(4)');
  await clickVisualize(page);
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  await page.click('[data-action="last"]');
  await sleep(400);
  const coll = await page.evaluate(() => {
    const find = (name) => [...document.querySelectorAll('main section')].find((el) => el.innerText.startsWith(name));
    const info = (el) => ({ text: el?.innerText.replace(/\s+/g, ' ').slice(0, 400) ?? '', gaps: el?.querySelectorAll('[data-gap]').length ?? 0 });
    return { dict: info(find('seen')), set: info(find('nums')) };
  });
  record(
    'large dicts and sets show the head, the tail and the entries matching a variable',
    /size 300/.test(coll.dict.text) && coll.dict.gaps >= 2 && /150 (= x )?-150/.test(coll.dict.text) && /size 300/.test(coll.set.text) && coll.set.gaps >= 2 && /\b150\b/.test(coll.set.text)
      ? null
      : `got ${JSON.stringify(coll)}`,
  );

  await page.evaluate((v) => (v ? localStorage.setItem('algoalive.tabs.v1', v) : localStorage.removeItem('algoalive.tabs.v1')), saved);
  await openApp(page, url);
}

await runSuite(async ({ page, url }) => {
  await testStepLimit(page, url);
});

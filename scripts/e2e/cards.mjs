// e2e：說明卡片：條件、計算、邏輯、迴圈與呼叫、容器操作、遞迴樹、交換 / 推導式 / 切片
//
//   node scripts/e2e/cards.mjs                          # 自己啟動 vite preview（先 npm run build）
//   node scripts/e2e/cards.mjs --url http://localhost:5173/
import { record, sleep, openAndStepTo, runSuite, clickVisualize } from './harness.mjs';

async function testCondition(page) {
  console.log('Condition');
  // 預設頁籤 167：第一個條件是 while left < right → 0 < 6 → True
  await page.click('[data-tab-example="lc167"]');
  await sleep(300);
  await clickVisualize(page);
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  for (let i = 0; i < 5 && !(await page.$('main [data-condition]')); i++) await page.click('[data-action="next"]');
  const text = await page.evaluate(() => document.querySelector('main [data-condition]')?.innerText ?? '');
  record('condition card shows substituted values', /left < right[\s\S]*0 < 6[\s\S]*True/.test(text) ? null : `got ${JSON.stringify(text)}`);
  // Monaco 在下一個 animation frame 才重繪；並以不換行空白（ ）呈現空格，比對前先正規化
  await page.waitForSelector('.monaco-editor .aa-hint-true', { timeout: 3000 }).catch(() => {});
  const hint = await page.$eval('.monaco-editor', (el) => el.querySelector('.aa-hint-true')?.textContent.replace(/\s+/g, ' ').trim() ?? null);
  record('editor shows the inline result', hint?.includes('0 < 6 → True') ? null : `got ${JSON.stringify(hint)}`);
  const outlined = await page.$$eval('main section:nth-child(2) [style*="dashed"]', (els) => els.length);
  record('compared variables are outlined', outlined >= 2 ? null : `found ${outlined} outlined elements`);

  // 卡片時有時無，下面的內容（陣列、變數）位置也不能跳
  const tops = new Set();
  for (let i = 0; i < 15; i++) {
    tops.add(
      await page.evaluate(() => {
        const slot = document.querySelector('main [data-info-slot]');
        return slot ? Math.round(slot.nextElementSibling.getBoundingClientRect().top) : -1;
      }),
    );
    await page.click('[data-action="next"]');
    await sleep(60);
  }
  record('visualization content stays in place while cards change', tops.size === 1 && !tops.has(-1) ? null : `content moved: ${[...tops].join(', ')}`);
}

async function testCalc(page) {
  console.log('Calculation');
  // 預設頁籤 167 第 4 行：current_sum = numbers[left] + numbers[right] → 1 + 11 → 12
  await page.click('[data-tab-example="lc167"]');
  await sleep(300);
  await clickVisualize(page);
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  const atCalc = () => page.evaluate(() => document.querySelector('main [data-calc]')?.innerText.includes('current_sum') ?? false);
  for (let i = 0; i < 6 && !(await atCalc()); i++) await page.click('[data-action="next"]');
  const text = await page.evaluate(() => document.querySelector('main [data-calc]')?.innerText ?? '');
  record('calculation card reduces the expression', /1 \+ 11[\s\S]*12/.test(text) ? null : `got ${JSON.stringify(text)}`);
  // Monaco 在下一個 animation frame 才重繪，等提示出現再讀
  await page.waitForSelector('.monaco-editor .aa-hint-calc', { timeout: 3000 }).catch(() => {});
  const hint = await page.$eval('.monaco-editor', (el) => el.querySelector('.aa-hint-calc')?.textContent.replace(/\s+/g, ' ').trim() ?? null);
  record('editor shows the calculation result', hint?.includes('1 + 11 → 12') ? null : `got ${JSON.stringify(hint)}`);
  const reads = await page.$$eval('main section:nth-child(2) [style*="dashed"]', (els) => els.length);
  record('cells read by the calculation are outlined', reads >= 2 ? null : `found ${reads} outlined cells`);
}

async function testLogic(page) {
  console.log('Logic');
  // 739：while stack and temperatures[stack[-1]] < t，stack 為空時短路
  const logic = await openAndStepTo(page, 'monotonic-stack', 'lc739', '[data-condition]', 'skipped');
  record('logic tree shows the short-circuit', /stack[\s\S]*empty container is False[\s\S]*and stops at the first False[\s\S]*skipped/.test(logic) ? null : `got ${JSON.stringify(logic)}`);
  // 191：n &= n - 1 → 1011 & 1010 = 1010
  const bits = await openAndStepTo(page, 'bit-manipulation', 'lc191', '[data-calc]', 'Bitwise');
  record('bitwise calculation shows binary rows', /11 & 10[\s\S]*bitwise[\s\S]*\(11\)[\s\S]*\(10\)/i.test(bits) ? null : `got ${JSON.stringify(bits)}`);
}

async function testContext(page) {
  console.log('Loops & calls');
  // 預設頁籤 283：for fast in range(len(nums)) → 第 1 / 5 圈；沒有遞迴，不顯示呼叫堆疊
  await page.click('[data-tab-example="lc283"]');
  await sleep(300);
  await clickVisualize(page);
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  // 走到第一次出現迴圈資訊為止（第 1 圈）
  const inLoop = () => page.evaluate(() => /pass \d/.test(document.querySelector('main [data-loops]')?.innerText ?? ''));
  for (let i = 0; i < 6 && !(await inLoop()); i++) await page.click('[data-action="next"]');
  const loopText = await page.evaluate(() => document.querySelector('main [data-loops]')?.innerText ?? '');
  record('loop row shows the pass number', /for fast in range\(len\(nums\)\)[\s\S]*pass 1 \/ 5/.test(loopText) ? null : `got ${JSON.stringify(loopText)}`);
  const hasStack = await page.$('main [data-call-stack]');
  record('no call stack row without nested calls', hasStack ? 'call stack row is shown for a single function' : null);
  // 104：遞迴到 root=None 時，堆疊有三層
  const stackText = await openAndStepTo(page, 'tree-dfs', 'lc104', '[data-call-stack]', 'root=None');
  const frames = (stackText.match(/maxDepth/g) ?? []).length;
  record('call stack shows each recursive call', frames >= 3 && /root=\(3\)/.test(stackText) ? null : `got ${JSON.stringify(stackText)}`);
}

async function testOps(page) {
  console.log('Container ops & heap');
  // 20：stack.append(ch) → 把 '(' 放到 stack 的尾端
  const push = await openAndStepTo(page, 'stack', 'lc20', '[data-op]', 'at the end of stack');
  record('op card describes a push', /stack\.append\(ch\)[\s\S]*Put '\(' at the end of stack/.test(push) ? null : `got ${JSON.stringify(push)}`);
  // 1046：heappop 卡片 + 堆積樹
  await page.click('[data-action="library"]');
  await page.waitForSelector('[data-topic="heap"]');
  await page.click('[data-topic="heap"]');
  await page.waitForSelector('[data-example="lc1046"]');
  await page.click('[data-example="lc1046"]');
  await sleep(250);
  await clickVisualize(page);
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  const opText = () => page.evaluate(() => document.querySelector('main [data-op]')?.innerText ?? '');
  for (let i = 0; i < 40 && !(await opText()).includes('Pop the smallest'); i++) await page.click('[data-action="next"]');
  const pop = await opText();
  record('op card explains heappop', /Pop the smallest value -8/.test(pop) ? null : `got ${JSON.stringify(pop)}`);
  const nodes = await page.$$eval('main [data-heap="heap"] .rounded-full', (els) => els.map((e) => e.textContent.trim()));
  record('heap is drawn as a tree with the minimum on top', nodes.length === 6 && nodes[0] === '-8' ? null : `got ${JSON.stringify(nodes)}`);
  await page.click('[role="tab"][aria-selected="true"] button');
}

async function testRecursionTree(page) {
  console.log('Recursion tree');
  await page.click('[data-action="library"]');
  await page.waitForSelector('[data-topic="recursion"]');
  await page.click('[data-topic="recursion"]');
  await page.waitForSelector('[data-example="lc509"]');
  await page.click('[data-example="lc509"]');
  await sleep(250);
  await clickVisualize(page);
  await page.waitForFunction(() => /Step 1 \/ \d+/.test(document.body.innerText));
  await page.click('[data-action="last"]');
  await sleep(400);
  const calls = await page.$$eval('main [data-recursion-tree] button', (els) => els.length);
  record('recursion tree shows every call of fib(5)', calls === 15 ? null : `expected 15 calls, got ${calls}`);
  const returned = await page.$eval('main [data-recursion-tree] button', (el) => el.innerText.replace(/\s+/g, ' ').trim());
  record('root call shows its return value', returned === 'fib(5) → 5' ? null : `got ${JSON.stringify(returned)}`);
  // 播放途中：樹上標成「目前」的節點，必須和呼叫堆疊最內層是同一次呼叫
  await page.click('[data-action="first"]');
  const mismatches = [];
  for (let i = 0; i < 40; i++) {
    const pair = await page.evaluate(() => {
      const cur = document.querySelector('main [data-recursion-tree] button span.font-semibold')?.textContent.trim();
      // 剛回傳的那一層還在播離場動畫、仍在 DOM 中；它已經不是目前的呼叫，不會帶 data-current
      const top = document.querySelector('main [data-call-stack] [data-current]')?.innerText.replace(/\s+/g, '') ?? '';
      return { cur, top };
    });
    const n = pair.top.match(/n=(-?\d+)/)?.[1];
    if (pair.cur && n !== undefined && pair.cur !== `fib(${n})`) mismatches.push(`${pair.cur} vs ${pair.top}`);
    await page.click('[data-action="next"]');
    await sleep(300); // 等呼叫堆疊的離場動畫結束，舊的那一層才會從 DOM 移除
  }
  record('current call in the tree matches the call stack', mismatches.length ? mismatches.slice(0, 3).join(' | ') : null);
  // 點第 2 次呼叫 fib(4)：跳到它開始的那一步
  await page.evaluate(() => document.querySelectorAll('main [data-recursion-tree] button')[1].click());
  await sleep(300);
  const stepText = await page.evaluate(() => document.body.innerText.match(/Step (\d+) \/ \d+/)?.[1]);
  const stack = await page.evaluate(() => document.querySelector('main [data-call-stack]')?.innerText ?? '');
  record('clicking a call jumps to where it starts', Number(stepText) < 10 && /n=4/.test(stack) ? null : `step ${stepText}, stack ${JSON.stringify(stack)}`);
  await page.click('[role="tab"][aria-selected="true"] button');
}

async function testStatements(page) {
  console.log('Swap, comprehension & slices');
  const swap = await openAndStepTo(page, 'fast-slow', 'lc283', '[data-multi]', 'Swap');
  record('swap card evaluates the right side first', /evaluate every value on the right first[\s\S]*then assign them all at once[\s\S]*no temporary variable/.test(swap) ? null : `got ${JSON.stringify(swap)}`);
  const comp = await openAndStepTo(page, 'heap', 'lc1046', '[data-comp]', 'Element #3');
  record('comprehension card builds the result', /Element #3: s = 4[\s\S]*add -4[\s\S]*-2[\s\S]*-7[\s\S]*-4/.test(comp) ? null : `got ${JSON.stringify(comp)}`);
  const slice = await openAndStepTo(page, 'backtracking', 'lc78', '[data-slice]', 'path[:] → [1, 2]');
  record('slice label shows the selected range', slice === 'path[:] → [1, 2]' ? null : `got ${JSON.stringify(slice)}`);
}

await runSuite(async ({ page }) => {
  await testCondition(page);
  await testCalc(page);
  await testLogic(page);
  await testContext(page);
  await testOps(page);
  await testRecursionTree(page);
  await testStatements(page);
});

// e2e：說明卡片：字典樹、break / continue、二維格子、try / except、內建函式、設計類題目、負數位元，以及教學頁的示範動畫
//
//   node scripts/e2e/more-cards.mjs                          # 自己啟動 vite preview（先 npm run build）
//   node scripts/e2e/more-cards.mjs --url http://localhost:5173/
import { record, sleep, openAndStepTo, runSuite } from './harness.mjs';

async function testTrieJumpGrid(page) {
  console.log('Trie, break/continue & grid movement');
  // 14：flower / flow / flight 建好的字典樹，3 個單字結尾
  await openAndStepTo(page, 'trie', 'lc14', '[data-trie]', 'trie', { keepOpen: true });
  await page.click('[data-action="last"]');
  await sleep(500);
  const trie = await page.evaluate(() => ({
    edges: [...document.querySelectorAll('main [data-trie] [data-edge]')].map((e) => e.dataset.edge).sort().join(''),
    ends: document.querySelectorAll('main [data-trie] [data-end]').length,
  }));
  await page.click('[role="tab"][aria-selected="true"] button');
  record('trie view draws every character and marks word ends', trie.edges === 'efghilortw' && trie.ends === 3 ? null : `got ${JSON.stringify(trie)}`);

  // 46：if used[i]: continue
  const jump = await openAndStepTo(page, 'backtracking', 'lc46', '[data-jump]', 'continue');
  record('continue card names the loop and the next line', /skip the rest of this pass of "for i in range\(len\(nums\)\)"[\s\S]*back to line 10/.test(jump) ? null : `got ${JSON.stringify(jump)}`);

  // 48：轉置交換時，同一個格子元素移動到新位置
  await openAndStepTo(page, 'matrix', 'lc48', '[data-multi]', 'swap', { keepOpen: true });
  const cells = () =>
    page.evaluate(() => Object.fromEntries([...document.querySelectorAll('main [data-cell]')].map((e) => [e.dataset.cell, [e.innerText, Math.round(e.getBoundingClientRect().x - e.parentElement.getBoundingClientRect().x), Math.round(e.getBoundingClientRect().y - e.parentElement.getBoundingClientRect().y)]])));
  await sleep(800); // 等格子的進場動畫（scale）結束
  const before = await cells();
  await page.click('[data-action="next"]');
  await sleep(800);
  const after = await cells();
  await page.click('[role="tab"][aria-selected="true"] button');
  const moved = Object.keys(before).filter((k) => after[k] && (after[k][1] !== before[k][1] || after[k][2] !== before[k][2]));
  const swapped = moved.length === 2 && moved.every((k) => after[k][0] === before[k][0]);
  record('grid cells move with their values on a swap', swapped ? null : `moved ${JSON.stringify(moved)} — ${JSON.stringify({ before, after })}`);
}

async function testTryExcept(page) {
  console.log('try / except');
  // 468：check_v4 raise → 丟回 validIPAddress → 被 except ValueError 接住
  const thrown = await openAndStepTo(page, 'exceptions', 'lc468', '[data-exc]', 'leaves check_v4');
  record('exception card shows it propagating to the caller', /ValueError: bad part: 01[\s\S]*no try here catches it[\s\S]*leaves check_v4\(\) and is raised again in validIPAddress\(\) at line 14/.test(thrown) ? null : `got ${JSON.stringify(thrown)}`);
  const caught = await openAndStepTo(page, 'exceptions', 'lc468', '[data-exc]', 'caught by');
  record('exception card shows the matching except', /try on line 11[\s\S]*except ValueError[\s\S]*caught by the except on line 20/.test(caught) ? null : `got ${JSON.stringify(caught)}`);
  const check = await openAndStepTo(page, 'exceptions', 'lc468', '[data-try]', 'match for');
  record('except card answers whether the exception matches', /Is ValueError a match for except ValueError\?[\s\S]*yes — caught!/.test(check) ? null : `got ${JSON.stringify(check)}`);
}

async function testBuiltins(page) {
  console.log('Built-in functions');
  // 1984：nums.sort() — 格子先照原本順序 9 4 1 7，再滑到 1 4 7 9
  await openAndStepTo(page, 'builtins', 'lc1984', '[data-builtin]', 'sort', { keepOpen: true });
  const chips = () => page.$eval('main [data-reorder]', (el) => ({ state: el.dataset.reorder, text: el.innerText.split(/\s+/).join(' ') }));
  const start = await chips();
  await sleep(1200);
  const done = await chips();
  record('sort card slides items into sorted order', start.state === 'start' && start.text === '9 4 1 7' && done.state === 'done' && done.text === '1 4 7 9' ? null : `got ${JSON.stringify({ start, done })}`);
  // 下一張：min(…) 標出勝出的差值
  await page.click('[data-action="next"]');
  await sleep(1200);
  const pick = await page.evaluate(() => ({
    card: document.querySelector('main [data-builtin]')?.innerText ?? '',
    winner: document.querySelector('main [data-builtin] [data-pick]')?.innerText ?? null,
  }));
  await page.click('[role="tab"][aria-selected="true"] button');
  record('min card marks the smallest item', /keep the smallest[\s\S]*→\s*2/.test(pick.card) && pick.winner === '2' ? null : `got ${JSON.stringify(pick)}`);

  // 896：all(a <= b …) 在第一組 (6, 5) 就停
  const all = await openAndStepTo(page, 'builtins', 'lc896', '[data-builtin]:nth-of-type(2)', 'stops at the first False');
  record('all() card stops at the first False', /\(6, 5\)[\s\S]*False[\s\S]*stopped here/.test(all) ? null : `got ${JSON.stringify(all)}`);
}

async function testDesign(page) {
  console.log('Design problems');
  // 155：最後一步時，前面的操作都標出輸出，最後一個是目前的操作
  await openAndStepTo(page, 'design', 'lc155', '[data-design]', 'MinStack()', { keepOpen: true });
  await page.click('[data-action="last"]');
  await sleep(400);
  const ops = () => page.$$eval('main [data-design-op]', (els) => els.map((e) => `${e.dataset.designOp}:${e.innerText.replace(/\s+/g, ' ').trim()}`));
  const end = await ops();
  const want = ['done:MinStack() → null', 'done:push(-2) → null', 'done:push(0) → null', 'done:push(-3) → null', 'done:getMin() → -3', 'done:pop() → null', 'done:top() → 0', 'done:getMin() → -2'];
  record('operation timeline shows every output', JSON.stringify(end) === JSON.stringify(want) ? null : `got ${JSON.stringify(end)}`);
  // 點「getMin()」（第 5 個）跳到那個操作開始的地方
  await page.click('main [data-design-op]:nth-child(5)');
  await sleep(400);
  const seek = await page.evaluate(() => ({
    current: document.querySelector('main [data-design-op="current"]')?.innerText.split('\n')[0],
    stack: document.querySelector('main') ? [...document.querySelectorAll('main section')].some((s) => s.innerText.startsWith('self.mins')) : false,
  }));
  await page.click('[role="tab"][aria-selected="true"] button');
  record('clicking an operation jumps to it', seek.current === 'getMin()' && seek.stack ? null : `got ${JSON.stringify(seek)}`);

  // 232：outbox.append(inbox.pop()) 說明元素從哪裡搬到哪裡
  const move = await openAndStepTo(page, 'design', 'lc232', '[data-op]', 'off the end of self.inbox');
  record('op card explains moving between stacks', /Take 3 off the end of self\.inbox and put it at the end of self\.outbox/.test(move) ? null : `got ${JSON.stringify(move)}`);
}

async function testNegativeBits(page) {
  console.log('Negative numbers in bits');
  // 371：b &= mask，b = -5 → 32 位二補數；遮罩後左邊的 …1 變成 …0
  await openAndStepTo(page, 'bit-manipulation', 'lc371', '[data-bits="signed"]', '32 bits', { keepOpen: true });
  await sleep(300);
  const view = await page.evaluate(() => {
    const box = document.querySelector('main [data-bits="signed"]');
    return {
      title: box?.querySelector('div')?.innerText ?? '',
      extend: [...(box?.querySelectorAll('[data-extend]') ?? [])].map((e) => e.dataset.extend).join(''),
      note: !!box?.querySelector('[data-bits-note]'),
      signBits: [...(box?.querySelectorAll('[title]') ?? [])].filter((e) => /sign bit/.test(e.getAttribute('title'))).length,
    };
  });
  await page.click('[role="tab"][aria-selected="true"] button');
  record('negative numbers are drawn in two\'s complement', /32 bits shown/.test(view.title) && view.extend === '100' && view.note && view.signBits === 1 ? null : `got ${JSON.stringify(view)}`);
}

async function testDemo(page) {
  console.log('Tutorial demo');
  await page.click('[data-action="library"]');
  await page.waitForSelector('[data-topic="tree-dfs"]');
  await page.click('[data-topic="tree-dfs"]');
  const progress = () => page.$eval('[data-demo-progress]', (el) => el.textContent.trim());
  // 背景執行範例需要一點時間，之後應該自動往前播放
  await page.waitForFunction(() => /^\d+ \/ [1-9]\d*$/.test(document.querySelector('[data-demo-progress]')?.textContent.trim() ?? ''), {
    timeout: 30_000,
  });
  const first = await progress();
  await sleep(2500);
  const later = await progress();
  const step = (s) => Number(s.split('/')[0]);
  record('demo runs the example and auto-plays', step(later) > step(first) ? null : `progress stuck at ${first} → ${later}`);
  // 播放時高度不能變動，否則下方的教學內容會跟著跳
  const heights = new Set();
  for (let i = 0; i < 20; i++) {
    heights.add(Math.round(await page.$eval('[data-demo]', (el) => el.getBoundingClientRect().height)));
    await sleep(150);
  }
  record('demo keeps a fixed height while playing', heights.size === 1 ? null : `heights changed: ${[...heights].join(', ')}`);
  const hasTree = await page.$eval('[data-demo]', (el) => el.innerText.includes('TreeNode'));
  record('demo shows the tree view', hasTree ? null : 'no TreeNode view inside the demo');
  const busy = await page.$eval('[data-action="visualize"]', (b) => b.disabled);
  record('background demo runs do not block Visualize', busy ? 'Visualize button is disabled' : null);
  await page.keyboard.press('Escape');
}

await runSuite(async ({ page }) => {
  await testTrieJumpGrid(page);
  await testTryExcept(page);
  await testBuiltins(page);
  await testDesign(page);
  await testNegativeBits(page);
  await testDemo(page);
});

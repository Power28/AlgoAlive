// e2e：每個教學範例（Python 與 JavaScript）都能開啟、執行到最後一步，回傳值等於 src/tutorials 的 expected
//
//   node scripts/e2e/examples.mjs                          # 自己啟動 vite preview（先 npm run build）
//   node scripts/e2e/examples.mjs --url http://localhost:5173/
//   node scripts/e2e/examples.mjs --lang python          # 只跑 Python（或 javascript）的範例；npm run test:e2e 會分成兩組平行跑
import { arg, record, sleep, runActiveTab, loadExpected, runSuite } from './harness.mjs';

/** 範例的 key：JavaScript 版本是 lc206@js，只有 JavaScript 的範例是 js 開頭 */
const keyOf = (id, lang) => (lang === 'javascript' && !id.startsWith('js') ? `${id}@js` : id);
const isJsKey = (key) => key.endsWith('@js') || key.startsWith('js');

async function testExamples(page, all, only) {
  const expected = new Map([...all].filter(([key]) => !only || (only === 'javascript') === isJsKey(key)));
  console.log(`Tutorial examples${only ? ` in ${only}` : ''} (${expected.size})`);
  await page.click('[data-action="library"]');
  await page.waitForSelector('[data-topic]');
  const topics = await page.$$eval('[data-topic]', (els) => els.map((e) => e.dataset.topic));
  await page.keyboard.press('Escape');

  const seen = new Set();
  for (const topic of topics) {
    await page.click('[data-action="library"]');
    await page.waitForSelector(`[data-topic="${topic}"]`);
    await page.click(`[data-topic="${topic}"]`);
    const listed = await page.$$eval('[data-example]', (els) => els.map((e) => ({ id: e.dataset.example, lang: e.dataset.exampleLang })));
    await page.keyboard.press('Escape');

    // 有 JavaScript 版本的主題：切換成 JavaScript 再把每個範例跑一次
    const runs = listed.filter((x) => !only || x.lang === only);
    await page.click('[data-action="library"]');
    await page.waitForSelector(`[data-topic="${topic}"]`);
    await page.click(`[data-topic="${topic}"]`);
    if (only !== 'python' && (await page.$('[data-tutorial-lang="javascript"]'))) {
      await page.click('[data-tutorial-lang="javascript"]');
      await sleep(150);
      const jsIds = await page.$$eval('[data-example][data-example-lang="javascript"]', (els) => els.map((e) => e.dataset.example));
      runs.push(...jsIds.map((id) => ({ id, lang: 'javascript' })));
      await page.click('[data-tutorial-lang="python"]');
    }
    await page.keyboard.press('Escape');

    for (const { id, lang } of runs) {
      seen.add(keyOf(id, lang));
      await page.click('[data-action="library"]');
      await page.waitForSelector(`[data-topic="${topic}"]`);
      await page.click(`[data-topic="${topic}"]`);
      if (await page.$(`[data-tutorial-lang="${lang}"]`)) await page.click(`[data-tutorial-lang="${lang}"]`);
      await page.waitForSelector(`[data-example="${id}"][data-example-lang="${lang}"]`);
      await page.click(`[data-example="${id}"][data-example-lang="${lang}"]`);
      await sleep(250);
      const { returned, error } = await runActiveTab(page);
      const key = keyOf(id, lang);
      const want = expected.get(key);
      let problem = null;
      if (error) problem = error;
      else if (want === undefined) problem = 'no expected value in src/tutorials';
      else if (returned !== want) problem = `expected ${JSON.stringify(want)}, got ${JSON.stringify(returned)}`;
      record(`${key} (${topic})`, problem);
      // 關掉剛開的頁籤，避免頁籤列無限變長
      await page.click('[role="tab"][aria-selected="true"] button');
    }
    // 教學語言的偏好會記在瀏覽器裡：切回 Python，避免影響後面的測試
    await page.click('[data-action="library"]');
    await page.waitForSelector(`[data-topic="${topic}"]`);
    await page.click(`[data-topic="${topic}"]`);
    if (await page.$('[data-tutorial-lang="python"]')) await page.click('[data-tutorial-lang="python"]');
    await page.keyboard.press('Escape');
  }
  const missing = [...expected.keys()].filter((id) => !seen.has(id));
  record('every example is reachable from the library', missing.length ? `missing: ${missing.join(', ')}` : null);
}

await runSuite(async ({ page }) => {
  await testExamples(page, loadExpected(), arg('--lang'));
});

// e2e：解題筆記——從頁籤存成筆記、複習排程、重新整理後保留、開回頁籤視覺化、搜尋、刪除、匯出 / 匯入、該複習的提醒
//
//   node scripts/e2e/notes.mjs                          # 自己啟動 vite preview（先 npm run build）
//   node scripts/e2e/notes.mjs --url http://localhost:5173/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { record, sleep, openApp, runSuite } from './harness.mjs';

const view = (page) =>
  page.evaluate(() => ({
    title: document.querySelector('[data-note-title]')?.innerText.trim() ?? null,
    due: document.querySelector('[data-note-due]')?.innerText.trim() ?? null,
    items: [...document.querySelectorAll('[data-note-item]')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()),
    message: document.querySelector('[data-notes-message]')?.innerText.trim() ?? null,
  }));

async function testSaveAndReview(page, url) {
  console.log('Save a tab as a note');
  // 預設頁籤 167：題號、題名、難度、主題由教學範例帶入
  await page.click('[data-tab-example="lc167"]');
  await page.click('[data-action="save-as-note"]');
  await page.waitForSelector('[data-note-editor]');
  const prefilled = await page.evaluate(() => {
    const v = (f) => document.querySelector(`[data-field="${f}"]`)?.value;
    return { number: v('number'), title: v('title'), difficulty: v('difficulty'), tags: v('tags') };
  });
  record(
    'saving an example tab prefills the problem',
    prefilled.number === '167' && /Two Sum II/.test(prefilled.title) && prefilled.difficulty === 'medium' && prefilled.tags ? null : `got ${JSON.stringify(prefilled)}`,
  );

  await page.click('[data-field="summary"]');
  await page.keyboard.type('Sorted array, find two numbers that add up to target.');
  await page.click('[data-field="approach"]');
  await page.keyboard.type('- **Two pointers** from both ends\n- sum too small: `left += 1`');
  await page.select('[data-field="status"]', 'hint');
  await page.click('[data-action="save-note"]');
  await page.waitForSelector('[data-note-view]');
  const saved = await view(page);
  const button = await page.$eval('[data-action="save-as-note"]', (b) => b.innerText.trim());
  record(
    'the note is saved, linked to the tab and due tomorrow (needed a hint)',
    /^167\.\s*Two Sum II/.test(saved.title ?? '') && saved.due === 'Review tomorrow' && saved.items.length === 1 && button === 'Update note'
      ? null
      : `got ${JSON.stringify({ saved, button })}`,
  );

  // 思路先收起來；打開後顯示 Markdown，選「很順」→ 升一階（3 天後）
  const hidden = await page.$eval('[data-note-view]', (el) => !el.innerText.includes('Two pointers'));
  await page.click('[data-action="reveal-note"]');
  const shown = await page.evaluate(() => {
    const el = document.querySelector('[data-note-view]');
    return { strong: el.querySelector('strong')?.textContent, code: el.querySelector('li code')?.textContent };
  });
  await page.click('[data-review-result="easy"]');
  await sleep(200);
  const reviewed = await page.$eval('[data-review-saved]', (el) => el.innerText.trim());
  record(
    'the approach is hidden until revealed, then reviewing schedules the next date',
    hidden && shown.strong === 'Two pointers' && shown.code === 'left += 1' && reviewed === 'Saved. Review in 3 days' ? null : `got ${JSON.stringify({ hidden, shown, reviewed })}`,
  );

  // 重新整理後仍在
  await page.keyboard.press('Escape');
  await openApp(page, url);
  await page.click('[data-action="notes"]');
  await page.waitForSelector('[data-note-item]');
  const reloaded = await view(page);
  record('notes survive a reload', reloaded.items.length === 1 && /Review in 3 days/.test(reloaded.items[0]) ? null : `got ${JSON.stringify(reloaded)}`);

  // 搜尋
  await page.type('[data-notes-search]', 'zzz');
  await sleep(150);
  const none = (await view(page)).items.length;
  await page.click('[data-notes-search]', { count: 3 });
  await page.keyboard.type('two pointers');
  await sleep(150);
  const found = (await view(page)).items.length;
  record('search matches the approach text', none === 0 && found === 1 ? null : `got ${none} / ${found}`);
}

async function testOpenSolution(page) {
  console.log('Open a solution from a note');
  await page.click('[data-note-item]');
  await page.click('[data-action="reveal-note"]');
  const before = await page.$$eval('[role="tab"]', (els) => els.length);
  await page.click('[data-action="open-solution"]');
  // 開新頁籤、關掉筆記視窗，等執行環境就緒後自動執行
  await page.waitForFunction(() => /Step 1 \/ [1-9]\d*/.test(document.body.innerText), { timeout: 60_000 });
  const state = await page.evaluate(() => ({
    tabs: document.querySelectorAll('[role="tab"]').length,
    active: document.querySelector('[role="tab"][aria-selected="true"]')?.innerText.trim(),
    notesOpen: !!document.querySelector('[data-notes]'),
    button: document.querySelector('[data-action="save-as-note"]')?.innerText.trim(),
  }));
  record(
    'opening a solution adds a tab and visualizes it',
    state.tabs === before + 1 && /^167\. Two Sum II/.test(state.active ?? '') && !state.notesOpen && state.button === 'Update note' ? null : `got ${JSON.stringify(state)}`,
  );
}

async function testBackup(page, url) {
  console.log('Export, delete and import');
  await page.click('[data-action="notes"]');
  await page.waitForSelector('[data-note-item]');
  // 匯出：攔下下載的檔案內容
  const exported = await page.evaluate(async () => {
    let blob = null;
    const create = URL.createObjectURL;
    const click = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (b) => ((blob = b), create(b));
    let name = null;
    HTMLAnchorElement.prototype.click = function () {
      name = this.download;
    };
    document.querySelector('[data-action="export-notes"]').click();
    URL.createObjectURL = create;
    HTMLAnchorElement.prototype.click = click;
    return { name, text: blob ? await blob.text() : null };
  });
  const data = exported.text ? JSON.parse(exported.text) : null;
  record(
    'export downloads every note as JSON',
    /^algoalive-notes-\d{4}-\d{2}-\d{2}\.json$/.test(exported.name ?? '') && data?.kind === 'algoalive-notes' && data.notes.length === 1 ? null : `got ${JSON.stringify({ name: exported.name, kind: data?.kind })}`,
  );

  // 刪除（確認對話框）→ 清單變空
  await page.click('[data-note-item]');
  page.once('dialog', (d) => d.accept());
  await page.click('[data-action="delete-note"]');
  await sleep(200);
  const afterDelete = (await view(page)).items.length;

  // 匯入剛才的檔案：筆記回來
  const file = path.join(os.tmpdir(), `algoalive-notes-e2e-${process.pid}.json`);
  fs.writeFileSync(file, exported.text ?? '');
  const input = await page.$('[data-import-input]');
  await input.uploadFile(file);
  await page.waitForFunction(() => document.querySelector('[data-notes-message]')?.innerText.includes('Imported'));
  fs.unlinkSync(file);
  const restored = await view(page);
  record(
    'deleting and importing the backup brings the note back',
    afterDelete === 0 && restored.items.length === 1 && /1 new/.test(restored.message ?? '') ? null : `got ${JSON.stringify({ afterDelete, restored })}`,
  );

  // 該複習的提醒：把複習日改到兩天前 → 上方的按鈕顯示數字，打開時篩出該複習的題目
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const notes = JSON.parse(localStorage.getItem('algoalive.notes.v1'));
    notes[0].review.due = Date.now() - 2 * 24 * 60 * 60 * 1000;
    localStorage.setItem('algoalive.notes.v1', JSON.stringify(notes));
  });
  await openApp(page, url);
  const badge = await page.$eval('[data-notes-due]', (el) => el.innerText.trim()).catch(() => null);
  await page.click('[data-action="notes"]');
  await page.waitForSelector('[data-note-view]');
  const due = await view(page);
  const dueFilter = await page.$eval('[data-filter="due"]', (el) => el.className.includes('bg-ink-700'));
  record(
    'overdue notes show a badge and open filtered to what is due',
    badge === '1' && dueFilter && /^Overdue by 2 days$/.test(due.due ?? '') ? null : `got ${JSON.stringify({ badge, dueFilter, due })}`,
  );
  await page.keyboard.press('Escape');
}

await runSuite(async ({ page, url }) => {
  await testSaveAndReview(page, url);
  await testOpenSolution(page);
  await testBackup(page, url);
});

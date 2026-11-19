import { expect, test, type Page } from '@playwright/test';
import { APP_URL, CACHE_KEY, SERVER_KEY, cacheWrites, installCacheWriteSpy, openApp, readStorage, trackErrors, within } from './support/app';
import { addNote, board, dragHeaderBy, headerGrabPoint, note, notes, resizeBy, settledBox, textArea } from './support/notes';

const savedStatus = (page: Page) => page.getByRole('status').filter({ hasText: 'All changes saved' });

test('reload restores position, size, text and color', async ({ page }) => {
  await openApp(page);
  await addNote(page);
  await dragHeaderBy(page, note(page), 140, 90);
  await resizeBy(page, note(page), 80, 50);
  await textArea(note(page)).fill('remember me');
  await note(page).getByRole('button', { name: 'Change color' }).click();
  await note(page).getByRole('menuitemradio', { name: 'green' }).click();
  const before = await settledBox(note(page));
  await expect(savedStatus(page)).toBeVisible();

  await page.reload();

  await expect(notes(page)).toHaveCount(1);
  const after = await settledBox(note(page));
  within(after.x, before.x);
  within(after.y, before.y);
  within(after.width, before.width);
  within(after.height, before.height);
  await expect(textArea(note(page))).toHaveValue('remember me');
  await expect(note(page)).toHaveClass(/note--green/);
});

test('a drag does not write to storage on every movement, only once after release', async ({ page }) => {
  await installCacheWriteSpy(page);
  await openApp(page);
  await addNote(page);
  await expect(savedStatus(page)).toBeVisible();
  const baseline = await cacheWrites(page);

  const from = await headerGrabPoint(note(page));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 300, from.y + 200, { steps: 100 });
  // Nothing reached the store mid-drag: no storage write and the sync status never left "saved".
  expect(await cacheWrites(page)).toBe(baseline);
  await expect(savedStatus(page)).toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole('status')).toHaveText('Saving…');

  await expect.poll(() => cacheWrites(page)).toBe(baseline + 1);
});

test('typing is batched into few writes instead of one per keystroke', async ({ page }) => {
  await installCacheWriteSpy(page);
  await openApp(page);
  await addNote(page);
  await expect(savedStatus(page)).toBeVisible();
  const baseline = await cacheWrites(page);

  await textArea(note(page)).pressSequentially('twenty characters!!', { delay: 10 });
  await expect(savedStatus(page)).toBeVisible();
  await expect.poll(async () => (await readStorage(page, CACHE_KEY))[0]?.text).toBe('twenty characters!!');

  expect((await cacheWrites(page)) - baseline).toBeLessThanOrEqual(3);
});

test('the save status moves from Saving to All changes saved', async ({ page }) => {
  await openApp(page);
  await addNote(page);

  await expect(page.getByRole('status')).toHaveText('Saving…');
  await expect(savedStatus(page)).toBeVisible();
  expect(await readStorage(page, SERVER_KEY)).toHaveLength(1);
});

test('notes are restored from the (async) mock API when the local cache is gone', async ({ page }) => {
  await openApp(page);
  await addNote(page);
  await textArea(note(page)).fill('from the server');
  await expect(savedStatus(page)).toBeVisible();
  await expect.poll(async () => (await readStorage(page, SERVER_KEY))[0]?.text).toBe('from the server');

  await page.evaluate((key) => window.localStorage.removeItem(key), CACHE_KEY);
  await page.reload();

  await expect(notes(page)).toHaveCount(1);
  await expect(textArea(note(page))).toHaveValue('from the server');
});

test('deleting a note removes it from storage too', async ({ page }) => {
  await openApp(page);
  await addNote(page);
  await expect(savedStatus(page)).toBeVisible();
  await note(page).getByRole('button', { name: 'Delete note' }).click();

  await expect.poll(async () => (await readStorage(page, CACHE_KEY)).length).toBe(0);
  await page.reload();
  await expect(notes(page)).toHaveCount(0);
});

test('a corrupted cache falls back to an empty board without errors', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((key) => window.localStorage.setItem(key, '{not valid json'), CACHE_KEY);
  await page.goto(APP_URL);
  await expect(board(page)).toBeVisible();

  await expect(notes(page)).toHaveCount(0);
  await addNote(page);
  expect(errors).toEqual([]);
});

test('malformed note records are dropped and valid ones kept', async ({ page }) => {
  await page.addInitScript((key) => {
    const good = { id: 'a', x: 50, y: 50, width: 200, height: 200, text: 'ok', color: 'pink', z: 1 };
    const bad = { id: 'b', x: 'nope', y: 0, width: 1, height: 1, text: '', color: 'red', z: 2 };
    window.localStorage.setItem(key, JSON.stringify({ version: 1, notes: [good, bad] }));
  }, CACHE_KEY);
  await page.goto(APP_URL);

  await expect(notes(page)).toHaveCount(1);
  await expect(textArea(note(page))).toHaveValue('ok');
  await expect(note(page)).toHaveClass(/note--pink/);
});

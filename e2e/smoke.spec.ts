import { expect, test } from '@playwright/test';
import { APP_URL, MIN_VIEWPORT, setViewport, trackErrors } from './support/app';
import { addNote, board, notes } from './support/notes';

test('loads from file:// without console errors or page errors', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(APP_URL);

  await expect(board(page)).toBeVisible();
  await expect(page).toHaveTitle('Sticky Notes');
  await addNote(page);
  await expect(notes(page)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('the page never scrolls at the minimum resolution', async ({ page }) => {
  await page.goto(APP_URL);
  await setViewport(page, MIN_VIEWPORT.width, MIN_VIEWPORT.height);
  await addNote(page);

  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(overflow.horizontal).toBeLessThanOrEqual(0);
  expect(overflow.vertical).toBeLessThanOrEqual(0);
});

test('the app is a single self-contained file (no external requests)', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith('file://') && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url);
  });
  await page.goto(APP_URL);
  await expect(board(page)).toBeVisible();

  expect(external).toEqual([]);
});

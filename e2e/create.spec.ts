import { expect, test } from '@playwright/test';
import { DEFAULT_NOTE_SIZE, MIN_NOTE_SIZE, box, openApp, within } from './support/app';
import { addNote, board, drawNote, note, notes, settledBox } from './support/notes';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('the New note button creates a default-size note inside the board', async ({ page }) => {
  await addNote(page);
  const n = await settledBox(note(page));
  const b = await box(board(page));
  within(n.width, DEFAULT_NOTE_SIZE);
  within(n.height, DEFAULT_NOTE_SIZE);
  expect(n.x).toBeGreaterThanOrEqual(b.x);
  expect(n.y).toBeGreaterThanOrEqual(b.y);
});

test('successive toolbar notes do not stack exactly on top of each other', async ({ page }) => {
  await addNote(page);
  await addNote(page);
  const a = await box(note(page, 0));
  const c = await box(note(page, 1));
  expect(a.x !== c.x || a.y !== c.y).toBe(true);
});

test('dragging on the empty board creates a note at that position and size', async ({ page }) => {
  const b = await box(board(page));
  await drawNote(page, { x: b.x + 200, y: b.y + 100 }, { x: b.x + 460, y: b.y + 380 });

  await expect(notes(page)).toHaveCount(1);
  const n = await settledBox(note(page));
  within(n.x, b.x + 200);
  within(n.y, b.y + 100);
  within(n.width, 260);
  within(n.height, 280);
});

test('drawing works in every direction', async ({ page }) => {
  const b = await box(board(page));
  await drawNote(page, { x: b.x + 500, y: b.y + 400 }, { x: b.x + 300, y: b.y + 200 });

  const n = await settledBox(note(page));
  within(n.x, b.x + 300);
  within(n.y, b.y + 200);
  within(n.width, 200);
  within(n.height, 200);
});

test('a fast flick still draws the right rectangle', async ({ page }) => {
  const b = await box(board(page));
  await drawNote(page, { x: b.x + 100, y: b.y + 100 }, { x: b.x + 400, y: b.y + 350 }, { steps: 1 });

  const n = await settledBox(note(page));
  within(n.width, 300);
  within(n.height, 250);
});

test('a small drawn rectangle is raised to the minimum note size', async ({ page }) => {
  const b = await box(board(page));
  await drawNote(page, { x: b.x + 300, y: b.y + 300 }, { x: b.x + 340, y: b.y + 330 });

  const n = await settledBox(note(page));
  within(n.width, MIN_NOTE_SIZE);
  within(n.height, MIN_NOTE_SIZE);
});

test('a plain click or a tiny drag on the board creates nothing', async ({ page }) => {
  const b = await box(board(page));
  await page.mouse.click(b.x + 300, b.y + 300);
  await drawNote(page, { x: b.x + 400, y: b.y + 300 }, { x: b.x + 403, y: b.y + 302 }, { steps: 2 });

  await expect(notes(page)).toHaveCount(0);
});

test('Escape while drawing cancels and leaves no ghost behind', async ({ page }) => {
  const b = await box(board(page));
  await page.mouse.move(b.x + 200, b.y + 200);
  await page.mouse.down();
  await page.mouse.move(b.x + 500, b.y + 400, { steps: 5 });
  await expect(page.locator('.ghost')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();

  await expect(notes(page)).toHaveCount(0);
  await expect(page.locator('.ghost')).toBeHidden();
});

test('drawing past the board edge keeps the note inside the board', async ({ page }) => {
  const b = await box(board(page));
  await drawNote(page, { x: b.x + b.width - 100, y: b.y + b.height - 100 }, { x: b.x + b.width + 400, y: b.y + b.height + 400 });

  const n = await settledBox(note(page));
  expect(n.x + n.width).toBeLessThanOrEqual(b.x + b.width + 1);
  expect(n.y + n.height).toBeLessThanOrEqual(b.y + b.height + 1);
});

import { expect, test } from '@playwright/test';
import { DEFAULT_NOTE_SIZE, MIN_NOTE_SIZE, box, openApp, within } from './support/app';
import { addNote, board, dragFromTo, grip, note, resizeBy, settledBox } from './support/notes';

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await addNote(page);
});

test('dragging the grip changes the size and leaves the position alone', async ({ page }) => {
  const before = await settledBox(note(page));
  await resizeBy(page, note(page), 120, 80);

  const after = await settledBox(note(page));
  within(after.width, DEFAULT_NOTE_SIZE + 120);
  within(after.height, DEFAULT_NOTE_SIZE + 80);
  within(after.x, before.x);
  within(after.y, before.y);
});

test('a fast flick resizes correctly', async ({ page }) => {
  await resizeBy(page, note(page), 200, 150, { steps: 1 });

  const after = await settledBox(note(page));
  within(after.width, DEFAULT_NOTE_SIZE + 200);
  within(after.height, DEFAULT_NOTE_SIZE + 150);
});

test('the note cannot be made smaller than the minimum size', async ({ page }) => {
  await resizeBy(page, note(page), -900, -900);

  const after = await settledBox(note(page));
  within(after.width, MIN_NOTE_SIZE);
  within(after.height, MIN_NOTE_SIZE);
});

test('the note cannot grow past the board edge, even with the pointer far outside the window', async ({ page }) => {
  const b = await box(board(page));
  await resizeBy(page, note(page), 5000, 5000, { steps: 4 });

  const after = await settledBox(note(page));
  within(after.x + after.width, b.x + b.width);
  within(after.y + after.height, b.y + b.height);
});

test('Escape cancels the resize and restores the original size', async ({ page }) => {
  const before = await settledBox(note(page));
  const g = await box(grip(note(page)));
  const from = { x: g.x + g.width - 4, y: g.y + g.height - 4 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 200, from.y + 100, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();

  const after = await settledBox(note(page));
  within(after.width, before.width);
  within(after.height, before.height);
});

test('a resized note keeps its size after being moved', async ({ page }) => {
  await resizeBy(page, note(page), 100, 60);
  const resized = await settledBox(note(page));
  const handle = await box(note(page).getByTestId('note-header'));
  await dragFromTo(page, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, { x: handle.x + 200, y: handle.y + 150 });

  const moved = await settledBox(note(page));
  within(moved.width, resized.width);
  within(moved.height, resized.height);
  expect(moved.x).not.toBe(resized.x);
});

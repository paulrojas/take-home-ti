import { expect, test } from '@playwright/test';
import { box, openApp, within } from './support/app';
import { addNote, board, dragFromTo, dragHeaderBy, header, headerGrabPoint, note, settledBox } from './support/notes';

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await addNote(page);
});

test('dragging the header moves the note by exactly the pointer delta', async ({ page }) => {
  const before = await settledBox(note(page));
  await dragHeaderBy(page, note(page), 150, 90);

  const after = await settledBox(note(page));
  within(after.x - before.x, 150);
  within(after.y - before.y, 90);
  within(after.width, before.width);
  within(after.height, before.height);
});

test('a single large jump (fast flick) lands in the right place', async ({ page }) => {
  const before = await settledBox(note(page));
  await dragHeaderBy(page, note(page), 300, 200, { steps: 1 });

  const after = await settledBox(note(page));
  within(after.x - before.x, 300);
  within(after.y - before.y, 200);
});

test('tracking continues when the pointer leaves the note, the board and the window', async ({ page }) => {
  const b = await box(board(page));
  const from = await headerGrabPoint(note(page));
  await dragFromTo(page, from, { x: b.x + b.width + 500, y: b.y - 400 }, { steps: 6 });

  const n = await settledBox(note(page));
  // Clamped to the top-right corner of the board instead of being lost or stuck.
  within(n.x + n.width, b.x + b.width);
  within(n.y, b.y);
});

test('the note cannot be dragged outside the left or bottom edge', async ({ page }) => {
  const b = await box(board(page));
  await dragHeaderBy(page, note(page), -2000, 2000, { steps: 4 });

  const n = await settledBox(note(page));
  within(n.x, b.x);
  within(n.y + n.height, b.y + b.height);
});

test('releasing the button outside the board still ends the drag', async ({ page }) => {
  const from = await headerGrabPoint(note(page));
  await dragFromTo(page, from, { x: from.x + 100, y: from.y + 50 });
  // A later pointer move must not drag the note any further.
  const settled = await settledBox(note(page));
  await page.mouse.move(from.x + 400, from.y + 300, { steps: 3 });

  const after = await box(note(page));
  within(after.x, settled.x);
  within(after.y, settled.y);
});

test('Escape cancels the move and restores the original position', async ({ page }) => {
  const before = await settledBox(note(page));
  const from = await headerGrabPoint(note(page));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 250, from.y + 150, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();

  const after = await settledBox(note(page));
  within(after.x, before.x);
  within(after.y, before.y);
});

test('pressing the header buttons never moves the note', async ({ page }) => {
  const before = await settledBox(note(page));
  const colorButton = note(page).getByRole('button', { name: 'Change color' });
  await note(page).hover();
  const c = await box(colorButton);
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + 200, c.y + 150, { steps: 5 });
  await page.mouse.up();

  const after = await settledBox(note(page));
  within(after.x, before.x);
  within(after.y, before.y);
  await expect(header(note(page))).toBeVisible();
});

test('the moved position survives a second drag from the new place', async ({ page }) => {
  await dragHeaderBy(page, note(page), 100, 100);
  const mid = await settledBox(note(page));
  await dragHeaderBy(page, note(page), -40, 30);

  const end = await settledBox(note(page));
  within(end.x - mid.x, -40);
  within(end.y - mid.y, 30);
});

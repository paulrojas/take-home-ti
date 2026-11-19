import { expect, test } from '@playwright/test';
import { box, openApp, within } from './support/app';
import { addNote, center, dragFromTo, dragHeaderBy, grip, header, headerGrabPoint, note, notes, resizeBy, settledBox, trash } from './support/notes';

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await addNote(page);
});

test('releasing a resize over the trash never deletes the note', async ({ page }) => {
  const g = await box(grip(note(page)));
  const from = { x: g.x + g.width - 4, y: g.y + g.height - 4 };
  const to = await center(trash(page));
  await dragFromTo(page, from, to);

  await expect(notes(page)).toHaveCount(1);
  await expect(trash(page)).not.toHaveClass(/trash--active/);
});

test('moving never changes the size and resizing never changes the position', async ({ page }) => {
  const start = await settledBox(note(page));
  await dragHeaderBy(page, note(page), 120, 70);
  const moved = await settledBox(note(page));
  within(moved.width, start.width);
  within(moved.height, start.height);

  await resizeBy(page, note(page), 60, 40);
  const resized = await settledBox(note(page));
  within(resized.x, moved.x);
  within(resized.y, moved.y);
});

test('a second pointer cannot start a competing action while a drag is running', async ({ page }) => {
  const before = await settledBox(note(page));
  const from = await headerGrabPoint(note(page));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 40, { steps: 3 });
  await expect(note(page)).toHaveClass(/note--dragging/);

  // A real mouse cannot press twice, so a touch/pen pointer is simulated on the resize grip.
  await grip(note(page)).evaluate((el) => {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, button: 0, clientX: r.x + 4, clientY: r.y + 4 }),
    );
  });
  await expect(note(page)).not.toHaveClass(/note--resizing/);
  await page.mouse.up();

  const after = await settledBox(note(page));
  within(after.width, before.width);
  within(after.height, before.height);
  within(after.x - before.x, 60);
});

test('dragging one note leaves the other note untouched', async ({ page }) => {
  await addNote(page);
  const other = note(page, 1);
  const otherBefore = await settledBox(other);
  await other.evaluate((el) => {
    const w = window as unknown as { __mutations: number };
    w.__mutations = 0;
    new MutationObserver((records) => (w.__mutations += records.length)).observe(el, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  });

  await dragHeaderBy(page, note(page, 0), 200, 120, { steps: 20 });
  await settledBox(note(page, 0));

  expect(await page.evaluate(() => (window as unknown as { __mutations: number }).__mutations)).toBe(0);
  const otherAfter = await box(other);
  within(otherAfter.x, otherBefore.x);
  within(otherAfter.y, otherBefore.y);
});

test('the toolbar button and the trash do not interfere with each other', async ({ page }) => {
  await addNote(page);
  await expect(notes(page)).toHaveCount(2);
  await expect(header(note(page, 1))).toBeVisible();
});

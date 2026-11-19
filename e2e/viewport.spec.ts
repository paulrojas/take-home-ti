import { expect, test } from '@playwright/test';
import { MIN_VIEWPORT, box, openApp, setViewport } from './support/app';
import { addNote, board, dragHeaderBy, note, notes, settledBox } from './support/notes';

const warning = (page: import('@playwright/test').Page) => page.getByRole('alertdialog').filter({ hasText: 'Your window is too small' });

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('a window below the minimum shows a warning with the current and required size', async ({ page }) => {
  await setViewport(page, 900, 600);

  await expect(warning(page)).toBeVisible();
  await expect(warning(page)).toContainText('1024 × 768');
  await expect(warning(page)).toContainText('900 × 600');
  await expect(warning(page)).toContainText('enlarge');
});

test('the warning disappears by itself once the window is large enough', async ({ page }) => {
  await setViewport(page, 900, 600);
  await expect(warning(page)).toBeVisible();

  await setViewport(page, MIN_VIEWPORT.width, MIN_VIEWPORT.height);
  await expect(warning(page)).toBeHidden();
});

for (const [width, height, shown] of [
  [1023, 768, true],
  [1024, 767, true],
  [1024, 768, false],
  [1920, 1080, false],
] as const) {
  test(`${width}x${height} ${shown ? 'shows' : 'does not show'} the warning`, async ({ page }) => {
    await setViewport(page, width, height);
    if (shown) await expect(warning(page)).toBeVisible();
    else await expect(warning(page)).toBeHidden();
  });
}

test('notes survive the window being too small for a while', async ({ page }) => {
  await addNote(page);
  await setViewport(page, 900, 600);
  await expect(warning(page)).toBeVisible();
  await setViewport(page, 1280, 800);
  await expect(warning(page)).toBeHidden();

  await expect(notes(page)).toHaveCount(1);
});

test('the warning blocks interaction with the board underneath', async ({ page }) => {
  await setViewport(page, 900, 600);
  await expect(warning(page)).toBeVisible();

  await page.mouse.click(300, 300);
  await expect(notes(page)).toHaveCount(0);
});

test('shrinking the window pulls a note that no longer fits back inside the board', async ({ page }) => {
  await addNote(page);
  await dragHeaderBy(page, note(page), 900, 500, { steps: 6 });
  const farAway = await settledBox(note(page));
  expect(farAway.x + farAway.width).toBeGreaterThan(1024);

  await setViewport(page, MIN_VIEWPORT.width, MIN_VIEWPORT.height);

  await expect
    .poll(async () => {
      const b = await box(board(page));
      const n = await box(note(page));
      return n.x >= b.x - 1 && n.y >= b.y - 1 && n.x + n.width <= b.x + b.width + 1 && n.y + n.height <= b.y + b.height + 1;
    })
    .toBe(true);
});

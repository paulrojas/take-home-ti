import { expect, test } from '@playwright/test';
import { box, openApp } from './support/app';
import { addNote, dragHeaderBy, note, notes, settledBox, textArea } from './support/notes';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test.describe('text', () => {
  test('typing is kept and long text stays inside the note', async ({ page }) => {
    await addNote(page);
    const long = 'sticky '.repeat(200);
    await textArea(note(page)).fill(long);

    await expect(textArea(note(page))).toHaveValue(long);
    const n = await box(note(page));
    expect(n.height).toBeLessThan(260);
  });

  test('typing in one note never changes another', async ({ page }) => {
    await addNote(page);
    await addNote(page);
    await textArea(note(page, 0)).fill('first');
    await expect(textArea(note(page, 1))).toHaveValue('');
  });
});

test.describe('stacking order', () => {
  test('clicking a lower overlapping note brings it to the front', async ({ page }) => {
    await addNote(page);
    await addNote(page);
    // Overlap them: move the second note so both share an area.
    const first = await settledBox(note(page, 0));
    const secondHeader = await box(note(page, 1).getByTestId('note-header'));
    await page.mouse.move(secondHeader.x + secondHeader.width / 2, secondHeader.y + secondHeader.height / 2);
    await page.mouse.down();
    await page.mouse.move(first.x + 120, first.y + 60, { steps: 6 });
    await page.mouse.up();

    const topAt = (x: number, y: number): Promise<number> =>
      page.evaluate(
        ([px, py]) => {
          const el = document.elementFromPoint(px as number, py as number);
          const all = Array.from(document.querySelectorAll('[aria-label="Sticky note"]'));
          return all.findIndex((n) => n.contains(el));
        },
        [x, y],
      );
    expect(await topAt(first.x + 150, first.y + 100)).toBe(1);

    // Press on the part of the first note that the second one does not cover.
    await page.mouse.click(first.x + 6, first.y + 150);
    expect(await topAt(first.x + 150, first.y + 100)).toBe(0);
  });

  test('the stacking order survives a reload', async ({ page }) => {
    await addNote(page);
    await addNote(page);
    const z = async (i: number): Promise<number> => Number(await note(page, i).evaluate((el) => getComputedStyle(el).zIndex));
    // Press the part of the first note that the cascaded second note does not cover.
    await note(page, 0).click({ position: { x: 6, y: 150 } });
    expect(await z(0)).toBeGreaterThan(await z(1));

    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('sticky-notes:cache'))).toContain('"z"');
    await page.reload();
    await expect(notes(page)).toHaveCount(2);
    expect(await z(0)).toBeGreaterThan(await z(1));
  });
});

test.describe('colors', () => {
  test('the color menu changes the note color and marks the chosen swatch', async ({ page }) => {
    await addNote(page);
    await note(page).getByRole('button', { name: 'Change color' }).click();
    await note(page).getByRole('menuitemradio', { name: 'blue' }).click();

    await expect(note(page)).toHaveClass(/note--blue/);
    await note(page).getByRole('button', { name: 'Change color' }).click();
    await expect(note(page).getByRole('menuitemradio', { name: 'blue' })).toHaveAttribute('aria-checked', 'true');
  });

  test('Escape and clicking outside close the menu', async ({ page }) => {
    await addNote(page);
    const menuButton = note(page).getByRole('button', { name: 'Change color' });
    await menuButton.click();
    await expect(note(page).getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(note(page).getByRole('menu')).toBeHidden();

    await menuButton.click();
    await page.mouse.click(700, 500);
    await expect(note(page).getByRole('menu')).toBeHidden();
  });

  test('a color change on one note does not affect others', async ({ page }) => {
    await addNote(page);
    await addNote(page);
    await note(page, 1).getByRole('button', { name: 'Change color' }).click();
    await note(page, 1).getByRole('menuitemradio', { name: 'pink' }).click();

    await expect(note(page, 0)).toHaveClass(/note--yellow/);
    await expect(note(page, 1)).toHaveClass(/note--pink/);
    await dragHeaderBy(page, note(page, 1), 10, 10);
    await expect(note(page, 1)).toHaveClass(/note--pink/);
  });
});

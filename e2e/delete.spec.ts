import { expect, test, type Page } from '@playwright/test';
import { box, openApp, within } from './support/app';
import { addNote, center, dragFromTo, drawNote, headerGrabPoint, note, notes, settledBox, textArea, trash } from './support/notes';

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await addNote(page);
});

async function startDragToTrash(page: Page): Promise<void> {
  const from = await headerGrabPoint(note(page));
  const to = await center(trash(page));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
}

test.describe('drag to trash', () => {
  test('shows feedback while over the trash and deletes on release', async ({ page }) => {
    await startDragToTrash(page);
    await expect(trash(page)).toHaveClass(/trash--active/);
    await expect(note(page)).toHaveClass(/note--doomed/);

    await page.mouse.up();
    await expect(notes(page)).toHaveCount(0);
    await expect(trash(page)).not.toHaveClass(/trash--active/);
  });

  test('a fast flick onto the trash deletes the note', async ({ page }) => {
    const from = await headerGrabPoint(note(page));
    const to = await center(trash(page));
    await dragFromTo(page, from, to, { steps: 1 });

    await expect(notes(page)).toHaveCount(0);
  });

  test('passing over the trash and releasing elsewhere keeps the note', async ({ page }) => {
    await startDragToTrash(page);
    await expect(trash(page)).toHaveClass(/trash--active/);
    await page.mouse.move(400, 300, { steps: 6 });
    await expect(trash(page)).not.toHaveClass(/trash--active/);
    await expect(note(page)).not.toHaveClass(/note--doomed/);
    await page.mouse.up();

    await expect(notes(page)).toHaveCount(1);
  });

  test('Escape while over the trash cancels without deleting', async ({ page }) => {
    await startDragToTrash(page);
    await page.keyboard.press('Escape');
    await page.mouse.up();

    await expect(notes(page)).toHaveCount(1);
    await expect(trash(page)).not.toHaveClass(/trash--active/);
  });

  test('deletes when the card covers the trash even though the pointer stays outside it', async ({ page }) => {
    const card = await box(note(page));
    const zone = await box(trash(page));
    const grab = await headerGrabPoint(note(page));
    // Move the card so only its bottom-right corner (20px) enters the trash zone.
    const dx = zone.x + 20 - (card.x + card.width);
    const dy = zone.y + 20 - (card.y + card.height);
    const end = { x: grab.x + dx, y: grab.y + dy };
    expect(end.x < zone.x || end.y < zone.y).toBe(true);

    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await expect(trash(page)).toHaveClass(/trash--active/);
    await page.mouse.up();

    await expect(notes(page)).toHaveCount(0);
  });

  test('a card that only brushes past the trash edge is kept', async ({ page }) => {
    const card = await box(note(page));
    const zone = await box(trash(page));
    const grab = await headerGrabPoint(note(page));
    const dx = zone.x - 10 - (card.x + card.width);
    const dy = zone.y - 10 - (card.y + card.height);

    await dragFromTo(page, grab, { x: grab.x + dx, y: grab.y + dy });

    await expect(notes(page)).toHaveCount(1);
  });

  test('a note drawn over the trash is not deleted by clicking it, only after it leaves and returns', async ({ page }) => {
    await note(page).getByRole('button', { name: 'Delete note' }).click();
    const zone = await box(trash(page));
    await drawNote(page, { x: zone.x - 60, y: zone.y - 60 }, { x: zone.x + zone.width - 5, y: zone.y + zone.height - 5 });
    await expect(notes(page)).toHaveCount(1);

    const grab = await headerGrabPoint(note(page));
    await page.mouse.click(grab.x, grab.y);
    await expect(notes(page)).toHaveCount(1);

    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(grab.x - 400, grab.y - 200, { steps: 8 });
    await expect(trash(page)).not.toHaveClass(/trash--active/);
    await page.mouse.move(grab.x, grab.y, { steps: 8 });
    await expect(trash(page)).toHaveClass(/trash--active/);
    await page.mouse.up();
    await expect(notes(page)).toHaveCount(0);
  });

  test('only the dragged note is deleted', async ({ page }) => {
    await addNote(page);
    await startDragToTrash(page);
    await page.mouse.up();

    await expect(notes(page)).toHaveCount(1);
  });
});

const deleteButton = (page: Page) => note(page).getByRole('button', { name: 'Delete note' });
const toastRegion = (page: Page) => page.getByRole('status', { name: 'Notifications' });
const undoButton = (page: Page) => toastRegion(page).getByRole('button', { name: 'Undo' });

test.describe('delete button', () => {
  test('removes an empty note immediately', async ({ page }) => {
    await deleteButton(page).click();
    await expect(notes(page)).toHaveCount(0);
  });

  test('removes a note with text immediately, without a blocking dialog', async ({ page }) => {
    await textArea(note(page)).fill('keep me');
    await deleteButton(page).click();

    await expect(notes(page)).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });
});

test.describe('undo', () => {
  test('the toast Undo button brings the note back with its text, place and colour', async ({ page }) => {
    await textArea(note(page)).fill('keep me');
    const before = await box(note(page));
    await deleteButton(page).click();
    await expect(toastRegion(page)).toContainText('Note deleted');

    await undoButton(page).click();

    await expect(notes(page)).toHaveCount(1);
    await expect(textArea(note(page))).toHaveValue('keep me');
    const after = await settledBox(note(page));
    within(after.x, before.x);
    within(after.y, before.y);
    within(after.width, before.width);
    within(after.height, before.height);
    await expect(toastRegion(page)).toBeEmpty();
  });

  test('restores a note deleted by dragging it to the trash', async ({ page }) => {
    await startDragToTrash(page);
    await page.mouse.up();
    await expect(notes(page)).toHaveCount(0);

    await undoButton(page).click();
    await expect(notes(page)).toHaveCount(1);
  });

  test('Ctrl/Cmd+Z undoes deletions one by one, most recent first', async ({ page }) => {
    await addNote(page);
    await textArea(note(page, 0)).fill('first');
    await textArea(note(page, 1)).fill('second');
    await note(page, 1).getByRole('button', { name: 'Delete note' }).click();
    await note(page, 0).getByRole('button', { name: 'Delete note' }).click();
    await expect(notes(page)).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+z');
    await expect(notes(page)).toHaveCount(1);
    await expect(textArea(note(page))).toHaveValue('first');

    await page.keyboard.press('ControlOrMeta+z');
    await expect(notes(page)).toHaveCount(2);
  });

  test('Ctrl/Cmd+Z while typing is left to the text field', async ({ page }) => {
    await addNote(page);
    await note(page, 1).getByRole('button', { name: 'Delete note' }).click();
    await expect(notes(page)).toHaveCount(1);

    await textArea(note(page)).fill('typing');
    await page.keyboard.press('ControlOrMeta+z');

    await expect(notes(page)).toHaveCount(1);
  });

  test('the toast fades after a few seconds but Ctrl/Cmd+Z still works', async ({ page }) => {
    await deleteButton(page).click();
    await expect(toastRegion(page)).toContainText('Note deleted');
    await expect(toastRegion(page)).toBeEmpty({ timeout: 10_000 });

    await page.keyboard.press('ControlOrMeta+z');
    await expect(notes(page)).toHaveCount(1);
  });

  test('a deletion survives a reload as a deletion (history is not persisted)', async ({ page }) => {
    await deleteButton(page).click();
    await expect(notes(page)).toHaveCount(0);
    await expect(page.getByText('All changes saved')).toBeVisible();

    await page.reload();
    await expect(notes(page)).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(notes(page)).toHaveCount(0);
  });
});

test.describe('Delete key', () => {
  test('on a focused note deletes it, and it can be undone', async ({ page }) => {
    await textArea(note(page)).fill('keep me');
    await note(page).focus();
    await page.keyboard.press('Delete');
    await expect(notes(page)).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+z');
    await expect(textArea(note(page))).toHaveValue('keep me');
  });

  test('is ignored while typing in the textarea', async ({ page }) => {
    await textArea(note(page)).fill('abc');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Delete');

    await expect(notes(page)).toHaveCount(1);
  });
});

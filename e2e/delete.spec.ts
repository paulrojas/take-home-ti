import { expect, test, type Page } from '@playwright/test';
import { openApp } from './support/app';
import { addNote, center, dragFromTo, headerGrabPoint, note, notes, textArea, trash } from './support/notes';

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

  test('only the dragged note is deleted', async ({ page }) => {
    await addNote(page);
    await startDragToTrash(page);
    await page.mouse.up();

    await expect(notes(page)).toHaveCount(1);
  });
});

test.describe('delete button', () => {
  test('removes an empty note immediately', async ({ page }) => {
    await note(page).getByRole('button', { name: 'Delete note' }).click();
    await expect(notes(page)).toHaveCount(0);
  });

  test('asks first when the note has text; Cancel keeps it with its text', async ({ page }) => {
    await textArea(note(page)).fill('keep me');
    await note(page).getByRole('button', { name: 'Delete note' }).click();

    const dialog = page.getByRole('alertdialog').filter({ hasText: 'Delete this note?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(notes(page)).toHaveCount(1);
    await expect(textArea(note(page))).toHaveValue('keep me');
  });

  test('Delete confirms and removes the note', async ({ page }) => {
    await textArea(note(page)).fill('bye');
    await note(page).getByRole('button', { name: 'Delete note' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(notes(page)).toHaveCount(0);
  });

  test('Escape closes the dialog without deleting and focus returns to the delete button', async ({ page }) => {
    await textArea(note(page)).fill('keep me');
    const deleteButton = note(page).getByRole('button', { name: 'Delete note' });
    await deleteButton.focus();
    await deleteButton.press('Enter');
    await expect(page.getByText('Delete this note?')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByText('Delete this note?')).toBeHidden();
    await expect(notes(page)).toHaveCount(1);
    await expect(deleteButton).toBeFocused();
  });

  test('Tab cannot reach the textarea behind the dialog', async ({ page }) => {
    await textArea(note(page)).fill('keep me');
    await note(page).getByRole('button', { name: 'Delete note' }).click();

    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      await expect(textArea(note(page))).not.toBeFocused();
    }
  });
});

test.describe('Delete key', () => {
  test('on a focused empty note deletes it', async ({ page }) => {
    await note(page).focus();
    await page.keyboard.press('Delete');
    await expect(notes(page)).toHaveCount(0);
  });

  test('on a focused note with text opens the confirmation', async ({ page }) => {
    await textArea(note(page)).fill('keep me');
    await note(page).focus();
    await page.keyboard.press('Delete');

    await expect(page.getByText('Delete this note?')).toBeVisible();
    await expect(notes(page)).toHaveCount(1);
  });

  test('is ignored while typing in the textarea', async ({ page }) => {
    await textArea(note(page)).fill('abc');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Delete');

    await expect(notes(page)).toHaveCount(1);
    await expect(page.getByText('Delete this note?')).toBeHidden();
  });
});

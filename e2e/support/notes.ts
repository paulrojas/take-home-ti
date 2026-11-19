import { expect, type Locator, type Page } from '@playwright/test';
import { box, type Box } from './app';

export const notes = (page: Page): Locator => page.getByRole('group', { name: 'Sticky note' });
export const note = (page: Page, index = 0): Locator => notes(page).nth(index);
export const header = (n: Locator): Locator => n.getByTestId('note-header');
export const grip = (n: Locator): Locator => n.getByTestId('resize-handle');
export const textArea = (n: Locator): Locator => n.getByRole('textbox', { name: 'Note text' });
export const trash = (page: Page): Locator => page.getByTestId('trash');
export const board = (page: Page): Locator => page.getByTestId('board');

export interface DragOptions {
  /** 1 models a fast flick (one big jump); larger values a slow, precise drag. */
  readonly steps?: number;
}

export async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const b = await box(locator);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Point on the header that is not covered by its buttons. */
export async function headerGrabPoint(n: Locator): Promise<{ x: number; y: number }> {
  const b = await box(header(n));
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

export async function dragFromTo(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  { steps = 8 }: DragOptions = {},
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

export async function dragHeaderBy(page: Page, n: Locator, dx: number, dy: number, options?: DragOptions): Promise<void> {
  const from = await headerGrabPoint(n);
  await dragFromTo(page, from, { x: from.x + dx, y: from.y + dy }, options);
}

export async function resizeBy(page: Page, n: Locator, dx: number, dy: number, options?: DragOptions): Promise<void> {
  const b = await box(grip(n));
  const from = { x: b.x + b.width - 4, y: b.y + b.height - 4 };
  await dragFromTo(page, from, { x: from.x + dx, y: from.y + dy }, options);
}

export async function drawNote(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, options?: DragOptions): Promise<void> {
  await dragFromTo(page, from, to, options);
}

export async function addNote(page: Page): Promise<void> {
  const before = await notes(page).count();
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(notes(page)).toHaveCount(before + 1);
}

/** Waits until the element's bounding box stops changing, so rAF-driven updates have landed. */
export async function settledBox(locator: Locator): Promise<Box> {
  let last = await box(locator);
  await expect
    .poll(async () => {
      const current = await box(locator);
      const same = current.x === last.x && current.y === last.y && current.width === last.width && current.height === last.height;
      last = current;
      return same;
    })
    .toBe(true);
  return last;
}

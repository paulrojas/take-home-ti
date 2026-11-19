import { expect, type Locator, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Playwright runs from the repo root; the package is an ES module, so __dirname is not available.
export const APP_URL = pathToFileURL(resolve(process.cwd(), 'dist/index.html')).href;

export const CACHE_KEY = 'sticky-notes:cache';
export const SERVER_KEY = 'sticky-notes:mock-server';

/** Mirrors the app's limits on purpose: the tests state the spec, they don't import the implementation. */
export const MIN_NOTE_SIZE = 120;
export const DEFAULT_NOTE_SIZE = 200;
export const MIN_VIEWPORT = { width: 1024, height: 768 } as const;

export interface StoredNote {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly text: string;
  readonly color: string;
  readonly z: number;
}

/** Collects page errors so any test can assert the app ran clean. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

export async function openApp(page: Page): Promise<void> {
  await page.goto(APP_URL);
  await expect(page.getByTestId('board')).toBeVisible();
}

export async function readStorage(page: Page, key: string): Promise<StoredNote[]> {
  const raw = await page.evaluate((k) => window.localStorage.getItem(k), key);
  if (raw === null) return [];
  return (JSON.parse(raw) as { notes: StoredNote[] }).notes;
}

/** Counts cache writes from the page's point of view, to prove drags don't persist per movement. */
export async function installCacheWriteSpy(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    const w = window as unknown as { __cacheWrites: number };
    w.__cacheWrites = 0;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === key) w.__cacheWrites += 1;
      return original.call(this, k, v);
    };
  }, CACHE_KEY);
}

export function cacheWrites(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __cacheWrites: number }).__cacheWrites);
}

export async function setViewport(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
}

export function within(actual: number, expected: number, tolerance = 1.5): void {
  expect(Math.abs(actual - expected), `${actual} should be within ${tolerance} of ${expected}`).toBeLessThanOrEqual(tolerance);
}

export type Box = { x: number; y: number; width: number; height: number };

export async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (!found) throw new Error('Element has no bounding box');
  return found;
}

import type { Edges, Point, Rect, Size } from '../types';

export const MIN_NOTE_SIZE = 120;
export const DEFAULT_NOTE_SIZE = 200;
/** Pointer travel below which a board drag is treated as a plain click. */
export const DRAW_THRESHOLD = 6;

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function pointInEdges(point: Point, edges: Edges): boolean {
  return point.x >= edges.left && point.x <= edges.right && point.y >= edges.top && point.y <= edges.bottom;
}

/** Keeps a note of the given size fully inside the bounds. */
export function clampPosition(x: number, y: number, size: Size, bounds: Size): Point {
  return {
    x: clamp(x, 0, bounds.width - size.width),
    y: clamp(y, 0, bounds.height - size.height),
  };
}

/** Limits a size so the note stays inside the bounds from its origin, never going below the minimum. */
export function clampSize(width: number, height: number, origin: Point, bounds: Size): Size {
  return {
    width: clamp(width, MIN_NOTE_SIZE, bounds.width - origin.x),
    height: clamp(height, MIN_NOTE_SIZE, bounds.height - origin.y),
  };
}

/** Builds the rectangle spanned by two corner points, regardless of drag direction. */
export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/** Turns a drawn rectangle into a valid note rectangle: minimum size enforced, kept inside the bounds. */
export function fitNoteRect(rect: Rect, bounds: Size): Rect {
  const width = clamp(rect.width, MIN_NOTE_SIZE, bounds.width);
  const height = clamp(rect.height, MIN_NOTE_SIZE, bounds.height);
  const position = clampPosition(rect.x, rect.y, { width, height }, bounds);
  return { ...position, width, height };
}

const CASCADE_STEP = 28;
const CASCADE_STEPS = 8;
const CASCADE_ORIGIN = 40;

/** Staggered position for notes created from the toolbar, so they don't stack exactly. */
export function cascadeRect(index: number): Rect {
  const offset = CASCADE_ORIGIN + (index % CASCADE_STEPS) * CASCADE_STEP;
  return { x: offset, y: offset, width: DEFAULT_NOTE_SIZE, height: DEFAULT_NOTE_SIZE };
}

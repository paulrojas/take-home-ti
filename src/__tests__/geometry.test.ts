import { describe, expect, it } from 'vitest';
import {
  MIN_NOTE_SIZE,
  clamp,
  clampPosition,
  clampSize,
  fitNoteRect,
  normalizeRect,
  pointInEdges,
} from '../utils/geometry';

const bounds = { width: 1000, height: 600 };

describe('geometry', () => {
  it('clamp falls back to min when range is inverted', () => {
    expect(clamp(5, 10, 0)).toBe(10);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it('pointInEdges is inclusive', () => {
    const edges = { left: 10, top: 10, right: 20, bottom: 20 };
    expect(pointInEdges({ x: 10, y: 20 }, edges)).toBe(true);
    expect(pointInEdges({ x: 21, y: 15 }, edges)).toBe(false);
  });

  it('clampPosition keeps notes fully inside the board', () => {
    const size = { width: 200, height: 200 };
    expect(clampPosition(-50, 900, size, bounds)).toEqual({ x: 0, y: 400 });
    expect(clampPosition(900, 100, size, bounds)).toEqual({ x: 800, y: 100 });
  });

  it('clampSize enforces the minimum and the board edge', () => {
    expect(clampSize(10, 10, { x: 0, y: 0 }, bounds)).toEqual({ width: MIN_NOTE_SIZE, height: MIN_NOTE_SIZE });
    expect(clampSize(5000, 5000, { x: 100, y: 100 }, bounds)).toEqual({ width: 900, height: 500 });
  });

  it('normalizeRect handles any drag direction', () => {
    expect(normalizeRect({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, width: 40, height: 60 });
  });

  it('fitNoteRect enforces minimum size and stays inside bounds', () => {
    expect(fitNoteRect({ x: 990, y: 590, width: 10, height: 10 }, bounds)).toEqual({
      x: 1000 - MIN_NOTE_SIZE,
      y: 600 - MIN_NOTE_SIZE,
      width: MIN_NOTE_SIZE,
      height: MIN_NOTE_SIZE,
    });
  });
});

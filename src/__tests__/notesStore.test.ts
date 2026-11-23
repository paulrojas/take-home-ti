import { describe, expect, it, vi } from 'vitest';
import { UNDO_LIMIT, createNotesStore, selectAllNotes } from '../store/notesStore';

const rect = { x: 10, y: 10, width: 200, height: 200 };

describe('notes store', () => {
  it('creates notes with increasing z and a new id list', () => {
    const store = createNotesStore();
    const before = store.getState().ids;

    const a = store.getState().create(rect);
    const b = store.getState().create(rect);

    const { ids, notes } = store.getState();
    expect(ids).toEqual([a, b]);
    expect(ids).not.toBe(before);
    expect(notes[b]!.z).toBeGreaterThan(notes[a]!.z);
  });

  it('keeps the id list identity while a note is edited, and replaces only that record', () => {
    const store = createNotesStore();
    const a = store.getState().create(rect);
    const b = store.getState().create(rect);
    const { ids, notes } = store.getState();

    store.getState().update(a, { text: 'hello' });

    expect(store.getState().ids).toBe(ids);
    expect(store.getState().notes[a]).not.toBe(notes[a]);
    expect(store.getState().notes[b]).toBe(notes[b]);
  });

  it('skips no-op updates', () => {
    const store = createNotesStore();
    const a = store.getState().create(rect);
    const onChange = vi.fn();
    store.subscribe(onChange);

    store.getState().update(a, { x: rect.x });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes notes and updates ids', () => {
    const store = createNotesStore();
    const a = store.getState().create(rect);
    const b = store.getState().create(rect);
    store.getState().remove(a);
    expect(store.getState().ids).toEqual([b]);
    expect(store.getState().notes[a]).toBeUndefined();
  });

  it('brings a note to front only when it is not already on top', () => {
    const store = createNotesStore();
    const a = store.getState().create(rect);
    const b = store.getState().create(rect);
    const onChange = vi.fn();
    store.subscribe(onChange);

    store.getState().bringToFront(b);
    expect(onChange).not.toHaveBeenCalled();

    store.getState().bringToFront(a);
    expect(store.getState().notes[a]!.z).toBeGreaterThan(store.getState().notes[b]!.z);
  });

  it('continues z ordering after replaceAll', () => {
    const source = createNotesStore();
    const a = source.getState().create(rect);
    source.getState().bringToFront(a);
    const store = createNotesStore();
    store.getState().replaceAll(selectAllNotes(source.getState()));
    const b = store.getState().create(rect);
    expect(store.getState().notes[b]!.z).toBeGreaterThan(store.getState().notes[a]!.z);
  });

  it('constrainTo applies every correction in one notification', () => {
    const store = createNotesStore();
    store.getState().create({ x: 900, y: 10, width: 200, height: 200 });
    store.getState().create({ x: 950, y: 300, width: 200, height: 200 });
    const onChange = vi.fn();
    store.subscribe(onChange);

    store.getState().constrainTo({ width: 800, height: 600 });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('constrainTo leaves the notes reference alone when only a deleted note needed fitting', () => {
    const store = createNotesStore();
    store.getState().create({ x: 10, y: 10, width: 200, height: 200 });
    const far = store.getState().create({ x: 1700, y: 100, width: 200, height: 200 });
    store.getState().remove(far);
    const notes = store.getState().notes;

    store.getState().constrainTo({ width: 1100, height: 600 });

    expect(store.getState().notes).toBe(notes);
  });

  it('constrainTo pulls oversized and out-of-bounds notes back in and leaves fitting ones alone', () => {
    const store = createNotesStore();
    const fits = store.getState().create({ x: 10, y: 10, width: 200, height: 200 });
    const outside = store.getState().create({ x: 900, y: 500, width: 300, height: 300 });
    const fitsBefore = store.getState().notes[fits];

    store.getState().constrainTo({ width: 800, height: 600 });

    expect(store.getState().notes[fits]).toBe(fitsBefore);
    expect(store.getState().notes[outside]).toMatchObject({ x: 500, y: 300, width: 300, height: 300 });
  });
});

describe('undoing a deletion', () => {
  it('restores the exact record, including text, colour and stacking', () => {
    const store = createNotesStore();
    const a = store.getState().create(rect);
    store.getState().update(a, { text: 'keep me', color: 'pink' });
    store.getState().create(rect);
    const original = store.getState().notes[a];

    store.getState().remove(a);
    store.getState().undoRemove();

    expect(store.getState().notes[a]).toEqual(original);
    expect(store.getState().ids).toContain(a);
    expect(store.getState().removed).toHaveLength(0);
  });

  it('undoes several deletions, most recent first', () => {
    const store = createNotesStore();
    const a = store.getState().create(rect);
    const b = store.getState().create(rect);
    store.getState().remove(a);
    store.getState().remove(b);

    store.getState().undoRemove();
    expect(store.getState().ids).toEqual([b]);
    store.getState().undoRemove();
    expect(store.getState().ids).toEqual([a, b]);
  });

  it('puts the note back at its original place in the order', () => {
    const store = createNotesStore();
    const [a, b, c] = [rect, rect, rect].map((r) => store.getState().create(r));
    store.getState().remove(a!);
    store.getState().remove(c!);

    store.getState().undoRemove();
    store.getState().undoRemove();

    expect(store.getState().ids).toEqual([a, b, c]);
  });

  it('keeps deleted notes inside the board, so an undo after the window shrank is reachable', () => {
    const store = createNotesStore();
    const far = store.getState().create({ x: 1700, y: 100, width: 200, height: 200 });
    store.getState().remove(far);

    store.getState().constrainTo({ width: 1100, height: 600 });
    store.getState().undoRemove();

    expect(store.getState().notes[far]).toMatchObject({ x: 900, y: 100 });
  });

  it('restores a chosen deletion and leaves the others undoable', () => {
    const store = createNotesStore();
    const [a, b, c] = [rect, rect, rect].map((r) => store.getState().create(r));
    [a!, b!, c!].forEach((id) => store.getState().remove(id));

    store.getState().undoRemove(b);

    expect(store.getState().ids).toEqual([b]);
    expect(store.getState().removed.map((entry) => entry.note.id)).toEqual([a, c]);
  });

  it('clamps the original index when the order has shrunk since the deletion', () => {
    const store = createNotesStore();
    const [a, b, c] = [rect, rect, rect].map((r) => store.getState().create(r));
    store.getState().remove(c!);
    store.getState().remove(b!);
    store.getState().remove(a!);

    store.getState().undoRemove(c);

    expect(store.getState().ids).toEqual([c]);
  });

  it('ignores an id that was never deleted', () => {
    const store = createNotesStore();
    const a = store.getState().create(rect);
    const onChange = vi.fn();
    store.subscribe(onChange);

    store.getState().undoRemove(a);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('numbers deletions in increasing order', () => {
    const store = createNotesStore();
    store.getState().remove(store.getState().create(rect));
    store.getState().remove(store.getState().create(rect));
    const seqs = store.getState().removed.map((entry) => entry.seq);
    expect(seqs[1]).toBeGreaterThan(seqs[0]!);
  });

  it('is a no-op with nothing to undo', () => {
    const store = createNotesStore();
    const onChange = vi.fn();
    store.subscribe(onChange);
    store.getState().undoRemove();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never ties stacking with a note created after the deletion', () => {
    const store = createNotesStore();
    const a = store.getState().create(rect);
    store.getState().remove(a);
    const b = store.getState().create(rect);
    store.getState().undoRemove();
    expect(store.getState().notes[b]!.z).toBeGreaterThan(store.getState().notes[a]!.z);
  });

  it('keeps only the most recent deletions', () => {
    const store = createNotesStore();
    for (let i = 0; i < UNDO_LIMIT + 5; i += 1) store.getState().remove(store.getState().create(rect));
    expect(store.getState().removed).toHaveLength(UNDO_LIMIT);
  });

  it('forgets the history when notes are replaced from storage', () => {
    const store = createNotesStore();
    store.getState().remove(store.getState().create(rect));
    store.getState().replaceAll([]);
    expect(store.getState().removed).toHaveLength(0);
  });
});

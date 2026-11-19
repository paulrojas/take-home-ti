import { describe, expect, it, vi } from 'vitest';
import { NotesStore } from '../store/notesStore';

const rect = { x: 10, y: 10, width: 200, height: 200 };

describe('NotesStore', () => {
  it('creates notes with increasing z and notifies id listeners', () => {
    const store = new NotesStore();
    const onIds = vi.fn();
    store.subscribeIds(onIds);

    const a = store.create(rect);
    const b = store.create(rect);

    expect(store.getIds()).toEqual([a, b]);
    expect(store.getNote(b)!.z).toBeGreaterThan(store.getNote(a)!.z);
    expect(onIds).toHaveBeenCalledTimes(2);
  });

  it('only notifies the listener of the updated note, not the id list', () => {
    const store = new NotesStore();
    const a = store.create(rect);
    const b = store.create(rect);
    const onA = vi.fn();
    const onB = vi.fn();
    const onIds = vi.fn();
    store.subscribeNote(a, onA);
    store.subscribeNote(b, onB);
    store.subscribeIds(onIds);

    store.update(a, { text: 'hello' });

    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
    expect(onIds).not.toHaveBeenCalled();
  });

  it('skips no-op updates', () => {
    const store = new NotesStore();
    const a = store.create(rect);
    const onChange = vi.fn();
    store.subscribeChanges(onChange);
    const version = store.getVersion();

    store.update(a, { x: rect.x });

    expect(onChange).not.toHaveBeenCalled();
    expect(store.getVersion()).toBe(version);
  });

  it('removes notes and updates ids', () => {
    const store = new NotesStore();
    const a = store.create(rect);
    const b = store.create(rect);
    store.remove(a);
    expect(store.getIds()).toEqual([b]);
    expect(store.getNote(a)).toBeUndefined();
  });

  it('brings a note to front only when it is not already on top', () => {
    const store = new NotesStore();
    const a = store.create(rect);
    const b = store.create(rect);
    const onB = vi.fn();
    store.subscribeNote(b, onB);

    store.bringToFront(b);
    expect(onB).not.toHaveBeenCalled();

    store.bringToFront(a);
    expect(store.getNote(a)!.z).toBeGreaterThan(store.getNote(b)!.z);
  });

  it('continues z ordering after replaceAll', () => {
    const source = new NotesStore();
    const a = source.create(rect);
    source.bringToFront(a);
    const store = new NotesStore();
    store.replaceAll(source.getAll());
    const b = store.create(rect);
    expect(store.getNote(b)!.z).toBeGreaterThan(store.getNote(a)!.z);
  });
});

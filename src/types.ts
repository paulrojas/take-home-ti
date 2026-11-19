declare const noteIdBrand: unique symbol;

export type NoteId = string & { readonly [noteIdBrand]: true };

export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Point, Size {}

/** Viewport-relative edges, shaped like the subset of DOMRect we use for hit testing. */
export interface Edges {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Note extends Rect {
  readonly id: NoteId;
  readonly text: string;
  readonly color: NoteColor;
  /** Stacking order; the highest value is rendered on top. */
  readonly z: number;
}

export type NoteChanges = Partial<Pick<Note, 'x' | 'y' | 'width' | 'height' | 'text' | 'color' | 'z'>>;

export function asNoteId(value: string): NoteId {
  return value as NoteId;
}

let idCounter = 0;

/** `crypto.randomUUID` is unavailable in insecure contexts, so ids are built by hand. */
export function createNoteId(): NoteId {
  idCounter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return asNoteId(`note-${Date.now().toString(36)}-${idCounter}-${random}`);
}

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && (NOTE_COLORS as readonly string[]).includes(value);
}

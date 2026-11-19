import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '../types';

export interface PointerDragCallbacks {
  /** Called once, only if the drag actually starts (see the single-drag rule below). */
  onStart?(): void;
  /** Called at most once per animation frame, with the pointer offset from where the drag started. */
  onMove(dx: number, dy: number, pointer: Point): void;
  /** Called once. `cancelled` is true for Escape or an interrupted pointer. */
  onEnd(dx: number, dy: number, pointer: Point, cancelled: boolean): void;
}

/** Only one drag may run at a time, so a second pointer (touch, pen) can never start a competing action. */
let dragActive = false;

/**
 * Runs a pointer drag on the event's current target and returns whether it started. Listeners exist only
 * while the drag lasts and pointer capture keeps events flowing even when the pointer leaves the element
 * or the window. Callers mutate the DOM directly in `onMove`, so a drag causes no React renders.
 */
export function beginPointerDrag(event: ReactPointerEvent<HTMLElement>, callbacks: PointerDragCallbacks): boolean {
  if (dragActive) return false;
  dragActive = true;

  const target = event.currentTarget;
  const { pointerId } = event;
  const startX = event.clientX;
  const startY = event.clientY;
  // Mutated in place; callbacks must read it synchronously.
  const pointer = { x: startX, y: startY };
  let frame = 0;
  let finished = false;

  try {
    target.setPointerCapture(pointerId);
  } catch {
    // The pointer is no longer active (e.g. released already); the drag still works without capture.
  }

  const emitMove = (): void => {
    frame = 0;
    callbacks.onMove(pointer.x - startX, pointer.y - startY, pointer);
  };

  const finish = (cancelled: boolean): void => {
    if (finished) return;
    finished = true;
    dragActive = false;
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    target.removeEventListener('pointermove', onPointerMove);
    target.removeEventListener('pointerup', onPointerUp);
    target.removeEventListener('pointercancel', onPointerCancel);
    target.removeEventListener('lostpointercapture', onLostCapture);
    window.removeEventListener('keydown', onKeyDown);
    if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);

    if (!cancelled) callbacks.onMove(pointer.x - startX, pointer.y - startY, pointer);
    callbacks.onEnd(pointer.x - startX, pointer.y - startY, pointer, cancelled);
  };

  function onPointerMove(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (!frame) frame = requestAnimationFrame(emitMove);
  }

  function onPointerUp(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    finish(false);
  }

  function onPointerCancel(e: PointerEvent): void {
    if (e.pointerId === pointerId) finish(true);
  }

  // The browser took the capture away (element removed, window lost focus): end instead of hanging.
  function onLostCapture(e: PointerEvent): void {
    if (e.pointerId === pointerId) finish(true);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') finish(true);
  }

  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerCancel);
  target.addEventListener('lostpointercapture', onLostCapture);
  window.addEventListener('keydown', onKeyDown);

  callbacks.onStart?.();
  return true;
}

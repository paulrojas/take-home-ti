import { useEffect } from 'react';
import { useStore } from '../store/AppContext';

function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement;
}

/** Ctrl/Cmd+Z restores the last deleted note, except while typing, where the browser's own text undo applies. */
export function useUndoShortcut(): void {
  const store = useStore();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // `code` covers non-Latin layouts, `key` covers layouts that move the Z key; a held key must not unwind the history.
      const isZ = event.code === 'KeyZ' || event.key.toLowerCase() === 'z';
      const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && isZ;
      if (!isUndo || event.repeat || event.defaultPrevented || isTextField(event.target)) return;
      if (store.getState().removed.length === 0) return;
      event.preventDefault();
      store.getState().undoRemove();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);
}

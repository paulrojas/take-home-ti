import { useEffect, useState } from 'react';
import type { Size } from '../types';
import { meetsMinimumResolution } from '../utils/viewport';
import { useDebouncedCallback } from './useDebouncedCallback';

const RESIZE_DEBOUNCE_MS = 100;

function readViewport(): Size | null {
  const { innerWidth: width, innerHeight: height } = window;
  return meetsMinimumResolution(width, height) ? null : { width, height };
}

/**
 * Returns the current viewport size while it is below the supported minimum, otherwise `null`.
 * State only changes while the window is too small or when crossing the threshold, so a supported
 * window being resized never re-renders the caller.
 */
export function useTooSmallViewport(): Size | null {
  const [tooSmall, setTooSmall] = useState<Size | null>(readViewport);

  const update = useDebouncedCallback(() => {
    setTooSmall((previous) => {
      const next = readViewport();
      return next === null && previous === null ? previous : next;
    });
  }, RESIZE_DEBOUNCE_MS);

  useEffect(() => {
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update]);

  return tooSmall;
}

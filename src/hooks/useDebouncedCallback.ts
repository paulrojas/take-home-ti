import { useEffect, useMemo, useRef } from 'react';
import { debounce, type Debounced } from '../utils/debounce';

/**
 * Returns a referentially stable debounced version of `fn`. The latest `fn` is always the one invoked,
 * and a pending call is flushed on unmount so trailing edits are not lost.
 */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay: number): Debounced<A> {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const debounced = useMemo(() => debounce((...args: A) => fnRef.current(...args), delay), [delay]);
  useEffect(() => () => debounced.flush(), [debounced]);
  return debounced;
}

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** Runs the pending call immediately, if there is one. */
  flush(): void;
  /** Drops the pending call, if there is one. */
  cancel(): void;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, delay: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | undefined;

  const run = (): void => {
    timer = undefined;
    const args = pending;
    pending = undefined;
    if (args) fn(...args);
  };

  const debounced = ((...args: A): void => {
    pending = args;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(run, delay);
  }) as Debounced<A>;

  debounced.flush = (): void => {
    if (timer === undefined) return;
    clearTimeout(timer);
    run();
  };

  debounced.cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  };

  return debounced;
}

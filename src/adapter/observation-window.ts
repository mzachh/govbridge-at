/** Rearmable, bounded mutation observation; extraction remains with the existing adapter. */
export function createObservationWindow(
  pageDocument: Document,
  observe: () => Promise<void>,
  durationMs = 15_000,
): { rearm(): void; dispose(): void } {
  let pending: ReturnType<typeof setTimeout> | undefined;
  let stop: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const observer = new MutationObserver(() => {
    if (pending !== undefined) clearTimeout(pending);
    pending = setTimeout(() => { pending = undefined; void observe(); }, 250);
  });
  const clear = (): void => {
    observer.disconnect();
    if (pending !== undefined) clearTimeout(pending);
    if (stop !== undefined) clearTimeout(stop);
    pending = undefined;
    stop = undefined;
  };
  return {
    rearm() {
      if (disposed) return;
      clear();
      void observe();
      observer.observe(pageDocument.documentElement, { childList: true, subtree: true });
      stop = setTimeout(() => {
        // Stop accepting new mutations, but flush a debounce already scheduled
        // inside the window (for example a result arriving just before expiry).
        observer.disconnect();
        stop = undefined;
      }, durationMs);
    },
    dispose() { disposed = true; clear(); },
  };
}

// The two isolated content-script bundles share this world's JS global, not MAIN's.
// No DOM event or page-facing API: a page script cannot trigger or observe this signal.
const SIGNAL_KEY = Symbol.for("govbridge-at.isolated-search-observation");
interface SignalState { listeners: WeakMap<Document, Set<() => void>> }
const isolatedGlobal = globalThis as typeof globalThis & { [SIGNAL_KEY]?: SignalState };

function state(): SignalState {
  return isolatedGlobal[SIGNAL_KEY] ??= { listeners: new WeakMap() };
}

export function onSearchDispatched(pageDocument: Document, listener: () => void): () => void {
  const listeners = state().listeners.get(pageDocument) ?? new Set<() => void>();
  state().listeners.set(pageDocument, listeners);
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifySearchDispatched(pageDocument: Document): void {
  for (const listener of state().listeners.get(pageDocument) ?? []) listener();
}

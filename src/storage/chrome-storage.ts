import type { ClaimStorage, StoredClaimState } from "../tracking/types.js";
import type { ClaimStateStore } from "./storage.js";
import { assertStoredClaimState } from "./validation.js";

export const STORAGE_KEY = "oegkClaimTracker.state.v1";

export interface LocalStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

function emptyState(now: () => string): StoredClaimState {
  return { schemaVersion: 1, claims: [], events: [], updatedAt: now() };
}

export class ChromeClaimStorage implements ClaimStorage, ClaimStateStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly area: LocalStorageArea = chrome.storage.local,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async loadSnapshot(): Promise<StoredClaimState> {
    const stored = (await this.area.get(STORAGE_KEY))[STORAGE_KEY];
    if (stored === undefined) return emptyState(this.now);
    // Future versions and corrupt records fail closed and remain untouched.
    assertStoredClaimState(stored);
    return structuredClone(stored);
  }

  read(): Promise<StoredClaimState> { return this.loadSnapshot(); }

  replaceSnapshot(state: StoredClaimState): Promise<void> {
    let copy: StoredClaimState;
    try {
      assertStoredClaimState(state);
      copy = structuredClone(state);
    } catch (error) {
      return Promise.reject(error);
    }
    const write = this.writeQueue.then(() => this.area.set({ [STORAGE_KEY]: copy }));
    // Keep the queue usable after a rejected write while returning the failure.
    this.writeQueue = write.catch(() => undefined);
    return write;
  }

  replace(state: StoredClaimState): Promise<void> { return this.replaceSnapshot(state); }
}

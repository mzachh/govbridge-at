import { describe, expect, it } from "vitest";
import type { Claim, ClaimExtractionResult, ClaimObservation } from "../src/domain/claim.js";
import { ChromeClaimStorage, STORAGE_KEY } from "../src/storage/chrome-storage.js";
import { sortClaims } from "../src/storage/order.js";
import { reconcileClaims } from "../src/tracking/reconcile.js";
import type { ClaimStorage, StoredClaimState } from "../src/tracking/types.js";

const T0 = "2026-08-30T10:00:00.000Z";
const T1 = "2026-08-30T11:00:00.000Z";
const empty = (): StoredClaimState => ({ schemaVersion: 1, claims: [], events: [], updatedAt: T0 });
const observation = (overrides: Partial<ClaimObservation> = {}): ClaimObservation => ({
  provider: "Synthetic Clinic Alpha", invoiceDate: "2026-08-01", invoiceAmount: 120,
  status: "processing", source: "oegk", ...overrides,
});
const omit = (value: ClaimObservation, ...keys: (keyof ClaimObservation)[]): ClaimObservation => {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
};
const extraction = (claims: ClaimObservation[], overrides: Partial<ClaimExtractionResult> = {}): ClaimExtractionResult => ({
  state: "complete", pageKind: "results", snapshotComplete: true, observations: claims,
  diagnostics: { candidateCount: claims.length, skippedCount: 0 }, ...overrides,
});

class MemoryStorage implements ClaimStorage {
  writes = 0;
  constructor(public state: StoredClaimState = empty(), private failWrite = false) {}
  async loadSnapshot() { return structuredClone(this.state); }
  async replaceSnapshot(state: StoredClaimState) {
    if (this.failWrite) throw new Error("synthetic write failure");
    this.state = structuredClone(state); this.writes += 1;
  }
}

describe("OEGK-TRACK-001 OEGK-TRACK-007 reconciliation gating", () => {
  it.each(["loading", "unsupported", "error"] as const)("does not commit %s extraction", async (state) => {
    const storage = new MemoryStorage();
    const result = await reconcileClaims(storage, extraction([observation()], { state, snapshotComplete: false }), { now: () => T1 });
    expect(result.committed).toBe(false); expect(storage.writes).toBe(0); expect(storage.state).toEqual(empty());
  });

  it("rejects an invalid clock without a partial commit", async () => {
    const storage = new MemoryStorage();
    await expect(reconcileClaims(storage, extraction([observation()]), { now: () => "not-a-clock" })).rejects.toThrow("clock");
    expect(storage.writes).toBe(0);
  });
});

describe("OEGK-TRACK-002 OEGK-TRACK-003 identity", () => {
  it("assigns a secure opaque local ID without exposing fingerprint values", async () => {
    const storage = new MemoryStorage();
    const result = await reconcileClaims(storage, extraction([observation()]), { now: () => T1, randomId: () => "local-v1-opaque-random" });
    expect(result.state.claims[0]!.id).toBe("local-v1-opaque-random");
    expect(result.state.claims[0]!.id).not.toContain("Synthetic");
  });

  it("uses cryptographically supplied local IDs for insufficient evidence", async () => {
    const storage = new MemoryStorage();
    const result = await reconcileClaims(storage, extraction([omit(observation(), "provider", "invoiceDate", "invoiceAmount")]),
      { now: () => T1, randomId: () => "local-v1-random-test" });
    expect(result.state.claims[0]!.id).toBe("local-v1-random-test");
  });

  it("keeps duplicate-looking observations separate and infers no transition", async () => {
    let sequence = 0;
    const storage = new MemoryStorage();
    const result = await reconcileClaims(storage, extraction([observation(), observation()]),
      { now: () => T1, randomId: () => `local-v1-random-${++sequence}` });
    expect(result.state.claims.map((claim) => claim.id)).toEqual(["local-v1-random-1", "local-v1-random-2"]);
    expect(result.newEvents).toEqual([]); expect(result.ambiguityCount).toBe(2);
  });
});

describe("OEGK-TRACK-004 through OEGK-TRACK-010 changes and retention", () => {
  it("merges conservatively and emits exactly one status event", async () => {
    const storage = new MemoryStorage();
    const first = await reconcileClaims(storage, extraction([observation()]), { now: () => T0 });
    const id = first.state.claims[0]!.id;
    const secondObservation = omit(observation({ status: "completed", reimbursementAmount: 70 }), "provider");
    const second = await reconcileClaims(storage, extraction([secondObservation]), { now: () => T1 });
    expect(second.state.claims[0]).toMatchObject({ id, provider: "Synthetic Clinic Alpha", invoiceAmount: 120, reimbursementAmount: 70, status: "completed", lastSeen: T1 });
    expect(second.newEvents).toEqual([{ type: "CLAIM_STATUS_CHANGED", claimId: id, previousStatus: "processing", newStatus: "completed", observedAt: T1 }]);
  });

  it("is idempotent apart from lastSeen and emits no event for new claims", async () => {
    const storage = new MemoryStorage();
    const first = await reconcileClaims(storage, extraction([observation()]), { now: () => T0 });
    const second = await reconcileClaims(storage, extraction([observation()]), { now: () => T1 });
    expect(second.state.claims).toHaveLength(1); expect(second.state.claims[0]!.id).toBe(first.state.claims[0]!.id);
    expect(second.state.claims[0]!.lastSeen).toBe(T1); expect(second.newEvents).toEqual([]);
  });

  it("retains a claim absent from a complete or authoritative empty snapshot", async () => {
    const storage = new MemoryStorage();
    await reconcileClaims(storage, extraction([observation()]), { now: () => T0 });
    const before = storage.state.claims[0];
    await reconcileClaims(storage, extraction([], { state: "empty" }), { now: () => T1 });
    expect(storage.state.claims[0]).toEqual(before); expect(storage.state.events).toEqual([]);
    expect(storage.state.metadata).toEqual({ lastSnapshotAt: T1, lastExtractionState: "empty" });
  });

  it("does not alter committed state when atomic storage replacement fails", async () => {
    const storage = new MemoryStorage(empty(), true);
    await expect(reconcileClaims(storage, extraction([observation()]), { now: () => T1 })).rejects.toThrow("write failure");
    expect(storage.state).toEqual(empty());
  });
});

describe("OEGK-TRACK-011 detail enrichment", () => {
  it("enriches exactly one unique match but creates no unmatched detail claim", async () => {
    const storage = new MemoryStorage();
    await reconcileClaims(storage, extraction([observation()]), { now: () => T0 });
    const detail = extraction([observation({ treatmentDate: "2026-07-30" })], { pageKind: "open-rejected-detail", snapshotComplete: false });
    const enriched = await reconcileClaims(storage, detail, { now: () => T1 });
    expect(enriched.committed).toBe(true); expect(storage.state.claims[0]!.treatmentDate).toBe("2026-07-30");

    const unmatched = extraction([observation({ provider: "Synthetic Clinic Beta" })], { pageKind: "reimbursed-detail", snapshotComplete: false });
    const rejected = await reconcileClaims(storage, unmatched, { now: () => T1 });
    expect(rejected.committed).toBe(false); expect(storage.state.claims).toHaveLength(1);
  });
});

class FakeArea {
  value: Record<string, unknown> = {};
  active = 0; maxActive = 0; order: number[] = [];
  async get(key: string) { return key in this.value ? { [key]: this.value[key] } : {}; }
  async set(items: Record<string, unknown>) {
    this.active += 1; this.maxActive = Math.max(this.maxActive, this.active);
    const marker = ((items[STORAGE_KEY] as StoredClaimState).claims[0]?.invoiceAmount ?? 0);
    await new Promise((resolve) => setTimeout(resolve, marker === 1 ? 5 : 0));
    this.value = { ...this.value, ...structuredClone(items) }; this.order.push(marker); this.active -= 1;
  }
}

describe("OEGK-STORAGE-001 through OEGK-STORAGE-007 local state", () => {
  it("initializes missing data and round-trips one validated versioned value", async () => {
    const area = new FakeArea(); const storage = new ChromeClaimStorage(area, () => T0);
    expect(await storage.read()).toEqual(empty());
    const state = { ...empty(), claims: [{ ...observation(), id: "local-v1-a", lastSeen: T0 }] as Claim[] };
    await storage.replace(state); expect(await storage.read()).toEqual(state);
  });

  it("preserves corrupt and future-version raw values by failing closed", async () => {
    for (const raw of [{ schemaVersion: 2 }, { ...empty(), rawHtml: "synthetic forbidden material" }]) {
      const area = new FakeArea(); area.value[STORAGE_KEY] = raw;
      const storage = new ChromeClaimStorage(area, () => T0);
      await expect(storage.loadSnapshot()).rejects.toThrow("Invalid local claim state");
      expect(area.value[STORAGE_KEY]).toEqual(raw);
    }
  });

  it("rejects noncanonical extra fields before writing", async () => {
    const area = new FakeArea(); const storage = new ChromeClaimStorage(area, () => T0);
    await expect(storage.replaceSnapshot({ ...empty(), diagnostics: {} } as unknown as StoredClaimState)).rejects.toThrow();
    expect(area.value).toEqual({});
  });

  it("round-trips closed snapshot metadata and rejects raw diagnostic metadata", async () => {
    const area = new FakeArea(); const storage = new ChromeClaimStorage(area, () => T0);
    const state: StoredClaimState = {
      ...empty(),
      metadata: { lastSnapshotAt: T0, lastExtractionState: "complete", lastObservedRange: { from: "2026-01-01", to: "2026-08-30" } },
    };
    await storage.replace(state); expect((await storage.read()).metadata).toEqual(state.metadata);
    await expect(storage.replace({ ...state, metadata: { ...state.metadata!, diagnostics: {} } } as unknown as StoredClaimState)).rejects.toThrow();
  });

  it("serializes concurrent atomic replacements", async () => {
    const area = new FakeArea(); const storage = new ChromeClaimStorage(area, () => T0);
    const state = (amount: number): StoredClaimState => ({ ...empty(), claims: [{ ...observation({ invoiceAmount: amount }), id: `local-v1-${amount}`, lastSeen: T0 }] });
    await Promise.all([storage.replaceSnapshot(state(1)), storage.replaceSnapshot(state(2))]);
    expect(area.maxActive).toBe(1); expect(area.order).toEqual([1, 2]); expect((await storage.read()).claims[0]!.invoiceAmount).toBe(2);
  });

  it("sorts open, unknown, closed then invoice date, lastSeen, and ID", () => {
    const claim = (id: string, status: Claim["status"], invoiceDate?: string): Claim => ({ id, status, source: "oegk", lastSeen: T0, ...(invoiceDate ? { invoiceDate } : {}) });
    expect(sortClaims([claim("c", "completed", "2026-08-01"), claim("u", "unknown"), claim("o2", "processing"), claim("o1", "submitted", "2026-08-02")]).map(({ id }) => id))
      .toEqual(["o1", "o2", "u", "c"]);
  });
});

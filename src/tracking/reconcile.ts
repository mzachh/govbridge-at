import { assertClaim, type Claim, type ClaimObservation } from "../domain/claim.js";
import type { ClaimStatusChangedEvent, ClaimStorage, ReconciliationInput, ReconciliationResult, StoredClaimState } from "./types.js";

export interface TrackerOptions { now?: () => string; randomId?: () => string; }
const optionalKeys = ["provider", "treatmentDate", "treatmentEndDate", "invoiceDate", "submittedDate", "reimbursementDate", "invoiceAmount", "reimbursementAmount", "responseAvailable"] as const;

function secureRandomId(): string {
  if (typeof crypto?.randomUUID !== "function") throw new Error("Secure local identity generation is unavailable.");
  return `local-v1-${crypto.randomUUID()}`;
}
function instant(clock: () => string): string {
  const value = clock();
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error("Invalid tracker clock.");
  return value;
}
export function stableFingerprint(claim: ClaimObservation | Claim): string | undefined {
  const parts: [string, string][] = [];
  if (claim.provider !== undefined) parts.push(["provider", claim.provider]);
  if (claim.invoiceDate !== undefined) parts.push(["invoiceDate", claim.invoiceDate]);
  if (claim.treatmentDate !== undefined) parts.push(["treatmentDate", claim.treatmentDate]);
  if (claim.treatmentEndDate !== undefined) parts.push(["treatmentEndDate", claim.treatmentEndDate]);
  if (claim.invoiceAmount !== undefined) parts.push(["invoiceAmount", claim.invoiceAmount.toFixed(2)]);
  return parts.length >= 2 && parts.some(([key]) => key !== "provider") ? `fp-v1:${parts.map(([key, value]) => `${key}=${value}`).join("|")}` : undefined;
}
function counts(values: readonly (ClaimObservation | Claim)[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const value of values) { const fp = stableFingerprint(value); if (fp) result.set(fp, (result.get(fp) ?? 0) + 1); }
  return result;
}
function identityParts(claim: ClaimObservation | Claim): Map<string, string> {
  const result = new Map<string, string>();
  if (claim.provider !== undefined) result.set("provider", claim.provider);
  if (claim.invoiceDate !== undefined) result.set("invoiceDate", claim.invoiceDate);
  if (claim.treatmentDate !== undefined) result.set("treatmentDate", claim.treatmentDate);
  if (claim.treatmentEndDate !== undefined) result.set("treatmentEndDate", claim.treatmentEndDate);
  if (claim.invoiceAmount !== undefined) result.set("invoiceAmount", claim.invoiceAmount.toFixed(2));
  return result;
}
function compatibleIdentity(current: ClaimObservation, stored: Claim): boolean {
  const left = identityParts(current), right = identityParts(stored);
  const common = [...left].filter(([key, value]) => right.get(key) === value);
  const conflict = [...left].some(([key, value]) => right.has(key) && right.get(key) !== value);
  return !conflict && common.length >= 2 && common.some(([key]) => key !== "provider");
}
function materialize(observation: ClaimObservation, id: string, observedAt: string): Claim {
  const claim: Claim = { id, status: observation.status, source: "oegk", lastSeen: observedAt };
  for (const key of optionalKeys) { const value = observation[key]; if (value !== undefined) Object.assign(claim, { [key]: value }); }
  assertClaim(claim); return claim;
}
function merge(previous: Claim, observation: ClaimObservation, observedAt: string): Claim {
  const result = { ...previous, ...materialize(observation, previous.id, observedAt), id: previous.id };
  assertClaim(result); return result;
}

export async function reconcileClaims(storage: ClaimStorage, input: ReconciliationInput, options: TrackerOptions = {}): Promise<ReconciliationResult> {
  const previous = await storage.loadSnapshot();
  const results = input.pageKind === "results" && ((input.state === "complete" && input.snapshotComplete) || input.state === "empty");
  const detail = input.pageKind === "open-rejected-detail" || input.pageKind === "reimbursed-detail";
  if ((!results && !detail) || (detail && input.observations.length !== 1)) return { state: previous, newEvents: [], committed: false, ambiguityCount: 0 };
  const observedAt = instant(options.now ?? (() => new Date().toISOString()));
  const currentCounts = counts(input.observations), storedCounts = counts(previous.claims);
  const next = new Map(previous.claims.map((claim) => [claim.id, claim]));
  const events: ClaimStatusChangedEvent[] = [];
  let ambiguityCount = 0, changed = false;
  for (const observation of input.observations) {
    const fp = stableFingerprint(observation);
    const currentUnique = fp !== undefined && currentCounts.get(fp) === 1;
    const compatible = previous.claims.filter((claim) => compatibleIdentity(observation, claim));
    const candidate = compatible.length === 1 ? compatible[0] : undefined;
    const candidateCurrentCount = candidate === undefined ? 0 : input.observations.filter((value) => compatibleIdentity(value, candidate)).length;
    const matched = currentUnique && candidateCurrentCount === 1 ? candidate : undefined;
    if (detail && !matched) { if (fp) ambiguityCount += 1; continue; }
    if (matched) {
      const merged = merge(matched, observation, observedAt); next.set(matched.id, merged); changed = true;
      if (matched.status !== merged.status) events.push({ type: "CLAIM_STATUS_CHANGED", claimId: matched.id, previousStatus: matched.status, newStatus: merged.status, observedAt });
    } else {
      if (fp && (!currentUnique || (storedCounts.get(fp) ?? 0) > 1)) ambiguityCount += 1;
      const id = (options.randomId ?? secureRandomId)();
      next.set(id, materialize(observation, id, observedAt)); changed = true;
    }
  }
  if (detail && !changed) return { state: previous, newEvents: [], committed: false, ambiguityCount };
  const metadata = results ? {
    lastSnapshotAt: observedAt,
    lastExtractionState: input.state as "complete" | "empty",
    ...(input.observedRange ? { lastObservedRange: input.observedRange } : {}),
  } : previous.metadata;
  const state: StoredClaimState = {
    schemaVersion: 1,
    claims: [...next.values()],
    events: [...previous.events, ...events],
    updatedAt: observedAt,
    ...(metadata ? { metadata } : {}),
  };
  await storage.replaceSnapshot(state);
  return { state, newEvents: events, committed: true, ambiguityCount };
}

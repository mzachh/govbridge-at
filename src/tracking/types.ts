import type { Claim, ClaimExtractionResult, ClaimStatus } from "../domain/claim.js";
export type { Claim, ClaimExtractionResult, ClaimObservation, ClaimStatus } from "../domain/claim.js";
export interface ClaimStatusChangedEvent { type: "CLAIM_STATUS_CHANGED"; claimId: string; previousStatus: ClaimStatus; newStatus: ClaimStatus; observedAt: string; }
export interface ObservationMetadata {
  lastSnapshotAt: string;
  lastExtractionState: "complete" | "empty";
  lastObservedRange?: { from: string; to: string };
}
export interface StoredClaimState { schemaVersion: 1; claims: Claim[]; events: ClaimStatusChangedEvent[]; updatedAt: string; metadata?: ObservationMetadata; }
export interface ClaimStorage { loadSnapshot(): Promise<StoredClaimState>; replaceSnapshot(state: StoredClaimState): Promise<void>; }
export interface ReconciliationResult { state: StoredClaimState; newEvents: ClaimStatusChangedEvent[]; committed: boolean; ambiguityCount: number; }
export type ReconciliationInput = ClaimExtractionResult;

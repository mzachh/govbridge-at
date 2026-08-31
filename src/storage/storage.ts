import type { StoredClaimState } from "../tracking/types.js";
export interface ClaimRepository { read(): Promise<StoredClaimState>; }
export interface ClaimStateStore extends ClaimRepository { replace(state: StoredClaimState): Promise<void>; }

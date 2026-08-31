import { CLAIM_STATUSES, type Claim } from "../domain/claim.js";
import type { ClaimStatusChangedEvent, StoredClaimState } from "../tracking/types.js";

const claimKeys = new Set([
  "id", "provider", "treatmentDate", "treatmentEndDate", "invoiceDate",
  "submittedDate", "reimbursementDate", "invoiceAmount",
  "reimbursementAmount", "status", "responseAvailable", "source", "lastSeen",
]);
const eventKeys = new Set([
  "type", "claimId", "previousStatus", "newStatus", "observedAt",
]);
const stateKeys = new Set(["schemaVersion", "claims", "events", "updatedAt", "metadata"]);
const metadataKeys = new Set(["lastSnapshotAt", "lastExtractionState", "lastObservedRange"]);
const datePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isInstant(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day;
}

function optionalString(value: Record<string, unknown>, key: string): boolean {
  return !(key in value) || (typeof value[key] === "string" && value[key] !== "");
}

function optionalDate(value: Record<string, unknown>, key: string): boolean {
  return !(key in value) || isCalendarDate(value[key]);
}

function optionalAmount(value: Record<string, unknown>, key: string): boolean {
  return !(key in value) || (typeof value[key] === "number" &&
    Number.isFinite(value[key]) && value[key] >= 0);
}

export function isClaim(value: unknown): value is Claim {
  if (!isRecord(value) || !hasOnlyKeys(value, claimKeys)) return false;
  return typeof value.id === "string" && value.id.length > 0 &&
    CLAIM_STATUSES.includes(value.status as never) && value.source === "oegk" &&
    isInstant(value.lastSeen) && optionalString(value, "provider") &&
    optionalDate(value, "treatmentDate") && optionalDate(value, "treatmentEndDate") &&
    optionalDate(value, "invoiceDate") && optionalDate(value, "submittedDate") &&
    optionalDate(value, "reimbursementDate") && optionalAmount(value, "invoiceAmount") &&
    optionalAmount(value, "reimbursementAmount") &&
    (!("responseAvailable" in value) || typeof value.responseAvailable === "boolean");
}

export function isStatusEvent(value: unknown): value is ClaimStatusChangedEvent {
  if (!isRecord(value) || !hasOnlyKeys(value, eventKeys)) return false;
  return value.type === "CLAIM_STATUS_CHANGED" &&
    typeof value.claimId === "string" && value.claimId.length > 0 &&
    CLAIM_STATUSES.includes(value.previousStatus as never) &&
    CLAIM_STATUSES.includes(value.newStatus as never) && isInstant(value.observedAt);
}

export function isStoredClaimState(value: unknown): value is StoredClaimState {
  if (!isRecord(value) || !hasOnlyKeys(value, stateKeys)) return false;
  const metadataValid = !("metadata" in value) || (
    isRecord(value.metadata) && hasOnlyKeys(value.metadata, metadataKeys) &&
    isInstant(value.metadata.lastSnapshotAt) &&
    (value.metadata.lastExtractionState === "complete" || value.metadata.lastExtractionState === "empty") &&
    (!("lastObservedRange" in value.metadata) || (
      isRecord(value.metadata.lastObservedRange) &&
      Object.keys(value.metadata.lastObservedRange).sort().join() === "from,to" &&
      isCalendarDate(value.metadata.lastObservedRange.from) &&
      isCalendarDate(value.metadata.lastObservedRange.to)
    ))
  );
  return metadataValid && value.schemaVersion === 1 && Array.isArray(value.claims) &&
    value.claims.every(isClaim) && new Set(value.claims.map((claim) => claim.id)).size === value.claims.length &&
    Array.isArray(value.events) && value.events.every(isStatusEvent) && isInstant(value.updatedAt);
}

export function assertStoredClaimState(value: unknown): asserts value is StoredClaimState {
  if (!isStoredClaimState(value)) throw new Error("Invalid local claim state.");
}

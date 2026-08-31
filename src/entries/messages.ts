import {
  CLAIM_STATUSES,
  normalizeEuroAmount,
  normalizeLocalDate,
  normalizeText,
  type ClaimExtractionResult,
  type ClaimObservation,
  type ClaimPageKind,
  type ExtractionState,
} from "../domain/claim.js";

export type ExtensionRequest =
  | { type: "claims.observe"; result: ClaimExtractionResult }
  | { type: "claims.read" }
  | { type: "dashboard.open" };

const STATES = new Set<ExtractionState>(["complete", "empty", "loading", "unsupported", "error"]);
const PAGE_KINDS = new Set<ClaimPageKind>(["type-range", "results", "open-rejected-detail", "reimbursed-detail"]);
const OBSERVATION_KEYS = new Set([
  "provider", "treatmentDate", "treatmentEndDate", "invoiceDate", "submittedDate",
  "reimbursementDate", "invoiceAmount", "reimbursementAmount", "status",
  "responseAvailable", "source", "transientSourceId",
]);
const RESULT_KEYS = new Set(["state", "pageKind", "snapshotComplete", "observations", "observedRange", "diagnostics"]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, keys: Set<string>): boolean {
  return Object.keys(value).every((key) => keys.has(key));
}

function validObservation(value: unknown): value is ClaimObservation {
  if (!record(value) || !onlyKeys(value, OBSERVATION_KEYS)) return false;
  if (value.source !== "oegk" || !CLAIM_STATUSES.includes(value.status as never)) return false;
  for (const key of ["treatmentDate", "treatmentEndDate", "invoiceDate", "submittedDate", "reimbursementDate"] as const) {
    if (key in value && normalizeLocalDate(value[key]) !== value[key]) return false;
  }
  for (const key of ["invoiceAmount", "reimbursementAmount"] as const) {
    if (key in value && (typeof value[key] !== "number" || normalizeEuroAmount(value[key]) !== value[key])) return false;
  }
  if ("provider" in value && normalizeText(value.provider) !== value.provider) return false;
  if ("transientSourceId" in value && normalizeText(value.transientSourceId) !== value.transientSourceId) return false;
  return !("responseAvailable" in value) || typeof value.responseAvailable === "boolean";
}

function validExtractionResult(value: unknown): value is ClaimExtractionResult {
  if (!record(value) || !onlyKeys(value, RESULT_KEYS)) return false;
  if (!STATES.has(value.state as ExtractionState) || typeof value.snapshotComplete !== "boolean") return false;
  if ("pageKind" in value && !PAGE_KINDS.has(value.pageKind as ClaimPageKind)) return false;
  if (!Array.isArray(value.observations) || !value.observations.every(validObservation)) return false;
  if (!record(value.diagnostics) || Object.keys(value.diagnostics).sort().join() !== "candidateCount,skippedCount") return false;
  if (typeof value.diagnostics.candidateCount !== "number" ||
      !Number.isInteger(value.diagnostics.candidateCount) || value.diagnostics.candidateCount < 0 ||
      typeof value.diagnostics.skippedCount !== "number" ||
      !Number.isInteger(value.diagnostics.skippedCount) || value.diagnostics.skippedCount < 0) return false;
  if ("observedRange" in value) {
    if (!record(value.observedRange) || Object.keys(value.observedRange).sort().join() !== "from,to") return false;
    if (normalizeLocalDate(value.observedRange.from) !== value.observedRange.from ||
        normalizeLocalDate(value.observedRange.to) !== value.observedRange.to) return false;
  }
  return true;
}

export function parseExtensionRequest(value: unknown): ExtensionRequest | undefined {
  if (!record(value) || typeof value.type !== "string") return undefined;
  if (value.type === "claims.read" || value.type === "dashboard.open") {
    return Object.keys(value).length === 1 ? value as ExtensionRequest : undefined;
  }
  if (value.type === "claims.observe" && Object.keys(value).length === 2 && validExtractionResult(value.result)) {
    return value as unknown as ExtensionRequest;
  }
  return undefined;
}

export function isSupportedMeineSvUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    return url.origin === "https://www.meinesv.at" && new Set([
      "/vsInfo/views/KE/einreichungTyp.xhtml",
      "/vsInfo/views/KE/einreichungListe.xhtml",
      "/vsInfo/views/KE/einreichungDetailOA.xhtml",
      "/vsInfo/views/KE/einreichungDetail.xhtml",
    ]).has(url.pathname);
  } catch {
    return false;
  }
}

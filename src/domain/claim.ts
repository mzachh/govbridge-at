export const CLAIM_STATUSES = [
  "submitted",
  "processing",
  "completed",
  "rejected",
  "unknown"
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export type ClaimClassification = "open" | "unknown" | "closed";

export interface Claim {
  id: string;
  provider?: string;
  treatmentDate?: string;
  treatmentEndDate?: string;
  invoiceDate?: string;
  submittedDate?: string;
  reimbursementDate?: string;
  invoiceAmount?: number;
  reimbursementAmount?: number;
  status: ClaimStatus;
  responseAvailable?: boolean;
  source: "oegk";
  lastSeen: string;
}

/** Adapter output before the live reader assigns snapshot identity and read time. */
export interface ClaimObservation {
  provider?: string;
  treatmentDate?: string;
  treatmentEndDate?: string;
  invoiceDate?: string;
  submittedDate?: string;
  reimbursementDate?: string;
  invoiceAmount?: number;
  reimbursementAmount?: number;
  status: ClaimStatus;
  responseAvailable?: boolean;
  source: "oegk";
  /** Transient evidence only; it is not a canonical Claim field. */
  transientSourceId?: string;
}

export type ExtractionState = "complete" | "empty" | "loading" | "unsupported" | "error";
export type ClaimPageKind = "type-range" | "results" | "open-rejected-detail" | "reimbursed-detail";

export interface ClaimExtractionResult {
  state: ExtractionState;
  pageKind?: ClaimPageKind;
  /** True when the rendered snapshot parsed fully; never account-wide coverage. */
  snapshotComplete: boolean;
  observations: ClaimObservation[];
  observedRange?: { from: string; to: string };
  diagnostics: { candidateCount: number; skippedCount: number };
}

const CLAIM_KEYS = new Set([
  "id", "provider", "treatmentDate", "treatmentEndDate", "invoiceDate",
  "submittedDate", "reimbursementDate", "invoiceAmount", "reimbursementAmount",
  "status", "responseAvailable", "source", "lastSeen"
]);
const DATE_KEYS = [
  "treatmentDate", "treatmentEndDate", "invoiceDate", "submittedDate", "reimbursementDate"
] as const;
const AMOUNT_KEYS = ["invoiceAmount", "reimbursementAmount"] as const;

export function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\s+/gu, " ");
  return normalized || undefined;
}

export function normalizeLocalDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  let year: number;
  let month: number;
  let day: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    year = Number(match[1]); month = Number(match[2]); day = Number(match[3]);
  } else {
    match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
    if (!match) return undefined;
    day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return undefined;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parses unambiguous EUR values in dot/comma decimal and grouped formats. */
export function normalizeEuroAmount(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : undefined;
  }
  if (typeof value !== "string") return undefined;
  let text = value.trim();
  if (!text || /(?:USD|GBP|CHF|\$|£)/iu.test(text)) return undefined;
  text = text.replace(/(?:EUR|€)/giu, "").replace(/[\u00a0\u202f ]/gu, "").trim();
  if (!text || text.startsWith("-") || /[^\d.,+]/u.test(text) || text.includes("+")) return undefined;

  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  let decimalSep: "," | "." | undefined;
  if (comma >= 0 && dot >= 0) {
    // Milestone one accepts Austrian grouping/decimal order only.
    if (dot > comma) return undefined;
    decimalSep = ",";
  }
  else if (comma >= 0) {
    const digits = text.length - comma - 1;
    if (digits <= 2) decimalSep = ",";
  } else if (dot >= 0) {
    const digits = text.length - dot - 1;
    if (digits <= 2) decimalSep = ".";
  }

  const groupingSep = decimalSep === "," ? "." : decimalSep === "." ? "," : undefined;
  const pieces = decimalSep ? text.split(decimalSep) : [text];
  if (pieces.length > 2) return undefined;
  const integerPart = pieces[0];
  const fraction = pieces[1];
  if (!integerPart || (fraction !== undefined && !/^\d{1,2}$/u.test(fraction))) return undefined;
  let integerDigits = integerPart;
  if (groupingSep && integerPart.includes(groupingSep)) {
    const groups = integerPart.split(groupingSep);
    if (!/^\d{1,3}$/u.test(groups[0] ?? "") || groups.slice(1).some((group) => !/^\d{3}$/u.test(group))) return undefined;
    integerDigits = groups.join("");
  } else if (!decimalSep && /[.,]/u.test(integerPart)) {
    const sep = integerPart.includes(".") ? "." : ",";
    const groups = integerPart.split(sep);
    if (!/^\d{1,3}$/u.test(groups[0] ?? "") || groups.slice(1).some((group) => !/^\d{3}$/u.test(group))) return undefined;
    integerDigits = groups.join("");
  }
  if (!/^\d+$/u.test(integerDigits)) return undefined;
  const result = Number(`${integerDigits}.${fraction ?? "0"}`);
  return Number.isFinite(result) ? Math.round(result * 100) / 100 : undefined;
}

export function classifyStatus(status: ClaimStatus): ClaimClassification {
  if (status === "submitted" || status === "processing") return "open";
  if (status === "unknown") return "unknown";
  return "closed";
}

function validInstant(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)) return false;
  const parsed = new Date(value);
  const canonical = value.includes(".") ? value : value.replace(/Z$/u, ".000Z");
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === canonical;
}

export function isClaim(value: unknown): value is Claim {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !CLAIM_KEYS.has(key))) return false;
  if (typeof record.id !== "string" || !record.id || record.source !== "oegk" ||
      !CLAIM_STATUSES.includes(record.status as ClaimStatus) || !validInstant(record.lastSeen)) return false;
  for (const key of DATE_KEYS) if (key in record && normalizeLocalDate(record[key]) !== record[key]) return false;
  for (const key of AMOUNT_KEYS) if (key in record && (typeof record[key] !== "number" || normalizeEuroAmount(record[key]) !== record[key])) return false;
  if ("provider" in record && normalizeText(record.provider) !== record.provider) return false;
  if ("responseAvailable" in record && typeof record.responseAvailable !== "boolean") return false;
  return true;
}

export const validateClaim = isClaim;
export const normalizeDate = normalizeLocalDate;
export const normalizeAmount = normalizeEuroAmount;

export function assertClaim(value: unknown): asserts value is Claim {
  if (!isClaim(value)) throw new TypeError("Invalid canonical claim.");
}

export function compareClaims(a: Claim, b: Claim): number {
  const rank = { open: 0, unknown: 1, closed: 2 } as const;
  const group = rank[classifyStatus(a.status)] - rank[classifyStatus(b.status)];
  if (group) return group;
  if (a.invoiceDate && !b.invoiceDate) return -1;
  if (!a.invoiceDate && b.invoiceDate) return 1;
  const invoiceOrder = (b.invoiceDate ?? "").localeCompare(a.invoiceDate ?? "");
  if (invoiceOrder) return invoiceOrder;
  const seenOrder = b.lastSeen.localeCompare(a.lastSeen);
  return seenOrder || a.id.localeCompare(b.id);
}

export function sortClaims(claims: readonly Claim[]): Claim[] {
  return [...claims].sort(compareClaims);
}

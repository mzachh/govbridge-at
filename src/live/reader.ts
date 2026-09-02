import { OegkAdapter } from "../adapter/oegk.js";
import { isClaim, type Claim, type ClaimObservation, type ClaimPageKind } from "../domain/claim.js";
import { isSearchPending } from "../actions/search-claims.js";
import type { ToolErrorCode, ToolResult } from "../webmcp/types.js";
import { isSearchPageUrl, SEARCH_PAGE_PATH } from "../webmcp/catalog.js";

export interface LivePage {
  scope: "current-page";
  pageKind: ClaimPageKind;
  readAt: string;
  completeness: "complete" | "partial";
  skippedCount: number;
  visibleRange?: { from: string; to: string };
}
export interface LiveSnapshot { claims: Claim[]; page: LivePage }
export interface LiveReader { read(): Promise<ToolResult<LiveSnapshot>> }

const nonces = new WeakMap<Document, string>();
const fields = ["provider", "treatmentDate", "treatmentEndDate", "invoiceDate", "submittedDate",
  "reimbursementDate", "invoiceAmount", "reimbursementAmount", "status", "responseAvailable", "source"] as const;

function permitted(observation: ClaimObservation): Omit<Claim, "id" | "lastSeen"> {
  // Fixed insertion order also supplies the canonical digest representation.
  return Object.fromEntries(fields.flatMap((key) => observation[key] === undefined ? [] : [[key, observation[key]]])) as Omit<Claim, "id" | "lastSeen">;
}
function failure(code: ToolErrorCode, message: string): ToolResult<never> {
  return { ok: false, error: { code, message } };
}

/** Only the document nonce survives calls; snapshots are invocation-local. */
export class LiveClaimReader implements LiveReader {
  constructor(private readonly pageDocument: Document) {}

  async read(): Promise<ToolResult<LiveSnapshot>> {
    const readAt = new Date().toISOString();
    try {
      const url = new URL(this.pageDocument.URL);
      if (url.origin !== "https://www.meinesv.at") return failure("UNSUPPORTED_PAGE", "Unsupported OEGK page.");
      if (isSearchPending(this.pageDocument)) return failure("PAGE_NOT_READY", "Search outcome is not yet confirmed. Do not automatically resubmit.");
      const location = { origin: url.origin, pathname: isSearchPageUrl(url.href) ? SEARCH_PAGE_PATH : url.pathname };
      const result = await new OegkAdapter({ document: this.pageDocument, location }).extractClaims();
      if (result.state === "unsupported") return failure("UNSUPPORTED_PAGE", "Unsupported OEGK page.");
      if (result.state === "loading" || (result.pageKind === "type-range" && result.state === "complete")) {
        return failure("PAGE_NOT_READY", "The current page has no ready search results.");
      }
      if (result.state === "error" || !result.pageKind) return failure("EXTRACTION_FAILED", "The current page could not be read or reports a validation error.");
      const observations = result.observations.map(permitted);
      if (observations.some((observation) => !isClaim({ ...observation, id: "validation", lastSeen: readAt }))) {
        return failure("EXTRACTION_FAILED", "The current page contains invalid claim data.");
      }
      let nonce = nonces.get(this.pageDocument);
      if (!nonce) { nonce = crypto.randomUUID(); nonces.set(this.pageDocument, nonce); }
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(observations)));
      const digest = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
      // A search may have started while hashing. Never release retained results in that case.
      if (isSearchPending(this.pageDocument)) return failure("PAGE_NOT_READY", "A search is in progress.");
      const page: LivePage = {
        scope: "current-page", pageKind: result.pageKind, readAt,
        completeness: result.diagnostics.skippedCount ? "partial" : "complete",
        skippedCount: result.diagnostics.skippedCount,
        ...(result.observedRange ? { visibleRange: { ...result.observedRange } } : {}),
      };
      return { ok: true, data: { page, claims: observations.map((observation, index) => ({
        ...observation, id: `live-v1-${nonce}-${digest}-${index}`, lastSeen: readAt,
      })) } };
    } catch {
      return failure("EXTRACTION_FAILED", "The current page could not be read.");
    }
  }
}

import { summarizeInvoiceYear } from "../domain/claim.js";
import {
  CLAIM_TOOL_CATALOG,
  isValidClaimToolInput,
  type ClaimToolName,
} from "./catalog.js";
import type { ToolErrorCode, ToolResult } from "./types.js";
import type { LiveReader } from "../live/reader.js";

type Handler = (input: unknown) => Promise<ToolResult<unknown>>;

export interface ReadOnlyClaimTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: Handler;
}

function failure(
  code: ToolErrorCode,
  message: string,
): ToolResult<never> {
  return { ok: false, error: { code, message } };
}

export function createReadOnlyClaimTools(reader: LiveReader): readonly ReadOnlyClaimTool[] {
  const catalog = Object.fromEntries(CLAIM_TOOL_CATALOG.map((tool) => [tool.name, tool])) as Record<
    ClaimToolName,
    (typeof CLAIM_TOOL_CATALOG)[number]
  >;
  const listClaims: ReadOnlyClaimTool = {
    ...catalog.list_claims,
    async execute(input) {
      if (!isValidClaimToolInput("list_claims", input)) return failure("INVALID_INPUT", "Invalid input.");
      const result = await reader.read();
      if (!result.ok) return result;
      return { ok: true, data: { claims: result.data.claims, count: result.data.claims.length, page: result.data.page } };
    },
  };

  const getOpenClaims: ReadOnlyClaimTool = {
    ...catalog.get_open_claims,
    async execute(input) {
      if (!isValidClaimToolInput("get_open_claims", input)) return failure("INVALID_INPUT", "Invalid input.");
      const result = await reader.read();
      if (!result.ok) return result;
      const claims = result.data.claims.filter(
        ({ status }) => status === "submitted" || status === "processing",
      );
      return { ok: true, data: { claims, count: claims.length, page: result.data.page } };
    },
  };

  const getClaim: ReadOnlyClaimTool = {
    ...catalog.get_claim,
    async execute(input) {
      if (!isValidClaimToolInput("get_claim", input)) return failure("INVALID_INPUT", "Invalid input.");
      const claimId = input.claimId;
      const result = await reader.read();
      if (!result.ok) return result;
      const claim = result.data.claims.find(({ id }) => id === claimId);
      if (!claim) return failure("NOT_FOUND", "Claim ID is absent or expired. List the current page again.");
      return { ok: true, data: { claim, page: result.data.page } };
    },
  };

  const getReimbursementSummary: ReadOnlyClaimTool = {
    ...catalog.get_reimbursement_summary,
    async execute(input) {
      if (!isValidClaimToolInput("get_reimbursement_summary", input)) return failure("INVALID_INPUT", "Invalid input.");
      const year = input.year as number;
      const result = await reader.read();
      if (!result.ok) return result;
      return { ok: true, data: { ...summarizeInvoiceYear(result.data.claims, year), page: result.data.page } };
    },
  };

  return Object.freeze([listClaims, getOpenClaims, getClaim, getReimbursementSummary]);
}

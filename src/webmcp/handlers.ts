import { summarizeInvoiceYear } from "../domain/claim.js";
import {
  CLAIM_TOOL_CATALOG,
  isValidClaimToolInput,
  type ClaimToolName,
} from "./catalog.js";
import type { Claim, ClaimRepository, ToolResult } from "./types.js";

type Handler = (input: unknown) => Promise<ToolResult<unknown>>;

export interface ReadOnlyClaimTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: Handler;
}

export class StorageUnavailableError extends Error {
  override readonly name = "StorageUnavailableError";
}

function failure(
  code: "INVALID_INPUT" | "NOT_FOUND" | "STORAGE_UNAVAILABLE" | "INTERNAL_ERROR",
  message: string,
): ToolResult<never> {
  return { ok: false, error: { code, message } };
}

function copyClaims(claims: readonly Claim[]): Claim[] {
  return claims.map((claim) => ({ ...claim }));
}

async function readClaims(repository: ClaimRepository): Promise<ToolResult<Claim[]>> {
  try {
    return { ok: true, data: copyClaims((await repository.read()).claims) };
  } catch (error: unknown) {
    void error;
    return failure("STORAGE_UNAVAILABLE", "Local claim storage is unavailable.");
  }
}

export function createReadOnlyClaimTools(repository: ClaimRepository): readonly ReadOnlyClaimTool[] {
  const catalog = Object.fromEntries(CLAIM_TOOL_CATALOG.map((tool) => [tool.name, tool])) as Record<
    ClaimToolName,
    (typeof CLAIM_TOOL_CATALOG)[number]
  >;
  const listClaims: ReadOnlyClaimTool = {
    ...catalog.list_claims,
    async execute(input) {
      if (!isValidClaimToolInput("list_claims", input)) return failure("INVALID_INPUT", "Invalid input.");
      const result = await readClaims(repository);
      if (!result.ok) return result;
      return { ok: true, data: { claims: result.data, count: result.data.length } };
    },
  };

  const getOpenClaims: ReadOnlyClaimTool = {
    ...catalog.get_open_claims,
    async execute(input) {
      if (!isValidClaimToolInput("get_open_claims", input)) return failure("INVALID_INPUT", "Invalid input.");
      const result = await readClaims(repository);
      if (!result.ok) return result;
      const claims = result.data.filter(
        ({ status }) => status === "submitted" || status === "processing",
      );
      return { ok: true, data: { claims, count: claims.length } };
    },
  };

  const getClaim: ReadOnlyClaimTool = {
    ...catalog.get_claim,
    async execute(input) {
      if (!isValidClaimToolInput("get_claim", input)) return failure("INVALID_INPUT", "Invalid input.");
      const claimId = input.claimId;
      const result = await readClaims(repository);
      if (!result.ok) return result;
      const claim = result.data.find(({ id }) => id === claimId);
      if (!claim) return failure("NOT_FOUND", "Claim not found.");
      return { ok: true, data: { claim } };
    },
  };

  const getReimbursementSummary: ReadOnlyClaimTool = {
    ...catalog.get_reimbursement_summary,
    async execute(input) {
      if (!isValidClaimToolInput("get_reimbursement_summary", input)) return failure("INVALID_INPUT", "Invalid input.");
      const year = input.year as number;
      const result = await readClaims(repository);
      if (!result.ok) return result;
      return { ok: true, data: summarizeInvoiceYear(result.data, year) };
    },
  };

  return Object.freeze([listClaims, getOpenClaims, getClaim, getReimbursementSummary]);
}

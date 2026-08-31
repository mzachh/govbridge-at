import { summarizeInvoiceYear } from "../domain/claim.js";
import type { Claim, ClaimRepository, ToolResult } from "./types.js";

const EMPTY_INPUT_SCHEMA = Object.freeze({
  type: "object",
  properties: Object.freeze({}),
  additionalProperties: false,
});

const CLAIM_ID_INPUT_SCHEMA = Object.freeze({
  type: "object",
  required: Object.freeze(["claimId"]),
  properties: Object.freeze({
    claimId: Object.freeze({ type: "string", minLength: 1, maxLength: 256 }),
  }),
  additionalProperties: false,
});

const YEAR_INPUT_SCHEMA = Object.freeze({
  type: "object",
  required: Object.freeze(["year"]),
  properties: Object.freeze({
    year: Object.freeze({ type: "integer", minimum: 2000, maximum: 2100 }),
  }),
  additionalProperties: false,
});

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

function isExactObject(input: unknown, keys: readonly string[]): input is Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return false;
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const actual = Object.keys(input);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
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
  const listClaims: ReadOnlyClaimTool = {
    name: "list_claims",
    description: "List all locally observed OEGK claims in deterministic order.",
    inputSchema: EMPTY_INPUT_SCHEMA,
    async execute(input) {
      if (!isExactObject(input, [])) return failure("INVALID_INPUT", "Invalid input.");
      const result = await readClaims(repository);
      if (!result.ok) return result;
      return { ok: true, data: { claims: result.data, count: result.data.length } };
    },
  };

  const getOpenClaims: ReadOnlyClaimTool = {
    name: "get_open_claims",
    description: "List locally observed OEGK claims whose status is submitted or processing.",
    inputSchema: EMPTY_INPUT_SCHEMA,
    async execute(input) {
      if (!isExactObject(input, [])) return failure("INVALID_INPUT", "Invalid input.");
      const result = await readClaims(repository);
      if (!result.ok) return result;
      const claims = result.data.filter(
        ({ status }) => status === "submitted" || status === "processing",
      );
      return { ok: true, data: { claims, count: claims.length } };
    },
  };

  const getClaim: ReadOnlyClaimTool = {
    name: "get_claim",
    description: "Get one locally observed OEGK claim by its canonical claim ID.",
    inputSchema: CLAIM_ID_INPUT_SCHEMA,
    async execute(input) {
      if (!isExactObject(input, ["claimId"])) return failure("INVALID_INPUT", "Invalid input.");
      const claimId = input.claimId;
      if (typeof claimId !== "string" || claimId.length < 1 || claimId.length > 256) {
        return failure("INVALID_INPUT", "Invalid claim ID.");
      }
      const result = await readClaims(repository);
      if (!result.ok) return result;
      const claim = result.data.find(({ id }) => id === claimId);
      if (!claim) return failure("NOT_FOUND", "Claim not found.");
      return { ok: true, data: { claim } };
    },
  };

  const getReimbursementSummary: ReadOnlyClaimTool = {
    name: "get_reimbursement_summary",
    description:
      "Summarize known invoice and reimbursement amounts for OEGK claims with an invoice date in one year.",
    inputSchema: YEAR_INPUT_SCHEMA,
    async execute(input) {
      if (!isExactObject(input, ["year"])) return failure("INVALID_INPUT", "Invalid input.");
      const year = input.year;
      if (!Number.isInteger(year) || typeof year !== "number" || year < 2000 || year > 2100) {
        return failure("INVALID_INPUT", "Invalid year.");
      }
      const result = await readClaims(repository);
      if (!result.ok) return result;
      return { ok: true, data: summarizeInvoiceYear(result.data, year) };
    },
  };

  return Object.freeze([listClaims, getOpenClaims, getClaim, getReimbursementSummary]);
}

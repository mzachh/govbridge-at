export const EMPTY_INPUT_SCHEMA = Object.freeze({
  type: "object",
  properties: Object.freeze({}),
  additionalProperties: false,
});

export const CLAIM_ID_INPUT_SCHEMA = Object.freeze({
  type: "object",
  required: Object.freeze(["claimId"]),
  properties: Object.freeze({
    claimId: Object.freeze({ type: "string", minLength: 1, maxLength: 256 }),
  }),
  additionalProperties: false,
});

export const YEAR_INPUT_SCHEMA = Object.freeze({
  type: "object",
  required: Object.freeze(["year"]),
  properties: Object.freeze({
    year: Object.freeze({ type: "integer", minimum: 2000, maximum: 2100 }),
  }),
  additionalProperties: false,
});

export const CLAIM_TOOL_CATALOG = Object.freeze([
  Object.freeze({
    name: "list_claims",
    description: "List all locally observed OEGK claims in deterministic order.",
    inputSchema: EMPTY_INPUT_SCHEMA,
  }),
  Object.freeze({
    name: "get_open_claims",
    description: "List locally observed OEGK claims whose status is submitted or processing.",
    inputSchema: EMPTY_INPUT_SCHEMA,
  }),
  Object.freeze({
    name: "get_claim",
    description: "Get one locally observed OEGK claim by its canonical claim ID.",
    inputSchema: CLAIM_ID_INPUT_SCHEMA,
  }),
  Object.freeze({
    name: "get_reimbursement_summary",
    description:
      "Summarize known invoice and reimbursement amounts for OEGK claims with an invoice date in one year.",
    inputSchema: YEAR_INPUT_SCHEMA,
  }),
] as const);

export type ClaimToolName = (typeof CLAIM_TOOL_CATALOG)[number]["name"];

const CLAIM_TOOL_NAMES = new Set<string>(CLAIM_TOOL_CATALOG.map(({ name }) => name));

export function isClaimToolName(value: unknown): value is ClaimToolName {
  return typeof value === "string" && CLAIM_TOOL_NAMES.has(value);
}

function isExactObject(input: unknown, keys: readonly string[]): input is Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return false;
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const actual = Object.keys(input);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

export function isValidClaimToolInput(tool: ClaimToolName, input: unknown): input is Record<string, unknown> {
  if (tool === "list_claims" || tool === "get_open_claims") return isExactObject(input, []);
  if (tool === "get_claim") {
    return isExactObject(input, ["claimId"]) &&
      typeof input.claimId === "string" && input.claimId.length >= 1 && input.claimId.length <= 256;
  }
  return isExactObject(input, ["year"]) && typeof input.year === "number" &&
    Number.isInteger(input.year) && input.year >= 2000 && input.year <= 2100;
}

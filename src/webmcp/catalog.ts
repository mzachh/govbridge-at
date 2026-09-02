import { resolveSiteContext, SYNTHETIC_DEMO_NOTICE, type SiteBuildProfile, type SiteContext } from "../environment/site-context.js";

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

export const CLAIM_TOOL_CATALOG = Object.freeze([
  Object.freeze({
    name: "list_claims",
    description: "Read OEGK claims rendered on the current page now, in page order. No refresh or stored history. Results include current-page completeness; IDs are temporary.",
    inputSchema: EMPTY_INPUT_SCHEMA,
  }),
  Object.freeze({
    name: "get_open_claims",
    description: "Read the current OEGK page and return claims whose status is submitted or processing. Current-page scope only.",
    inputSchema: EMPTY_INPUT_SCHEMA,
  }),
  Object.freeze({
    name: "get_claim",
    description: "Read the current OEGK page and find a temporary snapshot claim ID. Never navigates. If NOT_FOUND, list again.",
    inputSchema: CLAIM_ID_INPUT_SCHEMA,
  }),
] as const);

export type ClaimToolName = (typeof CLAIM_TOOL_CATALOG)[number]["name"];

export const SEARCH_PAGE_PATH = "/vsInfo/views/KE/einreichungTyp.xhtml";
export const SEARCH_ENTRY_PATH = "/vsInfo/views/KE/";
export const SEARCH_RESULTS_PATH = "/vsInfo/views/KE/einreichungListe.xhtml";
const SEARCH_CONTENT_ID = "10007.815943";
export const SEARCH_TOOL = Object.freeze({
  name: "search_claims",
  description: "Request a Wahlarzt / Wahltherapeut search on MeineSV for inclusive ISO dates, at most five calendar years. Registered on query and results routes; execution requires the validated query form or retained results-range form. Submits the current form once; does not return claims or confirm success. Navigation may return null or destroy execution. Never automatically retry an uncertain submission; cancellation cannot undo a dispatched click.",
  inputSchema: Object.freeze({
    type: "object",
    required: Object.freeze(["from", "to"]),
    properties: Object.freeze({
      from: Object.freeze({ type: "string", format: "date", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" }),
      to: Object.freeze({ type: "string", format: "date", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" }),
    }),
    additionalProperties: false,
  }),
} as const);

export const PAGE_TOOL_CATALOG = Object.freeze([...CLAIM_TOOL_CATALOG, SEARCH_TOOL]);
export type PageToolName = (typeof PAGE_TOOL_CATALOG)[number]["name"];

type PageToolDefinition = (typeof PAGE_TOOL_CATALOG)[number];

function catalogForContext(
  catalog: readonly PageToolDefinition[],
  context: SiteContext | undefined,
): readonly PageToolDefinition[] {
  if (context?.environment !== "demo") return catalog;
  return Object.freeze(catalog.map((tool) => Object.freeze({
    ...tool,
    description: `${tool.description} ${SYNTHETIC_DEMO_NOTICE} It is not evidence of official medical or financial data provenance.`,
  }))) as unknown as readonly PageToolDefinition[];
}

export function isSearchPageUrl(rawUrl: string | undefined, profile?: SiteBuildProfile): boolean {
  try {
    const url = new URL(rawUrl ?? "");
    return resolveSiteContext(url, profile) !== undefined &&
      (url.pathname === SEARCH_PAGE_PATH ||
        (url.pathname === SEARCH_ENTRY_PATH && url.searchParams.get("contentid") === SEARCH_CONTENT_ID));
  } catch {
    return false;
  }
}

export function isSearchResultsUrl(rawUrl: string | undefined, profile?: SiteBuildProfile): boolean {
  try {
    const url = new URL(rawUrl ?? "");
    return resolveSiteContext(url, profile) !== undefined && url.pathname === SEARCH_RESULTS_PATH;
  } catch {
    return false;
  }
}

/** Routes where the search action is discoverable; execution remains form-scoped. */
export function isSearchToolUrl(rawUrl: string | undefined, profile?: SiteBuildProfile): boolean {
  return isSearchPageUrl(rawUrl, profile) || isSearchResultsUrl(rawUrl, profile);
}

/** One shared source for registration and discovery metadata. */
export function pageToolCatalog(
  rawUrl?: string,
  profile?: SiteBuildProfile,
): readonly (typeof PAGE_TOOL_CATALOG)[number][] {
  const context = rawUrl === undefined ? undefined : resolveSiteContext(rawUrl, profile);
  const catalog = isSearchToolUrl(rawUrl, profile) ? PAGE_TOOL_CATALOG : CLAIM_TOOL_CATALOG;
  return catalogForContext(catalog, context);
}

export function isPageToolName(value: unknown): value is PageToolName {
  return value === "search_claims" || isClaimToolName(value);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function isValidSearchInput(input: unknown): input is { from: string; to: string } {
  if (!isExactObject(input, ["from", "to"]) || !calendarDate(input.from) || !calendarDate(input.to)) return false;
  const [year, month, day] = input.from.split("-").map(Number) as [number, number, number];
  // Compare numeric calendar components, including anniversaries after year 9999.
  const lastDay = Math.min(day, daysInMonth(year + 5, month));
  const [toYear, toMonth, toDay] = input.to.split("-").map(Number) as [number, number, number];
  return input.from <= input.to &&
    toYear * 10000 + toMonth * 100 + toDay <= (year + 5) * 10000 + month * 100 + lastDay;
}

export function isValidPageToolInput(tool: PageToolName, input: unknown): input is Record<string, unknown> {
  return tool === "search_claims" ? isValidSearchInput(input) : isValidClaimToolInput(tool, input);
}

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
  return false;
}

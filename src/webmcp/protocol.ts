import {
  isPageToolName,
  isValidPageToolInput,
  type PageToolName,
} from "./catalog.js";
import type { ToolResult } from "./types.js";

export const WEBMCP_BRIDGE_PROTOCOL = "oegk-claim-tracker.webmcp";
export const WEBMCP_BRIDGE_VERSION = 1;
export const WEBMCP_REQUEST_TIMEOUT_MS = 10_000;
const MAX_REQUEST_ID_LENGTH = 128;
const MAX_FRAME_LENGTH = 5_000_000;

export interface WebMcpBridgeRequest {
  protocol: typeof WEBMCP_BRIDGE_PROTOCOL;
  version: typeof WEBMCP_BRIDGE_VERSION;
  direction: "request";
  requestId: string;
  tool: PageToolName;
  input: Record<string, unknown>;
}

export interface WebMcpBridgeResponse {
  protocol: typeof WEBMCP_BRIDGE_PROTOCOL;
  version: typeof WEBMCP_BRIDGE_VERSION;
  direction: "response";
  requestId: string;
  result: ToolResult<unknown>;
}

function record(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function validRequestId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= MAX_REQUEST_ID_LENGTH;
}

function jsonCompatible(value: unknown, depth = 0): boolean {
  if (depth > 24) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => jsonCompatible(item, depth + 1));
  if (!record(value)) return false;
  return Object.entries(value).every(([key, item]) => key !== "__proto__" && jsonCompatible(item, depth + 1));
}

function withinFrameLimit(value: unknown): boolean {
  try {
    return JSON.stringify(value).length <= MAX_FRAME_LENGTH;
  } catch {
    return false;
  }
}

export function isToolResult(value: unknown): value is ToolResult<unknown> {
  if (!record(value) || typeof value.ok !== "boolean") return false;
  if (value.ok) {
    return onlyKeys(value, ["ok", "data"]) && jsonCompatible(value.data) && withinFrameLimit(value);
  }
  if (!onlyKeys(value, ["ok", "error"]) || !record(value.error) ||
      !onlyKeys(value.error, ["code", "message"])) return false;
  return new Set(["INVALID_INPUT", "NOT_FOUND", "STORAGE_UNAVAILABLE", "INTERNAL_ERROR", "UNSUPPORTED_PAGE", "FORM_UNAVAILABLE", "SEARCH_IN_PROGRESS"]).has(
    String(value.error.code),
  ) && typeof value.error.message === "string" && value.error.message.length <= 256 && withinFrameLimit(value);
}

export function parseBridgeRequest(value: unknown): WebMcpBridgeRequest | undefined {
  if (!record(value) || !onlyKeys(value, ["protocol", "version", "direction", "requestId", "tool", "input"])) {
    return undefined;
  }
  if (value.protocol !== WEBMCP_BRIDGE_PROTOCOL || value.version !== WEBMCP_BRIDGE_VERSION ||
      value.direction !== "request" || !validRequestId(value.requestId) ||
      !isPageToolName(value.tool) || !isValidPageToolInput(value.tool, value.input) ||
      !withinFrameLimit(value)) return undefined;
  return value as unknown as WebMcpBridgeRequest;
}

export function parseBridgeResponse(value: unknown): WebMcpBridgeResponse | undefined {
  if (!record(value) || !onlyKeys(value, ["protocol", "version", "direction", "requestId", "result"])) {
    return undefined;
  }
  if (value.protocol !== WEBMCP_BRIDGE_PROTOCOL || value.version !== WEBMCP_BRIDGE_VERSION ||
      value.direction !== "response" || !validRequestId(value.requestId) || !isToolResult(value.result) ||
      !withinFrameLimit(value)) return undefined;
  return value as unknown as WebMcpBridgeResponse;
}

export function createBridgeRequest(
  requestId: string,
  tool: PageToolName,
  input: Record<string, unknown>,
): WebMcpBridgeRequest {
  return {
    protocol: WEBMCP_BRIDGE_PROTOCOL,
    version: WEBMCP_BRIDGE_VERSION,
    direction: "request",
    requestId,
    tool,
    input,
  };
}

export function createBridgeResponse(
  requestId: string,
  result: ToolResult<unknown>,
): WebMcpBridgeResponse {
  return {
    protocol: WEBMCP_BRIDGE_PROTOCOL,
    version: WEBMCP_BRIDGE_VERSION,
    direction: "response",
    requestId,
    result,
  };
}

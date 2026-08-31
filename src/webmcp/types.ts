import type { Claim } from "../domain/claim.js";
import type { ClaimRepository } from "../storage/storage.js";

export type { Claim, ClaimStatus } from "../domain/claim.js";
export type { ClaimRepository } from "../storage/storage.js";

export type ToolErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "STORAGE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ToolErrorCode; message: string } };

export interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: true };
  execute(input: object, options?: { signal?: AbortSignal }): Promise<unknown>;
}

export interface ModelContextLike {
  registerTool(
    tool: WebMcpToolDefinition,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
}

export interface WebMcpDocumentLike {
  modelContext?: ModelContextLike;
}

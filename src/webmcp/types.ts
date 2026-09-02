export type { Claim, ClaimStatus } from "../domain/claim.js";

export type ToolErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "PAGE_NOT_READY"
  | "EXTRACTION_FAILED"
  | "UNSUPPORTED_PAGE"
  | "FORM_UNAVAILABLE"
  | "SEARCH_IN_PROGRESS"
  | "INTERNAL_ERROR";

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ToolErrorCode; message: string } };

export interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean };
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

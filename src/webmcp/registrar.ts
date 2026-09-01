import { CLAIM_TOOL_CATALOG, isValidClaimToolInput, type ClaimToolName } from "./catalog.js";
import type { WebMcpDocumentLike, WebMcpToolDefinition } from "./types.js";

export type RegistrationResult =
  | { available: false; reason: "unsupported" | "rejected" }
  | { available: true; dispose(): void };

const registrations = new WeakMap<object, AbortController>();

export type ToolExecutor = (
  tool: ClaimToolName,
  input: Record<string, unknown>,
) => Promise<unknown>;

export async function registerPageTools(
  pageDocument: WebMcpDocumentLike,
  execute: ToolExecutor,
): Promise<RegistrationResult> {
  const context = pageDocument.modelContext;
  if (!context || typeof context.registerTool !== "function") {
    return { available: false, reason: "unsupported" };
  }

  const owner = pageDocument as object;
  const existing = registrations.get(owner);
  if (existing && !existing.signal.aborted) {
    return { available: true, dispose: () => existing.abort() };
  }

  const controller = new AbortController();
  try {
    for (const tool of CLAIM_TOOL_CATALOG) {
      const definition: WebMcpToolDefinition = {
        ...tool,
        // The compatibility runtime annotates schemas during validation.
        // Keep the canonical catalog frozen and give each registration a detached copy.
        inputSchema: structuredClone(tool.inputSchema),
        annotations: { readOnlyHint: true },
        execute: async (input) => {
          if (!isValidClaimToolInput(tool.name, input)) {
            return { ok: false, error: { code: "INVALID_INPUT", message: "Invalid input." } };
          }
          return execute(tool.name, input as Record<string, unknown>);
        },
      };
      await context.registerTool(definition, { signal: controller.signal });
    }
    registrations.set(owner, controller);
    return {
      available: true,
      dispose() {
        controller.abort();
        registrations.delete(owner);
      },
    };
  } catch {
    controller.abort();
    registrations.delete(owner);
    return { available: false, reason: "rejected" };
  }
}

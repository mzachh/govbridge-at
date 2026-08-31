import { createReadOnlyClaimTools } from "./handlers.js";
import type { ClaimRepository, WebMcpDocumentLike, WebMcpToolDefinition } from "./types.js";

export type RegistrationResult =
  | { available: false; reason: "unsupported" | "rejected" }
  | { available: true; dispose(): void };

const registrations = new WeakMap<object, AbortController>();

/**
 * Registers tools only on the explicitly supplied extension-owned document.
 * Callers must never pass a host-page document or a content-script bridge.
 */
export async function registerExtensionPageTools(
  extensionDocument: WebMcpDocumentLike,
  repository: ClaimRepository,
): Promise<RegistrationResult> {
  const context = extensionDocument.modelContext;
  if (!context || typeof context.registerTool !== "function") {
    return { available: false, reason: "unsupported" };
  }

  const owner = extensionDocument as object;
  const existing = registrations.get(owner);
  if (existing && !existing.signal.aborted) {
    return { available: true, dispose: () => existing.abort() };
  }

  const controller = new AbortController();
  try {
    for (const tool of createReadOnlyClaimTools(repository)) {
      const definition: WebMcpToolDefinition = {
        ...tool,
        annotations: { readOnlyHint: true },
        execute: async (input, options) => {
          if (options?.signal?.aborted) throw new DOMException("Operation aborted.", "AbortError");
          return tool.execute(input);
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

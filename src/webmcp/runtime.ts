import { createPageBridgeClient } from "./page-client.js";
import { registerPageTools, type RegistrationResult } from "./registrar.js";
import type { WebMcpDocumentLike } from "./types.js";

export type LoadCompatibilityRuntime = () => Promise<void>;

export type BridgeRuntimeResult =
  | { available: false; reason: "unsupported" | "rejected" }
  | { available: true; runtime: "native" | "polyfill"; dispose(): void };

export async function startWebMcpBridge(
  pageDocument: WebMcpDocumentLike,
  pageWindow: Window,
  loadCompatibilityRuntime: LoadCompatibilityRuntime,
): Promise<BridgeRuntimeResult> {
  let runtime: "native" | "polyfill" = "native";
  if (!pageDocument.modelContext || typeof pageDocument.modelContext.registerTool !== "function") {
    runtime = "polyfill";
    try {
      await loadCompatibilityRuntime();
    } catch {
      return { available: false, reason: "unsupported" };
    }
  }
  if (!pageDocument.modelContext || typeof pageDocument.modelContext.registerTool !== "function") {
    return { available: false, reason: "unsupported" };
  }

  const client = createPageBridgeClient(pageWindow);
  const registration: RegistrationResult = await registerPageTools(
    pageDocument,
    (tool, input) => client.execute(tool, input),
  );
  if (!registration.available) {
    client.dispose();
    return registration;
  }
  return {
    available: true,
    runtime,
    dispose() {
      registration.dispose();
      client.dispose();
    },
  };
}

export function disposeOnFinalPageHide(pageWindow: Window, dispose: () => void): () => void {
  const onPageHide = (event: PageTransitionEvent): void => {
    if (event.persisted) return;
    pageWindow.removeEventListener("pagehide", onPageHide);
    dispose();
  };
  pageWindow.addEventListener("pagehide", onPageHide);
  return () => pageWindow.removeEventListener("pagehide", onPageHide);
}

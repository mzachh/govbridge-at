import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanupWebMCPPolyfill,
  initializeWebMCPPolyfill,
} from "@mcp-b/webmcp-polyfill";
import { registerPageTools } from "../src/webmcp/registrar.js";
import type { WebMcpDocumentLike } from "../src/webmcp/types.js";

interface PolyfillContext {
  getTools(): Promise<Array<{ name: string }>>;
  executeTool(tool: { name: string }, input: string): Promise<unknown>;
}

afterEach(() => cleanupWebMCPPolyfill());

describe("OEGK-BRIDGE-001 packaged compatibility runtime", () => {
  it("installs locally, exposes the four contracts, executes a proxy, and cleans up", async () => {
    cleanupWebMCPPolyfill();
    initializeWebMCPPolyfill({ installTestingShim: false });
    const pageDocument = document as Document & WebMcpDocumentLike & { modelContext: PolyfillContext };
    expect(pageDocument.modelContext).toBeDefined();
    expect((navigator as Navigator & { modelContextTesting?: unknown }).modelContextTesting).toBeUndefined();

    const execute = vi.fn(async (tool: string) => ({ ok: true, data: { tool } }));
    const registration = await registerPageTools(pageDocument, execute);
    expect(registration.available).toBe(true);
    const tools = await pageDocument.modelContext.getTools();
    expect(tools.map(({ name }) => name)).toEqual([
      "list_claims", "get_open_claims", "get_claim", "get_reimbursement_summary",
    ]);
    const serialized = await pageDocument.modelContext.executeTool(tools[0]!, "{}");
    expect(JSON.parse(String(serialized))).toEqual({ ok: true, data: { tool: "list_claims" } });
    expect(execute).toHaveBeenCalledWith("list_claims", {});
    if (registration.available) registration.dispose();
  });
});

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
  it("exposes the four-tool search-page catalog and executes its action proxy", async () => {
    cleanupWebMCPPolyfill();
    initializeWebMCPPolyfill({ installTestingShim: false });
    const pageDocument = document as Document & WebMcpDocumentLike & { modelContext: PolyfillContext };
    const execute = vi.fn(async () => ({ ok: true, data: { status: "submission_requested" } }));
    const registration = await registerPageTools(pageDocument, execute, "https://www.meinesv.at/vsInfo/views/KE/einreichungTyp.xhtml");
    const tools = await pageDocument.modelContext.getTools();
    expect(tools).toHaveLength(4);
    const search = tools.find(({ name }) => name === "search_claims")!;
    const input = { from: "2020-02-29", to: "2025-02-28" };
    const serialized = await pageDocument.modelContext.executeTool(search, JSON.stringify(input));
    expect(JSON.parse(String(serialized))).toEqual({ ok: true, data: { status: "submission_requested" } });
    expect(execute).toHaveBeenCalledWith("search_claims", input);
    if (registration.available) registration.dispose();
  });
  it("installs locally, exposes the three contracts, executes a proxy, and cleans up", async () => {
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
      "list_claims", "get_open_claims", "get_claim",
    ]);
    const serialized = await pageDocument.modelContext.executeTool(tools[0]!, "{}");
    expect(JSON.parse(String(serialized))).toEqual({ ok: true, data: { tool: "list_claims" } });
    expect(execute).toHaveBeenCalledWith("list_claims", {});
    if (registration.available) registration.dispose();
  });
});

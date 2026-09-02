import { afterEach, describe, expect, it, vi } from "vitest";
import { installContentBridge } from "../src/webmcp/content-bridge.js";
import { createPageBridgeClient } from "../src/webmcp/page-client.js";
import {
  createBridgeRequest,
  createBridgeResponse,
  parseBridgeRequest,
  parseBridgeResponse,
  WEBMCP_BRIDGE_PROTOCOL,
} from "../src/webmcp/protocol.js";
import { disposeOnFinalPageHide, startWebMcpBridge } from "../src/webmcp/runtime.js";
import type { WebMcpToolDefinition } from "../src/webmcp/types.js";
import { pageToolCatalog, SEARCH_ENTRY_PATH, SEARCH_PAGE_PATH, SEARCH_RESULTS_PATH } from "../src/webmcp/catalog.js";
import { registerPageTools } from "../src/webmcp/registrar.js";
import {
  AGENT_HINT_ATTRIBUTE,
  agentHintText,
  installAgentHint,
} from "../src/webmcp/agent-hint.js";

function message(data: unknown, overrides: Partial<MessageEventInit> = {}): MessageEvent {
  return new MessageEvent("message", {
    data,
    origin: window.location.origin,
    source: window,
    ...overrides,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("OEGK-BRIDGE-004 closed protocol", () => {
  it("allows the bounded search and live-query errors on the page bridge", () => {
    const request = createBridgeRequest("search", "search_claims", { from: "2026-01-01", to: "2026-09-01" });
    expect(parseBridgeRequest(request)).toEqual(request);
    expect(parseBridgeRequest({ ...request, input: { from: "2026-02-30", to: "2026-09-01" } })).toBeUndefined();
    for (const code of ["INVALID_INPUT", "UNSUPPORTED_PAGE", "FORM_UNAVAILABLE", "SEARCH_IN_PROGRESS", "INTERNAL_ERROR", "PAGE_NOT_READY", "EXTRACTION_FAILED"] as const) {
      expect(parseBridgeResponse(createBridgeResponse("search", { ok: false, error: { code, message: "Redacted." } })))
        .toBeDefined();
    }
  });
  it("accepts only exact, versioned, allowlisted requests and ToolResult responses", () => {
    const request = createBridgeRequest("request-1", "get_claim", { claimId: "synthetic-id" });
    expect(parseBridgeRequest(request)).toEqual(request);
    expect(parseBridgeRequest({ ...request, rawHtml: "forbidden" })).toBeUndefined();
    expect(parseBridgeRequest({ ...request, protocol: "other" })).toBeUndefined();
    expect(parseBridgeRequest({ ...request, tool: "read_storage" })).toBeUndefined();
    expect(parseBridgeRequest({ ...request, input: { claimId: "synthetic-id", extra: true } })).toBeUndefined();

    const response = createBridgeResponse("request-1", { ok: true, data: { count: 0, claims: [] } });
    expect(parseBridgeResponse(response)).toEqual(response);
    expect(parseBridgeResponse({ ...response, result: { ok: false, error: { code: "SECRET", message: "x" } } }))
      .toBeUndefined();
    expect(parseBridgeResponse({ ...response, requestId: "" })).toBeUndefined();
  });

  it("rejects non-plain inputs, malformed frames, non-finite values and excessive depth", () => {
    expect(parseBridgeRequest(null)).toBeUndefined();
    expect(parseBridgeRequest([])).toBeUndefined();
    expect(parseBridgeRequest({
      protocol: WEBMCP_BRIDGE_PROTOCOL,
      version: 1,
      direction: "request",
      requestId: "x",
      tool: "list_claims",
      input: new Date(),
    })).toBeUndefined();
    expect(parseBridgeResponse(createBridgeResponse("x", { ok: true, data: { value: Number.NaN } })))
      .toBeUndefined();
    let nested: Record<string, unknown> = {};
    for (let index = 0; index < 30; index += 1) nested = { nested };
    expect(parseBridgeResponse(createBridgeResponse("x", { ok: true, data: nested }))).toBeUndefined();
  });
});

describe("OEGK-BRIDGE-003 semantic agent hint", () => {
  it("uses the same page-scoped catalog for hint count and registration names", () => {
    document.body.innerHTML = "<main>Only synthetic structure</main>";
    const url = `https://www.meinesv.at${SEARCH_PAGE_PATH}`;
    const remove = installAgentHint(document, url);
    const hint = document.querySelector(`[${AGENT_HINT_ATTRIBUTE}]`)!;
    for (const { name } of pageToolCatalog(url)) expect(hint.textContent).toContain(name);
    expect(hint.textContent).toContain("search_claims (not read-only)");
    expect(hint.textContent).toContain("does not confirm search success");
    expect(hint.textContent).toContain("Hints alone do not prove callability");
    expect(document.documentElement.getAttribute("data-oegk-webmcp-tool-count")).toBe("4");
    remove();
  });
  it("publishes only static tool metadata and removes it with the document lifecycle", () => {
    document.body.innerHTML = "<main>Visible OEGK page</main>";
    const remove = installAgentHint(document);
    const hint = document.querySelector<HTMLElement>(`[${AGENT_HINT_ATTRIBUTE}]`)!;
    expect(hint).not.toBeNull();
    expect(hint.getAttribute("role")).toBe("note");
    expect(hint.style.position).toBe("fixed");
    expect(hint.textContent).toBe(agentHintText());
    expect(hint.textContent).toContain("list_claims");
    expect(hint.textContent).toContain("get_open_claims");
    expect(hint.textContent).toContain("get_claim");
    expect(hint.textContent).not.toContain("get_reimbursement_summary");
    expect(hint.textContent).toContain("document.modelContext.getTools()");
    expect(hint.textContent).not.toContain("provider");
    expect(document.documentElement.getAttribute("data-oegk-webmcp-tool-count")).toBe("3");
    expect(document.querySelectorAll(`[${AGENT_HINT_ATTRIBUTE}]`)).toHaveLength(1);
    installAgentHint(document)();
    expect(document.querySelectorAll(`[${AGENT_HINT_ATTRIBUTE}]`)).toHaveLength(1);
    remove();
    expect(document.querySelector(`[${AGENT_HINT_ATTRIBUTE}]`)).toBeNull();
    expect(document.documentElement.hasAttribute("data-oegk-webmcp-tools-available")).toBe(false);
  });
});

describe("OEGK-BRIDGE-004 isolated content relay", () => {
  it("relays one valid request and returns only a validated tool result", async () => {
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    const invoke = vi.fn(async () => ({ ok: true, data: { count: 0, claims: [] } }));
    const dispose = installContentBridge(window, invoke);
    window.dispatchEvent(message(createBridgeRequest("request-1", "list_claims", {})));
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledOnce());
    expect(postMessage.mock.calls[0]?.[0]).toEqual(createBridgeResponse("request-1", {
      ok: true,
      data: { count: 0, claims: [] },
    }));
    expect(postMessage.mock.calls[0]?.[1]).toBe(window.location.origin);
    dispose();
  });

  it("ignores wrong origins, malformed and duplicate in-flight requests", async () => {
    let finish: ((value: unknown) => void) | undefined;
    const invoke = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const dispose = installContentBridge(window, invoke);
    const request = createBridgeRequest("duplicate", "get_open_claims", {});
    window.dispatchEvent(message(request, { origin: "https://example.invalid" }));
    window.dispatchEvent(message({ ...request, extra: true }));
    window.dispatchEvent(message(request));
    window.dispatchEvent(message(request));
    expect(invoke).toHaveBeenCalledOnce();
    finish?.({ ok: true, data: { count: 0, claims: [] } });
    await Promise.resolve();
    dispose();
  });

  it("redacts thrown and malformed extension responses", async () => {
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    const disposeMalformed = installContentBridge(window, async () => ({ secret: "storage bytes" }));
    window.dispatchEvent(message(createBridgeRequest("malformed", "list_claims", {})));
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledOnce());
    expect(postMessage.mock.calls[0]?.[0]).toMatchObject({
      result: { ok: false, error: { code: "INTERNAL_ERROR", message: "Tool execution failed." } },
    });
    disposeMalformed();
  });
});

describe("OEGK-BRIDGE-006 MAIN page client", () => {
  it("does not send a pre-cancelled search or retry a dispatched search after timeout", async () => {
    vi.useFakeTimers();
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    const client = createPageBridgeClient(window, 50, () => "one-search");
    const controller = new AbortController();
    controller.abort();
    await expect(client.execute("search_claims", { from: "2026-01-01", to: "2026-01-01" }, { signal: controller.signal }))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(postMessage).not.toHaveBeenCalled();
    const result = client.execute("search_claims", { from: "2026-01-01", to: "2026-01-01" });
    const timedOut = expect(result).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(51);
    await timedOut;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(postMessage).toHaveBeenCalledOnce();
    client.dispose();
  });

  it("cancellation after dispatch only cancels waiting; it sends no undo or retry", async () => {
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    const client = createPageBridgeClient(window, 1_000, () => "cancel-search");
    const controller = new AbortController();
    const result = client.execute("search_claims", { from: "2026-01-01", to: "2026-01-01" }, { signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(postMessage).toHaveBeenCalledOnce();
    window.dispatchEvent(message(createBridgeResponse("cancel-search", { ok: true, data: { status: "submission_requested" } })));
    expect(postMessage).toHaveBeenCalledOnce();
    client.dispose();
  });
  it("correlates concurrent out-of-order responses", async () => {
    const outbound: unknown[] = [];
    vi.spyOn(window, "postMessage").mockImplementation((data) => { outbound.push(data); });
    const ids = ["first", "second"];
    const client = createPageBridgeClient(window, 1_000, () => ids.shift()!);
    const first = client.execute("list_claims", {});
    const second = client.execute("get_open_claims", {});
    expect(outbound).toHaveLength(2);
    window.dispatchEvent(message(createBridgeResponse("second", { ok: true, data: { count: 1 } })));
    window.dispatchEvent(message(createBridgeResponse("first", { ok: true, data: { count: 2 } })));
    await expect(second).resolves.toEqual({ ok: true, data: { count: 1 } });
    await expect(first).resolves.toEqual({ ok: true, data: { count: 2 } });
    client.dispose();
  });

  it("times out, supports cancellation, and rejects pending work on disposal", async () => {
    vi.useFakeTimers();
    vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    const ids = ["timeout", "abort", "dispose"];
    const client = createPageBridgeClient(window, 50, () => ids.shift()!);
    const timedOut = client.execute("list_claims", {});
    const timedOutExpectation = expect(timedOut).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(51);
    await timedOutExpectation;

    const controller = new AbortController();
    const aborted = client.execute("list_claims", {}, { signal: controller.signal });
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });

    const disposed = client.execute("list_claims", {});
    client.dispose();
    await expect(disposed).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("OEGK-BRIDGE-006 document lifecycle", () => {
  it("survives BFCache pagehide and disposes on final pagehide", () => {
    const dispose = vi.fn();
    const remove = disposeOnFinalPageHide(window, dispose);
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    expect(dispose).not.toHaveBeenCalled();
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    expect(dispose).toHaveBeenCalledOnce();
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    expect(dispose).toHaveBeenCalledOnce();
    remove();
  });
});

describe("OEGK-BRIDGE-001 native-first runtime", () => {
  it.each(["native", "polyfill"])("registers five tools on the type route with %s runtime", async (runtime) => {
    const definitions: WebMcpToolDefinition[] = [];
    const context = { async registerTool(tool: WebMcpToolDefinition) { definitions.push(tool); } };
    const pageDocument: { modelContext?: typeof context } = runtime === "native" ? { modelContext: context } : {};
    const fakeWindow = {
      location: new URL(`https://www.meinesv.at${SEARCH_PAGE_PATH}`),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } as unknown as Window;
    const fallback = vi.fn(async () => { pageDocument.modelContext = context; });
    const result = await startWebMcpBridge(pageDocument, fakeWindow, fallback);
    expect(result.available && result.runtime).toBe(runtime);
    expect(definitions.map(({ name }) => name)).toEqual(pageToolCatalog(fakeWindow.location.href).map(({ name }) => name));
    expect(definitions.map(({ annotations }) => annotations.readOnlyHint)).toEqual([true, true, true, false]);
    expect(fallback).toHaveBeenCalledTimes(runtime === "native" ? 0 : 1);
    if (result.available) result.dispose();
  });

  it("registers search_claims on the MeineSV entry URL", async () => {
    const definitions: WebMcpToolDefinition[] = [];
    const context = { async registerTool(tool: WebMcpToolDefinition) { definitions.push(tool); } };
    const entryWindow = {
      location: new URL(`https://www.meinesv.at${SEARCH_ENTRY_PATH}?contentid=10007.815943`),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), postMessage: vi.fn(),
      setTimeout, clearTimeout,
    } as unknown as Window;
    const pageDocument = { modelContext: context };
    const result = await startWebMcpBridge(pageDocument, entryWindow, async () => undefined);
    expect(result.available).toBe(true);
    expect(definitions.map(({ name }) => name)).toContain("search_claims");
    if (result.available) result.dispose();
  });

  it("registers search_claims on the MeineSV results URL", async () => {
    const definitions: WebMcpToolDefinition[] = [];
    const context = { async registerTool(tool: WebMcpToolDefinition) { definitions.push(tool); } };
    const resultsWindow = {
      location: new URL(`https://www.meinesv.at${SEARCH_RESULTS_PATH}`),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), postMessage: vi.fn(),
      setTimeout, clearTimeout,
    } as unknown as Window;
    const pageDocument = { modelContext: context };
    const result = await startWebMcpBridge(pageDocument, resultsWindow, async () => undefined);
    expect(result.available).toBe(true);
    const search = definitions.find(({ name }) => name === "search_claims");
    expect(search).toMatchObject({ annotations: { readOnlyHint: false } });
    if (result.available) result.dispose();
  });

  it("validates search dates before proxy invocation and passes cancellation to the page client", async () => {
    const definitions: WebMcpToolDefinition[] = [];
    const pageDocument = { modelContext: { async registerTool(tool: WebMcpToolDefinition) { definitions.push(tool); } } };
    const execute = vi.fn(async () => ({ ok: true, data: { status: "submission_requested" } }));
    const result = await registerPageTools(pageDocument, execute, `https://www.meinesv.at${SEARCH_PAGE_PATH}`);
    const search = definitions.find(({ name }) => name === "search_claims")!;
    expect(await search.execute({ from: "2020-02-29", to: "2025-03-01" })).toMatchObject({ error: { code: "INVALID_INPUT" } });
    expect(execute).not.toHaveBeenCalled();
    const controller = new AbortController();
    const input = { from: "2020-02-29", to: "2025-02-28" };
    await search.execute(input, { signal: controller.signal });
    expect(execute).toHaveBeenCalledWith("search_claims", input, { signal: controller.signal });
    if (result.available) result.dispose();
  });
  it("uses native WebMCP without loading the compatibility runtime", async () => {
    const definitions: WebMcpToolDefinition[] = [];
    const signals: AbortSignal[] = [];
    const pageDocument = {
      modelContext: {
        async registerTool(tool: WebMcpToolDefinition, options?: { signal?: AbortSignal }) {
          definitions.push(tool);
          if (options?.signal) signals.push(options.signal);
        },
      },
    };
    const fallback = vi.fn(async () => undefined);
    const result = await startWebMcpBridge(pageDocument, window, fallback);
    expect(result.available && result.runtime).toBe("native");
    expect(fallback).not.toHaveBeenCalled();
    expect(definitions.map(({ name }) => name)).toEqual([
      "list_claims", "get_open_claims", "get_claim",
    ]);
    expect(definitions.every(({ annotations }) => annotations.readOnlyHint)).toBe(true);
    if (result.available) result.dispose();
    expect(signals.every(({ aborted }) => aborted)).toBe(true);
  });

  it("loads the fallback only when native WebMCP is absent and degrades when unavailable", async () => {
    const definitions: WebMcpToolDefinition[] = [];
    const pageDocument: {
      modelContext?: { registerTool(tool: WebMcpToolDefinition): Promise<void> };
    } = {};
    const fallback = vi.fn(async () => {
      pageDocument.modelContext = {
        async registerTool(tool) { definitions.push(tool); },
      };
    });
    const result = await startWebMcpBridge(pageDocument, window, fallback);
    expect(result.available && result.runtime).toBe("polyfill");
    expect(fallback).toHaveBeenCalledOnce();
    expect(definitions).toHaveLength(3);
    if (result.available) result.dispose();

    const unavailable = await startWebMcpBridge({}, window, async () => undefined);
    expect(unavailable).toEqual({ available: false, reason: "unsupported" });
  });
});

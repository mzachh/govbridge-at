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
    expect(hint.textContent).toContain("get_reimbursement_summary");
    expect(hint.textContent).toContain("document.modelContext.getTools()");
    expect(hint.textContent).not.toContain("provider");
    expect(document.documentElement.getAttribute("data-oegk-webmcp-tool-count")).toBe("4");
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
      "list_claims", "get_open_claims", "get_claim", "get_reimbursement_summary",
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
    expect(definitions).toHaveLength(4);
    if (result.available) result.dispose();

    const unavailable = await startWebMcpBridge({}, window, async () => undefined);
    expect(unavailable).toEqual({ available: false, reason: "unsupported" });
  });
});

import {
  createBridgeRequest,
  parseBridgeResponse,
  WEBMCP_REQUEST_TIMEOUT_MS,
} from "./protocol.js";
import type { PageToolName } from "./catalog.js";

export interface PageBridgeClient {
  execute(
    tool: PageToolName,
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
  dispose(): void;
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(reason: unknown): void;
  timeout: number;
  signal?: AbortSignal;
  abort?: () => void;
}

export function createPageBridgeClient(
  pageWindow: Window,
  timeoutMs = WEBMCP_REQUEST_TIMEOUT_MS,
  createId: () => string = () => crypto.randomUUID(),
): PageBridgeClient {
  const pending = new Map<string, PendingRequest>();
  let disposed = false;

  const cleanup = (requestId: string): PendingRequest | undefined => {
    const request = pending.get(requestId);
    if (!request) return undefined;
    pending.delete(requestId);
    pageWindow.clearTimeout(request.timeout);
    if (request.signal && request.abort) request.signal.removeEventListener("abort", request.abort);
    return request;
  };

  const onMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== pageWindow || event.origin !== pageWindow.location.origin) return;
    const response = parseBridgeResponse(event.data);
    if (!response) return;
    cleanup(response.requestId)?.resolve(response.result);
  };
  pageWindow.addEventListener("message", onMessage);

  return {
    execute(tool, input, options) {
      if (disposed) return Promise.reject(new DOMException("Bridge disposed.", "AbortError"));
      if (options?.signal?.aborted) {
        return Promise.reject(new DOMException("Operation aborted.", "AbortError"));
      }
      let requestId = createId();
      for (let attempt = 0; pending.has(requestId) && attempt < 4; attempt += 1) requestId = createId();
      if (!requestId || requestId.length > 128 || pending.has(requestId)) {
        return Promise.reject(new Error("Unable to create a WebMCP request ID."));
      }
      return new Promise((resolve, reject) => {
        const timeout = pageWindow.setTimeout(() => {
          cleanup(requestId)?.reject(new Error("WebMCP bridge timed out."));
        }, timeoutMs);
        const request: PendingRequest = { resolve, reject, timeout };
        if (options?.signal) {
          const signal = options.signal;
          request.signal = signal;
          request.abort = () => {
            cleanup(requestId)?.reject(new DOMException("Operation aborted.", "AbortError"));
          };
          signal.addEventListener("abort", request.abort, { once: true });
        }
        pending.set(requestId, request);
        pageWindow.postMessage(createBridgeRequest(requestId, tool, input), pageWindow.location.origin);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pageWindow.removeEventListener("message", onMessage);
      for (const requestId of [...pending.keys()]) {
        cleanup(requestId)?.reject(new DOMException("Bridge disposed.", "AbortError"));
      }
    },
  };
}

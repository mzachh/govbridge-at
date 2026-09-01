import {
  createBridgeResponse,
  isToolResult,
  parseBridgeRequest,
} from "./protocol.js";
import type { ToolResult } from "./types.js";

export type InvokeExtensionTool = (
  tool: string,
  input: Record<string, unknown>,
) => Promise<unknown>;

const INTERNAL_FAILURE: ToolResult<never> = Object.freeze({
  ok: false,
  error: Object.freeze({ code: "INTERNAL_ERROR", message: "Tool execution failed." }),
});

export function installContentBridge(
  pageWindow: Window,
  invoke: InvokeExtensionTool,
): () => void {
  const inFlight = new Set<string>();
  let disposed = false;

  const onMessage = (event: MessageEvent<unknown>): void => {
    if (disposed || event.source !== pageWindow || event.origin !== pageWindow.location.origin) return;
    const request = parseBridgeRequest(event.data);
    if (!request || inFlight.has(request.requestId)) return;
    inFlight.add(request.requestId);
    void invoke(request.tool, request.input).then((result) => {
      const safeResult = isToolResult(result) ? result : INTERNAL_FAILURE;
      if (!disposed) {
        pageWindow.postMessage(
          createBridgeResponse(request.requestId, safeResult),
          pageWindow.location.origin,
        );
      }
    }).catch(() => {
      if (!disposed) {
        pageWindow.postMessage(
          createBridgeResponse(request.requestId, INTERNAL_FAILURE),
          pageWindow.location.origin,
        );
      }
    }).finally(() => inFlight.delete(request.requestId));
  };

  pageWindow.addEventListener("message", onMessage);
  return () => {
    disposed = true;
    inFlight.clear();
    pageWindow.removeEventListener("message", onMessage);
  };
}

import { disposeOnFinalPageHide, startWebMcpBridge } from "../webmcp/runtime.js";
import { isSupportedMeineSvUrl } from "../webmcp/scope.js";
import type { WebMcpDocumentLike } from "../webmcp/types.js";
import { publishBridgeStatus } from "../webmcp/diagnostics.js";
import { installAgentHint } from "../webmcp/agent-hint.js";

interface PolyfillOptionsWindow extends Window {
  __webMCPPolyfillOptions?: { installTestingShim: false };
}

async function loadCompatibilityRuntime(): Promise<void> {
  const configuredWindow = window as PolyfillOptionsWindow;
  configuredWindow.__webMCPPolyfillOptions = { installTestingShim: false };
  try {
    const { initializeWebMCPPolyfill } = await import("@mcp-b/webmcp-polyfill");
    initializeWebMCPPolyfill({ installTestingShim: false });
  } finally {
    delete configuredWindow.__webMCPPolyfillOptions;
  }
}

if (isSupportedMeineSvUrl(window.location.href)) {
  publishBridgeStatus("data-oegk-webmcp-build", "hint-v1");
  publishBridgeStatus("data-oegk-webmcp-bridge", "starting");
  void startWebMcpBridge(
    document as Document & WebMcpDocumentLike,
    window,
    loadCompatibilityRuntime,
  ).then((result) => {
    if (!result.available) {
      publishBridgeStatus("data-oegk-webmcp-bridge", result.reason);
      return;
    }
    publishBridgeStatus("data-oegk-webmcp-bridge", `ready:${result.runtime}`);
    const removeAgentHint = installAgentHint(document);
    disposeOnFinalPageHide(window, () => {
      removeAgentHint();
      result.dispose();
    });
  }).catch(() => {
    publishBridgeStatus("data-oegk-webmcp-bridge", "failed");
  });
}

import { installContentBridge } from "../webmcp/content-bridge.js";
import { disposeOnFinalPageHide } from "../webmcp/runtime.js";
import { isSupportedMeineSvUrl } from "../webmcp/scope.js";
import { publishBridgeStatus } from "../webmcp/diagnostics.js";

if (isSupportedMeineSvUrl(window.location.href)) {
  publishBridgeStatus("data-oegk-content-bridge", "ready");
  const dispose = installContentBridge(window, (tool, input) =>
    chrome.runtime.sendMessage({ type: "webmcp.execute", tool, input }));
  disposeOnFinalPageHide(window, dispose);
}

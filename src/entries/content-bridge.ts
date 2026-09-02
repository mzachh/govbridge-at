import { installContentBridge } from "../webmcp/content-bridge.js";
import { disposeOnFinalPageHide } from "../webmcp/runtime.js";
import { isSupportedMeineSvUrl } from "../webmcp/scope.js";
import { publishBridgeStatus } from "../webmcp/diagnostics.js";
import { searchClaims } from "../actions/search-claims.js";
import { LiveClaimReader } from "../live/reader.js";
import { createReadOnlyClaimTools } from "../webmcp/handlers.js";

if (isSupportedMeineSvUrl(window.location.href)) {
  publishBridgeStatus("data-oegk-content-bridge", "ready");
  const queries = createReadOnlyClaimTools(new LiveClaimReader(document));
  const dispose = installContentBridge(window, (tool, input) => tool === "search_claims"
    ? searchClaims(document, input)
    : queries.find((query) => query.name === tool)!.execute(input));
  disposeOnFinalPageHide(window, dispose);
}

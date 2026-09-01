import { OegkAdapter } from "../adapter/oegk.js";
import { createObservationWindow } from "../adapter/observation-window.js";
import { onSearchDispatched } from "../actions/search-observation.js";
import { disposeOnFinalPageHide } from "../webmcp/runtime.js";

let lastResult = "";

async function observeVisiblePage(): Promise<void> {
  const adapter = new OegkAdapter();
  const result = await adapter.extractClaims();
  if (result.state === "unsupported" || result.state === "loading") return;
  const signature = JSON.stringify(result);
  if (signature === lastResult) return;
  lastResult = signature;
  await chrome.runtime.sendMessage({ type: "claims.observe", result }).catch(() => undefined);
}

const observation = createObservationWindow(document, observeVisiblePage);
observation.rearm();
const removeSearchListener = onSearchDispatched(document, () => observation.rearm());
disposeOnFinalPageHide(window, () => {
  removeSearchListener();
  observation.dispose();
});

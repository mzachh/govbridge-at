import type { Claim } from "../domain/claim.js";
import { renderPopup } from "../ui/popup.js";

interface ReadResponse {
  ok: boolean;
  data?: { claims: Claim[]; updatedAt: string; metadata?: { lastSnapshotAt: string; lastExtractionState: "complete" | "empty" } };
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Popup root missing.");

void chrome.runtime.sendMessage({ type: "claims.read" }).then((response: ReadResponse) => {
  if (!response.ok || !response.data) {
    renderPopup(root, { state: "error" });
    return;
  }
  renderPopup(root, {
    state: "ready",
    claims: response.data.claims,
    hasObserved: response.data.metadata !== undefined,
  });
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "WebMCP-Dashboard öffnen";
  button.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "dashboard.open" });
  });
  root.append(button);
}).catch(() => renderPopup(root, { state: "error" }));

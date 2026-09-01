import type { StoredClaimState } from "../tracking/types.js";
import { summarizeDashboardCounts } from "../ui/dashboard.js";

interface ReadResponse { ok: boolean; data?: StoredClaimState }

const status = document.querySelector<HTMLElement>("#webmcp-status");
const runtimeState = document.querySelector<HTMLElement>("#runtime-state");
const runtimeLabel = document.querySelector<HTMLElement>("#runtime-label");
const storageStatus = document.querySelector<HTMLElement>("#storage-status");

function setText(selector: string, value: string): void {
  const node = document.querySelector<HTMLElement>(selector);
  if (node) node.textContent = value;
}

if (runtimeState) runtimeState.className = "runtime-state runtime-state--ready";
if (runtimeLabel) runtimeLabel.textContent = "Bridge packaged";
if (status) {
  status.textContent =
    "The MAIN-world WebMcpBridge registers four read-only query tools on supported OEGK pages, plus search_claims on the query/results routes, using native document.modelContext or its local fallback.";
}

const repository = {
  async read(): Promise<StoredClaimState> {
    const response = await chrome.runtime.sendMessage({ type: "claims.read" }) as ReadResponse;
    if (!response.ok || !response.data) throw new Error("Storage unavailable");
    return response.data;
  },
};

void repository.read().then((state) => {
  const counts = summarizeDashboardCounts(state.claims);
  setText("#claim-count", String(counts.observed));
  setText("#open-count", String(counts.open));
  setText("#closed-count", String(counts.closed));
  setText("#unknown-count", String(counts.unknown));
  if (storageStatus) {
    storageStatus.textContent = "Aggregate counts loaded from validated local storage. Claim details stay hidden.";
  }
}).catch(() => {
  if (storageStatus) {
    storageStatus.textContent = "Local claim storage is currently unavailable.";
    storageStatus.setAttribute("role", "alert");
  }
});

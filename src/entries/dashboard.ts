import type { StoredClaimState } from "../tracking/types.js";
import { summarizeDashboardCounts } from "../ui/dashboard.js";
import { registerExtensionPageTools } from "../webmcp/registrar.js";
import type { WebMcpDocumentLike } from "../webmcp/types.js";

interface ReadResponse { ok: boolean; data?: StoredClaimState }

const status = document.querySelector<HTMLElement>("#webmcp-status");
const runtimeState = document.querySelector<HTMLElement>("#runtime-state");
const runtimeLabel = document.querySelector<HTMLElement>("#runtime-label");
const storageStatus = document.querySelector<HTMLElement>("#storage-status");

function setText(selector: string, value: string): void {
  const node = document.querySelector<HTMLElement>(selector);
  if (node) node.textContent = value;
}

function setRuntimeState(
  state: "ready" | "unsupported" | "error",
  label: string,
  message: string,
): void {
  if (runtimeState) runtimeState.className = `runtime-state runtime-state--${state}`;
  if (runtimeLabel) runtimeLabel.textContent = label;
  if (status) status.textContent = message;
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

void registerExtensionPageTools(document as Document & WebMcpDocumentLike, repository).then((result) => {
  if (result.available) {
    setRuntimeState(
      "ready",
      "4 tools live",
      "Registered via document.modelContext.registerTool() on this extension-owned page.",
    );
  } else if (result.reason === "unsupported") {
    setRuntimeState(
      "unsupported",
      "Unavailable",
      "document.modelContext is not available in this browser document.",
    );
  } else {
    setRuntimeState(
      "error",
      "Registration failed",
      "The browser rejected WebMCP tool registration; no tools were exposed.",
    );
  }
});

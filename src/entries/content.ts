import { OegkAdapter } from "../adapter/oegk.js";

let lastResult = "";
let pending: number | undefined;
const stopAt = Date.now() + 15_000;

async function observeVisiblePage(): Promise<void> {
  const adapter = new OegkAdapter();
  const result = await adapter.extractClaims();
  if (result.state === "unsupported" || result.state === "loading") return;
  const signature = JSON.stringify(result);
  if (signature === lastResult) return;
  lastResult = signature;
  await chrome.runtime.sendMessage({ type: "claims.observe", result }).catch(() => undefined);
}

void observeVisiblePage();

const observer = new MutationObserver(() => {
  if (Date.now() >= stopAt) {
    observer.disconnect();
    return;
  }
  if (pending !== undefined) window.clearTimeout(pending);
  pending = window.setTimeout(() => void observeVisiblePage(), 250);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
window.setTimeout(() => observer.disconnect(), 15_000);

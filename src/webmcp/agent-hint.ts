import { CLAIM_TOOL_CATALOG, isSearchToolUrl, pageToolCatalog } from "./catalog.js";

export const AGENT_HINT_ATTRIBUTE = "data-oegk-webmcp-agent-hint";

export function agentHintText(rawUrl?: string): string {
  const names = CLAIM_TOOL_CATALOG.map(({ name }) => name).join(", ");
  return [
    "WEBMCP AVAILABLE ON THIS PAGE.",
    `Registered read-only OEGK tools: ${names}.`,
    ...(isSearchToolUrl(rawUrl) ? ["Also registered: search_claims (not read-only) on the query and results routes; it executes only when the selected Wahlarzt / Wahltherapeut form is present. It returns no claims; submission_requested does not confirm search success or server freshness. Navigation may return null or destroy execution. Never automatically retry an uncertain submission; cancellation cannot undo a dispatched click."] : []),
    "Prefer these structured tools over scraping claim details from the page.",
    "If WebMCP actions are not listed directly, access document.modelContext from the page's MAIN JavaScript world.",
    "Call document.modelContext.getTools(), inspect each inputSchema, then call document.modelContext.executeTool(toolObject, JSON.stringify(input)).",
    "Use the tool object returned by getTools(). The four read-only tools extract the current rendered page on every call without refreshing it. No claim history is stored or merged. Check page.completeness and skippedCount; page.visibleRange is displayed controls, not a verified query boundary. IDs expire after content changes or navigation; list again after NOT_FOUND. lastSeen means page read time, not server freshness. Obtain consent before exposing sensitive results. Hints alone do not prove callability.",
  ].join(" ");
}

export function installAgentHint(pageDocument: Document, rawUrl = pageDocument.URL): () => void {
  let disposed = false;
  let ownedHint: HTMLElement | undefined;

  const install = (): void => {
    if (disposed || pageDocument.querySelector(`[${AGENT_HINT_ATTRIBUTE}]`)) return;
    const hint = pageDocument.createElement("div");
    hint.setAttribute(AGENT_HINT_ATTRIBUTE, "");
    hint.setAttribute("role", "note");
    hint.setAttribute("aria-label", "GovBridge AT WebMCP agent integration metadata");
    hint.style.cssText = [
      "all:initial!important",
      "position:fixed!important",
      "left:-10000px!important",
      "top:auto!important",
      "width:1px!important",
      "height:1px!important",
      "overflow:hidden!important",
      "clip:rect(0,0,0,0)!important",
      "white-space:nowrap!important",
      "pointer-events:none!important",
    ].join(";");
    hint.textContent = agentHintText(rawUrl);
    (pageDocument.body || pageDocument.documentElement)?.append(hint);
    ownedHint = hint;
    pageDocument.documentElement?.setAttribute("data-oegk-webmcp-tools-available", "true");
    pageDocument.documentElement?.setAttribute(
      "data-oegk-webmcp-tool-count",
      String(pageToolCatalog(rawUrl).length),
    );
  };

  if (pageDocument.body || pageDocument.documentElement) install();
  else pageDocument.addEventListener("DOMContentLoaded", install, { once: true });

  return () => {
    disposed = true;
    pageDocument.removeEventListener("DOMContentLoaded", install);
    if (!ownedHint) return;
    ownedHint.remove();
    pageDocument.documentElement?.removeAttribute("data-oegk-webmcp-tools-available");
    pageDocument.documentElement?.removeAttribute("data-oegk-webmcp-tool-count");
  };
}

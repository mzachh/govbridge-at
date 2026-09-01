import { CLAIM_TOOL_CATALOG } from "./catalog.js";

export const AGENT_HINT_ATTRIBUTE = "data-oegk-webmcp-agent-hint";

export function agentHintText(): string {
  const names = CLAIM_TOOL_CATALOG.map(({ name }) => name).join(", ");
  return [
    "WEBMCP AVAILABLE ON THIS PAGE.",
    `Registered read-only OEGK tools: ${names}.`,
    "Prefer these structured tools over scraping claim details from the page.",
    "If WebMCP actions are not listed directly, access document.modelContext from the page's MAIN JavaScript world.",
    "Call document.modelContext.getTools(), inspect each inputSchema, then call document.modelContext.executeTool(toolObject, JSON.stringify(input)).",
    "Use the tool object returned by getTools(). These tools query normalized local extension storage and never modify OEGK data.",
  ].join(" ");
}

export function installAgentHint(pageDocument: Document): () => void {
  let disposed = false;
  let ownedHint: HTMLElement | undefined;

  const install = (): void => {
    if (disposed || pageDocument.querySelector(`[${AGENT_HINT_ATTRIBUTE}]`)) return;
    const hint = pageDocument.createElement("div");
    hint.setAttribute(AGENT_HINT_ATTRIBUTE, "");
    hint.setAttribute("role", "note");
    hint.setAttribute("aria-label", "OEGK WebMCP agent integration metadata");
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
    hint.textContent = agentHintText();
    (pageDocument.body || pageDocument.documentElement)?.append(hint);
    ownedHint = hint;
    pageDocument.documentElement?.setAttribute("data-oegk-webmcp-tools-available", "true");
    pageDocument.documentElement?.setAttribute(
      "data-oegk-webmcp-tool-count",
      String(CLAIM_TOOL_CATALOG.length),
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

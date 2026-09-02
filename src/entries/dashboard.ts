export {};

// This entry intentionally exposes only packaged capability metadata. It does
// not inspect the active tab, invoke a tool, read storage, or infer that a
// supported page is connected merely because this dashboard was opened.
const runtimeState = document.querySelector<HTMLElement>("#runtime-state");
const runtimeLabel = document.querySelector<HTMLElement>("#runtime-label");
const status = document.querySelector<HTMLElement>("#webmcp-status");

if (runtimeState) runtimeState.className = "runtime-state runtime-state--ready";
if (runtimeLabel) runtimeLabel.textContent = "Packaged capability";
if (status) {
  status.textContent =
    "This package exposes the current-page WebMCP tools on supported Meine SV routes. Opening this dashboard does not inspect a tab or prove that a page is connected or registered.";
}

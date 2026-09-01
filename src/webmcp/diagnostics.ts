function writeAttribute(name: string, value: string): boolean {
  const root = document.documentElement;
  if (!root) return false;
  root.setAttribute(name, value);
  return true;
}

export function publishBridgeStatus(
  name:
    | "data-oegk-webmcp-bridge"
    | "data-oegk-content-bridge"
    | "data-oegk-webmcp-build",
  value: string,
): void {
  if (writeAttribute(name, value)) return;
  document.addEventListener("DOMContentLoaded", () => writeAttribute(name, value), { once: true });
}

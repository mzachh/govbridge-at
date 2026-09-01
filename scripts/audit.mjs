import { readFile, readdir } from "node:fs/promises";

const root = new URL("../dist/", import.meta.url);
const expected = new Set([
  "PRIVACY.md", "THIRD_PARTY_NOTICES.txt", "background.js", "content-bridge.js", "content.js",
  "dashboard.html", "dashboard.js", "manifest.json", "popup.html", "popup.js", "styles.css",
  "webmcp-main.js",
]);
const files = await readdir(root);
for (const file of files) if (!expected.delete(file)) throw new Error(`Unexpected package file: ${file}`);
if (expected.size) throw new Error(`Missing package files: ${[...expected].join(", ")}`);

const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
const projectPackage = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
if (projectPackage.dependencies?.["@mcp-b/webmcp-polyfill"] !== "4.0.0") {
  throw new Error("WebMCP compatibility runtime must remain exactly pinned");
}
if (JSON.stringify(manifest.permissions) !== JSON.stringify(["storage"])) throw new Error("Manifest permission drift");
if ("host_permissions" in manifest || "optional_host_permissions" in manifest || "web_accessible_resources" in manifest) throw new Error("Forbidden manifest capability");
const main = manifest.content_scripts?.find((entry) => entry.world === "MAIN");
const relay = manifest.content_scripts?.find((entry) => entry.js?.includes("content-bridge.js"));
const exactMatches = [
  "https://www.meinesv.at/vsInfo/views/KE/einreichungTyp.xhtml",
  "https://www.meinesv.at/vsInfo/views/KE/einreichungListe.xhtml",
  "https://www.meinesv.at/vsInfo/views/KE/einreichungDetailOA.xhtml",
  "https://www.meinesv.at/vsInfo/views/KE/einreichungDetail.xhtml",
];
if (!main || JSON.stringify(main.js) !== JSON.stringify(["webmcp-main.js"]) ||
    main.world !== "MAIN" || main.run_at !== "document_start" || main.all_frames !== false ||
    !relay || JSON.stringify(relay.js) !== JSON.stringify(["content-bridge.js"]) ||
    relay.world !== "ISOLATED" || relay.run_at !== "document_start" || relay.all_frames !== false) {
  throw new Error("WebMCP bridge manifest drift");
}
if (JSON.stringify(main.matches) !== JSON.stringify(exactMatches) ||
    JSON.stringify(relay.matches) !== JSON.stringify(exactMatches)) {
  throw new Error("WebMCP bridge scope drift");
}

const runtime = (await Promise.all(files.filter((f) => f.endsWith(".js")).map((f) => readFile(new URL(f, root), "utf8")))).join("\n");
const mainRuntime = await readFile(new URL("webmcp-main.js", root), "utf8");
if (!mainRuntime.includes("installTestingShim: false") || !mainRuntime.includes("__isWebMCPPolyfill")) {
  throw new Error("WebMCP local fallback packaging drift");
}
for (const pattern of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /\.innerHTML\s*=/, /eval\s*\(/, /new Function/]) {
  if (pattern.test(runtime)) throw new Error(`Forbidden runtime construct: ${pattern}`);
}

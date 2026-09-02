import { readFile, readdir } from "node:fs/promises";
import { assertProfile, manifestMatches, readExtensionTargets, requiresDemo } from "./extension-config.mjs";

const profile = process.argv.find((argument) => argument.startsWith("--profile="))?.slice("--profile=".length) ?? "extension";
assertProfile(profile);
const targets = await readExtensionTargets();
const requireDemo = process.argv.includes("--require-demo") || requiresDemo(profile);
if (requireDemo && !targets.demoOrigin) {
  throw new Error("Demo audit requires config/extension-targets.json to contain the assigned HTTPS demoOrigin.");
}
// Audit the one installable package regardless of the compatibility alias.
const outdirName = "dist";
const root = new URL(`../${outdirName}/`, import.meta.url);
const expected = new Set([
  "PRIVACY.md", "THIRD_PARTY_NOTICES.txt", "content-bridge.js",
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
if ((manifest.permissions?.length ?? 0) !== 0 || "background" in manifest || manifest.content_scripts?.length !== 2) throw new Error("Manifest permission drift");
if ("host_permissions" in manifest || "optional_host_permissions" in manifest || "web_accessible_resources" in manifest) throw new Error("Forbidden manifest capability");
const main = manifest.content_scripts?.find((entry) => entry.world === "MAIN");
const relay = manifest.content_scripts?.find((entry) => entry.js?.includes("content-bridge.js"));
const bridgeMatches = manifestMatches(targets);
if (!main || JSON.stringify(main.js) !== JSON.stringify(["webmcp-main.js"]) ||
    main.world !== "MAIN" || main.run_at !== "document_start" || main.all_frames !== false ||
    !relay || JSON.stringify(relay.js) !== JSON.stringify(["content-bridge.js"]) ||
    relay.world !== "ISOLATED" || relay.run_at !== "document_start" || relay.all_frames !== false) {
  throw new Error("WebMCP bridge manifest drift");
}
if (JSON.stringify(main.matches) !== JSON.stringify(bridgeMatches) ||
    JSON.stringify(relay.matches) !== JSON.stringify(bridgeMatches)) {
  throw new Error("WebMCP bridge scope drift");
}

const runtime = (await Promise.all(files.filter((f) => f.endsWith(".js")).map((f) => readFile(new URL(f, root), "utf8")))).join("\n");
const mainRuntime = await readFile(new URL("webmcp-main.js", root), "utf8");
if (!mainRuntime.includes("installTestingShim: false") || !mainRuntime.includes("__isWebMCPPolyfill")) {
  throw new Error("WebMCP local fallback packaging drift");
}
for (const pattern of [/chrome\.storage/, /claims\.(?:observe|read)/, /webmcp\.execute/, /localStorage/, /indexedDB/, /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /\.innerHTML\s*=/, /eval\s*\(/, /new Function/]) {
  if (pattern.test(runtime)) throw new Error(`Forbidden runtime construct: ${pattern}`);
}

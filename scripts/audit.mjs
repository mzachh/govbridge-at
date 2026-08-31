import { readFile, readdir } from "node:fs/promises";

const root = new URL("../dist/", import.meta.url);
const expected = new Set(["PRIVACY.md", "background.js", "content.js", "dashboard.html", "dashboard.js", "manifest.json", "popup.html", "popup.js", "styles.css"]);
const files = await readdir(root);
for (const file of files) if (!expected.delete(file)) throw new Error(`Unexpected package file: ${file}`);
if (expected.size) throw new Error(`Missing package files: ${[...expected].join(", ")}`);

const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
if (JSON.stringify(manifest.permissions) !== JSON.stringify(["storage"])) throw new Error("Manifest permission drift");
if ("host_permissions" in manifest || "optional_host_permissions" in manifest || "web_accessible_resources" in manifest) throw new Error("Forbidden manifest capability");
if (manifest.cross_origin_opener_policy?.value !== "same-origin" ||
    manifest.cross_origin_embedder_policy?.value !== "require-corp") {
  throw new Error("WebMCP origin isolation drift");
}

const runtime = (await Promise.all(files.filter((f) => f.endsWith(".js")).map((f) => readFile(new URL(f, root), "utf8")))).join("\n");
for (const pattern of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /\.innerHTML\s*=/, /eval\s*\(/, /new Function/]) {
  if (pattern.test(runtime)) throw new Error(`Forbidden runtime construct: ${pattern}`);
}

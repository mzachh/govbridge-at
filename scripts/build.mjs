import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { assertProfile, manifestMatches, readExtensionTargets, requiresDemo } from "./extension-config.mjs";

const profile = process.argv.find((argument) => argument.startsWith("--profile="))?.slice("--profile=".length) ?? "extension";
assertProfile(profile);
const targets = await readExtensionTargets();
const requireDemo = process.argv.includes("--require-demo") || requiresDemo(profile);
if (requireDemo && !targets.demoOrigin) {
  throw new Error("Demo build requires config/extension-targets.json to contain the assigned HTTPS demoOrigin.");
}

// All environments are supported by the one installable package.
const outdirName = "dist";
const outdir = new URL(`../${outdirName}/`, import.meta.url);
await mkdir(outdir, { recursive: true });
// Retired bundles must never survive an incremental build.
for (const file of ["background.js", "content.js"]) await rm(new URL(file, outdir), { force: true });

await build({
  entryPoints: {
    "content-bridge": new URL("../src/entries/content-bridge.ts", import.meta.url).pathname,
    popup: new URL("../src/entries/popup.ts", import.meta.url).pathname,
    dashboard: new URL("../src/entries/dashboard.ts", import.meta.url).pathname,
    "webmcp-main": new URL("../src/entries/webmcp-main.ts", import.meta.url).pathname
  },
  bundle: true,
  outdir: outdir.pathname,
  format: "iife",
  target: "chrome120",
  sourcemap: false,
  minify: false,
  define: {
    __GOVBRIDGE_BUILD_PROFILE__: JSON.stringify("extension"),
  },
});

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
const matches = manifestMatches(targets);
for (const entry of manifest.content_scripts ?? []) entry.matches = [...matches];
await writeFile(new URL("manifest.json", outdir), `${JSON.stringify(manifest, null, 2)}\n`);

for (const file of ["popup.html", "dashboard.html", "styles.css", "PRIVACY.md", "THIRD_PARTY_NOTICES.txt"]) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(file, outdir));
}

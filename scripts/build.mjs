import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const outdir = new URL("../dist/", import.meta.url);
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
  minify: false
});

for (const file of ["manifest.json", "popup.html", "dashboard.html", "styles.css", "PRIVACY.md", "THIRD_PARTY_NOTICES.txt"]) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(file, outdir));
}

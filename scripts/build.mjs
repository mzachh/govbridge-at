import { cp, mkdir } from "node:fs/promises";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const outdir = new URL("../dist/", import.meta.url);
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: {
    background: new URL("../src/entries/background.ts", import.meta.url).pathname,
    "content-bridge": new URL("../src/entries/content-bridge.ts", import.meta.url).pathname,
    content: new URL("../src/entries/content.ts", import.meta.url).pathname,
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

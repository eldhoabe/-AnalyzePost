import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { build } from "esbuild";

const outdir = "dist";

if (existsSync(outdir)) {
  rmSync(outdir, { recursive: true, force: true });
}
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: {
    content: "src/content.ts",
    background: "src/background.ts",
    popup: "src/popup.ts",
    options: "src/options.ts",
  },
  bundle: true,
  format: "iife",
  target: "es2022",
  outdir,
  sourcemap: true,
  logLevel: "info",
});

for (const file of ["manifest.json", "popup.html", "options.html", "styles.css"]) {
  cpSync(file, `${outdir}/${file}`);
}
cpSync("icons", `${outdir}/icons`, { recursive: true });

// esbuild writes each source map's "sources" entries relative to the map
// file's location on disk (e.g. "../src/content.ts", since entry points
// are src/*.ts and outdir is dist/). Chrome DevTools resolves that against
// the loaded extension's own origin (chrome-extension://<id>/content.js),
// and "../" escapes above dist/ -- outside anything the extension serves
// -- so despite sourcesContent being embedded, DevTools can't nest the
// original .ts files under a "src" folder in the Sources panel. Rewriting
// to an origin-relative path ("src/content.ts") fixes that: it resolves to
// chrome-extension://<id>/src/content.ts, which doesn't need to actually
// exist on disk because sourcesContent already carries the real content.
for (const file of readdirSync(outdir)) {
  if (!file.endsWith(".js.map")) continue;
  const mapPath = `${outdir}/${file}`;
  const map = JSON.parse(readFileSync(mapPath, "utf8"));
  map.sources = map.sources.map((source) => source.replace(/^(\.\.\/)+/, ""));
  writeFileSync(mapPath, JSON.stringify(map));
}

console.log(`Built extension to ${outdir}/`);

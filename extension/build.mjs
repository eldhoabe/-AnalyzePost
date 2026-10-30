import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { build } from "esbuild";

const outdir = "dist";

// ── Backend URL ──────────────────────────────────────────────────────────────
const apiBase = process.env.API_BASE_URL ?? "http://localhost:8000";
const isRelease = Boolean(process.env.API_BASE_URL);

if (isRelease && apiBase.includes("localhost")) {
  console.error("ERROR: API_BASE_URL must not be localhost in a release build.");
  process.exit(1);
}

// ── Clean output ─────────────────────────────────────────────────────────────
if (existsSync(outdir)) {
  rmSync(outdir, { recursive: true, force: true });
}
mkdirSync(outdir, { recursive: true });

// ── JS bundle ────────────────────────────────────────────────────────────────
await build({
  entryPoints: {
    background: "src/background.ts",
    popup: "src/popup.ts",
    options: "src/options.ts",
    content: "src/content.tsx",
  },
  bundle: true,
  format: "iife",
  target: "es2022",
  outdir,
  sourcemap: isRelease ? false : true,
  jsx: "automatic",
  jsxImportSource: "preact",
  logLevel: "info",
  define: {
    __API_BASE__: JSON.stringify(apiBase),
  },
});

// ── Static files ─────────────────────────────────────────────────────────────
for (const file of ["popup.html", "options.html", "styles.css"]) {
  cpSync(file, `${outdir}/${file}`);
}
cpSync("icons", `${outdir}/icons`, { recursive: true });

// ── Manifest: sync version from package.json + patch host_permissions ────────
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

manifest.version = pkg.version;

// host_permissions must only list the actual backend origin
const url = new URL(apiBase);
const backendOrigin = `${url.protocol}//${url.host}/*`;
manifest.host_permissions = [backendOrigin];

writeFileSync(`${outdir}/manifest.json`, JSON.stringify(manifest, null, 2));

// ── Rewrite source map paths (dev only) ─────────────────────────────────────
// esbuild writes each source map's "sources" entries relative to the map
// file's location on disk (e.g. "../src/content.ts", since entry points
// are src/*.ts and outdir is dist/). Chrome DevTools resolves that against
// the loaded extension's own origin (chrome-extension://<id>/content.js),
// and "../" escapes above dist/ -- outside anything the extension serves
// -- so despite sourcesContent being embedded, DevTools can't nest the
// original .ts files under a "src" folder in the Sources panel. Rewriting
// to an origin-relative path ("src/content.ts") fixes that.
if (!isRelease) {
  for (const file of readdirSync(outdir)) {
    if (!file.endsWith(".js.map")) continue;
    const mapPath = `${outdir}/${file}`;
    const map = JSON.parse(readFileSync(mapPath, "utf8"));
    map.sources = map.sources.map((source) => source.replace(/^(\.\.\/)+/, ""));
    writeFileSync(mapPath, JSON.stringify(map));
  }
}

console.log(`Built extension to ${outdir}/ (${isRelease ? "release" : "dev"}, API: ${apiBase})`);

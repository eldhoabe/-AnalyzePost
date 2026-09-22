import { existsSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { build } from "esbuild";

const outdir = "dist";

if (existsSync(outdir)) {
  rmSync(outdir, { recursive: true, force: true });
}
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: {
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

console.log(`Built extension to ${outdir}/`);

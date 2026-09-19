// Empaquetado mínimo con esbuild: dos entradas (content script y popup),
// más la copia de manifest, HTML y CSS a `dist/`.
// Uso: `node build.mjs` (o `npm run build`).
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

await build({
  entryPoints: {
    content: "src/content/index.ts",
    popup: "src/popup/popup.ts",
  },
  bundle: true,
  format: "iife",
  target: ["chrome120"],
  outdir: "dist",
  sourcemap: false,
  minify: false,
  logLevel: "info",
});

cpSync("manifest.json", "dist/manifest.json");
cpSync("src/popup/popup.html", "dist/popup.html");
cpSync("src/popup/popup.css", "dist/popup.css");

#!/usr/bin/env node
// La promesa del producto convertida en comprobación: NADA sale del
// navegador. Falla si en `src/` aparece cualquier forma de salir a la red
// fuera del módulo de actualización del catálogo (`src/catalog/update/`,
// que en esta versión no existe), o si el manifest pide más permisos de los
// mínimos. Uso: `npm run check:no-network`.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const ALLOWED_DIR = path.join(SRC, "catalog", "update");

const FORBIDDEN = [
  { name: "fetch(", re: /\bfetch\s*\(/ },
  { name: "XMLHttpRequest", re: /\bXMLHttpRequest\b/ },
  { name: "navigator.sendBeacon", re: /\bsendBeacon\b/ },
  { name: "WebSocket", re: /\bWebSocket\b/ },
  { name: "EventSource", re: /\bEventSource\b/ },
  { name: "importScripts(", re: /\bimportScripts\s*\(/ },
];

const ALLOWED_PERMISSIONS = new Set(["storage"]);
const ALLOWED_HOSTS = new Set(["https://mail.google.com/*"]);

const problems = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(ts|js|mjs|html)$/.test(entry)) continue;
    if (p.startsWith(ALLOWED_DIR + path.sep)) continue;
    const text = readFileSync(p, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      // Un comentario puede NOMBRAR la prohibición (este mismo fichero lo hace);
      // lo que se busca es código.
      const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
      for (const f of FORBIDDEN) {
        if (f.re.test(code)) problems.push(`${path.relative(ROOT, p)}:${i + 1}: ${f.name}`);
      }
    });
  }
}

walk(SRC);

const manifest = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
for (const perm of manifest.permissions ?? []) {
  if (!ALLOWED_PERMISSIONS.has(perm)) problems.push(`manifest.json: permiso no permitido «${perm}»`);
}
for (const host of manifest.host_permissions ?? []) {
  if (!ALLOWED_HOSTS.has(host)) problems.push(`manifest.json: host no permitido «${host}»`);
}
for (const key of ["optional_permissions", "optional_host_permissions", "oauth2", "background"]) {
  if (manifest[key] !== undefined) problems.push(`manifest.json: «${key}» no debe existir en esta versión`);
}
for (const cs of manifest.content_scripts ?? []) {
  for (const m of cs.matches ?? []) {
    if (!ALLOWED_HOSTS.has(m)) problems.push(`manifest.json: content script en host no permitido «${m}»`);
  }
}

if (problems.length) {
  console.error("Salida a la red o permisos de más:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("OK — nada sale del navegador: sin fetch/XHR/beacon/WebSocket en src/, permisos mínimos en manifest.json.");

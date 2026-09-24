#!/usr/bin/env node
// La promesa del producto convertida en comprobación: de aquí no sale tu
// correo. Comprueba cuatro cosas, y la tercera y la cuarta son las que
// sostienen la promesa ahora que el catálogo se descarga:
//
//   1. En `src/` no hay ninguna forma de salir a la red —`fetch`, XHR, beacon,
//      WebSocket, EventSource, `importScripts`— fuera de `src/catalog/update/`.
//   2. El manifest pide los permisos mínimos, y el content script solo corre en
//      Gmail.
//   3. La ÚNICA URL de red que aparece en `src/` es la del catálogo público.
//      Sin esto, la excepción de la carpeta bastaría para llamar a cualquier
//      sitio con tal de hacerlo desde ahí.
//   4. `src/catalog/update/` solo importa el validador y los tipos. Es lo que
//      impide que un dato del buzón llegue a esa carpeta: sin acceso al
//      adaptador de Gmail ni a las tres listas, no hay nada que mandar.
//
// Uso: `npm run check:no-network`.

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
/** Dónde puede correr el content script: solo Gmail. */
const CONTENT_HOSTS = new Set(["https://mail.google.com/*"]);
/** Y a dónde puede llegar la extensión: Gmail y el catálogo público, nada más. */
const ALLOWED_HOSTS = new Set([
  "https://mail.google.com/*",
  "https://raw.githubusercontent.com/fjolivaresDH/correo-particular-catalogo/*",
]);
/** La única URL de red que puede aparecer escrita en `src/`. */
const CATALOG_URL = "https://raw.githubusercontent.com/fjolivaresDH/correo-particular-catalogo/";
/**
 * La única URL a la que puede NAVEGAR la persona con un clic: proponer un
 * remitente al catálogo. No es lo mismo que pedir algo por la red y por eso va
 * aparte — nadie la llama en segundo plano; abre una pestaña con el texto ya
 * escrito y el envío lo hace ella, en su sesión de GitHub. Para que la
 * distinción sea real y no una promesa, esta URL tiene PROHIBIDO aparecer
 * dentro de `src/catalog/update/`, que es la única carpeta donde vive `fetch`:
 * así no queda ningún sitio del código donde las dos cosas puedan juntarse.
 */
const PROPOSE_URL = "https://github.com/fjolivaresDH/correo-particular-catalogo/issues/new";
/** Lo único que `src/catalog/update/` puede importar. */
const UPDATE_IMPORTS = new Set(["../validate", "../../rules/types"]);

const problems = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(ts|js|mjs|html)$/.test(entry)) continue;
    const text = readFileSync(p, "utf8");
    const rel = path.relative(ROOT, p);
    // Los tests NO se empaquetan (esbuild entra solo por el content script y el
    // popup) y además tienen que poder escribir una URL mala o un import
    // prohibido para demostrar que se rechazan. Por eso se les exime de las
    // comprobaciones 3 y 4, que son sobre lo que VIAJA — y un test no viaja.
    // La 1 (salir a la red) les sigue aplicando fuera de `update/`.
    const esTest = /\.test\.ts$/.test(entry);
    // Una URL http(s) escrita en cualquier parte de `src/` que no sea la del
    // catálogo es una salida a la red esperando a que alguien la use.
    const enUpdate = p.startsWith(ALLOWED_DIR + path.sep);
    if (!esTest) {
      for (const m of text.matchAll(/https?:\/\/[^\s"'`)]+/g)) {
        const url = m[0];
        const permitida =
          url.startsWith(CATALOG_URL) ||
          url.startsWith("https://mail.google.com") ||
          (url.startsWith(PROPOSE_URL) && !enUpdate);
        if (!permitida) {
          problems.push(
            url.startsWith(PROPOSE_URL)
              ? `${rel}: la URL de proponer no puede vivir en la carpeta que sí sale a la red`
              : `${rel}: URL de red que no es el catálogo «${url}»`,
          );
        }
      }
    }
    if (enUpdate) {
      if (esTest) continue;
      for (const m of text.matchAll(/^\s*import[^"']*["']([^"']+)["']/gm)) {
        if (!UPDATE_IMPORTS.has(m[1])) {
          problems.push(`${rel}: src/catalog/update/ no puede importar «${m[1]}»`);
        }
      }
      continue;
    }
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
    if (!CONTENT_HOSTS.has(m)) problems.push(`manifest.json: content script en host no permitido «${m}»`);
  }
}

if (problems.length) {
  console.error("Salida a la red o permisos de más:\n" + problems.join("\n"));
  process.exit(1);
}
console.log(
  "OK — tu correo no sale: red solo en src/catalog/update/ y solo al catálogo público, " +
    "esa carpeta no ve nada del buzón, y el manifest pide lo mínimo.",
);

// Copia `catalog/**` desde un clon local de correo-particular-catalogo, anota
// su commit en `catalog/SNAPSHOT` y REGENERA `src/catalog/bundled.ts`. Uso:
//   node scripts/sync-catalog.mjs ../correo-particular-catalogo
//
// Lo tercero es lo que evita un fallo silencioso: si los imports del catálogo
// empaquetado se escribieran a mano, una lista nueva se copiaría al disco y no
// la cargaría nadie — con todos los tests en verde. Aquí la lista que se COPIA
// y la que se CARGA salen de la misma pasada. `bundled.test.ts` comprueba que
// el fichero generado sigue cuadrando con el disco, por si alguien lo edita.
import { cpSync, existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const source = process.argv[2];
if (!source || !existsSync(path.join(source, "catalog"))) {
  console.error("Uso: node scripts/sync-catalog.mjs <ruta-al-clon-del-catalogo>");
  process.exit(1);
}
for (const entry of readdirSync("catalog", { withFileTypes: true })) {
  if (entry.isDirectory()) rmSync(path.join("catalog", entry.name), { recursive: true, force: true });
}
cpSync(path.join(source, "catalog"), "catalog", { recursive: true });
const hash = execSync("git rev-parse HEAD", { cwd: source }).toString().trim();
writeFileSync("catalog/SNAPSHOT", hash + "\n");

writeFileSync("src/catalog/bundled.ts", generarBundled());
const listas = listasEnDisco();
console.log(`Catálogo copiado desde ${source} @ ${hash} — ${listas.length} listas empaquetadas.`);

/** Las listas del catálogo, en orden estable. `index.json` no es una lista. */
export function listasEnDisco() {
  const out = [];
  for (const market of readdirSync("catalog", { withFileTypes: true })) {
    if (!market.isDirectory()) continue;
    for (const f of readdirSync(path.join("catalog", market.name)).sort()) {
      if (f.endsWith(".json")) out.push(`${market.name}/${f}`);
    }
  }
  return out.sort();
}

function identificador(ruta) {
  return ruta
    .replace(/\.json$/, "")
    .replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[^A-Za-z0-9]/g, "");
}

function generarBundled() {
  const listas = listasEnDisco();
  const imports = listas.map((r) => `import ${identificador(r)} from "../../catalog/${r}";`).join("\n");
  return `// GENERADO por \`npm run catalog:sync\` — no se edita a mano.
// Enumera las listas del catálogo empaquetado (\`catalog/**\`, copia literal del
// repositorio público en el commit de \`catalog/SNAPSHOT\`).

${imports}

/** Las listas tal cual están en disco, SIN validar: eso lo hace \`loadBundledCatalog\`. */
export const BUNDLED_LISTS: unknown[] = [${listas.map((r) => identificador(r)).join(", ")}];

/** Las rutas de las que salen, en el mismo orden. Lo comprueba \`bundled.test.ts\`. */
export const BUNDLED_PATHS: string[] = [${listas.map((r) => JSON.stringify(r)).join(", ")}];
`;
}

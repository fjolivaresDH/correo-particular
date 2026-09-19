// Copia `catalog/**` desde un clon local de correo-particular-catalogo y
// anota su commit en `catalog/SNAPSHOT`. Uso:
//   node scripts/sync-catalog.mjs ../correo-particular-catalogo
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
console.log(`Catálogo copiado desde ${source} @ ${hash}`);

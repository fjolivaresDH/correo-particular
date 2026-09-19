// `bundled.ts` lo GENERA `npm run catalog:sync`. Este test es la otra mitad:
// comprueba que lo generado sigue cuadrando con lo que hay en disco, por si
// alguien lo edita a mano o copia una lista sin volver a sincronizar. Sin él,
// una lista nueva se quedaría en `catalog/` sin que la cargara nadie, y todo
// lo demás seguiría en verde.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BUNDLED_LISTS, BUNDLED_PATHS } from "./bundled";
import { loadBundledCatalog } from "./index";

const RAIZ = path.resolve(__dirname, "../..");

function listasEnDisco(): string[] {
  const out: string[] = [];
  const catalogo = path.join(RAIZ, "catalog");
  for (const market of readdirSync(catalogo, { withFileTypes: true })) {
    if (!market.isDirectory()) continue;
    for (const f of readdirSync(path.join(catalogo, market.name))) {
      if (f.endsWith(".json")) out.push(`${market.name}/${f}`);
    }
  }
  return out.sort();
}

describe("el catálogo empaquetado", () => {
  it("empaqueta exactamente las listas que hay en disco", () => {
    expect([...BUNDLED_PATHS].sort()).toEqual(listasEnDisco());
  });

  it("carga y valida todas", () => {
    const listas = loadBundledCatalog();
    expect(listas).toHaveLength(BUNDLED_PATHS.length);
    expect(BUNDLED_LISTS).toHaveLength(BUNDLED_PATHS.length);
  });

  it("trae bastantes reglas como para que el catálogo sirva de algo", () => {
    const reglas = loadBundledCatalog().flatMap((l) => l.rules);
    expect(reglas.length).toBeGreaterThan(200);
    // Ids únicos en TODO el catálogo: dos reglas con el mismo id son una regla
    // que pisa a otra según el orden de carga.
    expect(new Set(reglas.map((r) => r.id)).size).toBe(reglas.length);
  });

  it("el índice que se publica nombra las mismas listas que se empaquetan", () => {
    const indice = JSON.parse(readFileSync(path.join(RAIZ, "catalog/index.json"), "utf8")) as { lists: string[] };
    expect([...indice.lists].sort()).toEqual(listasEnDisco());
  });

  it("nada del catálogo se ha verificado todavía: se enseña como «ejemplo»", () => {
    const sinVerificar = loadBundledCatalog()
      .flatMap((l) => l.rules)
      .every((r) => r.verified === false);
    // Cuando alguien verifique reglas de verdad, este test cambia a la vez que
    // el catálogo -- está para que «verified» no se ponga a true por descuido.
    expect(sinVerificar).toBe(true);
  });
});

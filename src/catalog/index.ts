// De dónde salen las reglas que aplica la extensión. Dos fuentes, en este
// orden: lo DESCARGADO (si hay algo guardado y válido) y, si no, lo
// EMPAQUETADO, que es una copia literal de `catalog/**` del repositorio público
// tomada en el commit que dice `catalog/SNAPSHOT`.
//
// Las dos pasan por la MISMA validación (`validateList`): categorías cerradas,
// forma de los dominios, expresiones que compilan. Un JSON roto —venga de donde
// venga— tumbaría el content script en silencio, así que falla ruidoso al
// cargar y se cae a la fuente de debajo.
//
// La descarga vive aparte, en `src/catalog/update/`, la única carpeta donde
// `npm run check:no-network` tolera `fetch(`. Lee su cabecera antes de tocarla.

import { BUNDLED_LISTS } from "./bundled";
import { cachedCatalog } from "./update/index";
import type { RuleList } from "../rules/types";
import { validateList } from "./validate";

let cached: RuleList[] | null = null;

/** Las listas del catálogo empaquetado, ya validadas. Lanza si alguna es inválida. */
export function loadBundledCatalog(): RuleList[] {
  if (cached) return cached;
  cached = BUNDLED_LISTS.map((doc, i) => validateList(doc, `bundled[${i}]`));
  return cached;
}

/**
 * El catálogo que toca usar ahora mismo: lo descargado si lo hay, y si no lo
 * empaquetado. Nunca devuelve una lista vacía y nunca lanza por culpa de la
 * caché: una caché ilegible se ignora, no rompe la extensión.
 */
export async function loadCatalog(): Promise<{ lists: RuleList[]; source: "downloaded" | "bundled" }> {
  const descargado = await cachedCatalog();
  if (descargado && descargado.length > 0) return { lists: descargado, source: "downloaded" };
  return { lists: loadBundledCatalog(), source: "bundled" };
}

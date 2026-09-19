// Catálogo empaquetado: copia literal de `catalog/**` del repositorio público
// (ver `catalog/README.md`). Se valida al cargar con una comprobación ligera
// (categorías cerradas, forma de dominios), porque un JSON roto aquí tumbaría
// el content script en silencio.
//
// TODO (actualización en caliente): descargar desde GitHub raw con caché en
// `chrome.storage`. Vivirá en `src/catalog/update/`, la ÚNICA carpeta donde
// `npm run check:no-network` tolera `fetch(`.

import esEnergiaYTelecos from "../../catalog/es/energia-y-telecos.json";
import globalServiciosDigitales from "../../catalog/global/servicios-digitales.json";
import type { RuleList } from "../rules/types";
import { validateList } from "./validate";

const RAW: unknown[] = [esEnergiaYTelecos, globalServiciosDigitales];

let cached: RuleList[] | null = null;

/** Las listas del catálogo empaquetado, ya validadas. Lanza si alguna es inválida. */
export function loadBundledCatalog(): RuleList[] {
  if (cached) return cached;
  cached = RAW.map((doc, i) => validateList(doc, `bundled[${i}]`));
  return cached;
}

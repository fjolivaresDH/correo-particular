// LA ÚNICA carpeta de la extensión que puede salir a la red, y solo para UNA
// cosa: traerse el catálogo público de reglas. Lo vigila
// `npm run check:no-network`, que aquí tolera `fetch(` y en cualquier otro
// sitio de `src/` falla.
//
// Cuatro decisiones que hacen esto admisible, y que no se relajan:
//
//   1. **La petición no lleva NADA del buzón.** Es un GET a una URL FIJA y
//      constante (abajo), sin parámetros, sin cabeceras nuestras, sin cuerpo.
//      No hay forma de que un dato del correo llegue a la red por aquí, y este
//      módulo no importa nada del adaptador de Gmail ni de las tres listas:
//      solo el validador y los tipos (lo comprueba la lista blanca de imports
//      de `check-no-network`).
//   2. **La dispara la PERSONA, no un reloj.** Se llama al abrir el popup, y
//      como mucho una vez al día. No hay service worker ni `alarms`: una
//      descarga periódica en segundo plano es, en la práctica, un «sigo aquí»
//      diario a un servidor ajeno, que es justo lo que este producto no hace.
//   3. **Lo descargado se valida con la MISMA función que lo empaquetado**
//      (`validateList`): categorías cerradas, dominios con forma de dominio,
//      expresiones que compilan y con tope de longitud. Una lista que no valida
//      se descarta entera y se sigue con lo que ya había.
//   4. **Nunca se queda sin catálogo.** Si la red falla, si GitHub responde otra
//      cosa o si el índice no se entiende, se devuelve `null` y quien llama usa
//      la caché anterior o, en su defecto, el catálogo empaquetado.
//
// Lo que esto NO es: un canal de configuración. El índice solo puede nombrar
// ficheros con forma `es/algo.json` o `global/algo.json` — una ruta que no la
// cumpla no se sigue, así que ni un índice manipulado puede hacer que la
// extensión pida otra cosa a otro sitio.

import { validateList } from "../validate";
import type { RuleList } from "../../rules/types";

/** Rama `main` del catálogo público, en bruto. Constante: no se configura. */
const BASE = "https://raw.githubusercontent.com/fjolivaresDH/correo-particular-catalogo/main/catalog/";

/** Forma cerrada de una ruta del índice. Todo lo demás se ignora. */
const LIST_PATH = /^(es|global)\/[a-z0-9-]+\.json$/;

/** Una vez al día basta: el catálogo lo mueven personas, no una máquina. */
export const TTL_MS = 24 * 60 * 60 * 1000;

/** Tope de tamaño por fichero; un catálogo sano está muy por debajo. */
const MAX_BYTES = 512 * 1024;

const TIMEOUT_MS = 8000;

export const CATALOG_CACHE_KEY = "catalog";

export interface CatalogCache {
  /** ISO del momento en que se descargó. */
  fetchedAt: string;
  lists: RuleList[];
}

/** Lo mínimo que este módulo necesita del mundo, para poder probarlo entero. */
export interface UpdateDeps {
  fetchText(url: string): Promise<string>;
  readCache(): Promise<CatalogCache | null>;
  writeCache(cache: CatalogCache): Promise<void>;
  now(): Date;
}

async function fetchTextFromNetwork(url: string): Promise<string> {
  const res = await fetch(url, {
    // Ni cookies ni credenciales: es un fichero público y así se pide.
    credentials: "omit",
    cache: "no-cache",
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("fichero demasiado grande");
  return text;
}

export const browserDeps: UpdateDeps = {
  fetchText: fetchTextFromNetwork,
  async readCache() {
    const got = await chrome.storage.local.get(CATALOG_CACHE_KEY);
    const raw = got[CATALOG_CACHE_KEY];
    return isCache(raw) ? raw : null;
  },
  async writeCache(cache) {
    await chrome.storage.local.set({ [CATALOG_CACHE_KEY]: cache });
  },
  now: () => new Date(),
};

function isCache(raw: unknown): raw is CatalogCache {
  if (typeof raw !== "object" || raw === null) return false;
  const c = raw as Partial<CatalogCache>;
  return typeof c.fetchedAt === "string" && Array.isArray(c.lists);
}

function parseIndex(text: string): string[] {
  const doc: unknown = JSON.parse(text);
  if (typeof doc !== "object" || doc === null) throw new Error("índice que no es un objeto");
  const { version, lists } = doc as { version?: unknown; lists?: unknown };
  // Un índice de un formato que no conocemos no se interpreta a medias.
  if (version !== 1) throw new Error(`versión de índice desconocida (${String(version)})`);
  if (!Array.isArray(lists) || lists.length === 0) throw new Error("índice sin listas");
  const rutas = lists.filter((p): p is string => typeof p === "string" && LIST_PATH.test(p));
  if (rutas.length === 0) throw new Error("índice sin ninguna ruta con forma válida");
  return rutas;
}

/**
 * Trae el catálogo si toca. Devuelve las listas descargadas, o `null` si no
 * hacía falta (caché fresca) o si algo falló — nunca lanza.
 */
export async function refreshCatalog(deps: UpdateDeps = browserDeps): Promise<RuleList[] | null> {
  try {
    const cache = await deps.readCache();
    if (cache) {
      const edad = deps.now().getTime() - new Date(cache.fetchedAt).getTime();
      // `edad < 0` es un reloj que se movió hacia atrás: se trata como fresca,
      // que es el lado conservador (no descargar).
      if (Number.isNaN(edad) || edad < TTL_MS) return null;
    }
    const rutas = parseIndex(await deps.fetchText(`${BASE}index.json`));
    const listas: RuleList[] = [];
    for (const ruta of rutas) {
      const texto = await deps.fetchText(`${BASE}${ruta}`);
      listas.push(validateList(JSON.parse(texto), ruta));
    }
    await deps.writeCache({ fetchedAt: deps.now().toISOString(), lists: listas });
    return listas;
  } catch {
    // Sin catálogo nuevo se sigue con el de antes: quien llama no se entera.
    return null;
  }
}

/** Las listas descargadas que haya guardadas, ya validadas, o `null`. */
export async function cachedCatalog(deps: UpdateDeps = browserDeps): Promise<RuleList[] | null> {
  try {
    const cache = await deps.readCache();
    if (!cache) return null;
    // Se revalida al LEER, no solo al escribir: lo que hay en `storage` pudo
    // guardarlo una versión anterior con otro esquema.
    return cache.lists.map((doc, i) => validateList(doc, `cache[${i}]`));
  } catch {
    return null;
  }
}

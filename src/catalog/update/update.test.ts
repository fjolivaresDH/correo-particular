// El módulo de actualización, entero contra dobles: qué pide, qué acepta y qué
// hace cuando algo va mal. La caja de arena es la red y `chrome.storage`, así
// que no hace falta navegador.

import { describe, expect, it } from "vitest";
import { CATALOG_CACHE_KEY, TTL_MS, cachedCatalog, refreshCatalog, type CatalogCache, type UpdateDeps } from "./index";

const BASE = "https://raw.githubusercontent.com/fjolivaresDH/correo-particular-catalogo/main/catalog/";

const LISTA_ES = {
  market: "es",
  rules: [
    {
      id: "iberdrola",
      name: "Iberdrola",
      category: "bill",
      match: { domains: ["iberdrola.es"] },
      market: "es",
      verified: false,
    },
  ],
};

interface Caja {
  deps: UpdateDeps;
  pedidas: string[];
  guardado: CatalogCache | null;
}

function caja(opts: {
  ficheros?: Record<string, unknown>;
  cache?: CatalogCache | null;
  ahora?: string;
  falla?: (url: string) => boolean;
} = {}): Caja {
  const ficheros = opts.ficheros ?? {
    "index.json": { version: 1, lists: ["es/energia.json"] },
    "es/energia.json": LISTA_ES,
  };
  const c: Caja = {
    pedidas: [],
    guardado: null,
    deps: {
      async fetchText(url) {
        c.pedidas.push(url);
        if (opts.falla?.(url)) throw new Error("red caída");
        const clave = url.slice(BASE.length);
        const doc = ficheros[clave];
        if (doc === undefined) throw new Error(`404 ${clave}`);
        return typeof doc === "string" ? doc : JSON.stringify(doc);
      },
      async readCache() {
        return opts.cache ?? null;
      },
      async writeCache(cache) {
        c.guardado = cache;
      },
      now: () => new Date(opts.ahora ?? "2026-09-19T12:00:00.000Z"),
    },
  };
  return c;
}

const HACE_DOS_DIAS = "2026-09-17T12:00:00.000Z";

describe("refreshCatalog", () => {
  it("sin caché: pide el índice y cada lista, y guarda lo validado", async () => {
    const c = caja();
    const listas = await refreshCatalog(c.deps);
    expect(c.pedidas).toEqual([`${BASE}index.json`, `${BASE}es/energia.json`]);
    expect(listas).toHaveLength(1);
    expect(listas?.[0]?.rules[0]?.id).toBe("iberdrola");
    expect(c.guardado?.fetchedAt).toBe("2026-09-19T12:00:00.000Z");
  });

  it("con caché fresca no pide NADA: el tope es un día", async () => {
    const c = caja({ cache: { fetchedAt: "2026-09-19T06:00:00.000Z", lists: [] } });
    expect(await refreshCatalog(c.deps)).toBeNull();
    expect(c.pedidas).toEqual([]);
  });

  it("con caché vieja sí pide", async () => {
    const c = caja({ cache: { fetchedAt: HACE_DOS_DIAS, lists: [] } });
    expect(await refreshCatalog(c.deps)).not.toBeNull();
    expect(c.pedidas.length).toBe(2);
    expect(TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("una fecha de caché ilegible se trata como fresca: no descargar es el lado seguro", async () => {
    const c = caja({ cache: { fetchedAt: "vete a saber", lists: [] } });
    expect(await refreshCatalog(c.deps)).toBeNull();
    expect(c.pedidas).toEqual([]);
  });

  it("si la red falla no lanza, no guarda nada y quien llama se queda con lo que tenía", async () => {
    const c = caja({ falla: () => true });
    expect(await refreshCatalog(c.deps)).toBeNull();
    expect(c.guardado).toBeNull();
  });

  it("una lista que no valida tira la descarga ENTERA, no se guarda a medias", async () => {
    const c = caja({
      ficheros: {
        "index.json": { version: 1, lists: ["es/buena.json", "es/mala.json"] },
        "es/buena.json": LISTA_ES,
        "es/mala.json": { market: "es", rules: [{ id: "x", name: "X", category: "inventada", match: { domains: ["x.es"] }, verified: false }] },
      },
    });
    expect(await refreshCatalog(c.deps)).toBeNull();
    expect(c.guardado).toBeNull();
  });

  it("una versión de índice que no conocemos no se interpreta a medias", async () => {
    const c = caja({ ficheros: { "index.json": { version: 2, lists: ["es/energia.json"] }, "es/energia.json": LISTA_ES } });
    expect(await refreshCatalog(c.deps)).toBeNull();
    expect(c.pedidas).toEqual([`${BASE}index.json`]);
  });

  it("el índice solo puede nombrar ficheros del catálogo: una ruta rara ni se pide", async () => {
    const c = caja({
      ficheros: {
        "index.json": {
          version: 1,
          lists: ["../../../etc/passwd", "https://otro-sitio.test/x.json", "es/../secreto.json", "es/energia.json"],
        },
        "es/energia.json": LISTA_ES,
      },
    });
    await refreshCatalog(c.deps);
    expect(c.pedidas).toEqual([`${BASE}index.json`, `${BASE}es/energia.json`]);
  });

  it("un índice cuyas rutas son TODAS raras no descarga nada", async () => {
    const c = caja({ ficheros: { "index.json": { version: 1, lists: ["http://malo.test/a.json"] } } });
    expect(await refreshCatalog(c.deps)).toBeNull();
    expect(c.guardado).toBeNull();
  });

  it("un índice que no es JSON no rompe nada", async () => {
    const c = caja({ ficheros: { "index.json": "<html>404</html>" } });
    expect(await refreshCatalog(c.deps)).toBeNull();
  });
});

describe("cachedCatalog", () => {
  it("devuelve lo guardado, revalidado", async () => {
    const c = caja({ cache: { fetchedAt: HACE_DOS_DIAS, lists: [LISTA_ES] as never } });
    const listas = await cachedCatalog(c.deps);
    expect(listas?.[0]?.rules[0]?.name).toBe("Iberdrola");
  });

  it("una caché guardada por una versión anterior, con otra forma, se ignora en vez de romper", async () => {
    const c = caja({ cache: { fetchedAt: HACE_DOS_DIAS, lists: [{ market: "marte", rules: [] }] as never } });
    expect(await cachedCatalog(c.deps)).toBeNull();
  });

  it("sin caché, null", async () => {
    expect(await cachedCatalog(caja().deps)).toBeNull();
  });

  it("la clave de storage es la que espera el resto", () => {
    expect(CATALOG_CACHE_KEY).toBe("catalog");
  });
});

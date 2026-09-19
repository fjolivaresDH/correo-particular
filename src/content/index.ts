// Content script: corre dentro de mail.google.com. Lee la lista con el
// adaptador, clasifica con el motor sobre el catálogo empaquetado y guarda
// METADATOS en `chrome.storage.local`. Nada sale del navegador: aquí no hay
// `fetch`, ni mensajes a un servidor, ni telemetría (lo vigila
// `npm run check:no-network`).

import { loadBundledCatalog } from "../catalog/index";
import { parseList } from "../gmail/parse-row";
import { createEngine } from "../rules/engine";
import { type ClassifiedRow, type ScanResult, STORAGE_KEYS } from "../shared/types";

const SCAN_DEBOUNCE_MS = 1200;

const engine = createEngine(loadBundledCatalog());

/** Vista actual según el hash de Gmail (`#inbox`, `#sent`, `#search/...`). Solo informativo. */
function currentView(): string {
  const hash = location.hash.replace(/^#/, "");
  return (hash.split("/")[0] || "inbox").toLowerCase();
}

function scan(): void {
  const root = document.querySelector('div[role="main"]') ?? document;
  const now = new Date();
  const rows: ClassifiedRow[] = parseList(root, now).map((row) => ({
    ...row,
    classification: engine.classify({ senderEmail: row.senderEmail, subject: row.subject }, now),
  }));
  if (rows.length === 0) return; // Vista sin lista (un hilo abierto, ajustes…): no se pisa lo anterior.
  const result: ScanResult = {
    scannedAt: now.toISOString(),
    view: currentView(),
    rows,
    ruleCount: engine.ruleCount,
  };
  void chrome.storage.local.set({ [STORAGE_KEYS.scan]: result });
}

let timer: number | undefined;
function scheduleScan(): void {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = undefined;
    try {
      scan();
    } catch {
      // Si Gmail ha cambiado y el adaptador falla, la extensión calla; no
      // hay a quién avisar fuera del navegador y no debe romper la página.
    }
  }, SCAN_DEBOUNCE_MS);
}

// Gmail pinta la lista después de cargar y la re-pinta al navegar: se observa
// el documento y se barre con un pequeño retardo para no repetir trabajo.
const observer = new MutationObserver(scheduleScan);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("hashchange", scheduleScan);
scheduleScan();

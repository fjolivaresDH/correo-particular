// Popup: lee `chrome.storage.local` (lo que dejó el content script) y pinta
// las tres listas con los módulos puros de `src/aha/`. No toca Gmail ni la
// red. Texto en castellano; sin marca más allá del pie.

import { computeAha } from "../aha/index";
import type { CategoryKey } from "../aha/categories";
import { DEFAULT_SETTINGS, type ScanResult, type Settings, STORAGE_KEYS } from "../shared/types";

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  bill: "Recibos y facturas",
  renewal: "Renovaciones",
  warranty: "Garantías",
  "return-window": "Plazos de devolución",
  appointment: "Citas",
  subscription: "Suscripciones",
  newsletter: "Boletines",
  notification: "Avisos automáticos",
  shop: "Compras",
  government: "Administración",
  bank: "Banco",
  delivery: "Envíos",
  unknown: "Sin reconocer todavía",
};

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Falta #${id} en popup.html`);
  return node as T;
}

function li(): HTMLLIElement {
  return document.createElement("li");
}

function span(className: string, text: string): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = className;
  s.textContent = text;
  return s;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}/${y}`;
}

function formatAmount(amount: number | null, text: string | null): string {
  if (amount === null) return "";
  return text ? `${text} €` : `${amount.toFixed(2).replace(".", ",")} €`;
}

function exampleBadge(verified: boolean): HTMLSpanElement | null {
  return verified ? null : span("badge", "ejemplo");
}

function render(scan: ScanResult | null, settings: Settings): void {
  const status = el<HTMLParagraphElement>("status");
  const dueList = el<HTMLUListElement>("due");
  const catList = el<HTMLUListElement>("categories");
  const owedList = el<HTMLUListElement>("owed");
  dueList.replaceChildren();
  catList.replaceChildren();
  owedList.replaceChildren();

  if (!scan) {
    status.textContent = "Abre Gmail en una pestaña para que la extensión lea la lista.";
    el("due-empty").hidden = false;
    el("categories-empty").hidden = false;
    el("owed-empty").hidden = false;
    return;
  }

  const when = new Date(scan.scannedAt);
  status.textContent = `${scan.rows.length} conversaciones leídas de la vista «${scan.view}» a las ${when.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}, con ${scan.ruleCount} reglas.`;

  const aha = computeAha(scan.rows, settings.owedDays);

  for (const item of aha.due) {
    const row = li();
    const line = document.createElement("div");
    line.className = "row";
    const grow = document.createElement("span");
    grow.className = "grow";
    const head = document.createElement("span");
    head.className = "strong";
    head.textContent = item.dueDate
      ? `vence el ${formatDate(item.dueDate)} · ${item.organization}`
      : `${item.organization} · ${formatDate(item.emailDate)}`;
    grow.append(head);
    const amount = formatAmount(item.amount, item.amountText);
    if (amount) grow.append(document.createTextNode(` · ${amount}`));
    grow.append(span("subject", item.subject));
    line.append(grow);
    line.append(span("badge", CATEGORY_LABELS[item.category]));
    const badge = exampleBadge(item.verified);
    if (badge) line.append(badge);
    row.append(line);
    dueList.append(row);
  }
  el("due-empty").hidden = aha.due.length > 0;

  for (const c of aha.categories) {
    const row = li();
    const line = document.createElement("div");
    line.className = "row";
    const grow = document.createElement("span");
    grow.className = "grow";
    grow.append(span("strong", CATEGORY_LABELS[c.category]));
    if (c.organizations.length > 0) {
      const orgs = c.organizations
        .slice(0, 6)
        .map((o) => `${o.name} (${o.count})${o.verified ? "" : " · ejemplo"}`)
        .join(", ");
      grow.append(span("orgs", orgs));
      grow.querySelector(".orgs")!.setAttribute("style", "display:block");
    }
    line.append(grow);
    line.append(span("count", String(c.count)));
    row.append(line);
    catList.append(row);
  }
  el("categories-empty").hidden = aha.categories.length > 0;

  for (const item of aha.owed) {
    const row = li();
    const line = document.createElement("div");
    line.className = "row";
    const grow = document.createElement("span");
    grow.className = "grow";
    grow.append(span("strong", item.senderName ?? item.senderEmail ?? "Alguien"));
    grow.append(span("subject", item.subject));
    line.append(grow);
    line.append(span("badge", `${item.daysWaiting} días`));
    row.append(line);
    owedList.append(row);
  }
  el("owed-empty").hidden = aha.owed.length > 0;
}

function selectTab(name: string): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(".tabs button")) {
    const selected = button.dataset.tab === name;
    button.setAttribute("aria-selected", selected ? "true" : "false");
  }
  for (const panel of document.querySelectorAll<HTMLElement>("[role=tabpanel]")) {
    panel.hidden = panel.id !== `tab-${name}`;
  }
}

async function main(): Promise<void> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.scan, STORAGE_KEYS.settings]);
  let scan = (stored[STORAGE_KEYS.scan] as ScanResult | undefined) ?? null;
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEYS.settings] as Partial<Settings> | undefined) };

  const days = el<HTMLInputElement>("owed-days");
  days.value = String(settings.owedDays);
  days.addEventListener("change", () => {
    const n = Number.parseInt(days.value, 10);
    if (!Number.isFinite(n) || n < 1) return;
    settings.owedDays = n;
    void chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
    render(scan, settings);
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>(".tabs button")) {
    button.addEventListener("click", () => selectTab(button.dataset.tab ?? "due"));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEYS.scan]) return;
    scan = (changes[STORAGE_KEYS.scan]!.newValue as ScanResult | undefined) ?? null;
    render(scan, settings);
  });

  render(scan, settings);
}

void main();

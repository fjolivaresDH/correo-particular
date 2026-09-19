// Aha 1 — «Qué vence»: correos de categorías con fecha (recibo, renovación,
// garantía, plazo de devolución, cita, suscripción) que traen fecha de
// vencimiento o importe, ordenados por fecha. Puro.

import type { Category } from "../rules/types";
import type { ClassifiedRow } from "../shared/types";

export const DUE_CATEGORIES: ReadonlySet<Category> = new Set<Category>([
  "bill",
  "renewal",
  "warranty",
  "return-window",
  "appointment",
  "subscription",
]);

export interface DueItem {
  threadId: string;
  organization: string;
  category: Category;
  subject: string;
  /** Fecha de vencimiento extraída del asunto, o `null`. */
  dueDate: string | null;
  amount: number | null;
  amountText: string | null;
  /** Fecha del correo (ISO) — la que ordena cuando no hay vencimiento. */
  emailDate: string | null;
  /** Regla sin verificar contra correos reales: se enseña como «ejemplo». */
  verified: boolean;
}

/** Fecha por la que se ordena un vencimiento: la de vencimiento, si no la del correo. */
function sortKey(item: DueItem): string {
  return item.dueDate ?? item.emailDate ?? "9999-12-31";
}

export function dueList(rows: ClassifiedRow[]): DueItem[] {
  const items: DueItem[] = [];
  for (const row of rows) {
    const c = row.classification;
    if (!c || !DUE_CATEGORIES.has(c.category)) continue;
    if (c.dueDate === null && c.amount === null) continue;
    items.push({
      threadId: row.threadId,
      organization: c.organization,
      category: c.category,
      subject: row.subject,
      dueDate: c.dueDate,
      amount: c.amount,
      amountText: c.amountText,
      emailDate: row.date,
      verified: c.verified,
    });
  }
  items.sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.organization.localeCompare(b.organization));
  return items;
}

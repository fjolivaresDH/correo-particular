// Aha 2 — «Qué es cada cosa»: recuento por categoría del catálogo, más
// «sin reconocer» para lo que ningún remitente del catálogo casa. Es dato de
// CONTRAPARTE (qué es cada remitente), nunca de cómo trabaja la persona. Puro.

import { CATEGORIES, type Category } from "../rules/types";
import type { ClassifiedRow } from "../shared/types";

export type CategoryKey = Category | "unknown";

export interface CategoryCount {
  category: CategoryKey;
  count: number;
  /** Organizaciones reconocidas en esa categoría, por número de correos, de más a menos. */
  organizations: { name: string; count: number; verified: boolean }[];
}

export function categoryCounts(rows: ClassifiedRow[]): CategoryCount[] {
  const byCategory = new Map<CategoryKey, Map<string, { count: number; verified: boolean }>>();
  const totals = new Map<CategoryKey, number>();

  for (const row of rows) {
    const key: CategoryKey = row.classification?.category ?? "unknown";
    totals.set(key, (totals.get(key) ?? 0) + 1);
    if (!row.classification) continue;
    const orgs = byCategory.get(key) ?? new Map();
    const org = orgs.get(row.classification.organization) ?? { count: 0, verified: row.classification.verified };
    org.count++;
    orgs.set(row.classification.organization, org);
    byCategory.set(key, orgs);
  }

  const order: CategoryKey[] = [...CATEGORIES, "unknown"];
  const out: CategoryCount[] = [];
  for (const category of order) {
    const count = totals.get(category) ?? 0;
    if (count === 0) continue;
    const organizations = Array.from(byCategory.get(category)?.entries() ?? [])
      .map(([name, v]) => ({ name, count: v.count, verified: v.verified }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    out.push({ category, count, organizations });
  }
  out.sort((a, b) => b.count - a.count || order.indexOf(a.category) - order.indexOf(b.category));
  return out;
}

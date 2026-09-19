// Validación ligera de una lista del catálogo, espejo de lo que comprueba
// `validate.cjs` en el repositorio del catálogo. No es un validador de JSON
// Schema completo: existe para que un fichero roto falle ruidoso al cargar.

import { CATEGORIES, type Category, type Rule, type RuleList } from "../rules/types";

const ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const DOMAIN = /^([a-z0-9-]+\.)+[a-z]{2,}$/;
const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORIES);

function fail(where: string, msg: string): never {
  throw new Error(`Catálogo inválido (${where}): ${msg}`);
}

function checkPatterns(where: string, value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) fail(where, "debe ser una lista");
  for (const p of value) {
    if (typeof p !== "string" || p.length > 200) fail(where, "patrón inválido");
    try {
      new RegExp(p);
    } catch {
      fail(where, `la expresión «${p}» no compila`);
    }
  }
  return value as string[];
}

function checkRule(where: string, raw: unknown): Rule {
  if (typeof raw !== "object" || raw === null) fail(where, "regla que no es un objeto");
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  if (!ID.test(id)) fail(where, `id inválido «${id}»`);
  const w = `${where}/${id}`;
  if (typeof r.name !== "string" || r.name.length < 2 || r.name.length > 64) fail(w, "name entre 2 y 64");
  if (typeof r.category !== "string" || !CATEGORY_SET.has(r.category)) fail(w, `category fuera de la lista «${String(r.category)}»`);
  if (typeof r.verified !== "boolean") fail(w, "verified debe ser booleano");
  const match = r.match as Record<string, unknown> | undefined;
  const domains = match?.domains;
  if (!Array.isArray(domains) || domains.length === 0) fail(w, "match.domains obligatorio");
  for (const d of domains) if (typeof d !== "string" || !DOMAIN.test(d)) fail(w, `dominio inválido «${String(d)}»`);
  const extract = r.extract as Record<string, unknown> | undefined;
  const rule: Rule = {
    id,
    name: r.name,
    category: r.category as Category,
    match: { domains: domains as string[] },
    verified: r.verified,
  };
  const subject = checkPatterns(`${w}.match.subject`, match?.subject);
  if (subject) rule.match.subject = subject;
  if (extract !== undefined) {
    rule.extract = {};
    const dueDate = checkPatterns(`${w}.extract.dueDate`, extract.dueDate);
    const amount = checkPatterns(`${w}.extract.amount`, extract.amount);
    if (dueDate) rule.extract.dueDate = dueDate;
    if (amount) rule.extract.amount = amount;
  }
  if (r.market !== undefined) {
    if (r.market !== "es" && r.market !== "global") fail(w, "market fuera de la lista");
    rule.market = r.market;
  }
  if (r.notes !== undefined) {
    if (typeof r.notes !== "string") fail(w, "notes debe ser texto");
    rule.notes = r.notes;
  }
  return rule;
}

export function validateList(raw: unknown, where: string): RuleList {
  if (typeof raw !== "object" || raw === null) fail(where, "no es un objeto");
  const doc = raw as Record<string, unknown>;
  if (doc.market !== "es" && doc.market !== "global") fail(where, `market fuera de la lista «${String(doc.market)}»`);
  if (!Array.isArray(doc.rules) || doc.rules.length === 0) fail(where, "rules vacío");
  const rules = doc.rules.map((r, i) => checkRule(`${where}#${i}`, r));
  const seen = new Set<string>();
  for (const r of rules) {
    if (seen.has(r.id)) fail(where, `id duplicado «${r.id}»`);
    seen.add(r.id);
  }
  return { market: doc.market, rules };
}

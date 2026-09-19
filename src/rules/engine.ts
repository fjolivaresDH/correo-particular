// Motor de reglas: puro, sin DOM. Recibe el catálogo y una cabecera de correo
// (remitente y asunto) y devuelve la clasificación, o `null` si ningún
// remitente del catálogo casa. Nunca lee el cuerpo: `extract.*` se aplica
// SOLO sobre el asunto en la versión gratis, como dice el esquema.

import { domainMatches, domainOf } from "./domain";
import { firstCapture, parseAmount, parseDate } from "./extract";
import type { Classification, EmailHeader, Rule, RuleList } from "./types";

interface IndexedDomain {
  domain: string;
  rule: Rule;
}

export interface RuleEngine {
  classify(email: EmailHeader, now?: Date): Classification | null;
  readonly ruleCount: number;
}

function safeTest(pattern: string, subject: string): boolean {
  try {
    return new RegExp(pattern, "i").test(subject);
  } catch {
    return false;
  }
}

/**
 * Construye el motor a partir de una o varias listas del catálogo. Entre dos
 * reglas cuyos dominios casen con el remitente gana el dominio MÁS LARGO
 * (`account.netflix.com` antes que `netflix.com`); a igual longitud, la que
 * aparezca antes en el catálogo.
 */
export function createEngine(lists: RuleList[]): RuleEngine {
  const index: IndexedDomain[] = [];
  let ruleCount = 0;
  for (const list of lists) {
    for (const rule of list.rules) {
      ruleCount++;
      for (const domain of rule.match.domains) index.push({ domain: domain.toLowerCase(), rule });
    }
  }
  // Orden estable: más largo primero; así el primer acierto es el más específico.
  index.sort((a, b) => b.domain.length - a.domain.length);

  return {
    ruleCount,
    classify(email, now = new Date()) {
      const domain = domainOf(email.senderEmail);
      if (!domain) return null;
      const hit = index.find((entry) => domainMatches(domain, entry.domain));
      if (!hit) return null;
      const { rule } = hit;
      const subject = email.subject ?? "";

      const patterns = rule.match.subject;
      const subjectMatched = patterns && patterns.length > 0
        ? patterns.some((p) => safeTest(p, subject))
        : null;

      // Si la regla afina por asunto y este no casa, el correo es de la
      // organización pero no es «lo que manda normalmente»: no se extrae nada.
      const extractable = subjectMatched !== false;
      const dueRaw = extractable ? firstCapture(rule.extract?.dueDate, subject) : null;
      const amountRaw = extractable ? firstCapture(rule.extract?.amount, subject) : null;
      const amount = amountRaw ? parseAmount(amountRaw) : null;

      return {
        ruleId: rule.id,
        organization: rule.name,
        category: rule.category,
        verified: rule.verified,
        subjectMatched,
        dueDate: dueRaw ? parseDate(dueRaw, now) : null,
        amount,
        amountText: amount === null ? null : amountRaw,
      };
    },
  };
}

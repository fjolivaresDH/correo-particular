// Qué remitentes de los que se ven NO reconoce el catálogo, para poder
// proponerlos. Módulo PURO: no toca la red ni el DOM; decide a partir de las
// filas ya clasificadas.
//
// LA RAYA QUE NO SE CRUZA (la misma del catálogo, y por eso está aquí y no en
// la interfaz): **solo organizaciones, jamás personas.** Una regla del catálogo
// es pública para siempre, así que proponer el dominio del correo de alguien
// sería publicar con quién se escribe. Dos defensas, y ninguna sobra:
//
//   1. Aquí se descartan los dominios de correo PERSONAL conocidos (Gmail,
//      Outlook, Yahoo…). Es una lista corta y cerrada: no pretende adivinar si
//      un dominio es de empresa, solo quitar de en medio lo que seguro no lo
//      es. Un dominio propio de una persona (`nombreapellido.com`) se le
//      escaparía, y por eso existe la segunda.
//   2. La propone la PERSONA, con un clic, viendo antes exactamente qué se
//      manda (`src/popup/`). Nada sale solo.
//
// Y lo que se propone es el DOMINIO, nunca la dirección: `iberdrola.es`, no
// `facturas@iberdrola.es`. Una dirección es de alguien; un dominio de envío
// masivo es de una organización.

import type { ClassifiedRow } from "../shared/types";

/** Dominios de correo personal: nunca se proponen. Lista cerrada, a propósito. */
const PERSONAL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.es",
  "hotmail.com",
  "hotmail.es",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "gmx.es",
  "gmx.com",
  "terra.es",
  "telefonica.net",
  "ono.com",
  "wanadoo.es",
  "mixmail.com",
]);

export interface ProposalCandidate {
  /** El dominio, en minúsculas. Lo único que viajaría a una propuesta. */
  domain: string;
  /** Cuántas conversaciones de las que se ven vienen de ahí. */
  count: number;
  /** Un asunto de ejemplo, SOLO para que la persona reconozca de qué habla. */
  sampleSubject: string;
}

function domainOf(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  // Misma forma que exige el esquema del catálogo: sin proponer basura.
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain) ? domain : null;
}

/**
 * Los dominios sin regla que más aparecen, de más a menos. Excluye el correo
 * personal conocido y lo que el catálogo ya reconoce.
 */
export function proposalCandidates(rows: ClassifiedRow[], limit = 5): ProposalCandidate[] {
  const byDomain = new Map<string, { count: number; sampleSubject: string }>();
  for (const row of rows) {
    // Si el catálogo ya lo reconoce, no hay nada que proponer.
    if (row.classification) continue;
    const domain = domainOf(row.senderEmail);
    if (!domain || PERSONAL_DOMAINS.has(domain)) continue;
    const seen = byDomain.get(domain);
    if (seen) seen.count++;
    else byDomain.set(domain, { count: 1, sampleSubject: row.subject });
  }
  return Array.from(byDomain.entries())
    .map(([domain, v]) => ({ domain, count: v.count, sampleSubject: v.sampleSubject }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
    .slice(0, limit);
}

/** Solo para que la interfaz pueda decir la verdad sobre qué se descarta. */
export function isPersonalDomain(domain: string): boolean {
  return PERSONAL_DOMAINS.has(domain.trim().toLowerCase());
}

// ── Qué se manda al proponer ────────────────────────────────────────────────
// Vive AQUÍ y no en el popup a propósito: lo que viaja es una decisión sobre
// datos, no una cuestión de interfaz, y así se puede poner bajo test
// (`propose.test.ts` comprueba que en la URL no cabe ni una dirección ni un
// asunto). El popup solo abre lo que esta función devuelve.
//
// La URL es FIJA y del repositorio público del catálogo. No se PIDE por la red:
// la abre la persona en una pestaña, con un clic, y el envío lo hace ella desde
// su sesión de GitHub. `check-no-network` la declara como la única dirección de
// navegación permitida, y le prohíbe aparecer en la carpeta que sí sale a la red.
export const PROPOSE_URL = "https://github.com/fjolivaresDH/correo-particular-catalogo/issues/new";

/** El enlace de propuesta para un dominio. Lo único que lleva es el dominio. */
export function proposeHref(domain: string): string {
  const limpio = domain.trim().toLowerCase();
  const cuerpo = [
    `Dominio: ${limpio}`,
    "",
    "Qué organización es:",
    "Qué suele mandar (recibo, renovación, cita, boletín...):",
    "",
    "Propuesto desde la extensión. No incluye ninguna dirección ni contenido de correo.",
  ].join("\n");
  const q = new URLSearchParams({ title: `Remitente: ${limpio}`, body: cuerpo });
  return `${PROPOSE_URL}?${q.toString()}`;
}

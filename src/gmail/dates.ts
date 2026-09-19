// Fechas tal como Gmail las pinta en la lista: el `title` del span lleva la
// fecha completa («mar, 12 sept 2026, 10:34» / «Tue, Sep 12, 2026, 10:34 AM»)
// y el texto visible una versión corta («10:34», «12 sept», «12/09/2024»).
// Reutiliza el mismo entendimiento de meses que el motor de reglas.

import { parseDate } from "../rules/extract";

/**
 * Devuelve ISO `YYYY-MM-DD` a partir del `title` (preferido) o del texto
 * visible. «10:34» (solo hora) se entiende como hoy. `null` si no se entiende.
 */
export function parseGmailDate(title: string | null, visible: string | null, now: Date): string | null {
  for (const candidate of [title, visible]) {
    if (!candidate) continue;
    const t = candidate.trim();
    if (!t) continue;
    if (/^\d{1,2}:\d{2}(\s*[ap]\.?m\.?)?$/i.test(t)) return isoOf(now);
    // Se quita la hora para que «10:34» no se lea como día/mes.
    const withoutTime = t.replace(/\b\d{1,2}:\d{2}(\s*[ap]\.?m\.?)?\b/gi, " ");
    const parsed = parseDate(withoutTime, now);
    if (parsed) return parsed;
  }
  return null;
}

export function isoOf(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return `${y}-${m < 10 ? "0" + m : m}-${d < 10 ? "0" + d : d}`;
}

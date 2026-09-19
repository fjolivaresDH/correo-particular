// Extracción de fecha e importe a partir de una cadena YA capturada por un
// patrón del catálogo. Puro: sin DOM, sin red, sin reloj propio (recibe `now`).

const MONTHS: Record<string, number> = {
  // es
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, set: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
  // en
  jan: 1, january: 1, february: 2, march: 3, apr: 4, april: 4, june: 6,
  july: 7, aug: 8, august: 8, september: 9, october: 10, november: 11,
  dec: 12, december: 12,
};

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function toIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // 31 de febrero
  return `${y}-${pad(m)}-${pad(d)}`;
}

function normalizeYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

/**
 * Sin año, una fecha de vencimiento se supone del año en curso, salvo que
 * quede a más de 6 meses en el pasado: entonces es del año que viene.
 */
function guessYear(m: number, d: number, now: Date): number {
  const y = now.getUTCFullYear();
  const candidate = Date.UTC(y, m - 1, d);
  const sixMonths = 183 * 24 * 3600 * 1000;
  return candidate < now.getTime() - sixMonths ? y + 1 : y;
}

/**
 * Entiende «20 de septiembre», «20 sept 2026», «20/09/2026», «20-09»,
 * «2026-09-20», «September 20», «Sep 20, 2026». Devuelve ISO o `null`.
 */
export function parseDate(text: string, now: Date): string | null {
  const t = text.trim().toLowerCase();

  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = t.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = m[3] ? normalizeYear(Number(m[3])) : guessYear(mo, d, now);
    return toIso(y, mo, d);
  }

  // «20 de septiembre de 2026», «20 sept», «20 september 2026»
  m = t.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóú]+)\.?(?:\s*(?:de\s+)?(\d{4}))?/);
  if (m && MONTHS[m[2]!] !== undefined) {
    const d = Number(m[1]);
    const mo = MONTHS[m[2]!]!;
    const y = m[3] ? Number(m[3]) : guessYear(mo, d, now);
    return toIso(y, mo, d);
  }

  // «september 20», «sep 20, 2026»
  m = t.match(/([a-z]+)\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (m && MONTHS[m[1]!] !== undefined) {
    const mo = MONTHS[m[1]!]!;
    const d = Number(m[2]);
    const y = m[3] ? Number(m[3]) : guessYear(mo, d, now);
    return toIso(y, mo, d);
  }

  return null;
}

/**
 * Entiende «84,30», «1.234,56», «1,234.56», «84.30», «1234». Devuelve número
 * con dos decimales de precisión o `null`.
 */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[^\d.,]/g, "");
  if (!t) return null;
  let normalized: string;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // El último separador es el decimal; el otro, de miles.
    normalized = lastComma > lastDot
      ? t.replace(/\./g, "").replace(",", ".")
      : t.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // Solo comas: decimal si hay exactamente 2 dígitos detrás; si no, miles.
    normalized = /,\d{2}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, "");
  } else if (lastDot >= 0) {
    normalized = /\.\d{2}$/.test(t) ? t : t.replace(/\./g, "");
  } else {
    normalized = t;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/**
 * Aplica los patrones (con UN grupo de captura) sobre el asunto y devuelve la
 * primera captura. Los patrones vienen del catálogo, ya validados allí; aquí
 * un patrón que no compila se ignora en vez de tumbar la clasificación.
 */
export function firstCapture(patterns: string[] | undefined, subject: string): string | null {
  if (!patterns) return null;
  for (const p of patterns) {
    let re: RegExp;
    try {
      re = new RegExp(p, "i");
    } catch {
      continue;
    }
    const m = subject.match(re);
    if (m && m[1] !== undefined) return m[1];
  }
  return null;
}

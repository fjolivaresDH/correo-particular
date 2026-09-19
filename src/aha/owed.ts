// Aha 3 — «A quién debes respuesta»: hilos donde la última palabra visible es
// de otra persona, yo no he contestado, y han pasado más de N días. SOLO
// metadatos: remitente, asunto, fecha. Se calcula y se queda en el
// dispositivo; es dato de cómo trabaja la persona y no se agrega ni se
// comparte jamás (producto-particulares.md §4). Puro.

import type { ClassifiedRow } from "../shared/types";

export interface OwedItem {
  threadId: string;
  senderName: string | null;
  senderEmail: string | null;
  subject: string;
  date: string;
  daysWaiting: number;
}

/** Direcciones que por su forma no esperan respuesta. */
const NO_REPLY = /(^|[._-])(no[-_.]?reply|noreply|donotreply|do-not-reply|notificaciones?|notifications?|mailer-daemon)([._-]|@|$)/i;

function daysBetween(fromIso: string, now: Date): number {
  const from = Date.parse(fromIso + "T00:00:00Z");
  if (!Number.isFinite(from)) return 0;
  return Math.floor((now.getTime() - from) / (24 * 3600 * 1000));
}

export function owedList(rows: ClassifiedRow[], minDays: number, now: Date = new Date()): OwedItem[] {
  const items: OwedItem[] = [];
  for (const row of rows) {
    if (!row.date) continue;
    // Una organización del catálogo no espera respuesta: es un recibo, un boletín…
    if (row.classification) continue;
    if (!row.senderEmail || NO_REPLY.test(row.senderEmail)) continue;
    // Si aparezco en el hilo, o la última palabra es mía, no debo nada (por lo que se ve).
    if (row.hasOwnReply !== false || row.lastIsMe) continue;
    const daysWaiting = daysBetween(row.date, now);
    if (daysWaiting < minDays) continue;
    items.push({
      threadId: row.threadId,
      senderName: row.senderName,
      senderEmail: row.senderEmail,
      subject: row.subject,
      date: row.date,
      daysWaiting,
    });
  }
  items.sort((a, b) => b.daysWaiting - a.daysWaiting || a.subject.localeCompare(b.subject));
  return items;
}

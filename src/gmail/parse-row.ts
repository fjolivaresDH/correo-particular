// Adaptador de Gmail: del DOM de la lista a `ThreadRow`. Recibe un `Element`
// (o `Document`) para poder correr sobre fixtures en tests. No lee el
// fragmento de vista previa ni abre ningún hilo: solo lo que la fila enseña.

import type { Participant, ThreadRow } from "../shared/types";
import { parseGmailDate } from "./dates";
import { SELECTORS, SELF_NAMES } from "./selectors";

function text(el: Element | null): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function attr(el: Element | null, name: string): string | null {
  const v = el?.getAttribute(name);
  return v && v.trim() ? v.trim() : null;
}

function parseParticipants(cell: Element | null): Participant[] {
  if (!cell) return [];
  const out: Participant[] = [];
  for (const span of Array.from(cell.querySelectorAll(SELECTORS.participant))) {
    const email = attr(span, "email")?.toLowerCase() ?? null;
    const name = attr(span, "name") ?? (text(span) || null);
    const label = (name ?? text(span)).toLowerCase();
    out.push({ name, email, isMe: SELF_NAMES.has(label) });
  }
  return out;
}

function parseMessageCount(cell: Element | null): number {
  const raw = text(cell?.querySelector(SELECTORS.messageCount) ?? null);
  const n = Number.parseInt(raw.replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function findThreadId(row: Element, subjectEl: Element | null): string | null {
  for (const el of [subjectEl, row]) {
    if (!el) continue;
    for (const name of SELECTORS.threadIdAttrs) {
      const v = attr(el, name);
      if (v) return v;
    }
    const inner = el.querySelector(SELECTORS.threadIdAttrs.map((a) => `[${a}]`).join(","));
    if (inner) {
      for (const name of SELECTORS.threadIdAttrs) {
        const v = attr(inner, name);
        if (v) return v;
      }
    }
  }
  return null;
}

/** Identificador derivado cuando Gmail no expone ninguno: no es estable entre sesiones. */
function derivedId(subject: string, sender: string | null, date: string | null): string {
  const s = `${sender ?? ""}|${subject}|${date ?? ""}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `derived:${(h >>> 0).toString(16)}`;
}

/** Convierte UNA fila (`tr.zA`) en `ThreadRow`; `null` si no tiene ni asunto ni remitente. */
export function parseRow(row: Element, now: Date = new Date()): ThreadRow | null {
  const senderCell = row.querySelector(SELECTORS.senderCell);
  const subjectCell = row.querySelector(SELECTORS.subjectCell);
  const subjectEl = subjectCell?.querySelector(SELECTORS.subject) ?? null;
  const dateSpan = row.querySelector(SELECTORS.dateCell)?.querySelector(SELECTORS.dateSpan) ?? null;

  const participants = parseParticipants(senderCell);
  const subject = text(subjectEl);
  if (participants.length === 0 && !subject) return null;

  const other = participants.find((p) => !p.isMe) ?? null;
  const date = parseGmailDate(attr(dateSpan, "title"), text(dateSpan), now);
  const me = participants.some((p) => p.isMe);
  const last = participants[participants.length - 1] ?? null;

  return {
    threadId: findThreadId(row, subjectEl) ?? derivedId(subject, other?.email ?? null, date),
    subject,
    participants,
    senderEmail: other?.email ?? null,
    senderName: other?.name ?? null,
    messageCount: parseMessageCount(senderCell),
    date,
    unread: row.classList.contains(SELECTORS.rowUnread),
    hasOwnReply: participants.length === 0 ? null : me,
    lastIsMe: last?.isMe ?? false,
  };
}

/** Todas las filas de la lista visibles bajo `root`. Filas que no se entienden se saltan. */
export function parseList(root: ParentNode, now: Date = new Date()): ThreadRow[] {
  const rows: ThreadRow[] = [];
  for (const tr of Array.from(root.querySelectorAll(SELECTORS.row))) {
    try {
      const parsed = parseRow(tr, now);
      if (parsed) rows.push(parsed);
    } catch {
      // Una fila rara no tumba el barrido entero.
    }
  }
  return rows;
}

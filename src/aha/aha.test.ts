import { describe, expect, it } from "vitest";
import type { Classification } from "../rules/types";
import type { ClassifiedRow } from "../shared/types";
import { categoryCounts } from "./categories";
import { dueList } from "./due";
import { computeAha } from "./index";
import { owedList } from "./owed";

const NOW = new Date("2026-09-19T12:00:00Z");

function row(over: Partial<ClassifiedRow> & { subject: string }): ClassifiedRow {
  const senderEmail = over.senderEmail ?? "alguien@ejemplo.example";
  return {
    threadId: over.threadId ?? `t:${over.subject}`,
    participants: [{ name: over.senderName ?? "Alguien", email: senderEmail, isMe: false }],
    senderEmail,
    senderName: over.senderName ?? "Alguien",
    messageCount: 1,
    date: "2026-09-10",
    unread: false,
    hasOwnReply: false,
    lastIsMe: false,
    classification: null,
    ...over,
  };
}

function cls(over: Partial<Classification> & { category: Classification["category"] }): Classification {
  return {
    ruleId: "x",
    organization: "Org",
    verified: false,
    subjectMatched: null,
    dueDate: null,
    amount: null,
    amountText: null,
    ...over,
  };
}

describe("qué vence", () => {
  it("incluye solo categorías con fecha y solo si hay fecha o importe, ordenado por fecha", () => {
    const rows = [
      row({ subject: "Luz", date: "2026-09-15", classification: cls({ category: "bill", organization: "Iberdrola", amount: 84.3, amountText: "84,30" }) }),
      row({ subject: "Netflix", date: "2026-09-19", classification: cls({ category: "subscription", organization: "Netflix", dueDate: "2026-09-12" }) }),
      row({ subject: "Sin nada", classification: cls({ category: "bill", organization: "Endesa" }) }),
      row({ subject: "Compra", classification: cls({ category: "shop", organization: "Amazon", amount: 20 }) }),
      row({ subject: "Boletín", classification: null }),
    ];
    const due = dueList(rows);
    expect(due.map((d) => d.organization)).toEqual(["Netflix", "Iberdrola"]);
    expect(due[0]!.dueDate).toBe("2026-09-12");
    expect(due[1]!.amount).toBe(84.3);
    expect(due[1]!.verified).toBe(false);
  });

  it("ordena por fecha del correo cuando no hay vencimiento", () => {
    const rows = [
      row({ subject: "a", date: "2026-09-18", classification: cls({ category: "bill", organization: "B", amount: 1 }) }),
      row({ subject: "b", date: "2026-09-01", classification: cls({ category: "bill", organization: "A", amount: 1 }) }),
    ];
    expect(dueList(rows).map((d) => d.organization)).toEqual(["A", "B"]);
  });
});

describe("qué es cada cosa", () => {
  it("cuenta por categoría, con «unknown» para lo no reconocido, y organizaciones dentro", () => {
    const rows = [
      row({ subject: "1", classification: cls({ category: "bill", organization: "Iberdrola" }) }),
      row({ subject: "2", classification: cls({ category: "bill", organization: "Iberdrola" }) }),
      row({ subject: "3", classification: cls({ category: "bill", organization: "Endesa" }) }),
      row({ subject: "4", classification: cls({ category: "subscription", organization: "Netflix", verified: true }) }),
      row({ subject: "5" }),
      row({ subject: "6" }),
      row({ subject: "7" }),
      row({ subject: "8" }),
    ];
    const counts = categoryCounts(rows);
    expect(counts.map((c) => [c.category, c.count])).toEqual([
      ["unknown", 4],
      ["bill", 3],
      ["subscription", 1],
    ]);
    expect(counts[1]!.organizations).toEqual([
      { name: "Iberdrola", count: 2, verified: false },
      { name: "Endesa", count: 1, verified: false },
    ]);
    expect(counts[0]!.organizations).toEqual([]);
  });

  it("devuelve lista vacía sin filas", () => {
    expect(categoryCounts([])).toEqual([]);
  });
});

describe("a quién debes respuesta", () => {
  it("solo hilos de personas, sin respuesta mía, con más de N días; ordenados por espera", () => {
    const rows = [
      row({ subject: "Jueves", senderName: "Ana", date: "2026-09-09" }),
      row({ subject: "Reciente", senderName: "Bea", date: "2026-09-18" }),
      row({ subject: "Contestado", senderName: "Luis", date: "2026-09-01", hasOwnReply: true }),
      row({ subject: "Última mía", senderName: "Eva", date: "2026-09-01", lastIsMe: true }),
      row({ subject: "Factura", date: "2026-09-01", classification: cls({ category: "bill" }) }),
      row({ subject: "Automático", senderEmail: "no-reply@algo.example", date: "2026-09-01" }),
      row({ subject: "Notificación", senderEmail: "notificaciones@algo.example", date: "2026-09-01" }),
      row({ subject: "Sin fecha", date: null }),
      row({ subject: "Muy antiguo", senderName: "Carlos", date: "2026-08-01" }),
      row({ subject: "No se sabe", senderName: "Dani", date: "2026-08-15", hasOwnReply: null }),
    ];
    const owed = owedList(rows, 3, NOW);
    expect(owed.map((o) => o.senderName)).toEqual(["Carlos", "Ana"]);
    expect(owed[1]!.daysWaiting).toBe(10);
    expect(owed[0]!.subject).toBe("Muy antiguo");
  });

  it("respeta N configurable y nunca lleva contenido", () => {
    const rows = [row({ subject: "Jueves", senderName: "Ana", date: "2026-09-09" })];
    expect(owedList(rows, 11, NOW)).toEqual([]);
    const [item] = owedList(rows, 10, NOW);
    expect(Object.keys(item!).sort()).toEqual(["date", "daysWaiting", "senderEmail", "senderName", "subject", "threadId"]);
  });
});

describe("computeAha", () => {
  it("junta las tres listas", () => {
    const aha = computeAha([row({ subject: "Jueves", date: "2026-09-09" })], 3, NOW);
    expect(aha.due).toEqual([]);
    expect(aha.categories).toEqual([{ category: "unknown", count: 1, organizations: [] }]);
    expect(aha.owed).toHaveLength(1);
  });
});

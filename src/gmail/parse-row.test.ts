import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { parseGmailDate } from "./dates";
import { parseList } from "./parse-row";

const NOW = new Date("2026-09-19T12:00:00Z");

// Los fixtures son HTML sintético (ver README): se cargan con jsdom a mano,
// sin el entorno jsdom de vitest, que arranca mucho más lento.
function load(name: string): Document {
  const html = readFileSync(path.join(__dirname, "fixtures", name), "utf8");
  return new JSDOM(html).window.document;
}

describe("adaptador de Gmail: lista en español", () => {
  const rows = parseList(load("inbox-es.html"), NOW);

  it("lee una fila por hilo y salta la rota", () => {
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.subject)).toEqual([
      "Tu factura de septiembre: 84,30 €",
      "¿Quedamos el jueves?",
      "Presupuesto reforma",
      "Tu suscripción se renueva el 20/09/2026",
      "Novedades de temporada",
      "Descubre la nueva tarifa",
    ]);
  });

  it("extrae remitente (dirección y nombre), fecha del title, no leído e id del hilo", () => {
    const bill = rows[0]!;
    expect(bill.senderEmail).toBe("facturas@clientes.iberdrola.es");
    expect(bill.senderName).toBe("Iberdrola");
    expect(bill.date).toBe("2026-09-15");
    expect(bill.unread).toBe(true);
    expect(bill.threadId).toBe("1000000000000000001");
    expect(bill.messageCount).toBe(1);
  });

  it("nunca lee el fragmento de vista previa", () => {
    for (const r of rows) expect(r.subject).not.toMatch(/Fragmento que no se lee/);
    expect(JSON.stringify(rows)).not.toContain("Fragmento");
  });

  it("infiere si yo he contestado por mi presencia entre los participantes", () => {
    const waiting = rows[1]!;
    expect(waiting.hasOwnReply).toBe(false);
    expect(waiting.lastIsMe).toBe(false);
    expect(waiting.participants).toHaveLength(1);

    const replied = rows[2]!;
    expect(replied.hasOwnReply).toBe(true);
    expect(replied.lastIsMe).toBe(true);
    expect(replied.messageCount).toBe(3);
    expect(replied.senderEmail).toBe("luis.inventado@correo-inventado.example");
    expect(replied.participants.map((p) => p.isMe)).toEqual([false, true]);
  });

  it("entiende «solo hora» como hoy y una fecha visible de otro año", () => {
    expect(rows[3]!.date).toBe("2026-09-19");
    expect(rows[4]!.date).toBe("2024-12-12");
  });

  it("deriva un id cuando Gmail no expone ninguno", () => {
    expect(rows[4]!.threadId).toMatch(/^derived:[0-9a-f]+$/);
  });
});

describe("adaptador de Gmail: lista en inglés", () => {
  const rows = parseList(load("inbox-en.html"), NOW);

  it("reconoce «me» como yo y entiende fechas en inglés", () => {
    expect(rows).toHaveLength(2);
    expect(rows[0]!.hasOwnReply).toBe(true);
    expect(rows[0]!.lastIsMe).toBe(true);
    expect(rows[0]!.date).toBe("2026-09-08");
    expect(rows[1]!.senderEmail).toBe("no-reply@spotify.com");
    expect(rows[1]!.date).toBe("2026-09-17");
    expect(rows[1]!.unread).toBe(true);
  });
});

describe("fechas de Gmail", () => {
  it("prefiere el title al texto visible y quita la hora antes de leer", () => {
    expect(parseGmailDate("mar, 15 sept 2026, 09:12", "15 sept", NOW)).toBe("2026-09-15");
    expect(parseGmailDate(null, "10:34", NOW)).toBe("2026-09-19");
    expect(parseGmailDate(null, "3:15 PM", NOW)).toBe("2026-09-19");
    expect(parseGmailDate(null, "12 sept", NOW)).toBe("2026-09-12");
    expect(parseGmailDate(null, "12/12/24", NOW)).toBe("2024-12-12");
    expect(parseGmailDate("Tue, Sep 8, 2026, 10:34 AM", null, NOW)).toBe("2026-09-08");
    expect(parseGmailDate(null, "lo que sea", NOW)).toBeNull();
  });
});

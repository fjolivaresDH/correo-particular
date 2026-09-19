import { describe, expect, it } from "vitest";
import { loadBundledCatalog } from "../catalog/index";
import { domainMatches, domainOf } from "./domain";
import { createEngine } from "./engine";
import { firstCapture, parseAmount, parseDate } from "./extract";
import type { RuleList } from "./types";

const NOW = new Date("2026-09-19T12:00:00Z");

describe("dominios", () => {
  it("saca el dominio de una dirección y casa subdominios", () => {
    expect(domainOf("Facturas <facturas@clientes.iberdrola.es>")).toBe("clientes.iberdrola.es");
    expect(domainOf("x@IBERDROLA.ES")).toBe("iberdrola.es");
    expect(domainOf("sin-arroba")).toBeNull();
    expect(domainOf(null)).toBeNull();
    expect(domainMatches("clientes.iberdrola.es", "iberdrola.es")).toBe(true);
    expect(domainMatches("iberdrola.es", "iberdrola.es")).toBe(true);
    expect(domainMatches("notiberdrola.es", "iberdrola.es")).toBe(false);
    expect(domainMatches("iberdrola.es.evil.example", "iberdrola.es")).toBe(false);
  });
});

describe("extracción", () => {
  it("entiende fechas en español e inglés, con y sin año", () => {
    expect(parseDate("20 de septiembre", NOW)).toBe("2026-09-20");
    expect(parseDate("20 sept 2027", NOW)).toBe("2027-09-20");
    expect(parseDate("20/09/2026", NOW)).toBe("2026-09-20");
    expect(parseDate("5-1", NOW)).toBe("2027-01-05"); // hace más de 6 meses → año que viene
    expect(parseDate("2026-09-20", NOW)).toBe("2026-09-20");
    expect(parseDate("September 25", NOW)).toBe("2026-09-25");
    expect(parseDate("Sep 25, 2026", NOW)).toBe("2026-09-25");
    expect(parseDate("31 de febrero", NOW)).toBeNull();
    expect(parseDate("mañana", NOW)).toBeNull();
  });

  it("entiende importes con coma o punto decimal y separadores de miles", () => {
    expect(parseAmount("84,30")).toBe(84.3);
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("84.30")).toBe(84.3);
    expect(parseAmount("1.234")).toBe(1234);
    expect(parseAmount("1234")).toBe(1234);
    expect(parseAmount("€")).toBeNull();
  });

  it("devuelve la primera captura e ignora patrones que no compilan", () => {
    expect(firstCapture(["(", "importe[: ]+([0-9.,]+) ?€"], "Importe: 12,50 €")).toBe("12,50");
    expect(firstCapture(undefined, "x")).toBeNull();
    expect(firstCapture(["sin grupo"], "sin grupo")).toBeNull();
  });
});

describe("motor sobre el catálogo sembrado", () => {
  const engine = createEngine(loadBundledCatalog());

  // El recuento EXACTO y que cuadre con el disco es de bundled.test.ts; aquí
  // solo que el motor cargó el catálogo entero y no una lista suelta.
  it("carga el catálogo empaquetado entero", () => {
    expect(engine.ruleCount).toBeGreaterThan(200);
  });

  const cases: { sender: string; subject: string; ruleId: string; category: string; amount?: number; subjectMatched: boolean | null }[] = [
    { sender: "facturas@iberdrola.es", subject: "Tu factura de septiembre: 84,30 €", ruleId: "iberdrola", category: "bill", amount: 84.3, subjectMatched: true },
    { sender: "clientes@endesa.com", subject: "Factura disponible: 120,00€", ruleId: "endesa", category: "bill", amount: 120, subjectMatched: true },
    { sender: "info@naturgy.es", subject: "Tu FACTURA de gas 45,10 €", ruleId: "naturgy", category: "bill", amount: 45.1, subjectMatched: true },
    { sender: "no-responder@telefonica.com", subject: "Factura Movistar 60,00 €", ruleId: "movistar", category: "bill", amount: 60, subjectMatched: true },
    { sender: "avisos@vodafone.es", subject: "Ya tienes tu factura: 32,99 €", ruleId: "vodafone", category: "bill", amount: 32.99, subjectMatched: true },
    { sender: "hola@orange.es", subject: "Factura de octubre", ruleId: "orange", category: "bill", subjectMatched: true },
    { sender: "order-update@amazon.es", subject: "Tu pedido ha sido enviado", ruleId: "amazon", category: "shop", subjectMatched: null },
    { sender: "service@paypal.com", subject: "Has recibido un pago", ruleId: "paypal", category: "notification", subjectMatched: null },
    { sender: "info@account.netflix.com", subject: "Tu suscripción se renueva", ruleId: "netflix", category: "subscription", subjectMatched: true },
    { sender: "no-reply@spotify.com", subject: "Your Premium plan renews", ruleId: "spotify", category: "subscription", subjectMatched: true },
    { sender: "no_reply@email.apple.com", subject: "Tu recibo de Apple", ruleId: "apple", category: "subscription", subjectMatched: true },
    { sender: "no-reply@accounts.google.com", subject: "Alerta de seguridad", ruleId: "google", category: "notification", subjectMatched: null },
  ];

  for (const c of cases) {
    it(`reconoce ${c.ruleId} (${c.category})`, () => {
      const r = engine.classify({ senderEmail: c.sender, subject: c.subject }, NOW);
      expect(r).not.toBeNull();
      expect(r!.ruleId).toBe(c.ruleId);
      expect(r!.category).toBe(c.category);
      expect(r!.subjectMatched).toBe(c.subjectMatched);
      expect(r!.amount).toBe(c.amount ?? null);
      expect(r!.verified).toBe(false);
    });
  }

  it("un remitente de la organización cuyo asunto no casa no extrae nada", () => {
    const r = engine.classify({ senderEmail: "novedades@movistar.es", subject: "Descubre la nueva tarifa 9,99 €" }, NOW);
    expect(r?.ruleId).toBe("movistar");
    expect(r?.subjectMatched).toBe(false);
    expect(r?.amount).toBeNull();
  });

  it("no reconoce dominios parecidos ni direcciones sin dominio", () => {
    expect(engine.classify({ senderEmail: "x@iberdrola.es.evil.example", subject: "factura" }, NOW)).toBeNull();
    expect(engine.classify({ senderEmail: "x@notiberdrola.es", subject: "factura" }, NOW)).toBeNull();
    expect(engine.classify({ senderEmail: null, subject: "factura" }, NOW)).toBeNull();
  });
});

describe("motor: prioridad y fechas", () => {
  const list: RuleList = {
    market: "global",
    rules: [
      { id: "acme", name: "Acme", category: "shop", match: { domains: ["acme.example"] }, verified: false },
      {
        id: "acme-billing",
        name: "Acme Billing",
        category: "bill",
        match: { domains: ["billing.acme.example"], subject: ["factura|invoice"] },
        extract: { dueDate: ["vence el (\\d{1,2} de [a-z]+)", "due (\\w+ \\d{1,2})"], amount: ["([0-9.,]+) ?(?:€|EUR)"] },
        verified: true,
      },
    ],
  };
  const engine = createEngine([list]);

  it("gana el dominio más específico", () => {
    expect(engine.classify({ senderEmail: "a@acme.example", subject: "hola" }, NOW)?.ruleId).toBe("acme");
    expect(engine.classify({ senderEmail: "a@billing.acme.example", subject: "Invoice" }, NOW)?.ruleId).toBe("acme-billing");
    expect(engine.classify({ senderEmail: "a@eu.billing.acme.example", subject: "Invoice" }, NOW)?.ruleId).toBe("acme-billing");
  });

  it("extrae fecha e importe del asunto, y solo del asunto", () => {
    const r = engine.classify({ senderEmail: "a@billing.acme.example", subject: "Factura 12,50 € — vence el 30 de septiembre" }, NOW);
    expect(r?.dueDate).toBe("2026-09-30");
    expect(r?.amount).toBe(12.5);
    expect(r?.amountText).toBe("12,50");
    expect(r?.verified).toBe(true);
    const en = engine.classify({ senderEmail: "a@billing.acme.example", subject: "Invoice due October 3" }, NOW);
    expect(en?.dueDate).toBe("2026-10-03");
  });
});

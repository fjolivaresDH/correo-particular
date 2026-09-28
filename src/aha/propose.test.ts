import { describe, expect, it } from "vitest";
import { PROPOSE_URL, isPersonalDomain, proposalCandidates, proposeHref } from "./propose";
import type { ClassifiedRow } from "../shared/types";

function fila(senderEmail: string | null, subject: string, reconocido = false): ClassifiedRow {
  return {
    threadId: `t-${senderEmail}-${subject}`,
    subject,
    participants: [],
    senderEmail,
    senderName: null,
    messageCount: 1,
    date: "2026-09-24",
    unread: false,
    hasOwnReply: null,
    lastIsMe: false,
    classification: reconocido
      ? {
          ruleId: "x",
          organization: "X",
          category: "bill",
          verified: false,
          subjectMatched: null,
          dueDate: null,
          amount: null,
          amountText: null,
        }
      : null,
  };
}

describe("candidatos a proponer", () => {
  it("ordena por cuántas conversaciones trae cada dominio", () => {
    const c = proposalCandidates([
      fila("no-reply@tienda.example", "Pedido 1"),
      fila("avisos@tienda.example", "Pedido 2"),
      fila("info@gestoria.example", "Cuota"),
    ]);
    expect(c.map((x) => x.domain)).toEqual(["tienda.example", "gestoria.example"]);
    expect(c[0]?.count).toBe(2);
  });

  it("lo que el catálogo YA reconoce no se propone", () => {
    expect(proposalCandidates([fila("facturas@iberdrola.es", "Tu factura", true)])).toEqual([]);
  });

  it("NUNCA propone un dominio de correo personal: publicaría con quién te escribes", () => {
    const personales = ["gmail.com", "hotmail.es", "outlook.com", "icloud.com", "proton.me", "yahoo.es"];
    const filas = personales.map((d, i) => fila(`alguien@${d}`, `Hola ${i}`));
    expect(proposalCandidates(filas)).toEqual([]);
    for (const d of personales) expect(isPersonalDomain(d.toUpperCase()), d).toBe(true);
  });

  it("descarta lo que no tiene forma de dominio, sin romperse", () => {
    expect(proposalCandidates([fila(null, "sin remitente"), fila("roto", "sin arroba"), fila("a@b", "sin punto")])).toEqual([]);
  });

  it("lleva un asunto de ejemplo para que la persona sepa de qué habla, y respeta el tope", () => {
    const filas = Array.from({ length: 9 }, (_, i) => fila(`x@d${i}.example`, `Asunto ${i}`));
    const c = proposalCandidates(filas, 3);
    expect(c).toHaveLength(3);
    expect(c[0]?.sampleSubject).toMatch(/^Asunto /);
  });

  it("el dominio va en minúsculas: es lo único que viajaría", () => {
    const c = proposalCandidates([fila("Avisos@TIENDA.Example", "Pedido")]);
    expect(c[0]?.domain).toBe("tienda.example");
  });
});

describe("qué viaja al proponer", () => {
  // Esta es la prueba que sostiene la promesa del popup. Si algún día alguien
  // mete el asunto o la dirección en el enlace "para dar contexto", aquí salta.
  const url = proposeHref("Tienda.Example");
  const params = new URL(url).searchParams;

  it("va a la página de propuestas y a ningún otro sitio", () => {
    expect(url.startsWith(PROPOSE_URL + "?")).toBe(true);
    expect(new URL(PROPOSE_URL).protocol).toBe("https:");
  });

  it("lleva UN solo parámetro: el dominio, en minúsculas", () => {
    expect([...params.keys()]).toEqual(["dominio"]);
    expect(params.get("dominio")).toBe("tienda.example");
  });

  it("NO cabe ninguna dirección de correo", () => {
    expect(decodeURIComponent(url)).not.toMatch(/@/);
  });

  it("NO lleva asunto ni contenido: el ejemplo se queda en el popup", () => {
    const asunto = "Tu pedido va en camino";
    expect(decodeURIComponent(proposeHref("tienda.example"))).not.toContain(asunto);
  });
});

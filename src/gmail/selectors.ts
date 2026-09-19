// TODA la fragilidad frente a Gmail vive en este fichero y en `parse-row.ts`.
// Los nombres de clase de Gmail son ofuscados pero ESTABLES desde hace años
// (los usan Mailtrack, Boomerang, Streak, InboxSDK…); aun así, Google puede
// cambiarlos cuando quiera. Si la extensión deja de leer, empieza por aquí y
// por el README de esta carpeta.

export const SELECTORS = {
  /** Cada hilo de la lista es un `<tr>` con clase `zA`. `zE` = no leído, `yO` = leído. */
  row: "tr.zA",
  rowUnread: "zE",

  /** Celda del remitente: `td.yX`; dentro, un `span` por participante. */
  senderCell: "td.yX",
  /**
   * Cada participante es un `span.yP` (leído) o `span.zF` (no leído) con los
   * atributos `email` y `name`. Para la persona dueña del buzón, `name` es
   * «yo» (o «me», «moi», «ich» según idioma de la interfaz).
   */
  participant: "span.yP[email], span.zF[email], span[email]",
  /** Contador de mensajes del hilo, «(3)», solo cuando hay más de uno. */
  messageCount: "span.bA4",

  /** Celda del asunto: `td.a4W`; el asunto va en `span.bog`. El fragmento (`span.y2`) NO se lee. */
  subjectCell: "td.a4W",
  subject: "span.bog",
  /** Identificador del hilo, cuando Gmail lo expone, en atributos data-* del asunto o de la fila. */
  threadIdAttrs: ["data-legacy-thread-id", "data-thread-id"],

  /** Celda de la fecha: `td.xW`; el `span` lleva la fecha completa en `title`. */
  dateCell: "td.xW",
  dateSpan: "span[title]",
} as const;

/** Textos con los que Gmail nombra a la persona dueña del buzón, por idioma de interfaz. */
export const SELF_NAMES: ReadonlySet<string> = new Set(["yo", "me", "moi", "ich", "io", "eu"]);

// Lo que cruza del adaptador de Gmail al resto: METADATOS de una fila de la
// lista, nunca el cuerpo ni el fragmento de vista previa. Es también lo que
// se guarda en `chrome.storage.local`, así que aquí no entra nada que no
// haga falta para pintar las tres listas.

import type { Classification } from "../rules/types";

export interface Participant {
  name: string | null;
  email: string | null;
  /** La persona dueña del buzón (Gmail la pinta como «yo»/«me»). */
  isMe: boolean;
}

export interface ThreadRow {
  /** Identificador estable del hilo si Gmail lo expone; si no, uno derivado. */
  threadId: string;
  subject: string;
  /** Participantes en el orden en que Gmail los pinta. */
  participants: Participant[];
  /** Primer participante que no soy yo; es el «remitente» a efectos de reglas. */
  senderEmail: string | null;
  senderName: string | null;
  /** Número de mensajes del hilo que Gmail enseña entre paréntesis (1 si no lo enseña). */
  messageCount: number;
  /** Fecha del último mensaje, ISO `YYYY-MM-DD`, o `null` si no se entendió. */
  date: string | null;
  unread: boolean;
  /**
   * Lo que se puede inferir de la fila sobre si yo he contestado: verdadero
   * si aparezco entre los participantes. `null` si la fila no da para saberlo.
   */
  hasOwnReply: boolean | null;
  /** Verdadero si el último participante pintado soy yo (última palabra mía). */
  lastIsMe: boolean;
}

export interface ClassifiedRow extends ThreadRow {
  classification: Classification | null;
}

export interface ScanResult {
  /** Instante del barrido, ISO. */
  scannedAt: string;
  /** Vista de Gmail en la que se barrió (`inbox`, `sent`, `search`…), informativo. */
  view: string;
  rows: ClassifiedRow[];
  ruleCount: number;
}

export interface Settings {
  /** Días sin contestar a partir de los que un hilo entra en «a quién debes respuesta». */
  owedDays: number;
}

export const DEFAULT_SETTINGS: Settings = { owedDays: 3 };

export const STORAGE_KEYS = {
  scan: "scan",
  settings: "settings",
} as const;

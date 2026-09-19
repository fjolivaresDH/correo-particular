// Tipos espejo de `schema/rule.schema.json` y `schema/list.schema.json` del
// catálogo. Si el esquema cambia, cambia esto y `src/catalog/validate.ts`.

export const CATEGORIES = [
  "bill",
  "renewal",
  "warranty",
  "return-window",
  "appointment",
  "subscription",
  "newsletter",
  "notification",
  "shop",
  "government",
  "bank",
  "delivery",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Market = "es" | "global";

export interface Rule {
  id: string;
  name: string;
  category: Category;
  match: {
    domains: string[];
    subject?: string[];
  };
  extract?: {
    dueDate?: string[];
    amount?: string[];
  };
  market?: Market;
  verified: boolean;
  notes?: string;
}

export interface RuleList {
  $schema?: string;
  market: Market;
  rules: Rule[];
}

/** Lo que el motor necesita de un correo: solo cabecera, nunca cuerpo. */
export interface EmailHeader {
  senderEmail: string | null;
  subject: string;
}

export interface Classification {
  ruleId: string;
  organization: string;
  category: Category;
  verified: boolean;
  /** `null` si la regla no tiene patrones de asunto; si los tiene, si alguno casó. */
  subjectMatched: boolean | null;
  /** ISO `YYYY-MM-DD`, solo si un patrón `extract.dueDate` casó y la fecha se entendió. */
  dueDate: string | null;
  /** Importe numérico (84.3), solo si un patrón `extract.amount` casó. */
  amount: number | null;
  amountText: string | null;
}

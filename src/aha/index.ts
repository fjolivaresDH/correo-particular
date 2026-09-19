// Las tres listas a partir de filas ya clasificadas. Puro: lo llama el popup
// sobre lo que hay en `chrome.storage.local`.

import type { ClassifiedRow } from "../shared/types";
import { categoryCounts, type CategoryCount } from "./categories";
import { dueList, type DueItem } from "./due";
import { owedList, type OwedItem } from "./owed";

export interface Aha {
  due: DueItem[];
  categories: CategoryCount[];
  owed: OwedItem[];
}

export function computeAha(rows: ClassifiedRow[], owedDays: number, now: Date = new Date()): Aha {
  return {
    due: dueList(rows),
    categories: categoryCounts(rows),
    owed: owedList(rows, owedDays, now),
  };
}

export { categoryCounts, dueList, owedList };
export type { CategoryCount, DueItem, OwedItem };

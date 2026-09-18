import type { ListItem, ShoppingList } from '../models/app.models';

/** Cálculos de listas en centavos enteros para evitar errores de punto flotante. */

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function lineSubtotalCents(item: ListItem): number | null {
  const price = item.offer?.price;
  if (price === null || price === undefined) return null;
  return toCents(price) * item.quantity;
}

export interface StoreGroupSummary {
  storeId: string;
  storeName: string;
  items: ListItem[];
  subtotalCents: number;
  pricedCount: number;
  unpricedCount: number;
  remainingCents: number;
}

export interface ListSummary {
  storeGroups: StoreGroupSummary[];
  /** Artículos sin oferta asignada: no suman al total. */
  pendingItems: ListItem[];
  /** Artículos con oferta pero sin precio publicado: no suman al total. */
  unpricedItems: ListItem[];
  totalCents: number;
  /** Total de artículos cotizados aún no marcados como comprados. */
  remainingCents: number;
  itemCount: number;
  quotedCount: number;
  purchasedCount: number;
  /** Artículos con precio anotado por el usuario (no consultado por la app). */
  manualCount: number;
}

export function summarizeList(list: ShoppingList): ListSummary {
  const groups = new Map<string, StoreGroupSummary>();
  const pendingItems: ListItem[] = [];
  const unpricedItems: ListItem[] = [];

  for (const item of list.items) {
    if (!item.offer) {
      pendingItems.push(item);
      continue;
    }
    const group = groups.get(item.offer.storeId) ?? {
      storeId: item.offer.storeId,
      storeName: item.offer.storeName,
      items: [],
      subtotalCents: 0,
      pricedCount: 0,
      unpricedCount: 0,
      remainingCents: 0,
    };
    group.items.push(item);
    const line = lineSubtotalCents(item);
    if (line === null) {
      group.unpricedCount++;
      unpricedItems.push(item);
    } else {
      group.pricedCount++;
      group.subtotalCents += line;
      if (!item.purchased) group.remainingCents += line;
    }
    groups.set(item.offer.storeId, group);
  }

  const storeGroups = [...groups.values()].sort((a, b) => a.storeName.localeCompare(b.storeName, 'es'));
  return {
    storeGroups,
    pendingItems,
    unpricedItems,
    totalCents: storeGroups.reduce((sum, g) => sum + g.subtotalCents, 0),
    remainingCents: storeGroups.reduce((sum, g) => sum + g.remainingCents, 0),
    itemCount: list.items.length,
    quotedCount: list.items.length - pendingItems.length - unpricedItems.length,
    purchasedCount: list.items.filter((i) => i.purchased).length,
    manualCount: list.items.filter((i) => i.offer?.source === 'manual').length,
  };
}

export function isValidQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 999;
}

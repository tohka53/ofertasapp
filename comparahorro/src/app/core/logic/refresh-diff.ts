import type { AppMessage, RefreshResponse } from '../models/api.models';
import { toSelectedOffer, type ListItem, type SelectedOffer, type ShoppingList } from '../models/app.models';

export type RefreshChangeKind =
  | 'price_up'
  | 'price_down'
  | 'price_missing'
  | 'now_unavailable'
  | 'back_available'
  | 'not_found'
  | 'store_error'
  | 'unchanged'
  | 'cheaper_elsewhere';

export interface RefreshChange {
  id: string;
  itemId: string;
  productName: string;
  kind: RefreshChangeKind;
  current: SelectedOffer;
  proposed: SelectedOffer | null;
  /** Aplicarlo sustituye la oferta; en `cheaper_elsewhere` además cambia de tienda. */
  changesStore: boolean;
  message: AppMessage;
  /** Selección inicial en el diálogo de confirmación. */
  selectedByDefault: boolean;
}

const MONEY_EPSILON = 0.005;

export function computeRefreshChanges(list: ShoppingList, response: RefreshResponse): RefreshChange[] {
  const changes: RefreshChange[] = [];
  const results = new Map(response.items.map((r) => [r.key, r]));
  const alternatives = new Map(response.alternatives.map((a) => [a.key, a.offers]));

  for (const item of list.items) {
    if (!item.offer || item.offer.source === 'manual') continue;
    const current = item.offer;
    const result = results.get(item.id);
    if (!result) continue;
    let effectivePrice = current.price;

    if (result.status === 'store_error' || result.status === 'pending') {
      changes.push(change(item, 'store_error', null, false, result.message ?? { code: 'refresh.msg.store_error' }));
    } else if (result.status === 'not_found' || !result.offer) {
      changes.push(change(item, 'not_found', null, false, { code: 'refresh.msg.not_found' }));
    } else {
      const proposed = toSelectedOffer(result.offer);
      effectivePrice = proposed.price;
      if (proposed.price === null) {
        changes.push(change(item, 'price_missing', proposed, false, { code: 'refresh.msg.price_missing' }));
      } else if (proposed.availability === 'unavailable' && current.availability !== 'unavailable') {
        changes.push(change(item, 'now_unavailable', proposed, true, { code: 'refresh.msg.now_unavailable' }));
      } else if (current.price === null || Math.abs(proposed.price - current.price) > MONEY_EPSILON) {
        const up = current.price !== null && proposed.price > current.price;
        changes.push(change(item, current.price === null ? 'price_down' : up ? 'price_up' : 'price_down', proposed, true, { code: 'refresh.msg.price_changed' }));
      } else if (proposed.availability === 'available' && current.availability === 'unavailable') {
        changes.push(change(item, 'back_available', proposed, true, { code: 'refresh.msg.back_available' }));
      } else {
        changes.push(change(item, 'unchanged', proposed, true, { code: 'refresh.msg.unchanged' }));
      }
    }

    const cheaper = (alternatives.get(item.id) ?? [])
      .filter((o) => o.price !== null && o.availability !== 'unavailable' && o.storeId !== current.storeId)
      .sort((a, b) => a.price! - b.price!)[0];
    if (cheaper && (effectivePrice === null || cheaper.price! < effectivePrice - MONEY_EPSILON)) {
      changes.push(change(item, 'cheaper_elsewhere', toSelectedOffer(cheaper), false, { code: 'refresh.msg.cheaper_elsewhere', params: { store: cheaper.storeName } }));
    }
  }
  return changes;
}

function change(item: ListItem, kind: RefreshChangeKind, proposed: SelectedOffer | null, selected: boolean, message: AppMessage): RefreshChange {
  return {
    id: `${item.id}:${kind}`,
    itemId: item.id,
    productName: item.offer?.name ?? item.productQuery,
    kind,
    current: item.offer!,
    proposed,
    changesStore: kind === 'cheaper_elsewhere',
    message,
    selectedByDefault: selected && kind !== 'cheaper_elsewhere',
  };
}

/** Aplica solo los cambios confirmados. Si se eligen dos propuestas para un artículo, gana el cambio de tienda. */
export function applyRefreshChanges(list: ShoppingList, confirmed: RefreshChange[]): ShoppingList {
  const byItem = new Map<string, RefreshChange>();
  for (const c of confirmed) {
    if (!c.proposed) continue;
    const existing = byItem.get(c.itemId);
    if (!existing || c.changesStore) byItem.set(c.itemId, c);
  }
  return {
    ...list,
    items: list.items.map((item) => {
      const c = byItem.get(item.id);
      return c?.proposed ? { ...item, offer: c.proposed } : item;
    }),
  };
}

import { manualOffer, toSelectedOffer, type ListItem, type ShoppingList } from '../models/app.models';
import { isValidQuantity, lineSubtotalCents, summarizeList } from './list-math';
import { makeOffer } from './test-data';

function item(id: string, quantity: number, offer: Parameters<typeof makeOffer>[0] | null, purchased = false): ListItem {
  return {
    id,
    productQuery: id,
    desiredPresentation: null,
    quantity,
    purchased,
    offer: offer ? toSelectedOffer(makeOffer(offer)) : null,
    addedAt: '2026-09-16T15:00:00.000Z',
    addedBy: 'u1',
  };
}

function list(items: ListItem[]): ShoppingList {
  return { id: 'l1', name: 'Compras de septiembre', month: 9, year: 2026, countryCode: 'GT', currency: 'GTQ', currencySymbol: 'Q', createdAt: '', updatedAt: '', ownerId: 'u1', familyId: null, role: 'admin', memberCount: 1, purgeAt: null, items };
}

describe('cálculos de listas', () => {
  it('suma subtotales por tienda en centavos sin errores de redondeo', () => {
    const summary = summarizeList(
      list([
        item('a', 3, { id: 'wm:1', storeId: 'walmart-gt', storeName: 'Walmart Guatemala', price: 0.1 }),
        item('b', 2, { id: 'wm:2', storeId: 'walmart-gt', storeName: 'Walmart Guatemala', price: 18.9 }),
        item('c', 3, { id: 'md:1', storeId: 'maxi-despensa-gt', storeName: 'Maxi Despensa', price: 13 }),
      ]),
    );
    expect(summary.totalCents).toBe(30 + 3780 + 3900);
    expect(summary.storeGroups.map((g) => [g.storeName, g.subtotalCents])).toEqual([
      ['Maxi Despensa', 3900],
      ['Walmart Guatemala', 3810],
    ]);
  });

  it('los pendientes y los productos sin precio no cuentan como gratuitos', () => {
    const summary = summarizeList(
      list([
        item('pendiente', 5, null),
        item('sin-precio', 2, { id: 'lt:1', storeId: 'la-torre-gt', storeName: 'La Torre', price: null }),
        item('ok', 1, { id: 'lt:2', storeId: 'la-torre-gt', storeName: 'La Torre', price: 20.65 }),
      ]),
    );
    expect(summary.pendingItems.map((i) => i.id)).toEqual(['pendiente']);
    expect(summary.unpricedItems.map((i) => i.id)).toEqual(['sin-precio']);
    expect(summary.totalCents).toBe(2065);
    expect(summary.quotedCount).toBe(1);
    expect(summary.storeGroups[0]!.unpricedCount).toBe(1);
    expect(lineSubtotalCents(summary.unpricedItems[0]!)).toBeNull();
  });

  it('el total por comprar excluye los artículos marcados como comprados', () => {
    const summary = summarizeList(
      list([
        item('a', 2, { id: 'wm:1', storeId: 'walmart-gt', price: 18.9 }, true),
        item('b', 4, { id: 'md:1', storeId: 'maxi-despensa-gt', price: 13 }),
      ]),
    );
    expect(summary.totalCents).toBe(8980); // 18.90 × 2 + 13.00 × 4
    expect(summary.remainingCents).toBe(5200);
    expect(summary.purchasedCount).toBe(1);
  });

  it('los precios anotados por el usuario suman al total y se cuentan aparte', () => {
    const noted: ListItem = {
      id: 'anotado',
      productQuery: 'Aceite 3 L',
      desiredPresentation: '3 L',
      quantity: 2,
      purchased: false,
      offer: manualOffer({ storeId: 'pricesmart-gt', storeName: 'PriceSmart', productName: 'Aceite 3 L', presentation: '3 L', price: 25, seenOn: '2026-09-16', url: '' }, 'GTQ', 'm1'),
      addedAt: '2026-09-16T15:00:00.000Z',
      addedBy: 'u1',
    };
    const summary = summarizeList(list([noted, item('ok', 1, { id: 'lt:2', storeId: 'la-torre-gt', storeName: 'La Torre', price: 20.65 })]));
    expect(summary.totalCents).toBe(5000 + 2065);
    expect(summary.manualCount).toBe(1);
    expect(summary.quotedCount).toBe(2);
    expect(summary.storeGroups.map((g) => g.storeName)).toEqual(['La Torre', 'PriceSmart']);
  });

  it('valida cantidades enteras entre 1 y 999', () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(999)).toBe(true);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(1.5)).toBe(false);
    expect(isValidQuantity(1000)).toBe(false);
    expect(isValidQuantity('2')).toBe(false);
  });
});

import type { RefreshResponse } from '../models/api.models';
import { manualOffer, toSelectedOffer, type ShoppingList } from '../models/app.models';
import { applyRefreshChanges, computeRefreshChanges } from './refresh-diff';
import { makeOffer } from './test-data';

const laTorreOffer = makeOffer({ id: 'la-torre-gt:3763', storeId: 'la-torre-gt', storeName: 'La Torre', name: 'Leche UHT Descremada Delactomy', gtin: '07441001698644', gtinRaw: '7441001698644', price: 20.65 });
const walmartOffer = makeOffer({ id: 'walmart-gt:33335', storeId: 'walmart-gt', storeName: 'Walmart Guatemala', name: 'Leche Dos Pinos delactomy', gtin: '07441001698644', gtinRaw: '7441001698644', price: 18.9 });
const suli = makeOffer({ id: 'maxi-despensa-gt:33848', storeId: 'maxi-despensa-gt', storeName: 'Maxi Despensa', price: 13 });

function list(): ShoppingList {
  return {
    id: 'l1',
    name: 'Compras',
    month: 9,
    year: 2026,
    countryCode: 'GT',
    currency: 'GTQ',
    currencySymbol: 'Q',
    createdAt: '',
    updatedAt: '',
    ownerId: 'u1',
    familyId: null,
    role: 'admin',
    memberCount: 1,
    purgeAt: null,
    items: [
      { id: 'i1', productQuery: 'leche', desiredPresentation: null, quantity: 1, purchased: false, offer: toSelectedOffer(laTorreOffer), addedAt: '', addedBy: 'u1', assignedTo: null },
      { id: 'i2', productQuery: 'suli', desiredPresentation: null, quantity: 2, purchased: false, offer: toSelectedOffer(suli), addedAt: '', addedBy: 'u1', assignedTo: null },
      { id: 'i3', productQuery: 'pendiente', desiredPresentation: null, quantity: 1, purchased: false, offer: null, addedAt: '', addedBy: 'u1', assignedTo: null },
    ],
  };
}

function response(overrides: Partial<RefreshResponse> = {}): RefreshResponse {
  return { countryCode: 'GT', refreshedAt: '2026-09-16T16:00:00.000Z', items: [], alternatives: [], stores: [], ...overrides };
}

describe('computeRefreshChanges', () => {
  it('detecta cambios de precio en la misma tienda y los preselecciona', () => {
    const changes = computeRefreshChanges(
      list(),
      response({
        items: [
          { key: 'i1', storeId: 'la-torre-gt', skuId: '3763', status: 'ok', offer: { ...laTorreOffer, price: 21.5 }, message: null },
          { key: 'i2', storeId: 'maxi-despensa-gt', skuId: '33848', status: 'ok', offer: { ...suli, price: 12 }, message: null },
        ],
      }),
    );
    expect(changes.map((c) => [c.itemId, c.kind, c.selectedByDefault])).toEqual([
      ['i1', 'price_up', true],
      ['i2', 'price_down', true],
    ]);
  });

  it('propone la misma oferta más barata en otra tienda sin preseleccionarla', () => {
    const changes = computeRefreshChanges(
      list(),
      response({
        items: [{ key: 'i1', storeId: 'la-torre-gt', skuId: '3763', status: 'ok', offer: laTorreOffer, message: null }],
        alternatives: [{ key: 'i1', offers: [walmartOffer] }],
      }),
    );
    const cheaper = changes.find((c) => c.kind === 'cheaper_elsewhere')!;
    expect(cheaper.changesStore).toBe(true);
    expect(cheaper.selectedByDefault).toBe(false);
    expect(cheaper.proposed?.storeName).toBe('Walmart Guatemala');
    expect(changes.find((c) => c.kind === 'unchanged')).toBeTruthy();
  });

  it('conserva la oferta si la tienda falla o ya no muestra el producto', () => {
    const changes = computeRefreshChanges(
      list(),
      response({
        items: [
          { key: 'i1', storeId: 'la-torre-gt', skuId: '3763', status: 'store_error', offer: null, message: { code: 'upstream_timeout', params: { seconds: '8' } } },
          { key: 'i2', storeId: 'maxi-despensa-gt', skuId: '33848', status: 'not_found', offer: null, message: null },
        ],
      }),
    );
    expect(changes.map((c) => [c.kind, c.proposed, c.message])).toEqual([
      ['store_error', null, { code: 'upstream_timeout', params: { seconds: '8' } }],
      ['not_found', null, { code: 'refresh.msg.not_found' }],
    ]);
    expect(applyRefreshChanges(list(), changes).items[0]!.offer?.price).toBe(20.65);
  });

  it('los precios anotados por el usuario no se consultan ni se reemplazan', () => {
    const base = list();
    const noted = manualOffer({ storeId: 'pricesmart-gt', storeName: 'PriceSmart', productName: 'Arroz 5 lb', presentation: '5 lb', price: 45, seenOn: '2026-09-16', url: '' }, 'GTQ', 'x');
    const withManual: ShoppingList = { ...base, items: base.items.map((i) => (i.id === 'i3' ? { ...i, offer: noted } : i)) };
    const changes = computeRefreshChanges(withManual, response({ items: [{ key: 'i3', storeId: 'pricesmart-gt', skuId: '', status: 'pending', offer: null, message: { code: 'link_only' } }] }));
    expect(changes).toEqual([]);
    expect(applyRefreshChanges(withManual, changes).items[2]!.offer).toEqual(noted);
  });

  it('un precio que desaparece no se interpreta como cero', () => {
    const [change] = computeRefreshChanges(
      list(),
      response({ items: [{ key: 'i1', storeId: 'la-torre-gt', skuId: '3763', status: 'ok', offer: { ...laTorreOffer, price: null }, message: null }] }),
    );
    expect(change!.kind).toBe('price_missing');
    expect(change!.selectedByDefault).toBe(false);
  });

  it('aplica solo lo confirmado; el cambio de tienda prevalece para el mismo artículo', () => {
    const changes = computeRefreshChanges(
      list(),
      response({
        items: [{ key: 'i1', storeId: 'la-torre-gt', skuId: '3763', status: 'ok', offer: { ...laTorreOffer, price: 22 }, message: null }],
        alternatives: [{ key: 'i1', offers: [walmartOffer] }],
      }),
    );
    const updated = applyRefreshChanges(list(), changes);
    expect(updated.items[0]!.offer?.storeId).toBe('walmart-gt');
    const onlyPrice = applyRefreshChanges(list(), changes.filter((c) => !c.changesStore));
    expect(onlyPrice.items[0]!.offer?.price).toBe(22);
    expect(applyRefreshChanges(list(), []).items[0]!.offer?.price).toBe(20.65);
  });
});

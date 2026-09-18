import { describe, expect, it } from 'vitest';
import { findCountry, findStore } from '../src/catalog/catalog.js';
import type { VtexIntegration } from '../src/catalog/catalog.types.js';
import { normalizeProduct, type NormalizeContext } from '../src/connectors/vtex/vtex-normalize.js';
import type { VtexProduct } from '../src/connectors/vtex/vtex.types.js';
import { fixture } from './helpers.js';

function ctx(storeId: string, sourceApi: NormalizeContext['sourceApi'] = 'intelligent-search'): NormalizeContext {
  const store = findStore(storeId)!;
  const country = findCountry('GT')!;
  return {
    store,
    integration: store.integration as VtexIntegration,
    countryCode: 'GT',
    currency: country.currency,
    unitSystem: country.unitSystem,
    consultedAt: '2026-09-16T15:31:26.206Z',
    location: { label: null, assignedStore: null, appliedBy: null },
    sourceApi,
  };
}

function normalizeAll(products: VtexProduct[], storeId: string, sourceApi?: NormalizeContext['sourceApi']) {
  return products.flatMap((p) => normalizeProduct(p, ctx(storeId, sourceApi)));
}

describe('Normalización VTEX con respuestas reales', () => {
  it('Walmart: precio, precio anterior, contenido, GTIN y enlace absoluto', () => {
    const offers = normalizeAll(fixture('walmart-gt').leche.products, 'walmart-gt');
    const delactomy = offers.find((o) => o.skuId === '33335')!;
    expect(delactomy).toMatchObject({
      id: 'walmart-gt:33335',
      storeName: 'Walmart Guatemala',
      name: 'Leche Dos Pinos delactomy uht 0% grasa - 946 ml',
      brand: 'DOS PINOS',
      price: 20.25,
      listPrice: null,
      currency: 'GTQ',
      gtin: '07441001698644',
      gtinRaw: '7441001698644',
      presentation: '946 ml',
      availability: 'available',
      url: 'https://www.walmart.com.gt/leche-dos-pinos-delactomy-descremada-1000ml/p',
      category: 'Leche Deslactosada',
    });
    expect(delactomy.unitPrice).toEqual({ value: 21.4059, per: 'L' });

    const coronado = offers.find((o) => o.skuId === '50366')!;
    expect(coronado.price).toBe(148.5);
    expect(coronado.listPrice).toBe(165);
    expect(coronado.promotions[0]).toMatchObject({ kind: 'price_drop', previousPrice: 165, discountPercent: 10 });
    expect(coronado.unitPrice).toBeNull(); // "Caja 12 Unidades - 12 L" es ambiguo
  });

  it('Walmart: promoción condicionada "2 x Q12"', () => {
    const [albay] = normalizeAll(fixture('walmart-gt').albay.products, 'walmart-gt');
    expect(albay!.promotions).toHaveLength(1);
    expect(albay!.promotions[0]).toMatchObject({ kind: 'multi_buy', totalPrice: 12, minQuantity: 2 });
    expect(albay!.unitPrice).toEqual({ value: 17.875, per: 'kg' });
  });

  it('Walmart: la Search API de catálogo (respaldo) produce la misma promoción', () => {
    const [legacy] = normalizeAll(fixture('walmart-gt').legacySku30935, 'walmart-gt', 'catalog-legacy');
    expect(legacy).toMatchObject({ price: 7.15, sourceApi: 'catalog-legacy', url: 'https://www.walmart.com.gt/arroz-albay-precocido-400gr/p' });
    expect(legacy!.promotions[0]).toMatchObject({ kind: 'multi_buy', totalPrice: 12 });
  });

  it('un precio 0 sin existencias se informa como no disponible, nunca como cero', () => {
    const [offer] = normalizeAll(fixture('walmart-gt').noBranchSample13001.products, 'walmart-gt');
    expect(offer!.price).toBeNull();
    expect(offer!.unitPrice).toBeNull();
    expect(offer!.availability).toBe('unavailable');
  });

  it('La Torre: contenido desde "Contenido Neto" y promoción destacada', () => {
    const offers = normalizeAll(fixture('la-torre-gt').leche.products, 'la-torre-gt');
    const delactomy = offers.find((o) => o.skuId === '3763')!;
    expect(delactomy).toMatchObject({ price: 20.65, presentation: '1 L', gtin: '07441001698644' });
    expect(delactomy.unitPrice).toEqual({ value: 20.65, per: 'L' });

    const polvo = offers.find((o) => o.skuId === '8364')!;
    expect(polvo.presentation).toBe('800 g');
    expect(polvo.promotions).toEqual([expect.objectContaining({ kind: 'store_highlight', raw: '2do a 99% Descuento Exclusivo Online', minQuantity: 2 })]);
  });

  it('La Torre: "Ofertas Publicadas" no duplica la rebaja por precio anterior', () => {
    const [pan] = normalizeAll(fixture('la-torre-gt').ofertasLeche.products, 'la-torre-gt');
    expect(pan!.promotions.map((p) => p.kind)).toEqual(['price_drop']);
    expect(pan!.listPrice).toBe(16.65);
  });

  it('Maxi Despensa: teaser "2 x Q20" y GTIN con cero inicial', () => {
    const offers = normalizeAll(fixture('maxi-despensa-gt').leche.products, 'maxi-despensa-gt');
    const suli = offers.find((o) => o.skuId === '33848')!;
    expect(suli.promotions[0]).toMatchObject({ kind: 'multi_buy', totalPrice: 20, promoUnitPrice: 10 });
    expect(suli.presentation).toBe('1 L');
    const winter = offers.find((o) => o.skuId === '58051')!;
    expect(winter.gtin).toBe('00064992750190');
    expect(winter.url).toBe('https://www.maxidespensa.com.gt/leche-entera-marca-winter-instantanea-360gr/p');
  });
});

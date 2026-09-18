import { alternativesFor, buildComparison, jaccard, nameTokens } from './compare';
import { grams, makeOffer, ml } from './test-data';

describe('buildComparison', () => {
  it('agrupa por código de barras entre tiendas y marca el menor precio por paquete', () => {
    const a = makeOffer({ id: 'wm:1', storeId: 'wm', name: 'Leche Delactomy 946 ml', gtin: '07441001698644', price: 18.9, content: ml(946) });
    const b = makeOffer({ id: 'lt:1', storeId: 'lt', name: 'Leche UHT Descremada Delactomy', gtin: '07441001698644', price: 20.65, content: ml(1000) });
    const summary = buildComparison([a, b]);
    expect(summary.groups).toHaveLength(1);
    const group = summary.groups[0]!;
    expect(group.matchType).toBe('gtin');
    expect(group.canCompare).toBe(true);
    expect(group.bestOfferIds).toEqual(['wm:1']);
    expect(group.contentMismatch).toBe(true);
    expect(summary.groupByOfferId.get('lt:1')).toBe(group);
  });

  it('no declara ganador si solo una tienda tiene precio o disponibilidad', () => {
    const a = makeOffer({ id: 'wm:1', storeId: 'wm', gtin: '07441001698644', price: 18.9 });
    const b = makeOffer({ id: 'lt:1', storeId: 'lt', gtin: '07441001698644', price: null });
    const c = makeOffer({ id: 'md:1', storeId: 'md', gtin: '07441001698644', price: 10, availability: 'unavailable' });
    const group = buildComparison([a, b, c]).groups[0]!;
    expect(group.canCompare).toBe(false);
    expect(group.bestOfferIds).toEqual([]);
  });

  it('empates: todas las ofertas con el menor precio reciben el distintivo', () => {
    const a = makeOffer({ id: 'wm:1', storeId: 'wm', gtin: '07441078217731', price: 13 });
    const b = makeOffer({ id: 'md:1', storeId: 'md', gtin: '07441078217731', price: 13 });
    expect(buildComparison([a, b]).groups[0]!.bestOfferIds.sort()).toEqual(['md:1', 'wm:1']);
  });

  it('coincidencia probable solo con misma marca, mismo contenido y nombre similar', () => {
    const a = makeOffer({ id: 'wm:2', storeId: 'wm', brand: 'SULI', name: 'Leche Entera Suli UHT - 1 L', price: 13, content: ml(1000) });
    const b = makeOffer({ id: 'md:2', storeId: 'md', brand: 'Suli', name: 'Leche Suli Entera UHT', price: 12.5, content: ml(1000) });
    const otherSize = makeOffer({ id: 'lt:2', storeId: 'lt', brand: 'SULI', name: 'Leche Entera Suli UHT', price: 7, content: ml(500) });
    const otherBrand = makeOffer({ id: 'lt:3', storeId: 'lt', brand: 'SABEMAS', name: 'Leche Entera UHT', price: 11, content: ml(1000) });
    const summary = buildComparison([a, b, otherSize, otherBrand]);
    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0]!.matchType).toBe('probable');
    expect(summary.groups[0]!.offers.map((o) => o.id).sort()).toEqual(['md:2', 'wm:2']);
    expect(summary.groupByOfferId.has('lt:2')).toBe(false);
    expect(summary.groupByOfferId.has('lt:3')).toBe(false);
  });

  it('no agrupa productos con códigos de barras distintos aunque se parezcan', () => {
    const a = makeOffer({ id: 'wm:3', storeId: 'wm', brand: 'CORONADO', name: 'Leche Coronado Deslactosada', gtin: '07441013501819', price: 16, content: ml(1000) });
    const b = makeOffer({ id: 'lt:3', storeId: 'lt', brand: 'CORONADO', name: 'Leche Coronado Deslactosada', gtin: '07441013501482', price: 16.65, content: ml(1000) });
    expect(buildComparison([a, b]).groups).toHaveLength(0);
  });

  it('distingue menor precio por paquete y menor precio por litro', () => {
    const small = makeOffer({ id: 'a', storeId: 'wm', name: 'Botella 500 ml', price: 10, content: ml(500), unitPrice: { value: 20, per: 'L' } });
    const big = makeOffer({ id: 'b', storeId: 'lt', name: 'Botella 1 L', price: 15, content: ml(1000), unitPrice: { value: 15, per: 'L' } });
    const summary = buildComparison([small, big]);
    expect(summary.cheapestPackage?.id).toBe('a');
    expect(summary.cheapestUnit?.offer.id).toBe('b');
    expect(summary.cheapestUnit?.per).toBe('L');
    expect(summary.groups).toHaveLength(0);
  });

  it('ignora precios ausentes para los mínimos', () => {
    const noPrice = makeOffer({ id: 'x', storeId: 'wm', price: null });
    const priced = makeOffer({ id: 'y', storeId: 'lt', price: 30, content: grams(400), unitPrice: { value: 75, per: 'kg' } });
    const summary = buildComparison([noPrice, priced]);
    expect(summary.cheapestPackage?.id).toBe('y');
  });
});

describe('alternativas y similitud', () => {
  it('lista alternativas con la misma unidad ordenadas por precio por unidad', () => {
    const target = makeOffer({ id: 't', storeId: 'wm', price: 10, unitPrice: { value: 20, per: 'L' } });
    const cheaper = makeOffer({ id: 'c', storeId: 'lt', price: 15, unitPrice: { value: 15, per: 'L' } });
    const kg = makeOffer({ id: 'k', storeId: 'lt', price: 5, unitPrice: { value: 12, per: 'kg' } });
    expect(alternativesFor(target, [target, cheaper, kg], undefined).map((o) => o.id)).toEqual(['c']);
  });

  it('tokens de nombre sin marca ni cantidades', () => {
    const tokens = nameTokens({ name: 'Leche Dos Pinos Pinito - 1000 ml', brand: 'DOS PINOS' });
    expect([...tokens]).toEqual(['leche', 'pinito']);
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3);
  });
});

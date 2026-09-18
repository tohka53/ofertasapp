import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { storesForCountry } from '../src/catalog/catalog.js';
import { fakeFetch, json, testConfig, type Route } from './helpers.js';

/** Productos de ejemplo con la forma de VTEX Intelligent Search (no son datos de las tiendas). */
function exampleProduct(id: string, name: string, price: number, quantity: number) {
  return {
    productId: id,
    productName: name,
    brand: 'MARCA',
    link: `/${id}/p`,
    items: [{ itemId: id, name, ean: '', sellers: [{ sellerId: '1', sellerDefault: true, commertialOffer: { Price: price, ListPrice: price, AvailableQuantity: quantity } }] }],
  };
}

describe('Tiendas VTEX de Centroamérica', () => {
  it('registra las tiendas conectadas por país', () => {
    const queryable = (code: string) => storesForCountry(code).filter((s) => s.integration.kind === 'vtex').map((s) => s.id);
    expect(queryable('SV')).toEqual(['walmart-sv', 'maxi-despensa-sv', 'despensa-don-juan-sv']);
    expect(queryable('HN')).toEqual(['walmart-hn', 'paiz-hn', 'la-colonia-hn']);
    expect(queryable('NI')).toEqual(['walmart-ni', 'la-union-ni']);
    expect(queryable('CR')).toEqual(['walmart-cr', 'masxmenos-cr', 'maxipali-cr']);
    expect(queryable('PA')).toEqual(['super-xtra-pa']);
    expect(queryable('BZ')).toEqual([]);
  });

  it('usa el canal y el idioma verificados de cada tienda y no aplica ubicación donde no se usa', async () => {
    const routes: Route = (url) => {
      if (url.pathname.endsWith('/product_search/')) return json({ recordsFiltered: 1, products: [exampleProduct('10', 'Arroz 2270 g', 3.4, 10)] });
      return undefined;
    };
    const fetchImpl = fakeFetch([routes]);
    const server = createApp(testConfig(), { fetchImpl });
    const res = await request(server)
      .get('/api/search')
      .query({ country: 'SV', q: 'arroz', stores: 'walmart-sv,maxi-despensa-sv', lat: '13.6929', lng: '-89.2182', locationLabel: 'San Salvador' })
      .expect(200);
    expect(res.body.currency).toBe('USD');
    expect(res.body.stores.map((s: { status: string; warnings: unknown[]; location: unknown }) => [s.status, s.warnings, s.location])).toEqual([
      ['ok', [], null],
      ['ok', [], null],
    ]);
    expect(fetchImpl.calls.some((u) => u.startsWith('https://www.walmart.com.sv/api/io/_v/api/intelligent-search/product_search/?query=arroz') && u.includes('locale=es-SV'))).toBe(true);
    expect(fetchImpl.calls.some((u) => u.includes('/regions'))).toBe(false);
    expect(res.body.offers[0]).toMatchObject({ price: 3.4, presentation: '2270 g', unitPrice: { per: 'kg' } });
  });

  it('La Colonia: sin ubicación las existencias se informan como desconocidas', async () => {
    const routes: Route = (url) => {
      if (url.host !== 'www.lacolonia.com') return undefined;
      if (url.pathname === '/api/checkout/pub/regions') {
        expect(url.searchParams.get('geoCoordinates')).toBe('-87.192100;14.072300');
        return json([{ id: 'U1cjbGFjb2xvbmlhMDE=', sellers: [{ id: 'lacolonia01', name: 'lacolonia01' }] }]);
      }
      if (url.pathname.endsWith('/product_search/')) {
        const regional = url.searchParams.get('regionId') === 'U1cjbGFjb2xvbmlhMDE=';
        return json({ recordsFiltered: 1, products: [exampleProduct('20', 'Arroz Blanco 1750 Gr', 51.95, regional ? 10000 : 0)] });
      }
      return undefined;
    };
    const server = createApp(testConfig(), { fetchImpl: fakeFetch([routes]) });

    const withoutLocation = await request(server).get('/api/search').query({ country: 'HN', q: 'arroz', stores: 'la-colonia-hn' }).expect(200);
    expect(withoutLocation.body.stores[0].warnings).toEqual([{ code: 'availability_needs_location', params: { store: 'Supermercados La Colonia' } }]);
    expect(withoutLocation.body.offers[0]).toMatchObject({ price: 51.95, availability: 'unknown', availableQuantity: null });

    const withLocation = await request(server)
      .get('/api/search')
      .query({ country: 'HN', q: 'arroz', stores: 'la-colonia-hn', lat: '14.0723', lng: '-87.1921', locationLabel: 'Tegucigalpa' })
      .expect(200);
    expect(withLocation.body.stores[0].location).toMatchObject({ method: 'geo', assignedStores: ['lacolonia01'] });
    expect(withLocation.body.offers[0]).toMatchObject({ availability: 'available', location: { label: 'Tegucigalpa', assignedStore: 'lacolonia01', appliedBy: 'geo' } });
  });
});

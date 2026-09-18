import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { fakeFetch, json, testConfig, type Route } from './helpers.js';

/**
 * Conector de la API de Kroger con respuestas simuladas según los campos documentados
 * (token OAuth2, Locations y Products). No reemplaza una prueba en vivo con credenciales.
 */
const API = 'https://api.kroger.com';

const krogerRoutes: Route = (url, init) => {
  if (url.host !== 'api.kroger.com') return undefined;
  if (url.pathname === '/v1/connect/oauth2/token') {
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe(`Basic ${Buffer.from('client-id:client-secret').toString('base64')}`);
    expect(String(init?.body)).toBe('grant_type=client_credentials&scope=product.compact');
    return json({ access_token: 'token-123', expires_in: 1800, token_type: 'bearer' });
  }
  expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token-123');
  if (url.pathname === '/v1/locations') {
    expect(url.searchParams.get('filter.zipCode.near')).toBe('45202');
    return json({ data: [{ locationId: '01400943', chain: 'KROGER', name: 'Kroger On the Rhine', address: { addressLine1: '100 E Court St', city: 'Cincinnati', state: 'OH', zipCode: '45202' } }] });
  }
  if (url.pathname === '/v1/products') {
    const withLocation = url.searchParams.get('filter.locationId') === '01400943';
    return json({
      data: [
        {
          productId: '0001111041600',
          upc: '0001111041600',
          brand: 'Kroger',
          description: 'Kroger 2% Reduced Fat Milk',
          categories: ['Dairy'],
          images: [{ perspective: 'front', featured: true, sizes: [{ size: 'medium', url: 'https://www.kroger.com/product/images/medium/front/0001111041600' }] }],
          items: [
            {
              itemId: '0001111041600',
              size: '1 gal',
              soldBy: 'UNIT',
              price: withLocation ? { regular: 3.49, promo: 2.99 } : undefined,
              inventory: withLocation ? { stockLevel: 'HIGH' } : undefined,
            },
          ],
        },
      ],
      meta: { pagination: { total: 1 } },
    });
  }
  return undefined;
};

function krogerApp() {
  const fetchImpl = fakeFetch([krogerRoutes]);
  const config = testConfig({ kroger: { clientId: 'client-id', clientSecret: 'client-secret', apiBaseUrl: API } });
  return { server: createApp(config, { fetchImpl }), fetchImpl };
}

describe('API de Kroger (con credenciales configuradas)', () => {
  it('ubica la tienda por ZIP y devuelve precio regular y promocional', async () => {
    const { server } = krogerApp();
    const res = await request(server).get('/api/search').query({ country: 'US', q: 'milk', stores: 'kroger-us', postalCode: '45202', locationLabel: 'ZIP 45202' }).expect(200);
    expect(res.body.stores[0]).toMatchObject({ status: 'ok', resultCount: 1 });
    expect(res.body.stores[0].location).toMatchObject({ method: 'postalCode', postalCode: '45202', regionId: '01400943', assignedStores: ['Kroger On the Rhine (100 E Court St, Cincinnati, OH)'] });
    const [offer] = res.body.offers;
    expect(offer).toMatchObject({
      storeId: 'kroger-us',
      currency: 'USD',
      name: 'Kroger 2% Reduced Fat Milk',
      price: 2.99,
      listPrice: 3.49,
      presentation: '1 gal',
      availability: 'available',
      sourceApi: 'kroger-products',
    });
    expect(offer.unitPrice.per).toBe('fl_oz');
    expect(offer.unitPrice.value).toBeCloseTo(2.99 / 128, 4);
    expect(offer.promotions[0]).toMatchObject({ kind: 'price_drop', previousPrice: 3.49, source: 'promo_price' });
  });

  it('sin ZIP no muestra precios y lo advierte', async () => {
    const { server } = krogerApp();
    const res = await request(server).get('/api/search').query({ country: 'US', q: 'milk', stores: 'kroger-us' }).expect(200);
    expect(res.body.stores[0].warnings).toEqual([{ code: 'zip_needed_for_prices', params: { store: 'Kroger' } }]);
    expect(res.body.offers[0]).toMatchObject({ price: null, availability: 'unknown' });
  });

  it('el catálogo la marca como disponible cuando el token funciona', async () => {
    const { server } = krogerApp();
    const res = await request(server).get('/api/countries/US/stores?state=OH&checkStatus=true').expect(200);
    expect(res.body.stores.find((s: { id: string }) => s.id === 'kroger-us')).toMatchObject({ status: 'available', selectable: true, queryable: true });
  });
});

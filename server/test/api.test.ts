import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { fakeFetch, fixture, hanging, json, testConfig, type Route } from './helpers.js';

const walmart = fixture('walmart-gt');
const laTorre = fixture('la-torre-gt');
const maxi = fixture('maxi-despensa-gt');
const WALMART_REGION_01001 = walmart.regions01001[0].id as string;

const IS_PATH = '/api/io/_v/api/intelligent-search/product_search/';

const walmartRoutes: Route = (url) => {
  if (url.host !== 'www.walmart.com.gt') return undefined;
  if (url.pathname === '/api/checkout/pub/regions') {
    if (url.searchParams.get('postalCode') === '01001') return json(walmart.regions01001);
    if (url.searchParams.get('postalCode') === '13001') return json(walmart.regions13001);
    if (url.searchParams.get('geoCoordinates')) return json(walmart.regions01001);
    return json([]);
  }
  if (url.pathname === IS_PATH) {
    const query = url.searchParams.get('query') ?? '';
    if (query === '7441001698644') return json({ recordsFiltered: 1, products: [walmart.leche.products[3]] });
    if (query === '7404003090373') return json(walmart.albay);
    if (url.searchParams.get('regionId') === WALMART_REGION_01001) return json(walmart.lecheRegion01001);
    if (url.searchParams.get('page') && !query) return json({ recordsFiltered: 1, products: [] });
    return json(walmart.leche);
  }
  return undefined;
};

const laTorreRoutes: Route = (url) => {
  if (url.host !== 'www.latorre.com.gt') return undefined;
  if (url.pathname === '/api/checkout/pub/regions') return json(laTorre.regions01010);
  if (url.pathname === IS_PATH) {
    const query = url.searchParams.get('query') ?? '';
    if (query === '7441001698644') return json(laTorre.delactomy);
    if (url.searchParams.get('sort') === 'discount:desc') return json(laTorre.ofertasLeche);
    return json(laTorre.leche);
  }
  return undefined;
};

function app(routes: Route[]) {
  const fetchImpl = fakeFetch(routes);
  return { app: createApp(testConfig(), { fetchImpl }), fetchImpl };
}

describe('API de catálogo', () => {
  it('lista países con tiendas registradas y conectadas', async () => {
    const { app: server } = app([]);
    const res = await request(server).get('/api/countries').expect(200);
    const gt = res.body.countries.find((c: { code: string }) => c.code === 'GT');
    expect(gt).toMatchObject({ name: { es: 'Guatemala', en: 'Guatemala' }, currency: 'GTQ', storeCount: 9, connectedStoreCount: 4, locationMode: 'gt-zones' });
    expect(res.body.countries.find((c: { code: string }) => c.code === 'SV')).toMatchObject({ storeCount: 6, connectedStoreCount: 3 });
    expect(res.body.countries.find((c: { code: string }) => c.code === 'US')).toMatchObject({ name: { es: 'Estados Unidos', en: 'United States' }, regionKind: 'state', unitSystem: 'us' });
    expect(res.body.countries.map((c: { code: string }) => c.code)).toEqual(['GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA', 'US']);
  });

  it('distingue tiendas disponibles, sin conexión y pendientes', async () => {
    const maxiDown: Route = (url) => (url.host === 'www.maxidespensa.com.gt' ? json({ error: 'down' }, 503) : undefined);
    const { app: server } = app([walmartRoutes, laTorreRoutes, maxiDown]);
    const res = await request(server).get('/api/countries/GT/stores?checkStatus=true').expect(200);
    const byId = Object.fromEntries(res.body.stores.map((s: { id: string }) => [s.id, s]));
    expect(byId['walmart-gt']).toMatchObject({ status: 'available', selectable: true, queryable: true, statusMessage: null });
    expect(byId['maxi-despensa-gt']).toMatchObject({ status: 'offline', statusMessage: { code: 'upstream_http', params: { status: 503 } } });
    expect(byId['pricesmart-gt']).toMatchObject({
      status: 'pending',
      integrationKind: 'link',
      selectable: true,
      queryable: false,
      searchUrlTemplate: 'https://www.pricesmart.com/es-gt/busqueda?q={query}',
    });
    expect(byId['suma-gt'].pendingReason.es).toContain('GraphQL privada');
    expect(byId['suma-gt'].pendingReason.en).toContain('private GraphQL');
    expect(byId['despensa-familiar-gt']).toMatchObject({ status: 'pending', selectable: false, pendingReasonCode: 'no_online_catalog' });
  });

  it('devuelve ubicaciones de Guatemala con Zona 1 por defecto', async () => {
    const { app: server } = app([]);
    const res = await request(server).get('/api/countries/GT/locations').expect(200);
    expect(res.body).toMatchObject({ mode: 'gt-zones', defaultLocation: { department: 'Guatemala', name: 'Guatemala Zona 1', postalCode: '01001' } });
    expect(res.body.departments).toHaveLength(22);
  });

  it('ofrece ciudades para Centroamérica y estados para EE. UU.', async () => {
    const { app: server } = app([]);
    const cr = await request(server).get('/api/countries/CR/locations').expect(200);
    expect(cr.body).toMatchObject({ mode: 'cities', departments: [], states: [] });
    expect(cr.body.cities[0]).toMatchObject({ name: 'San José' });
    const us = await request(server).get('/api/countries/US/locations').expect(200);
    expect(us.body.mode).toBe('us-zip');
    expect(us.body.states).toHaveLength(51);
    expect(us.body.states.find((s: { code: string }) => s.code === 'NY').name).toEqual({ es: 'Nueva York', en: 'New York' });
  });

  it('filtra las cadenas de EE. UU. por estado', async () => {
    const { app: server } = app([]);
    const tx = await request(server).get('/api/countries/US/stores?state=tx').expect(200);
    const ids = tx.body.stores.map((s: { id: string }) => s.id);
    expect(tx.body.state).toBe('TX');
    expect(ids).toEqual(expect.arrayContaining(['kroger-us', 'heb-us', 'walmart-us', 'tom-thumb-us']));
    expect(ids).not.toContain('publix-us');
    const kroger = tx.body.stores.find((s: { id: string }) => s.id === 'kroger-us');
    expect(kroger).toMatchObject({ status: 'pending', selectable: false, pendingReasonCode: 'credentials_missing', statusMessage: { code: 'credentials_missing' } });
    expect(kroger.banners.map((b: { name: string }) => b.name)).toContain('Ralphs');
    const fl = await request(server).get('/api/countries/US/stores?state=FL').expect(200);
    expect(fl.body.stores.map((s: { id: string }) => s.id)).toEqual(expect.arrayContaining(['publix-us', 'winn-dixie-us', 'kroger-us']));
    await request(server).get('/api/countries/US/stores?state=ZZ').expect(400);
  });
});

describe('Búsqueda', () => {
  it('consulta solo las tiendas pedidas y continúa si una falla', async () => {
    const maxiDown: Route = (url) => (url.host === 'www.maxidespensa.com.gt' ? json({ error: 'down' }, 500) : undefined);
    const { app: server, fetchImpl } = app([walmartRoutes, laTorreRoutes, maxiDown]);
    const res = await request(server)
      .get('/api/search')
      .query({ country: 'GT', q: 'leche', stores: 'walmart-gt,maxi-despensa-gt,pricesmart-gt' })
      .expect(200);

    const status = Object.fromEntries(res.body.stores.map((s: { storeId: string; status: string }) => [s.storeId, s.status]));
    expect(status).toEqual({ 'walmart-gt': 'ok', 'maxi-despensa-gt': 'error', 'pricesmart-gt': 'pending' });
    expect(res.body.offers.every((o: { storeId: string }) => o.storeId === 'walmart-gt')).toBe(true);
    expect(res.body.offers).toHaveLength(6);
    expect(fetchImpl.calls.some((u) => u.includes('latorre'))).toBe(false);
    expect(res.body.stores.find((s: { storeId: string }) => s.storeId === 'walmart-gt').warnings[0]).toEqual({ code: 'price_varies_no_location', params: { store: 'Walmart Guatemala' } });
    expect(res.body.stores.find((s: { storeId: string }) => s.storeId === 'pricesmart-gt').message).toEqual({ code: 'link_only' });
  });

  it('marca como sin conexión una tienda que no responde a tiempo', async () => {
    const maxiHang: Route = (url, init) => (url.host === 'www.maxidespensa.com.gt' ? hanging(init) : undefined);
    const { app: server } = app([laTorreRoutes, maxiHang]);
    const started = Date.now();
    const res = await request(server).get('/api/search').query({ country: 'GT', q: 'leche', stores: 'la-torre-gt,maxi-despensa-gt' }).expect(200);
    expect(Date.now() - started).toBeLessThan(6000);
    const maxiResult = res.body.stores.find((s: { storeId: string }) => s.storeId === 'maxi-despensa-gt');
    expect(maxiResult).toMatchObject({ status: 'timeout', resultCount: 0 });
    expect(res.body.offers).toHaveLength(5);
  });

  it('aplica la ubicación: sucursal asignada y precios regionales de Walmart', async () => {
    const { app: server, fetchImpl } = app([walmartRoutes]);
    const res = await request(server)
      .get('/api/search')
      .query({ country: 'GT', q: 'leche', stores: 'walmart-gt', postalCode: '01001', locationLabel: 'Guatemala Zona 1' })
      .expect(200);
    const store = res.body.stores[0];
    expect(store.location).toMatchObject({ method: 'postalCode', postalCode: '01001', assignedStores: ['WM-DEL NORTE'], priceVariesByLocation: true });
    const pinito = res.body.offers.find((o: { skuId: string }) => o.skuId === '33205');
    expect(pinito.price).toBe(17.45);
    expect(pinito.location).toEqual({ label: 'Guatemala Zona 1', assignedStore: 'WM-DEL NORTE', appliedBy: 'postalCode' });
    expect(fetchImpl.calls.some((u) => u.includes(`regionId=${encodeURIComponent(WALMART_REGION_01001)}`))).toBe(true);
  });

  it('usa coordenadas GPS solo donde la tienda las acepta', async () => {
    const { app: server } = app([walmartRoutes, laTorreRoutes]);
    const res = await request(server)
      .get('/api/search')
      .query({ country: 'GT', q: 'leche', stores: 'walmart-gt,la-torre-gt', lat: '14.642', lng: '-90.513' })
      .expect(200);
    const byId = Object.fromEntries(res.body.stores.map((s: { storeId: string }) => [s.storeId, s]));
    expect(byId['walmart-gt'].location).toMatchObject({ method: 'geo', assignedStores: ['WM-DEL NORTE'] });
    expect(byId['la-torre-gt'].location).toBeNull();
    expect(byId['la-torre-gt'].warnings[0]).toEqual({ code: 'geo_not_supported', params: { store: 'La Torre' } });
  });

  it('advierte cuando la ubicación no tiene sucursal', async () => {
    const { app: server } = app([walmartRoutes]);
    const res = await request(server).get('/api/search').query({ country: 'GT', q: 'leche', stores: 'walmart-gt', postalCode: '13001' }).expect(200);
    expect(res.body.stores[0].warnings.map((w: { code: string }) => w.code)).toContain('no_branch_price_zero');
  });

  it('recurre a la Search API de catálogo si Intelligent Search no está disponible', async () => {
    const legacyOnly: Route = (url) => {
      if (url.host !== 'www.walmart.com.gt') return undefined;
      if (url.pathname === IS_PATH) return json({ message: 'not found' }, 404);
      if (url.pathname === '/api/catalog_system/pub/products/search') {
        expect(url.searchParams.get('ft')).toBe('arroz');
        return json(walmart.legacySku30935, 206, { resources: '0-23/189' });
      }
      return undefined;
    };
    const { app: server } = app([legacyOnly]);
    const res = await request(server).get('/api/search').query({ country: 'GT', q: 'arroz', stores: 'walmart-gt' }).expect(200);
    expect(res.body.stores[0]).toMatchObject({ status: 'ok', totalAvailable: 189 });
    expect(res.body.stores[0].warnings.map((w: { code: string }) => w.code)).toContain('legacy_fallback');
    expect(res.body.offers[0]).toMatchObject({ sourceApi: 'catalog-legacy', price: 7.15 });
  });

  it('valida país, tiendas y texto', async () => {
    const { app: server } = app([]);
    await request(server).get('/api/search').query({ country: 'GT', q: 'leche', stores: 'tienda-inventada' }).expect(400);
    await request(server).get('/api/search').query({ country: 'SV', q: 'leche', stores: 'walmart-gt' }).expect(400);
    const short = await request(server).get('/api/search').query({ country: 'GT', q: 'l', stores: 'walmart-gt' }).expect(400);
    expect(short.body.error.code).toBe('query_too_short');
  });
});

describe('Comparación por código de barras y actualización', () => {
  it('encuentra el mismo GTIN en dos tiendas', async () => {
    const { app: server } = app([walmartRoutes, laTorreRoutes]);
    const res = await request(server).get('/api/products/by-gtin').query({ country: 'GT', gtin: '7441001698644', stores: 'walmart-gt,la-torre-gt' }).expect(200);
    expect(res.body.offers.map((o: { storeId: string; price: number }) => [o.storeId, o.price])).toEqual([
      ['walmart-gt', 20.25],
      ['la-torre-gt', 20.65],
    ]);
  });

  it('actualiza precios de artículos y sugiere alternativas en otras tiendas', async () => {
    const { app: server } = app([walmartRoutes, laTorreRoutes]);
    const res = await request(server)
      .post('/api/products/refresh')
      .send({
        countryCode: 'GT',
        items: [{ key: 'item-1', storeId: 'walmart-gt', skuId: '33335', gtinRaw: '7441001698644', name: 'Leche Dos Pinos delactomy uht 0% grasa - 946 ml' }],
        alternativeStoreIds: ['walmart-gt', 'la-torre-gt'],
        location: null,
      })
      .expect(200);
    expect(res.body.items[0]).toMatchObject({ key: 'item-1', status: 'ok' });
    expect(res.body.items[0].offer.price).toBe(20.25);
    expect(res.body.alternatives[0].offers[0]).toMatchObject({ storeId: 'la-torre-gt', price: 20.65 });
  });
});

describe('Ofertas', () => {
  it('solo devuelve productos con promoción verificable', async () => {
    const { app: server } = app([laTorreRoutes]);
    const res = await request(server).get('/api/offers').query({ country: 'GT', q: 'leche', stores: 'la-torre-gt' }).expect(200);
    expect(res.body.offers.map((o: { name: string }) => o.name)).toEqual(['Pan Pirujito De Leche Premium 12 Pack', 'Tutto Chocolovers Con Leche']);
    expect(res.body.stores[0].resultCount).toBe(2);
  });
});

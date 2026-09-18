/**
 * SOLO PARA PRUEBAS AUTOMATIZADAS.
 * Simula las rutas públicas de VTEX de Walmart, La Torre y Maxi Despensa usando
 * respuestas reales capturadas el 2026-09-16 (server/test/fixtures). Permite probar
 * el flujo completo sin depender de la red. La aplicación nunca usa este servidor
 * salvo que se inicie con TEST_STORE_BASE_URLS y ALLOW_TEST_STORE_BASE_URLS=1.
 *
 * Controles para las pruebas:
 *   - consulta que contiene "falla": Maxi Despensa responde HTTP 500.
 *   - consulta que contiene "lento": todas las tiendas tardan 4 s.
 *   - ruta /sin-conexion: responde HTTP 503 a todo. Se usa para las tiendas sin
 *     respuestas capturadas (Paiz y las de El Salvador), que así aparecen como
 *     registradas pero sin conexión y nunca se consultan en internet durante las pruebas.
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../server/test/fixtures/${name}.json`, import.meta.url), 'utf8'));
const walmart = fixture('walmart-gt');
const laTorre = fixture('la-torre-gt');
const maxi = fixture('maxi-despensa-gt');

const IS_PATH = '/api/io/_v/api/intelligent-search/product_search/';
const LEGACY_PATH = '/api/catalog_system/pub/products/search';
const REGIONS_PATH = '/api/checkout/pub/regions';
const empty = { recordsFiltered: 0, products: [] };

const byEan = (source, ean) => {
  const products = source.filter((p) => p.items?.some((i) => i.ean === ean));
  return { recordsFiltered: products.length, products };
};

const stores = {
  walmart: {
    regions: (params) => (params.get('postalCode') === '13001' ? walmart.regions13001 : walmart.regions01001),
    search: (query, params) => {
      const regional = params.get('regionId') === walmart.regions01001[0].id;
      const leche = regional ? walmart.lecheRegion01001 : walmart.leche;
      if (/^\d{8,14}$/.test(query)) return byEan([...leche.products, ...walmart.albay.products], query);
      if (!query || query.includes('leche')) return leche;
      if (query.includes('arroz')) return walmart.albay;
      return empty;
    },
    legacy: () => walmart.legacySku30935,
  },
  latorre: {
    regions: () => laTorre.regions01010,
    search: (query, params) => {
      if (/^\d{8,14}$/.test(query)) return byEan([...laTorre.leche.products, ...laTorre.arroz.products], query);
      if (!query || params.get('sort') === 'discount:desc') return laTorre.ofertasLeche;
      if (query.includes('leche')) return laTorre.leche;
      if (query.includes('arroz')) return laTorre.arroz;
      return empty;
    },
    legacy: () => [],
  },
  maxi: {
    regions: () => maxi.regions01001,
    search: (query) => {
      if (query.includes('falla')) return { status: 500 };
      if (/^\d{8,14}$/.test(query)) return byEan(maxi.leche.products, query);
      if (!query || query.includes('leche')) return maxi.leche;
      return empty;
    },
    legacy: () => [],
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const [, storeKey, ...rest] = url.pathname.split('/');
  const store = stores[storeKey ?? ''];
  const path = `/${rest.join('/')}`;
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
    res.end(JSON.stringify(body));
  };
  if (storeKey === 'sin-conexion') return send(503, { message: 'tienda simulada sin conexión' });
  if (!store) return send(404, { message: 'tienda simulada desconocida' });

  const query = (url.searchParams.get('query') ?? url.searchParams.get('ft') ?? '').toLowerCase();
  if (query.includes('lento')) await new Promise((r) => setTimeout(r, 4000));

  if (path === REGIONS_PATH) return send(200, store.regions(url.searchParams));
  if (path === IS_PATH) {
    const result = store.search(query, url.searchParams);
    if (result.status) return send(result.status, { message: 'error simulado' });
    return send(200, result);
  }
  if (path === LEGACY_PATH) {
    // La consulta "falla" también hace fallar la API de respaldo de Maxi Despensa.
    if (storeKey === 'maxi' && query.includes('falla')) return send(500, { message: 'error simulado' });
    return send(200, store.legacy(url.searchParams), { resources: '0-0/1' });
  }
  return send(404, { message: 'ruta simulada no disponible' });
});

const port = Number(process.env.MOCK_STORES_PORT ?? 4010);
server.listen(port, '127.0.0.1', () => console.log(`[mock-stores] http://127.0.0.1:${port} (solo pruebas)`));

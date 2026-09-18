import { describe, expect, it } from 'vitest';
import { findCountry, findStore } from '../src/catalog/catalog.js';
import { PriceSmartConnector } from '../src/connectors/pricesmart/pricesmart-connector.js';
import { HttpClient } from '../src/http/http-client.js';
import { fakeFetch, json } from './helpers.js';

const docs = [
  { pid: '328800', brand: "Member's Selection", title: "Member's Selection Leche Semidescremada 12 Unidades / 1 L / 33.81 oz", fractionDigits: 2, price_GT: 14495, availability_GT: 'true', inventory_GT: 'in stock', master_sku: '328800', slug: 'members-selection-leche-semidescremada-12-unidades-1-l-33-81-oz-328800', thumb_image: 'https://d31f1ehqijlcua.cloudfront.net/n/1/8/6/f/186f.jpg', variants: [{ skuid: '328800' }] },
  { pid: '234326', title: 'Folgers Café Instantáneo 453 g / 16 oz', fractionDigits: 2, price_GT: 11595, original_price_without_saving_GT: '144.95', saving_amount_GT: '-29.0', availability_GT: 'true', inventory_GT: 'in stock', slug: 'folgers-cafe-instantaneo-453-g-16-oz-234326', variants: [{ skuid: '234326' }] },
  { pid: '420380', title: "Member's Selection Aceite de Aguacate Refinado 1 L / 33.8 oz", fractionDigits: 2, price_GT: 13495, availability_GT: 'true', inventory_GT: 'out of stock', slug: 'aceite-420380', variants: [{ skuid: '420380' }] },
];

function connector() {
  const bodies: unknown[] = [];
  const fetchImpl = fakeFetch([
    (url, init) => {
      if (url.host !== 'www.pricesmart.com' || url.pathname !== '/api/br_discovery/getProductsByKeyword') return undefined;
      const body = JSON.parse(String(init?.body))[0];
      bodies.push(body);
      const filtered = body.fq.length ? docs.filter((d) => body.fq[0].includes(`"${d.pid}"`)) : docs;
      return json({ response: { numFound: filtered.length, start: 0, docs: filtered } });
    },
  ]);
  const http = new HttpClient({ fetchImpl, userAgent: 'test', cacheTtlMs: 0, maxConcurrentPerHost: 4 });
  const c = new PriceSmartConnector(findStore('pricesmart-gt')!, findCountry('GT')!, { http, timeoutMs: 1500 });
  return { c, bodies };
}

describe('PriceSmart Guatemala', () => {
  it('normaliza precio en quetzales, rebaja, existencias y enlace', async () => {
    const { c, bodies } = connector();
    const result = await c.search({ query: 'leche', count: 24, sort: 'relevance', hideUnavailable: false, location: null, signal: new AbortController().signal });
    expect(bodies[0]).toMatchObject({ q: 'leche', view_id: 'GT', account_id: '7024', domain_key: 'pricesmart_bloomreach_io_es' });
    expect(result.totalAvailable).toBe(3);
    const [leche, cafe, aceite] = result.offers;
    expect(leche).toMatchObject({ price: 144.95, listPrice: null, currency: 'GTQ', availability: 'available', url: 'https://www.pricesmart.com/es-gt/producto/members-selection-leche-semidescremada-12-unidades-1-l-33-81-oz-328800/328800', sourceApi: 'bloomreach-discovery' });
    expect(cafe).toMatchObject({ price: 115.95, listPrice: 144.95 });
    expect(cafe.promotions[0]).toMatchObject({ kind: 'price_drop', discountPercent: 20 });
    expect(aceite.availability).toBe('unavailable');
  });

  it('filtra ofertas y agotados', async () => {
    const { c } = connector();
    const result = await c.search({ query: '', count: 24, sort: 'discount', hideUnavailable: true, location: null, signal: new AbortController().signal });
    expect(result.offers.map((o) => o.skuId)).toEqual(['234326']);
  });

  it('actualiza SKUs por pid', async () => {
    const { c, bodies } = connector();
    const result = await c.lookupSkus([{ skuId: '328800', productId: '328800', gtinRaw: null, name: 'Leche' }], null, new AbortController().signal);
    expect(bodies[0]).toMatchObject({ q: '*', fq: ['pid:("328800")'] });
    expect(result.offers.get('328800')?.price).toBe(144.95);
  });
});

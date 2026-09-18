import { createHash } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { fakeFetch, fixture, json, testConfig } from './helpers.js';

/**
 * Respuestas en vivo capturadas el 16/09/2026 (16:57 UTC) para el mismo código de barras en
 * tres tiendas. Comprueba que el servidor pide exactamente las URLs que se ejecutaron en vivo
 * y que la normalización produce los precios, contenidos y sucursales publicados.
 */
interface LiveEntry {
  at: string;
  url: string;
  recordsFiltered: number;
  region: { id: string; sellers: Array<{ id: string; name: string }> };
  sha256: string;
  products: unknown[];
}

const live = fixture('live-delactomy-2026-09-16') as { gtin: string; postalCode: string; stores: Record<string, LiveEntry> };
const entries = Object.entries(live.stores);

function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).filter((k) => record[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canon(record[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function entryFor(url: URL): LiveEntry | undefined {
  return Object.values(live.stores).find((e) => new URL(e.url).host === url.host);
}

describe('Captura en vivo del 16/09/2026: EAN 7441001698644 en tres tiendas', () => {
  it('conserva la integridad calculada en el navegador al capturar', () => {
    for (const [, entry] of entries) {
      expect(createHash('sha256').update(canon(entry.products), 'utf8').digest('hex')).toBe(entry.sha256);
    }
  });

  it('pide las mismas URLs ejecutadas en vivo y normaliza precio, contenido y sucursal', async () => {
    const fetchImpl = fakeFetch([
      (url) => {
        const entry = entryFor(url);
        if (!entry) return undefined;
        if (url.pathname.endsWith('/regions')) return json([entry.region]);
        if (url.href === entry.url) return json({ products: entry.products, recordsFiltered: entry.recordsFiltered });
        return undefined;
      },
    ]);
    const server = createApp(testConfig(), { fetchImpl });
    const res = await request(server)
      .get('/api/products/by-gtin')
      .query({ country: 'GT', gtin: live.gtin, stores: entries.map(([id]) => id).join(','), postalCode: live.postalCode, locationLabel: 'Guatemala Zona 1' })
      .expect(200);

    const searchCalls = fetchImpl.calls.filter((u) => u.includes('/intelligent-search/'));
    expect(searchCalls.sort()).toEqual(entries.map(([, e]) => e.url).sort());

    expect(res.body.stores.map((s: { storeId: string; status: string; location: { assignedStores: string[] } | null }) => [s.storeId, s.status, s.location?.assignedStores])).toEqual([
      ['walmart-gt', 'ok', ['WM-DEL NORTE']],
      ['la-torre-gt', 'ok', ['latorrezona2']],
      ['maxi-despensa-gt', 'ok', ['Md Parroquia']],
    ]);

    type OfferView = { storeId: string; gtin: string; price: number | null; listPrice: number | null; presentation: string | null; unitPrice: { value: number; per: string } | null; availability: string };
    const byStore = new Map<string, OfferView>(res.body.offers.map((o: OfferView) => [o.storeId, o]));
    const expected: Array<[string, number, string, number]> = [
      ['walmart-gt', 18.9, '946 ml', 19.98],
      ['la-torre-gt', 20.65, '1 L', 20.65],
      ['maxi-despensa-gt', 18.5, '946 ml', 19.56],
    ];
    for (const [storeId, price, presentation, perLiter] of expected) {
      const offer = byStore.get(storeId);
      expect(offer, storeId).toBeDefined();
      expect(offer).toMatchObject({ gtin: '07441001698644', price, listPrice: null, presentation, availability: 'available' });
      expect(offer?.unitPrice?.per).toBe('L');
      expect(offer?.unitPrice?.value).toBeCloseTo(perLiter, 2);
    }
  });
});

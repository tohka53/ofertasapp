import { findCountry, storesForCountry } from '../catalog/catalog.js';
import type { CountryDefinition, StoreDefinition } from '../catalog/catalog.types.js';
import type { AppConfig } from '../config/env.js';
import type { ConnectorSearchParams, StoreConnector } from '../connectors/connector.js';
import type { ConnectorRegistry } from '../connectors/registry.js';
import { gtinSearchVariants, normalizeGtin } from '../domain/gtin.js';
import type { AppMessage, LocationInput, NormalizedOffer, SearchResponse, StoreQueryResult } from '../domain/types.js';
import { HttpError } from './errors.js';
import { classifyError, message } from './store-status.js';

export interface SearchRequest {
  countryCode: string;
  query: string;
  storeIds: string[];
  location: LocationInput | null;
  signal: AbortSignal;
}

export interface RefreshItemInput {
  key: string;
  storeId: string;
  skuId: string;
  productId: string | null;
  gtinRaw: string | null;
  name: string;
}

export interface RefreshRequest {
  countryCode: string;
  items: RefreshItemInput[];
  alternativeStoreIds: string[];
  location: LocationInput | null;
  signal: AbortSignal;
}

export interface RefreshItemResult {
  key: string;
  storeId: string;
  skuId: string;
  status: 'ok' | 'not_found' | 'store_error' | 'pending';
  offer: NormalizedOffer | null;
  message: AppMessage | null;
}

export interface RefreshResponse {
  countryCode: string;
  refreshedAt: string;
  items: RefreshItemResult[];
  alternatives: Array<{ key: string; offers: NormalizedOffer[] }>;
  stores: StoreQueryResult[];
}

type StoreTask = (connector: StoreConnector, signal: AbortSignal) => Promise<{
  offers: NormalizedOffer[];
  totalAvailable: number | null;
  location: StoreQueryResult['location'];
  warnings: AppMessage[];
}>;

export class SearchService {
  constructor(
    private readonly registry: ConnectorRegistry,
    private readonly config: AppConfig,
  ) {}

  async search(req: SearchRequest): Promise<SearchResponse> {
    return this.run(req, (connector, signal) =>
      connector.search(this.params(req.query, 'relevance', false, this.config.resultsPerStore, req.location, signal)),
    );
  }

  /** Promociones verificadas: rebajas (precio anterior) y promociones condicionadas publicadas por la tienda. */
  async offers(req: SearchRequest): Promise<SearchResponse> {
    const response = await this.run(req, (connector, signal) =>
      connector.search(this.params(req.query, 'discount', true, 50, req.location, signal)),
    );
    const withPromo = response.offers.filter((o) => o.price !== null && o.promotions.length > 0);
    withPromo.sort((a, b) => promoScore(b) - promoScore(a));
    const counts = new Map<string, number>();
    for (const offer of withPromo) counts.set(offer.storeId, (counts.get(offer.storeId) ?? 0) + 1);
    return {
      ...response,
      offers: withPromo,
      stores: response.stores.map((s) => ({ ...s, resultCount: s.status === 'ok' ? (counts.get(s.storeId) ?? 0) : 0, totalAvailable: null })),
    };
  }

  /** Busca un código de barras en las tiendas indicadas y devuelve solo coincidencias exactas. */
  async byGtin(req: SearchRequest): Promise<SearchResponse> {
    const gtin = normalizeGtin(req.query);
    if (!gtin) throw new HttpError(400, 'invalid_gtin', 'The barcode is not valid for comparison');
    const variants = gtinSearchVariants(gtin);
    return this.run(req, async (connector, signal) => {
      const warnings: AppMessage[] = [];
      let location: StoreQueryResult['location'] = null;
      for (const variant of variants) {
        const result = await connector.search(this.params(variant, 'relevance', false, 10, req.location, signal));
        warnings.push(...result.warnings);
        location = result.location;
        const matches = result.offers.filter((o) => o.gtin === gtin);
        if (matches.length) return { offers: matches, totalAvailable: matches.length, location, warnings };
      }
      return { offers: [], totalAvailable: 0, location, warnings };
    });
  }

  async refresh(req: RefreshRequest): Promise<RefreshResponse> {
    const country = this.country(req.countryCode);
    const allStores = storesForCountry(country.code);
    const byStore = new Map<string, RefreshItemInput[]>();
    for (const item of req.items) {
      if (!allStores.some((s) => s.id === item.storeId)) {
        throw new HttpError(400, 'invalid_store', `Store ${item.storeId} is not in ${country.code}`, { stores: item.storeId });
      }
      byStore.set(item.storeId, [...(byStore.get(item.storeId) ?? []), item]);
    }

    const itemResults: RefreshItemResult[] = [];
    const storeResults: StoreQueryResult[] = [];

    await Promise.all(
      [...byStore.entries()].map(async ([storeId, items]) => {
        const store = allStores.find((s) => s.id === storeId)!;
        const started = Date.now();
        const connector = this.registry.get(storeId);
        if (!connector) {
          const pending = this.pendingResult(store, started);
          storeResults.push(pending);
          for (const item of items) itemResults.push({ key: item.key, storeId, skuId: item.skuId, status: 'pending', offer: null, message: pending.message });
          return;
        }
        const { signal, dispose } = this.storeSignal(req.signal, items.length);
        try {
          const lookup = await connector.lookupSkus(
            items.map((i) => ({ skuId: i.skuId, productId: i.productId, gtinRaw: i.gtinRaw, name: i.name })),
            req.location,
            signal,
          );
          for (const item of items) {
            const offer = lookup.offers.get(item.skuId) ?? null;
            itemResults.push({
              key: item.key,
              storeId,
              skuId: item.skuId,
              status: offer ? 'ok' : 'not_found',
              offer,
              message: offer ? null : message('product_not_found'),
            });
          }
          storeResults.push({
            storeId,
            storeName: store.name,
            status: 'ok',
            message: null,
            warnings: dedupe(lookup.warnings),
            resultCount: lookup.offers.size,
            totalAvailable: null,
            durationMs: Date.now() - started,
            consultedAt: new Date().toISOString(),
            location: lookup.location,
          });
        } catch (error) {
          const { status, message: failure } = classifyError(error);
          storeResults.push(this.failedResult(store, started, status, failure));
          for (const item of items) itemResults.push({ key: item.key, storeId, skuId: item.skuId, status: 'store_error', offer: null, message: failure });
        } finally {
          dispose();
        }
      }),
    );

    const alternatives: RefreshResponse['alternatives'] = [];
    const altStores = req.alternativeStoreIds.filter((id) => allStores.some((s) => s.id === id));
    const withGtin = req.items.filter((i) => normalizeGtin(i.gtinRaw));
    for (const item of withGtin.slice(0, 30)) {
      const others = altStores.filter((id) => id !== item.storeId && this.registry.get(id));
      if (!others.length || req.signal.aborted) continue;
      const response = await this.byGtin({ countryCode: country.code, query: item.gtinRaw!, storeIds: others, location: req.location, signal: req.signal });
      const offers = response.offers.filter((o) => o.price !== null);
      if (offers.length) alternatives.push({ key: item.key, offers });
    }

    return { countryCode: country.code, refreshedAt: new Date().toISOString(), items: itemResults, alternatives, stores: storeResults };
  }

  private params(query: string, sort: ConnectorSearchParams['sort'], hideUnavailable: boolean, count: number, location: LocationInput | null, signal: AbortSignal): ConnectorSearchParams {
    return { query, sort, hideUnavailable, count, location, signal };
  }

  private country(code: string): CountryDefinition {
    const country = findCountry(code);
    if (!country) throw new HttpError(400, 'invalid_country', `Unsupported country: ${code}`, { country: code });
    return country;
  }

  private async run(req: SearchRequest, task: StoreTask): Promise<SearchResponse> {
    const country = this.country(req.countryCode);
    const available = storesForCountry(country.code);
    const uniqueIds = [...new Set(req.storeIds)];
    const invalid = uniqueIds.filter((id) => !available.some((s) => s.id === id));
    if (invalid.length) throw new HttpError(400, 'invalid_store', `Stores outside ${country.code}: ${invalid.join(', ')}`, { stores: invalid.join(', ') });

    const requestedAt = new Date();
    const stores = uniqueIds.map((id) => available.find((s) => s.id === id)!);
    const results = await Promise.all(stores.map((store) => this.runStore(store, req.signal, task)));

    return {
      query: req.query,
      countryCode: country.code,
      currency: country.currency,
      requestedAt: requestedAt.toISOString(),
      durationMs: Date.now() - requestedAt.getTime(),
      stores: results.map((r) => r.result),
      offers: results.flatMap((r) => r.offers),
    };
  }

  private async runStore(store: StoreDefinition, parentSignal: AbortSignal, task: StoreTask): Promise<{ result: StoreQueryResult; offers: NormalizedOffer[] }> {
    const started = Date.now();
    const connector = this.registry.get(store.id);
    if (!connector) return { result: this.pendingResult(store, started), offers: [] };

    const { signal, dispose } = this.storeSignal(parentSignal, 1);
    try {
      const outcome = await task(connector, signal);
      return {
        offers: outcome.offers,
        result: {
          storeId: store.id,
          storeName: store.name,
          status: 'ok',
          message: outcome.offers.length === 0 ? message('no_results') : null,
          warnings: dedupe(outcome.warnings),
          resultCount: outcome.offers.length,
          totalAvailable: outcome.totalAvailable,
          durationMs: Date.now() - started,
          consultedAt: outcome.offers[0]?.consultedAt ?? new Date().toISOString(),
          location: outcome.location,
        },
      };
    } catch (error) {
      const { status, message: failure } = classifyError(error);
      return { result: this.failedResult(store, started, status, failure), offers: [] };
    } finally {
      dispose();
    }
  }

  /** Señal por tienda: se cancela si el cliente se desconecta o si la tienda excede su tiempo total. */
  private storeSignal(parent: AbortSignal, operations: number): { signal: AbortSignal; dispose: () => void } {
    const controller = new AbortController();
    const budget = this.config.storeTimeoutMs * Math.min(2 + operations, 12) + 1000;
    const timer = setTimeout(() => controller.abort(), budget);
    const onAbort = () => controller.abort();
    parent.addEventListener('abort', onAbort, { once: true });
    if (parent.aborted) controller.abort();
    return {
      signal: controller.signal,
      dispose: () => {
        clearTimeout(timer);
        parent.removeEventListener('abort', onAbort);
      },
    };
  }

  private pendingResult(store: StoreDefinition, started: number): StoreQueryResult {
    const kind = store.integration.kind;
    const pendingMessage =
      kind === 'link'
        ? message('link_only')
        : kind === 'kroger'
          ? message('credentials_missing', { vars: 'KROGER_CLIENT_ID, KROGER_CLIENT_SECRET' })
          : message('integration_pending');
    return {
      storeId: store.id,
      storeName: store.name,
      status: 'pending',
      message: pendingMessage,
      warnings: [],
      resultCount: 0,
      totalAvailable: null,
      durationMs: Date.now() - started,
      consultedAt: new Date().toISOString(),
      location: null,
    };
  }

  private failedResult(store: StoreDefinition, started: number, status: StoreQueryResult['status'], failure: AppMessage): StoreQueryResult {
    return {
      storeId: store.id,
      storeName: store.name,
      status,
      message: failure,
      warnings: [],
      resultCount: 0,
      totalAvailable: null,
      durationMs: Date.now() - started,
      consultedAt: new Date().toISOString(),
      location: null,
    };
  }
}

function dedupe(messages: AppMessage[]): AppMessage[] {
  const seen = new Set<string>();
  return messages.filter((m) => {
    const key = JSON.stringify(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function promoScore(offer: NormalizedOffer): number {
  const drop = offer.promotions.find((p) => p.kind === 'price_drop');
  if (drop?.discountPercent) return 1000 + drop.discountPercent;
  return offer.promotions.length;
}

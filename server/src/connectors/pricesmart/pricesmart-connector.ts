import type { CountryDefinition, PriceSmartIntegration, StoreDefinition } from '../../catalog/catalog.types.js';
import type { AppMessage, Availability, LocationApplied, LocationInput, NormalizedOffer } from '../../domain/types.js';
import { computeUnitPrice, parseContentText } from '../../domain/units.js';
import { HttpClient, UpstreamError } from '../../http/http-client.js';
import { classifyError, message } from '../../services/store-status.js';
import type { ConnectorSearchParams, ConnectorSearchResult, ConnectorSkuLookup, LocationResolution, StoreConnector, StoreHealth } from '../connector.js';
import { priceDropPromotion } from '../vtex/promotions.js';
import type { PriceSmartDoc, PriceSmartSearchBody, PriceSmartSearchResponse } from './pricesmart.types.js';

export interface PriceSmartConnectorOptions {
  http: HttpClient;
  timeoutMs: number;
  baseUrlOverride?: string | null;
}

const SEARCH_PATH = '/api/br_discovery/getProductsByKeyword';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export class PriceSmartConnector implements StoreConnector {
  private readonly integration: PriceSmartIntegration;
  private readonly baseUrl: string;
  private readonly fields: string;

  constructor(
    readonly store: StoreDefinition,
    private readonly country: CountryDefinition,
    private readonly options: PriceSmartConnectorOptions,
  ) {
    if (store.integration.kind !== 'pricesmart') throw new Error(`Store ${store.id} does not use PriceSmart search`);
    this.integration = store.integration;
    this.baseUrl = (options.baseUrlOverride ?? this.integration.baseUrl).replace(/\/$/, '');
    const v = this.integration.viewId;
    this.fields = [
      'pid',
      'title',
      'brand',
      'slug',
      'thumb_image',
      'master_sku',
      'currency',
      'fractionDigits',
      'skuid',
      `price_${v}`,
      `availability_${v}`,
      `inventory_${v}`,
      `saving_amount_${v}`,
      `original_price_without_saving_${v}`,
      `sold_by_weight_${v}`,
      `weight_${v}`,
      `weight_uom_description_${v}`,
    ].join(',');
  }

  async search(params: ConnectorSearchParams): Promise<ConnectorSearchResult> {
    const query = params.query.trim();
    const rows = Math.min(Math.max(params.count, 1), 50);
    const response = await this.request(query || '*', [], params.sort === 'discount' ? 200 : rows, params.signal);
    let offers = (response.data.response?.docs ?? []).flatMap((doc) => this.normalize(doc, response.fetchedAt));
    if (params.sort === 'discount') offers = offers.filter((o) => o.listPrice !== null).sort((a, b) => discountOf(b) - discountOf(a)).slice(0, rows);
    if (params.sort === 'price_asc') offers = [...offers].sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY));
    if (params.hideUnavailable) offers = offers.filter((o) => o.availability === 'available');
    const warnings: AppMessage[] = [];
    return {
      offers,
      totalAvailable: typeof response.data.response?.numFound === 'number' ? response.data.response.numFound : null,
      location: null,
      warnings,
    };
  }

  async lookupSkus(
    skus: ConnectorSkuLookup[],
    _location: LocationInput | null,
    signal: AbortSignal,
  ): Promise<{ offers: Map<string, NormalizedOffer>; location: LocationApplied | null; warnings: AppMessage[] }> {
    const found = new Map<string, NormalizedOffer>();
    const ids = [...new Set(skus.map((s) => (s.productId ?? s.skuId).trim()).filter((id) => /^[A-Za-z0-9_-]+$/.test(id)))];
    if (ids.length) {
      const filter = `pid:(${ids.map((id) => `"${id}"`).join(' OR ')})`;
      const response = await this.request('*', [filter], Math.min(ids.length, 200), signal, false);
      const offers = (response.data.response?.docs ?? []).flatMap((doc) => this.normalize(doc, response.fetchedAt));
      for (const sku of skus) {
        const match = offers.find((o) => o.skuId === sku.skuId || o.productId === (sku.productId ?? sku.skuId));
        if (match) found.set(sku.skuId, match);
      }
    }
    for (const sku of skus) {
      if (found.has(sku.skuId) || !sku.name.trim()) continue;
      if (signal.aborted) throw new UpstreamError('cancelled', 'Request cancelled');
      const response = await this.request(sku.name.trim(), [], 24, signal, false);
      const match = (response.data.response?.docs ?? [])
        .flatMap((doc) => this.normalize(doc, response.fetchedAt))
        .find((o) => o.skuId === sku.skuId || o.productId === sku.productId);
      if (match) found.set(sku.skuId, match);
    }
    return { offers: found, location: null, warnings: [] };
  }

  async resolveLocation(_location: LocationInput, _signal: AbortSignal): Promise<LocationResolution> {
    return { status: 'not_supported', applied: null, message: message('location_not_used', { store: this.store.name }) };
  }

  async checkHealth(signal: AbortSignal): Promise<StoreHealth> {
    const started = Date.now();
    try {
      await this.request('leche', [], 1, signal, false, Math.min(this.options.timeoutMs, 6000));
      return { reachable: true, latencyMs: Date.now() - started, message: null };
    } catch (error) {
      return { reachable: false, latencyMs: Date.now() - started, message: classifyError(error).message };
    }
  }

  private async request(q: string, fq: string[], rows: number, signal: AbortSignal, useCache = true, timeoutMs = this.options.timeoutMs) {
    const pageUrl = `${this.baseUrl}/${this.integration.pathLocale}/busqueda?q=${encodeURIComponent(q)}`;
    const body: PriceSmartSearchBody = {
      url: pageUrl,
      start: 0,
      q,
      fq,
      search_type: 'keyword',
      rows,
      account_id: this.integration.accountId,
      auth_key: this.integration.authKey,
      request_id: Date.now(),
      domain_key: this.integration.domainKey,
      fl: this.fields,
      view_id: this.integration.viewId,
    };
    const response = await this.options.http.requestJson<PriceSmartSearchResponse>(`${this.baseUrl}${SEARCH_PATH}`, {
      method: 'POST',
      signal,
      timeoutMs,
      useCache,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/plain, */*',
        'accept-language': 'es-GT,es;q=0.9',
        origin: this.baseUrl,
        referer: pageUrl,
        'user-agent': BROWSER_USER_AGENT,
      },
      body: JSON.stringify([body]),
    });
    if (!response.data || typeof response.data !== 'object' || !Array.isArray(response.data.response?.docs)) {
      throw new UpstreamError('invalid_json', 'PriceSmart response without docs', response.status);
    }
    return response;
  }

  private normalize(doc: PriceSmartDoc, fetchedAt: string): NormalizedOffer[] {
    const v = this.integration.viewId;
    const productId = str(doc.pid);
    const name = str(doc.title);
    if (!productId || !name) return [];
    const digits = typeof doc.fractionDigits === 'number' && doc.fractionDigits >= 0 && doc.fractionDigits <= 4 ? doc.fractionDigits : 2;
    const minor = num(doc[`price_${v}`]);
    const price = minor !== null && minor > 0 ? round(minor / 10 ** digits) : null;
    const original = num(doc[`original_price_without_saving_${v}`]);
    const listPrice = price !== null && original !== null && original > price ? round(original) : null;
    const skuId = str(doc.variants?.[0]?.skuid) ?? str(doc.master_sku) ?? productId;
    const parsed = parseContentText(name, 'name', this.country.unitSystem);
    const slug = str(doc.slug);
    const drop = priceDropPromotion(price, listPrice);
    const image = str(doc.thumb_image);
    return [
      {
        id: `${this.store.id}:${skuId}`,
        storeId: this.store.id,
        storeName: this.store.name,
        countryCode: this.country.code,
        productId,
        skuId,
        name,
        brand: str(doc.brand),
        variant: null,
        presentation: parsed.presentation,
        content: parsed.content,
        gtin: null,
        gtinRaw: null,
        imageUrl: image ? image.replace(/^http:/i, 'https:') : null,
        url: slug ? `${this.integration.baseUrl}/${this.integration.pathLocale}/producto/${slug}/${productId}` : `${this.integration.baseUrl}/${this.integration.pathLocale}`,
        currency: this.country.currency,
        price,
        listPrice,
        unitPrice: computeUnitPrice(price, parsed.content, this.country.unitSystem),
        availability: availabilityOf(doc[`availability_${v}`], doc[`inventory_${v}`]),
        availableQuantity: null,
        promotions: drop ? [drop] : [],
        location: { label: null, assignedStore: null, appliedBy: null },
        category: null,
        consultedAt: fetchedAt,
        sourceApi: 'bloomreach-discovery',
      } satisfies NormalizedOffer,
    ];
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function availabilityOf(availability: unknown, inventory: unknown): Availability {
  const inv = typeof inventory === 'string' ? inventory.toLowerCase() : '';
  const avail = typeof availability === 'string' ? availability.toLowerCase() : typeof availability === 'boolean' ? String(availability) : '';
  if (avail === 'false' || inv === 'out of stock') return 'unavailable';
  if (avail === 'true' && inv === 'in stock') return 'available';
  return 'unknown';
}

function discountOf(offer: NormalizedOffer): number {
  return offer.promotions.find((p) => p.kind === 'price_drop')?.discountPercent ?? 0;
}

import type { CountryDefinition, StoreDefinition } from '../../catalog/catalog.types.js';
import { normalizeGtin } from '../../domain/gtin.js';
import type { AppMessage, Availability, LocationApplied, LocationInput, NormalizedOffer, OfferLocation } from '../../domain/types.js';
import { computeUnitPrice, parseContentText } from '../../domain/units.js';
import { HttpClient, UpstreamError } from '../../http/http-client.js';
import { TtlCache } from '../../http/ttl-cache.js';
import { classifyError, message } from '../../services/store-status.js';
import type { ConnectorSearchParams, ConnectorSearchResult, ConnectorSkuLookup, LocationResolution, StoreConnector, StoreHealth } from '../connector.js';
import { priceDropPromotion } from '../vtex/promotions.js';
import type { KrogerLocation, KrogerLocationsResponse, KrogerProduct, KrogerProductsResponse, KrogerTokenResponse } from './kroger.types.js';

export interface KrogerCredentials {
  clientId: string;
  clientSecret: string;
}

export interface KrogerConnectorOptions {
  http: HttpClient;
  timeoutMs: number;
  credentials: KrogerCredentials;
  apiBaseUrl: string;
}

const LOCATION_TTL_MS = 30 * 60 * 1000;
const WEBSITE = 'https://www.kroger.com';

/**
 * Conector de la API oficial de Kroger. El precio solo llega cuando la consulta indica
 * una tienda (`filter.locationId`), por eso la ubicación se resuelve con un código ZIP.
 */
export class KrogerConnector implements StoreConnector {
  private readonly baseUrl: string;
  private token: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;
  private readonly locations = new TtlCache<KrogerLocation | null>(LOCATION_TTL_MS, 200);

  constructor(
    readonly store: StoreDefinition,
    private readonly country: CountryDefinition,
    private readonly options: KrogerConnectorOptions,
  ) {
    if (store.integration.kind !== 'kroger') throw new Error(`Store ${store.id} does not use the Kroger API`);
    this.baseUrl = options.apiBaseUrl.replace(/\/$/, '');
  }

  async search(params: ConnectorSearchParams): Promise<ConnectorSearchResult> {
    const warnings: AppMessage[] = [];
    const location = await this.locationFor(params.location, params.signal, warnings);
    const applied = this.locationApplied(params.location, location);
    if (!params.query.trim()) {
      warnings.push(message('offers_query_required', { store: this.store.name }));
      return { offers: [], totalAvailable: 0, location: applied, warnings };
    }

    const query = new URLSearchParams();
    query.set('filter.term', params.query.trim());
    query.set('filter.limit', String(Math.min(Math.max(params.count, 1), 50)));
    if (location?.locationId) query.set('filter.locationId', location.locationId);
    const response = await this.get<KrogerProductsResponse>(`${this.baseUrl}/v1/products?${query.toString()}`, params.signal, true);

    let offers = (response.data.data ?? []).flatMap((product) => this.normalize(product, response.fetchedAt, params.location, location));
    if (params.sort === 'discount') offers = offers.filter((o) => o.listPrice !== null);
    if (params.hideUnavailable) offers = offers.filter((o) => o.availability === 'available');
    return { offers, totalAvailable: response.data.meta?.pagination?.total ?? null, location: applied, warnings };
  }

  async lookupSkus(
    skus: ConnectorSkuLookup[],
    locationInput: LocationInput | null,
    signal: AbortSignal,
  ): Promise<{ offers: Map<string, NormalizedOffer>; location: LocationApplied | null; warnings: AppMessage[] }> {
    const warnings: AppMessage[] = [];
    const location = await this.locationFor(locationInput, signal, warnings);
    const found = new Map<string, NormalizedOffer>();
    for (const sku of skus) {
      if (signal.aborted) throw new UpstreamError('cancelled', 'Request cancelled');
      const productId = sku.productId ?? sku.skuId;
      const query = new URLSearchParams();
      query.set('filter.productId', productId);
      if (location?.locationId) query.set('filter.locationId', location.locationId);
      const response = await this.get<KrogerProductsResponse>(`${this.baseUrl}/v1/products?${query.toString()}`, signal, false);
      const offer = (response.data.data ?? [])
        .flatMap((product) => this.normalize(product, response.fetchedAt, locationInput, location))
        .find((o) => o.skuId === sku.skuId || o.productId === productId);
      if (offer) found.set(sku.skuId, offer);
    }
    return { offers: found, location: this.locationApplied(locationInput, location), warnings };
  }

  async resolveLocation(locationInput: LocationInput, signal: AbortSignal): Promise<LocationResolution> {
    if (!locationInput.postalCode) {
      return { status: 'not_supported', applied: null, message: message('zip_required', { store: this.store.name }) };
    }
    try {
      const warnings: AppMessage[] = [];
      const location = await this.locationFor(locationInput, signal, warnings, true);
      return { status: 'ok', applied: this.locationApplied(locationInput, location), message: warnings[0] ?? null };
    } catch (error) {
      return { status: 'error', applied: null, message: classifyError(error).message };
    }
  }

  async checkHealth(signal: AbortSignal): Promise<StoreHealth> {
    const started = Date.now();
    try {
      await this.accessToken(signal);
      return { reachable: true, latencyMs: Date.now() - started, message: null };
    } catch (error) {
      return { reachable: false, latencyMs: Date.now() - started, message: classifyError(error).message };
    }
  }

  private async get<T>(url: string, signal: AbortSignal, useCache: boolean) {
    const token = await this.accessToken(signal);
    return this.options.http.requestJson<T>(url, {
      signal,
      timeoutMs: this.options.timeoutMs,
      useCache,
      headers: { authorization: `Bearer ${token}` },
    });
  }

  private async accessToken(signal: AbortSignal): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    if (!this.tokenRequest) {
      const { clientId, clientSecret } = this.options.credentials;
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      this.tokenRequest = this.options.http
        .requestJson<KrogerTokenResponse>(`${this.baseUrl}/v1/connect/oauth2/token`, {
          method: 'POST',
          signal,
          timeoutMs: this.options.timeoutMs,
          useCache: false,
          headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
          body: 'grant_type=client_credentials&scope=product.compact',
        })
        .then((response) => {
          const value = response.data.access_token;
          if (!value) throw new UpstreamError('invalid_json', 'Token response without access_token', response.status);
          const ttlSeconds = typeof response.data.expires_in === 'number' ? response.data.expires_in : 1800;
          this.token = { value, expiresAt: Date.now() + Math.max(60, ttlSeconds - 60) * 1000 };
          return value;
        })
        .finally(() => {
          this.tokenRequest = null;
        });
    }
    return this.tokenRequest;
  }

  private async locationFor(input: LocationInput | null, signal: AbortSignal, warnings: AppMessage[], throwOnError = false): Promise<KrogerLocation | null> {
    if (!input) {
      warnings.push(message('zip_needed_for_prices', { store: this.store.name }));
      return null;
    }
    if (!input.postalCode) {
      warnings.push(message('zip_required', { store: this.store.name }));
      return null;
    }
    const cacheKey = input.postalCode;
    if (this.locations.get(cacheKey) !== undefined) {
      const cached = this.locations.get(cacheKey) ?? null;
      if (!cached) warnings.push(message('no_branch', { store: this.store.name }));
      return cached;
    }
    try {
      const query = new URLSearchParams();
      query.set('filter.zipCode.near', input.postalCode);
      query.set('filter.limit', '1');
      const response = await this.get<KrogerLocationsResponse>(`${this.baseUrl}/v1/locations?${query.toString()}`, signal, false);
      const first = response.data.data?.find((l) => l.locationId) ?? null;
      this.locations.set(cacheKey, first);
      if (!first) warnings.push(message('no_branch', { store: this.store.name }));
      return first;
    } catch (error) {
      if (error instanceof UpstreamError && error.kind === 'cancelled') throw error;
      if (throwOnError) throw error;
      warnings.push(message('location_failed', { store: this.store.name }));
      return null;
    }
  }

  private locationName(location: KrogerLocation): string {
    const address = [location.address?.addressLine1, location.address?.city, location.address?.state].filter(Boolean).join(', ');
    const name = location.name?.trim() || location.chain?.trim() || location.locationId || '';
    return address ? `${name} (${address})` : name;
  }

  private locationApplied(input: LocationInput | null, location: KrogerLocation | null): LocationApplied | null {
    if (!input?.postalCode) return null;
    return {
      method: 'postalCode',
      postalCode: input.postalCode,
      label: input.label,
      assignedStores: location ? [this.locationName(location)] : [],
      regionId: location?.locationId ?? null,
      priceVariesByLocation: true,
    };
  }

  private normalize(product: KrogerProduct, fetchedAt: string, input: LocationInput | null, location: KrogerLocation | null): NormalizedOffer[] {
    const productId = product.productId?.trim();
    const name = product.description?.trim();
    if (!productId || !name) return [];
    const offerLocation: OfferLocation = {
      label: location ? (input?.label ?? input?.postalCode ?? null) : null,
      assignedStore: location ? this.locationName(location) : null,
      appliedBy: location ? 'postalCode' : null,
    };
    const image = this.imageUrl(product);
    const gtinRaw = product.upc?.trim() || null;

    return (product.items ?? []).slice(0, 5).map((item, index) => {
      const regular = positive(item.price?.regular);
      const promo = positive(item.price?.promo);
      const price = promo !== null && (regular === null || promo < regular) ? promo : regular;
      const listPrice = promo !== null && regular !== null && regular > promo ? regular : null;
      const parsed = parseContentText(item.size, 'size', this.country.unitSystem);
      const skuId = item.itemId?.trim() || (index === 0 ? productId : `${productId}-${index}`);
      const drop = priceDropPromotion(price, listPrice);
      return {
        id: `${this.store.id}:${skuId}`,
        storeId: this.store.id,
        storeName: this.store.name,
        countryCode: this.country.code,
        productId,
        skuId,
        name,
        brand: product.brand?.trim() || null,
        variant: null,
        presentation: parsed.presentation ?? (item.size?.trim() || null),
        content: parsed.content,
        gtin: normalizeGtin(gtinRaw),
        gtinRaw,
        imageUrl: image,
        url: product.productPageURI?.startsWith('/') ? `${WEBSITE}${product.productPageURI}` : `${WEBSITE}/`,
        currency: this.country.currency,
        price: location ? price : null,
        listPrice: location ? listPrice : null,
        unitPrice: location ? computeUnitPrice(price, parsed.content, this.country.unitSystem) : null,
        availability: location ? stockToAvailability(item.inventory?.stockLevel) : 'unknown',
        availableQuantity: null,
        promotions: location && drop ? [{ ...drop, source: 'promo_price' }] : [],
        location: offerLocation,
        category: product.categories?.[0] ?? null,
        consultedAt: fetchedAt,
        sourceApi: 'kroger-products',
      } satisfies NormalizedOffer;
    });
  }

  private imageUrl(product: KrogerProduct): string | null {
    const images = product.images ?? [];
    const preferred = images.find((i) => i.featured) ?? images.find((i) => i.perspective === 'front') ?? images[0];
    const sizes = preferred?.sizes ?? [];
    const url = (sizes.find((s) => s.size === 'medium') ?? sizes.find((s) => s.size === 'large') ?? sizes[0])?.url;
    return url ? url.replace(/^http:/i, 'https:') : null;
  }
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function stockToAvailability(level: string | undefined): Availability {
  if (!level) return 'unknown';
  const upper = level.toUpperCase();
  if (upper === 'HIGH' || upper === 'LOW') return 'available';
  if (upper.includes('OUT_OF_STOCK')) return 'unavailable';
  return 'unknown';
}

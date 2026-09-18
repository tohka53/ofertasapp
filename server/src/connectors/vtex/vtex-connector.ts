import type { CountryDefinition, StoreDefinition, VtexIntegration } from '../../catalog/catalog.types.js';
import type { AppMessage, LocationApplied, LocationInput, NormalizedOffer, OfferLocation } from '../../domain/types.js';
import { normalizeGtin } from '../../domain/gtin.js';
import { HttpClient, UpstreamError } from '../../http/http-client.js';
import { TtlCache } from '../../http/ttl-cache.js';
import { classifyError, message } from '../../services/store-status.js';
import type {
  ConnectorSearchParams,
  ConnectorSearchResult,
  ConnectorSkuLookup,
  LocationResolution,
  StoreConnector,
  StoreHealth,
} from '../connector.js';
import { normalizeProduct, type NormalizeContext } from './vtex-normalize.js';
import type { VtexIntelligentSearchResponse, VtexProduct, VtexRegion } from './vtex.types.js';

export interface VtexConnectorOptions {
  http: HttpClient;
  timeoutMs: number;
  /** Solo para pruebas automatizadas: reemplaza la URL base de la tienda. */
  baseUrlOverride?: string | null;
}

interface RegionInfo {
  regionId: string | null;
  assignedStores: string[];
  method: 'postalCode' | 'geo';
}

const REGION_TTL_MS = 30 * 60 * 1000;

export class VtexConnector implements StoreConnector {
  private readonly integration: VtexIntegration;
  private readonly baseUrl: string;
  private readonly regionCache = new TtlCache<RegionInfo>(REGION_TTL_MS, 500);

  constructor(
    readonly store: StoreDefinition,
    private readonly country: CountryDefinition,
    private readonly options: VtexConnectorOptions,
  ) {
    if (store.integration.kind !== 'vtex') throw new Error(`Store ${store.id} does not use VTEX`);
    this.integration = store.integration;
    this.baseUrl = (options.baseUrlOverride ?? this.integration.baseUrl).replace(/\/$/, '');
  }

  async search(params: ConnectorSearchParams): Promise<ConnectorSearchResult> {
    const warnings: AppMessage[] = [];
    if (params.sort === 'discount' && this.integration.offersClusterId) return this.publishedOffers(params, warnings);
    const region = await this.regionFor(params.location, params.signal, warnings);

    const isUrl = this.intelligentSearchUrl(params.query, params.count, params.sort, params.hideUnavailable, region?.regionId ?? null);
    try {
      const response = await this.options.http.getJson<VtexIntelligentSearchResponse>(isUrl, {
        signal: params.signal,
        timeoutMs: this.options.timeoutMs,
      });
      const products = Array.isArray(response.data?.products) ? response.data.products : [];
      const offers = this.normalizeAll(products, response.fetchedAt, this.offerLocation(params.location, region), 'intelligent-search', region);
      return {
        offers,
        totalAvailable: typeof response.data?.recordsFiltered === 'number' ? response.data.recordsFiltered : null,
        location: this.locationApplied(params.location, region),
        warnings,
      };
    } catch (error) {
      if (!this.shouldFallback(error)) throw error;
      warnings.push(message('legacy_fallback'));
      return this.legacySearch(params, warnings);
    }
  }

  async lookupSkus(
    skus: ConnectorSkuLookup[],
    location: LocationInput | null,
    signal: AbortSignal,
  ): Promise<{ offers: Map<string, NormalizedOffer>; location: LocationApplied | null; warnings: AppMessage[] }> {
    const warnings: AppMessage[] = [];
    const region = await this.regionFor(location, signal, warnings);
    const offerLocation = this.offerLocation(location, region);
    const found = new Map<string, NormalizedOffer>();

    for (const sku of skus) {
      if (signal.aborted) throw new UpstreamError('cancelled', 'Request cancelled');
      const queries = [sku.gtinRaw, sku.name].filter((q): q is string => Boolean(q && q.trim()));
      for (const query of queries) {
        const url = this.intelligentSearchUrl(query, 24, 'relevance', false, region?.regionId ?? null);
        try {
          const response = await this.options.http.getJson<VtexIntelligentSearchResponse>(url, {
            signal,
            timeoutMs: this.options.timeoutMs,
            useCache: false,
          });
          const offers = this.normalizeAll(response.data?.products ?? [], response.fetchedAt, offerLocation, 'intelligent-search', region);
          const targetGtin = normalizeGtin(sku.gtinRaw);
          const match = offers.find((o) => o.skuId === sku.skuId) ?? (targetGtin ? offers.find((o) => o.gtin === targetGtin) : undefined);
          if (match) {
            found.set(sku.skuId, match);
            break;
          }
        } catch (error) {
          if (!this.shouldFallback(error)) throw error;
          break;
        }
      }

      const canUseLegacy = !region || !this.integration.location.priceVariesByLocation;
      if (!found.has(sku.skuId) && canUseLegacy && /^\d+$/.test(sku.skuId)) {
        try {
          const url = `${this.baseUrl}/api/catalog_system/pub/products/search?fq=skuId:${encodeURIComponent(sku.skuId)}&sc=${this.integration.salesChannel}`;
          const response = await this.options.http.getJson<VtexProduct[]>(url, { signal, timeoutMs: this.options.timeoutMs, useCache: false });
          const offers = this.normalizeAll(Array.isArray(response.data) ? response.data : [], response.fetchedAt, this.offerLocation(null, null), 'catalog-legacy', null);
          const match = offers.find((o) => o.skuId === sku.skuId);
          if (match) found.set(sku.skuId, match);
        } catch (error) {
          if (error instanceof UpstreamError && error.kind === 'cancelled') throw error;
        }
      }
    }
    return { offers: found, location: this.locationApplied(location, region), warnings };
  }

  async resolveLocation(location: LocationInput, signal: AbortSignal): Promise<LocationResolution> {
    const warnings: AppMessage[] = [];
    try {
      const region = await this.regionFor(location, signal, warnings, true);
      if (!region) {
        return { status: 'not_supported', applied: null, message: warnings[0] ?? message('location_not_used', { store: this.store.name }) };
      }
      return { status: 'ok', applied: this.locationApplied(location, region), message: warnings[0] ?? null };
    } catch (error) {
      return { status: 'error', applied: null, message: classifyError(error).message };
    }
  }

  async checkHealth(signal: AbortSignal): Promise<StoreHealth> {
    const started = Date.now();
    const url = `${this.baseUrl}/api/io/_v/api/intelligent-search/product_search/?page=1&count=1&locale=${encodeURIComponent(this.integration.locale)}`;
    try {
      await this.options.http.getJson<VtexIntelligentSearchResponse>(url, { signal, timeoutMs: Math.min(this.options.timeoutMs, 6000), useCache: false });
      return { reachable: true, latencyMs: Date.now() - started, message: null };
    } catch (error) {
      return { reachable: false, latencyMs: Date.now() - started, message: classifyError(error).message };
    }
  }

  /**
   * Ofertas tomadas de la colección que la tienda publica (productClusterIds),
   * en lugar de deducirlas ordenando el catálogo por descuento.
   */
  private async publishedOffers(params: ConnectorSearchParams, warnings: AppMessage[]): Promise<ConnectorSearchResult> {
    const cluster = this.integration.offersClusterId as string;
    const ft = params.query.trim() ? `ft=${encodeURIComponent(params.query.trim())}&` : '';
    const to = Math.max(0, Math.min(params.count, 50) - 1);
    const url = `${this.baseUrl}/api/catalog_system/pub/products/search?${ft}fq=productClusterIds:${encodeURIComponent(cluster)}&_from=0&_to=${to}&sc=${this.integration.salesChannel}`;
    const response = await this.options.http.getJson<VtexProduct[]>(url, { signal: params.signal, timeoutMs: this.options.timeoutMs });
    let offers = this.normalizeAll(Array.isArray(response.data) ? response.data : [], response.fetchedAt, this.offerLocation(null, null), 'catalog-legacy', null);
    if (params.hideUnavailable) offers = offers.filter((o) => o.availability === 'available');
    const resources = response.headers.get('resources');
    const total = resources ? Number(resources.split('/')[1]) : Number.NaN;
    return { offers, totalAvailable: Number.isFinite(total) ? total : null, location: null, warnings };
  }

  private async legacySearch(params: ConnectorSearchParams, warnings: AppMessage[]): Promise<ConnectorSearchResult> {
    const order = params.sort === 'price_asc' ? '&O=OrderByPriceASC' : params.sort === 'discount' ? '&O=OrderByBestDiscountDESC' : '';
    const ft = params.query.trim() ? `ft=${encodeURIComponent(params.query.trim())}&` : '';
    const url = `${this.baseUrl}/api/catalog_system/pub/products/search?${ft}_from=0&_to=${Math.max(0, params.count - 1)}&sc=${this.integration.salesChannel}${order}`;
    const response = await this.options.http.getJson<VtexProduct[]>(url, { signal: params.signal, timeoutMs: this.options.timeoutMs });
    let offers = this.normalizeAll(Array.isArray(response.data) ? response.data : [], response.fetchedAt, this.offerLocation(null, null), 'catalog-legacy', null);
    if (params.hideUnavailable) offers = offers.filter((o) => o.availability === 'available');
    const resources = response.headers.get('resources');
    const total = resources ? Number(resources.split('/')[1]) : Number.NaN;
    return { offers, totalAvailable: Number.isFinite(total) ? total : null, location: null, warnings };
  }

  private intelligentSearchUrl(query: string, count: number, sort: ConnectorSearchParams['sort'], hideUnavailable: boolean, regionId: string | null): string {
    const params = new URLSearchParams();
    if (query.trim()) params.set('query', query.trim());
    params.set('page', '1');
    params.set('count', String(Math.min(Math.max(count, 1), 50)));
    params.set('locale', this.integration.locale);
    params.set('hideUnavailableItems', String(hideUnavailable));
    if (sort === 'discount') params.set('sort', 'discount:desc');
    if (sort === 'price_asc') params.set('sort', 'price:asc');
    if (regionId) params.set('regionId', regionId);
    return `${this.baseUrl}/api/io/_v/api/intelligent-search/product_search/?${params.toString()}`;
  }

  private shouldFallback(error: unknown): boolean {
    if (!(error instanceof UpstreamError)) return false;
    if (error.kind === 'invalid_json') return true;
    return error.kind === 'http' && error.status !== null && (error.status === 404 || error.status === 400 || error.status >= 500);
  }

  private normalizeAll(
    products: VtexProduct[],
    fetchedAt: string,
    location: OfferLocation,
    sourceApi: NormalizedOffer['sourceApi'],
    region: RegionInfo | null,
  ): NormalizedOffer[] {
    const ctx: NormalizeContext = {
      store: this.store,
      integration: this.integration,
      countryCode: this.country.code,
      currency: this.country.currency,
      unitSystem: this.country.unitSystem,
      consultedAt: fetchedAt,
      location,
      sourceApi,
    };
    const offers = products.flatMap((p) => normalizeProduct(p, ctx));
    // Sin sucursal asignada, las existencias de estas tiendas no son reales: se informan como desconocidas.
    if (this.integration.location.availabilityRequiresLocation && !region?.assignedStores.length) {
      return offers.map((o) => ({ ...o, availability: 'unknown', availableQuantity: null }));
    }
    return offers;
  }

  private async regionFor(location: LocationInput | null, signal: AbortSignal, warnings: AppMessage[], throwOnError = false): Promise<RegionInfo | null> {
    const cfg = this.integration.location;
    const usesLocation = cfg.supportsPostalCode || cfg.supportsGeoCoordinates;
    if (!location) {
      if (cfg.priceVariesByLocation) warnings.push(message('price_varies_no_location', { store: this.store.name }));
      else if (cfg.availabilityRequiresLocation) warnings.push(message('availability_needs_location', { store: this.store.name }));
      return null;
    }
    if (!usesLocation) return null;

    let query: string | null = null;
    let method: RegionInfo['method'] = 'postalCode';
    const hasGeo = location.lat !== null && location.lng !== null;
    if (location.postalCode && cfg.supportsPostalCode) {
      query = `postalCode=${encodeURIComponent(location.postalCode)}`;
    } else if (hasGeo && cfg.supportsGeoCoordinates) {
      query = `geoCoordinates=${location.lng!.toFixed(6)};${location.lat!.toFixed(6)}`;
      method = 'geo';
    } else if (hasGeo) {
      warnings.push(message('geo_not_supported', { store: this.store.name }));
      return null;
    } else {
      warnings.push(message('postal_not_supported', { store: this.store.name }));
      return null;
    }

    const cacheKey = `${this.store.id}|${query}`;
    const cached = this.regionCache.get(cacheKey);
    let region = cached ?? null;
    if (!region) {
      const url = `${this.baseUrl}/api/checkout/pub/regions?country=${this.integration.countryIso3}&sc=${this.integration.salesChannel}&${query}`;
      try {
        const response = await this.options.http.getJson<VtexRegion[]>(url, { signal, timeoutMs: this.options.timeoutMs, useCache: false });
        const first = Array.isArray(response.data) ? response.data[0] : undefined;
        const pattern = cfg.branchSellerIdPattern ? new RegExp(cfg.branchSellerIdPattern, 'i') : null;
        const assignedStores = (first?.sellers ?? [])
          .filter((s) => (pattern ? pattern.test(s.id ?? '') : true))
          .map((s) => {
            const name = (s.name ?? s.id ?? '').trim();
            return cfg.branchNamePrefixToStrip && name.startsWith(cfg.branchNamePrefixToStrip) ? name.slice(cfg.branchNamePrefixToStrip.length) : name;
          })
          .filter(Boolean);
        region = { regionId: first?.id ?? null, assignedStores, method };
        this.regionCache.set(cacheKey, region);
      } catch (error) {
        if (error instanceof UpstreamError && error.kind === 'cancelled') throw error;
        if (throwOnError) throw error;
        warnings.push(message('location_failed', { store: this.store.name }));
        return null;
      }
    }

    if (region.assignedStores.length === 0) {
      if (cfg.priceVariesByLocation) {
        warnings.push(message('no_branch_price_zero', { store: this.store.name }));
        return region;
      }
      warnings.push(message('no_branch', { store: this.store.name }));
      return throwOnError ? region : null;
    }
    return region;
  }

  private offerLocation(location: LocationInput | null, region: RegionInfo | null): OfferLocation {
    if (!location || !region) return { label: null, assignedStore: null, appliedBy: null };
    return {
      label: location.label ?? (location.postalCode && region.method === 'postalCode' ? location.postalCode : null),
      assignedStore: region.assignedStores.length ? region.assignedStores.join(', ') : null,
      appliedBy: region.method,
    };
  }

  private locationApplied(location: LocationInput | null, region: RegionInfo | null): LocationApplied | null {
    if (!location || !region) return null;
    return {
      method: region.method,
      postalCode: region.method === 'postalCode' ? location.postalCode : null,
      label: location.label,
      assignedStores: region.assignedStores,
      regionId: region.regionId,
      priceVariesByLocation: this.integration.location.priceVariesByLocation,
    };
  }
}

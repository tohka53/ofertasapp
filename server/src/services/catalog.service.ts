import { COUNTRIES, findCountry, isQueryable, storesForCountry } from '../catalog/catalog.js';
import type { CountryDefinition, KnownCondition, KrogerBanner, LocalizedText, LocationMode, PendingReasonCode, StoreDefinition } from '../catalog/catalog.types.js';
import { GT_DEFAULT_LOCATION, GT_LOCATIONS, type DepartmentLocations } from '../catalog/locations-gt.js';
import { CITY_PRESETS, US_STATES, type CityPreset, type StateOption } from '../catalog/locations.js';
import type { ConnectorRegistry } from '../connectors/registry.js';
import type { AppMessage, LocationApplied, LocationInput } from '../domain/types.js';
import { TtlCache } from '../http/ttl-cache.js';
import { HttpError } from './errors.js';
import { message } from './store-status.js';

export interface CountrySummary extends CountryDefinition {
  storeCount: number;
  connectedStoreCount: number;
}

export type IntegrationKind = StoreDefinition['integration']['kind'];

export interface StoreSummary {
  id: string;
  countryCode: string;
  name: string;
  operator: string | null;
  website: string | null;
  platform: LocalizedText;
  states: string[] | null;
  integrationKind: IntegrationKind;
  /** `available`/`offline`: consulta operativa comprobada; `pending`: registrada sin consulta; `unchecked`: sin comprobar. */
  status: 'available' | 'offline' | 'pending' | 'unchecked';
  statusMessage: AppMessage | null;
  /** Se puede elegir: consulta operativa o enlace a su sitio. */
  selectable: boolean;
  /** Se consulta desde el servidor. */
  queryable: boolean;
  searchUrlTemplate: string | null;
  checkedAt: string | null;
  latencyMs: number | null;
  verifiedAt: string;
  mechanism: LocalizedText | null;
  location: {
    usesLocation: boolean;
    priceVariesByLocation: boolean;
    availabilityRequiresLocation: boolean;
    supportsPostalCode: boolean;
    supportsGeoCoordinates: boolean;
    note: LocalizedText | null;
  };
  pendingReasonCode: PendingReasonCode | 'credentials_missing' | 'link_only' | null;
  pendingReason: LocalizedText | null;
  howToEnable: LocalizedText | null;
  evidence: LocalizedText[];
  banners: KrogerBanner[];
  knownConditions: KnownCondition[];
  notes: LocalizedText[];
  sources: string[];
}

export interface LocationsResponse {
  countryCode: string;
  mode: LocationMode;
  departments: DepartmentLocations[];
  defaultLocation: typeof GT_DEFAULT_LOCATION | null;
  cities: CityPreset[];
  states: StateOption[];
}

export interface LocationResolutionSummary {
  storeId: string;
  storeName: string;
  status: 'ok' | 'not_supported' | 'error' | 'pending';
  applied: LocationApplied | null;
  message: AppMessage | null;
}

const HEALTH_TTL_MS = 60_000;

const VTEX_MECHANISM: LocalizedText = {
  es: 'Servidor → API pública de VTEX Intelligent Search (/api/io/_v/api/intelligent-search/product_search), con respaldo en la Search API de catálogo (/api/catalog_system/pub/products/search). Ubicación: Checkout API pública (/api/checkout/pub/regions). Sin credenciales.',
  en: 'Server → public VTEX Intelligent Search API (/api/io/_v/api/intelligent-search/product_search), with the catalog Search API as fallback (/api/catalog_system/pub/products/search). Location: public Checkout API (/api/checkout/pub/regions). No credentials.',
};

const KROGER_MECHANISM: LocalizedText = {
  es: 'Servidor → API oficial de Kroger: token OAuth2 (credenciales de cliente, alcance product.compact), Locations API para la tienda más cercana al ZIP y Products API con filter.locationId para precios.',
  en: 'Server → official Kroger API: OAuth2 token (client credentials, product.compact scope), Locations API for the store nearest the ZIP code and Products API with filter.locationId for prices.',
};

const KROGER_CREDENTIALS_REASON: LocalizedText = {
  es: 'La API oficial de Kroger requiere credenciales propias y el servidor no las tiene configuradas.',
  en: 'The official Kroger API requires your own credentials and the server does not have them configured.',
};

const KROGER_HOW_TO_ENABLE: LocalizedText = {
  es: 'Crea una cuenta gratuita en developer.kroger.com, registra una aplicación con el alcance product.compact y agrega KROGER_CLIENT_ID y KROGER_CLIENT_SECRET a server/.env. Reinicia el servidor.',
  en: 'Create a free account at developer.kroger.com, register an application with the product.compact scope and add KROGER_CLIENT_ID and KROGER_CLIENT_SECRET to server/.env. Restart the server.',
};

const PRICESMART_MECHANISM: LocalizedText = {
  es: 'Servidor → endpoint de búsqueda del sitio de PriceSmart (POST /api/br_discovery/getProductsByKeyword, Bloomreach Discovery) con el precio del país (price_GT). Sin credenciales ni ubicación.',
  en: 'Server → PriceSmart website search endpoint (POST /api/br_discovery/getProductsByKeyword, Bloomreach Discovery) with the country price (price_GT). No credentials or location.',
};

export class CatalogService {
  private readonly health = new TtlCache<{ reachable: boolean; latencyMs: number; message: AppMessage | null; checkedAt: string }>(HEALTH_TTL_MS, 200);

  constructor(private readonly registry: ConnectorRegistry) {}

  listCountries(): CountrySummary[] {
    return COUNTRIES.map((country) => {
      const stores = storesForCountry(country.code);
      return {
        ...country,
        storeCount: stores.length,
        connectedStoreCount: stores.filter((s) => isQueryable(s)).length,
      };
    });
  }

  async listStores(countryCode: string, checkStatus: boolean, state: string | null, signal: AbortSignal): Promise<{ country: CountrySummary; state: string | null; stores: StoreSummary[] }> {
    const country = this.country(countryCode);
    const summary = this.listCountries().find((c) => c.code === country.code)!;
    const stateCode = country.regionKind === 'state' && state ? this.state(state) : null;
    const stores = storesForCountry(country.code, stateCode);
    const summaries = await Promise.all(stores.map((store) => this.storeSummary(store, checkStatus, signal)));
    return { country: summary, state: stateCode, stores: summaries };
  }

  locations(countryCode: string): LocationsResponse {
    const country = this.country(countryCode);
    return {
      countryCode: country.code,
      mode: country.locationMode,
      departments: country.locationMode === 'gt-zones' ? GT_LOCATIONS : [],
      defaultLocation: country.locationMode === 'gt-zones' ? GT_DEFAULT_LOCATION : null,
      cities: CITY_PRESETS[country.code] ?? [],
      states: country.regionKind === 'state' ? US_STATES : [],
    };
  }

  async resolveLocation(countryCode: string, storeIds: string[], location: LocationInput, signal: AbortSignal): Promise<LocationResolutionSummary[]> {
    const country = this.country(countryCode);
    const stores = storesForCountry(country.code);
    const invalid = storeIds.filter((id) => !stores.some((s) => s.id === id));
    if (invalid.length) throw new HttpError(400, 'invalid_store', `Stores outside ${country.code}: ${invalid.join(', ')}`, { stores: invalid.join(', ') });

    return Promise.all(
      [...new Set(storeIds)].map(async (id) => {
        const store = stores.find((s) => s.id === id)!;
        const connector = this.registry.get(id);
        if (!connector) {
          return { storeId: id, storeName: store.name, status: 'pending' as const, applied: null, message: message('integration_pending') };
        }
        const resolution = await connector.resolveLocation(location, signal);
        return { storeId: id, storeName: store.name, ...resolution };
      }),
    );
  }

  private async storeSummary(store: StoreDefinition, checkStatus: boolean, signal: AbortSignal): Promise<StoreSummary> {
    const integration = store.integration;
    const base = {
      id: store.id,
      countryCode: store.countryCode,
      name: store.name,
      operator: store.operator,
      website: store.website,
      platform: store.platform,
      states: store.states,
      knownConditions: store.knownConditions,
      notes: store.notes,
      sources: store.sources,
      banners: integration.kind === 'kroger' ? integration.banners : [],
      checkedAt: null as string | null,
      latencyMs: null as number | null,
      verifiedAt: integration.verifiedAt,
    };
    const noLocation = {
      usesLocation: false,
      priceVariesByLocation: false,
      availabilityRequiresLocation: false,
      supportsPostalCode: false,
      supportsGeoCoordinates: false,
      note: null,
    };

    if (integration.kind === 'pending' || integration.kind === 'link') {
      return {
        ...base,
        integrationKind: integration.kind,
        status: 'pending',
        statusMessage: message(integration.kind === 'link' ? 'link_only' : 'integration_pending'),
        selectable: integration.kind === 'link',
        queryable: false,
        searchUrlTemplate: integration.kind === 'link' ? integration.searchUrlTemplate : null,
        mechanism: null,
        location: noLocation,
        pendingReasonCode: integration.kind === 'link' ? 'link_only' : integration.reasonCode,
        pendingReason: integration.reason,
        howToEnable: integration.howToEnable,
        evidence: integration.evidence,
      };
    }

    const connector = this.registry.get(store.id);
    if (integration.kind === 'kroger' && !connector) {
      return {
        ...base,
        integrationKind: 'kroger',
        status: 'pending',
        statusMessage: message('credentials_missing', { vars: 'KROGER_CLIENT_ID, KROGER_CLIENT_SECRET' }),
        selectable: false,
        queryable: false,
        searchUrlTemplate: null,
        mechanism: KROGER_MECHANISM,
        location: { ...noLocation, usesLocation: true, priceVariesByLocation: true, supportsPostalCode: true, note: integration.note },
        pendingReasonCode: 'credentials_missing',
        pendingReason: KROGER_CREDENTIALS_REASON,
        howToEnable: KROGER_HOW_TO_ENABLE,
        evidence: [],
      };
    }

    let status: StoreSummary['status'] = 'unchecked';
    let statusMessage: AppMessage | null = null;
    let checkedAt: string | null = null;
    let latencyMs: number | null = null;
    if (checkStatus) {
      let health = this.health.get(store.id);
      if (!health) {
        const result = connector ? await connector.checkHealth(signal) : { reachable: false, latencyMs: 0, message: message('connector_missing') };
        health = { ...result, checkedAt: new Date().toISOString() };
        this.health.set(store.id, health);
      }
      status = health.reachable ? 'available' : 'offline';
      statusMessage = health.message;
      checkedAt = health.checkedAt;
      latencyMs = health.latencyMs;
    }

    const location =
      integration.kind === 'pricesmart'
        ? noLocation
        : integration.kind === 'vtex'
        ? {
            usesLocation: integration.location.supportsPostalCode || integration.location.supportsGeoCoordinates,
            priceVariesByLocation: integration.location.priceVariesByLocation,
            availabilityRequiresLocation: integration.location.availabilityRequiresLocation,
            supportsPostalCode: integration.location.supportsPostalCode,
            supportsGeoCoordinates: integration.location.supportsGeoCoordinates,
            note: integration.location.note,
          }
        : { ...noLocation, usesLocation: true, priceVariesByLocation: true, supportsPostalCode: true, note: integration.note };

    return {
      ...base,
      integrationKind: integration.kind,
      status,
      statusMessage,
      selectable: true,
      queryable: true,
      searchUrlTemplate: null,
      checkedAt,
      latencyMs,
      mechanism: integration.kind === 'vtex' ? VTEX_MECHANISM : integration.kind === 'pricesmart' ? PRICESMART_MECHANISM : KROGER_MECHANISM,
      location,
      pendingReasonCode: null,
      pendingReason: null,
      howToEnable: null,
      evidence: [],
    };
  }

  private country(code: string): CountryDefinition {
    const country = findCountry(code);
    if (!country) throw new HttpError(404, 'country_not_found', `Unsupported country: ${code}`, { country: code });
    return country;
  }

  private state(code: string): string {
    const upper = code.toUpperCase();
    if (!US_STATES.some((s) => s.code === upper)) throw new HttpError(400, 'invalid_state', `Unknown state: ${code}`, { state: code });
    return upper;
  }
}

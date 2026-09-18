import type { StoreDefinition } from '../catalog/catalog.types.js';
import type { AppMessage, LocationApplied, LocationInput, NormalizedOffer } from '../domain/types.js';

export interface ConnectorSearchParams {
  query: string;
  count: number;
  sort: 'relevance' | 'discount' | 'price_asc';
  hideUnavailable: boolean;
  location: LocationInput | null;
  signal: AbortSignal;
}

export interface ConnectorSearchResult {
  offers: NormalizedOffer[];
  totalAvailable: number | null;
  location: LocationApplied | null;
  warnings: AppMessage[];
}

export interface ConnectorSkuLookup {
  skuId: string;
  productId: string | null;
  gtinRaw: string | null;
  name: string;
}

export interface LocationResolution {
  status: 'ok' | 'not_supported' | 'error';
  applied: LocationApplied | null;
  message: AppMessage | null;
}

export interface StoreHealth {
  reachable: boolean;
  latencyMs: number;
  message: AppMessage | null;
}

export interface StoreConnector {
  readonly store: StoreDefinition;
  search(params: ConnectorSearchParams): Promise<ConnectorSearchResult>;
  /** Consulta el estado actual de SKUs concretos (para "Actualizar precios"). */
  lookupSkus(skus: ConnectorSkuLookup[], location: LocationInput | null, signal: AbortSignal): Promise<{ offers: Map<string, NormalizedOffer>; location: LocationApplied | null; warnings: AppMessage[] }>;
  resolveLocation(location: LocationInput, signal: AbortSignal): Promise<LocationResolution>;
  checkHealth(signal: AbortSignal): Promise<StoreHealth>;
}

import type { CurrencyCode, UnitSystem } from '../domain/types.js';

export type Lang = 'es' | 'en';

export interface LocalizedText {
  es: string;
  en: string;
}

/**
 * Cómo se elige la ubicación en el país:
 * - `gt-zones`: departamentos y zonas con código postal de Guatemala.
 * - `cities`: ciudades principales con coordenadas (para tiendas que asignan sucursal por GPS).
 * - `us-zip`: código ZIP de EE. UU.
 * - `none`: el país no tiene tiendas que usen ubicación.
 */
export type LocationMode = 'gt-zones' | 'cities' | 'us-zip' | 'none';

export interface CountryDefinition {
  code: string;
  name: LocalizedText;
  currency: CurrencyCode;
  currencySymbol: string;
  /** Locale para formatear números y fechas del país. */
  locale: string;
  flag: string;
  unitSystem: UnitSystem;
  /** `state`: las tiendas se filtran por estado (EE. UU.). */
  regionKind: 'none' | 'state';
  locationMode: LocationMode;
}

export interface KnownCondition {
  kind: 'shipping_fee' | 'free_shipping_threshold' | 'minimum_purchase' | 'item_limit' | 'membership' | 'coverage' | 'pickup' | 'wholesale_price';
  label: LocalizedText;
  /** Monto en la moneda del país, cuando la condición lo tiene. */
  amount: number | null;
  sourceUrl: string;
  verifiedAt: string;
}

export interface VtexLocationConfig {
  supportsPostalCode: boolean;
  supportsGeoCoordinates: boolean;
  /** Verificado comparando precios con y sin región. */
  priceVariesByLocation: boolean;
  /** Sin ubicación la tienda publica el catálogo sin existencias (verificado). */
  availabilityRequiresLocation: boolean;
  /** Expresión regular (fuente) para reconocer vendedores que representan sucursales. */
  branchSellerIdPattern: string | null;
  branchNamePrefixToStrip: string | null;
  note: LocalizedText;
}

export interface VtexIntegration {
  kind: 'vtex';
  baseUrl: string;
  /** Canal de venta público que usa la tienda sin sesión (verificado con /api/segments). */
  salesChannel: number;
  countryIso3: string;
  locale: string;
  location: VtexLocationConfig;
  promotions: {
    teaserConvention: 'walmart-ca' | null;
    /** Expresión regular (fuente) para colecciones destacadas que son promociones. */
    clusterHighlightPattern: string | null;
  };
  /** Propiedades de producto que contienen la presentación, en orden de prioridad. */
  contentProperties: string[];
  verifiedAt: string;
}

export interface KrogerBanner {
  name: string;
  states: string[];
}

/** API oficial de Kroger (developer.kroger.com). Requiere credenciales propias en el servidor. */
export interface KrogerIntegration {
  kind: 'kroger';
  banners: KrogerBanner[];
  docsUrl: string;
  note: LocalizedText;
  verifiedAt: string;
}

export interface PriceSmartIntegration {
  kind: 'pricesmart';
  baseUrl: string;
  viewId: string;
  pathLocale: string;
  accountId: string;
  authKey: string;
  domainKey: string;
  verifiedAt: string;
}

/** Tienda sin consulta automática: la app ofrece un enlace a su sitio. */
export interface LinkIntegration {
  kind: 'link';
  /** Plantilla con `{query}` para abrir la búsqueda del sitio (solo si se comprobó). */
  searchUrlTemplate: string | null;
  reason: LocalizedText;
  howToEnable: LocalizedText;
  evidence: LocalizedText[];
  verifiedAt: string;
}

export type PendingReasonCode = 'no_public_api' | 'no_online_catalog' | 'private_api' | 'requires_approval' | 'not_evaluated';

export interface PendingIntegration {
  kind: 'pending';
  reasonCode: PendingReasonCode;
  reason: LocalizedText;
  howToEnable: LocalizedText;
  evidence: LocalizedText[];
  verifiedAt: string;
}

export type StoreIntegration = VtexIntegration | KrogerIntegration | PriceSmartIntegration | LinkIntegration | PendingIntegration;

export interface StoreDefinition {
  id: string;
  countryCode: string;
  name: string;
  operator: string | null;
  /** Sitio oficial; `null` cuando no se encontró uno. */
  website: string | null;
  platform: LocalizedText;
  /** Estados donde opera (solo EE. UU.); `null` en países sin estados. */
  states: string[] | null;
  integration: StoreIntegration;
  knownConditions: KnownCondition[];
  notes: LocalizedText[];
  /** Fuentes de la información del directorio. */
  sources: string[];
}

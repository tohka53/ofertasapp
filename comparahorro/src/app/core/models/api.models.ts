/** Contratos del API del servidor (server/src/domain/types.ts, catálogo y servicios). */

export type Lang = 'es' | 'en';

export interface LocalizedText {
  es: string;
  en: string;
}

/** Mensaje del servidor: código estable y parámetros; la app lo presenta en el idioma elegido. */
export interface AppMessage {
  code: string;
  params?: Record<string, string | number>;
}

export type CurrencyCode = 'GTQ' | 'USD' | 'HNL' | 'CRC' | 'NIO' | 'BZD';
export type UnitSystem = 'metric' | 'us';
export type Availability = 'available' | 'unavailable' | 'unknown';
export type BaseUnit = 'g' | 'ml' | 'unit';
export type DisplayUnit = 'kg' | 'g' | 'mg' | 'lb' | 'oz' | 'L' | 'ml' | 'fl oz' | 'gal' | 'qt' | 'pt' | 'unit';

export interface ParsedContent {
  amount: number;
  unit: BaseUnit;
  displayAmount: number;
  displayUnit: DisplayUnit;
  packCount: number | null;
  multiplied: boolean;
  source: 'measurementUnit' | 'name' | 'property' | 'size';
  totalKnown: boolean;
}

export type UnitPriceBasis = 'kg' | 'L' | 'unit' | 'oz' | 'fl_oz';

export interface UnitPrice {
  value: number;
  per: UnitPriceBasis;
}

export type PromotionKind =
  | 'price_drop'
  | 'multi_buy'
  | 'percentage'
  | 'free_item'
  | 'combo'
  | 'free_shipping'
  | 'bundle'
  | 'store_highlight'
  | 'unknown';

export interface Promotion {
  kind: PromotionKind;
  source: 'list_price' | 'teaser' | 'discount_highlight' | 'cluster_highlight' | 'promo_price';
  minQuantity: number | null;
  payQuantity: number | null;
  promoUnitPrice: number | null;
  totalPrice: number | null;
  discountPercent: number | null;
  previousPrice: number | null;
  comboType: 'fixed' | 'percent' | null;
  validFrom: string | null;
  validTo: string | null;
  raw: string | null;
}

export interface OfferLocation {
  label: string | null;
  assignedStore: string | null;
  appliedBy: 'postalCode' | 'geo' | null;
}

export interface Offer {
  id: string;
  storeId: string;
  storeName: string;
  countryCode: string;
  productId: string;
  skuId: string;
  name: string;
  brand: string | null;
  variant: string | null;
  presentation: string | null;
  content: ParsedContent | null;
  gtin: string | null;
  gtinRaw: string | null;
  imageUrl: string | null;
  url: string;
  currency: CurrencyCode;
  price: number | null;
  listPrice: number | null;
  unitPrice: UnitPrice | null;
  availability: Availability;
  availableQuantity: number | null;
  promotions: Promotion[];
  location: OfferLocation;
  category: string | null;
  consultedAt: string;
  sourceApi: 'intelligent-search' | 'catalog-legacy' | 'kroger-products' | 'bloomreach-discovery';
}

export type StoreQueryStatus = 'ok' | 'error' | 'timeout' | 'pending' | 'cancelled';

export interface LocationApplied {
  method: 'postalCode' | 'geo';
  postalCode: string | null;
  label: string | null;
  assignedStores: string[];
  regionId: string | null;
  priceVariesByLocation: boolean;
}

export interface StoreQueryResult {
  storeId: string;
  storeName: string;
  status: StoreQueryStatus;
  message: AppMessage | null;
  warnings: AppMessage[];
  resultCount: number;
  totalAvailable: number | null;
  durationMs: number;
  consultedAt: string;
  location: LocationApplied | null;
}

export interface SearchResponse {
  query: string;
  countryCode: string;
  currency: CurrencyCode;
  requestedAt: string;
  durationMs: number;
  stores: StoreQueryResult[];
  offers: Offer[];
}

export type LocationMode = 'gt-zones' | 'cities' | 'us-zip' | 'none';

export interface Country {
  code: string;
  name: LocalizedText;
  currency: CurrencyCode;
  currencySymbol: string;
  locale: string;
  flag: string;
  unitSystem: UnitSystem;
  regionKind: 'none' | 'state';
  locationMode: LocationMode;
  storeCount: number;
  connectedStoreCount: number;
}

export interface KnownCondition {
  kind: 'shipping_fee' | 'free_shipping_threshold' | 'minimum_purchase' | 'item_limit' | 'membership' | 'coverage' | 'pickup' | 'wholesale_price';
  label: LocalizedText;
  amount: number | null;
  sourceUrl: string;
  verifiedAt: string;
}

export interface KrogerBanner {
  name: string;
  states: string[];
}

export type IntegrationKind = 'vtex' | 'kroger' | 'pricesmart' | 'link' | 'pending';

export type PendingReasonCode = 'no_public_api' | 'no_online_catalog' | 'private_api' | 'requires_approval' | 'not_evaluated' | 'credentials_missing' | 'link_only';

export interface StoreSummary {
  id: string;
  countryCode: string;
  name: string;
  operator: string | null;
  website: string | null;
  platform: LocalizedText;
  states: string[] | null;
  integrationKind: IntegrationKind;
  status: 'available' | 'offline' | 'pending' | 'unchecked';
  statusMessage: AppMessage | null;
  selectable: boolean;
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
  pendingReasonCode: PendingReasonCode | null;
  pendingReason: LocalizedText | null;
  howToEnable: LocalizedText | null;
  evidence: LocalizedText[];
  banners: KrogerBanner[];
  knownConditions: KnownCondition[];
  notes: LocalizedText[];
  sources: string[];
}

export interface StoresResponse {
  country: Country;
  state: string | null;
  stores: StoreSummary[];
}

export interface LocationOption {
  name: string;
  postalCode: string;
}

export interface DepartmentLocations {
  name: string;
  options: LocationOption[];
}

export interface CityPreset {
  name: string;
  lat: number;
  lng: number;
}

export interface StateOption {
  code: string;
  name: LocalizedText;
}

export interface LocationsResponse {
  countryCode: string;
  mode: LocationMode;
  departments: DepartmentLocations[];
  defaultLocation: { department: string; name: string; postalCode: string } | null;
  cities: CityPreset[];
  states: StateOption[];
}

export interface LocationResolution {
  storeId: string;
  storeName: string;
  status: 'ok' | 'not_supported' | 'error' | 'pending';
  applied: LocationApplied | null;
  message: AppMessage | null;
}

export interface RefreshItemRequest {
  key: string;
  storeId: string;
  skuId: string;
  productId: string | null;
  gtinRaw: string | null;
  name: string;
}

export interface RefreshItemResult {
  key: string;
  storeId: string;
  skuId: string;
  status: 'ok' | 'not_found' | 'store_error' | 'pending';
  offer: Offer | null;
  message: AppMessage | null;
}

export interface RefreshResponse {
  countryCode: string;
  refreshedAt: string;
  items: RefreshItemResult[];
  alternatives: Array<{ key: string; offers: Offer[] }>;
  stores: StoreQueryResult[];
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; params?: Record<string, string | number> };
}

/**
 * Tipos compartidos del dominio. Toda la información de productos proviene de
 * fuentes consultadas en tiempo real; ningún campo se rellena con valores
 * inventados. Los campos desconocidos se representan con `null`.
 *
 * Los textos para el usuario no se generan aquí: el servidor devuelve códigos y
 * datos estructurados, y la aplicación los presenta en español o inglés.
 */

export type CurrencyCode = 'GTQ' | 'USD' | 'HNL' | 'CRC' | 'NIO' | 'BZD';

export type UnitSystem = 'metric' | 'us';

export type Availability = 'available' | 'unavailable' | 'unknown';

export type BaseUnit = 'g' | 'ml' | 'unit';

export type DisplayUnit = 'kg' | 'g' | 'mg' | 'lb' | 'oz' | 'L' | 'ml' | 'fl oz' | 'gal' | 'qt' | 'pt' | 'unit';

/** Mensaje para el usuario: código estable y parámetros; la app elige el idioma. */
export interface AppMessage {
  code: string;
  params?: Record<string, string | number>;
}

export interface ParsedContent {
  /** Cantidad total en la unidad base (g, ml o unidades). */
  amount: number;
  unit: BaseUnit;
  /** Cantidad y unidad tal como se interpretaron del texto ("946" + "ml"). */
  displayAmount: number;
  displayUnit: DisplayUnit;
  /** Piezas del empaque cuando la fuente las indica ("3 Pack", "Caja 12 Unidades"). */
  packCount: number | null;
  /** Verdadero cuando el texto es una multiplicación explícita ("3 x 110 g"). */
  multiplied: boolean;
  source: 'measurementUnit' | 'name' | 'property' | 'size';
  /**
   * Falso cuando la fuente indica piezas y una cantidad sin aclarar si es por
   * pieza o total ("6 Pack - 946ml"). En ese caso no se calcula precio por unidad.
   */
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
  /** Cantidad mínima para aplicar la promoción. */
  minQuantity: number | null;
  /** Unidades que se pagan en promociones "lleva A, paga B". */
  payQuantity: number | null;
  /** Precio por unidad al aplicar la promoción. */
  promoUnitPrice: number | null;
  /** Precio total del grupo de unidades de la promoción ("2 x Q 12.00"). */
  totalPrice: number | null;
  discountPercent: number | null;
  /** Precio anterior publicado (rebajas). */
  previousPrice: number | null;
  /** Variante de combinación: monto fijo o porcentaje. */
  comboType: 'fixed' | 'percent' | null;
  validFrom: string | null;
  validTo: string | null;
  /** Texto original de la fuente (nombre de la promoción o de la colección). */
  raw: string | null;
}

export interface OfferLocation {
  /** Descripción de la ubicación usada en la consulta ("Guatemala Zona 1 (01001)"). */
  label: string | null;
  /** Sucursal o tienda asignada por la fuente para esa ubicación. */
  assignedStore: string | null;
  appliedBy: 'postalCode' | 'geo' | null;
}

export interface NormalizedOffer {
  id: string;
  storeId: string;
  storeName: string;
  countryCode: string;
  productId: string;
  skuId: string;
  name: string;
  brand: string | null;
  variant: string | null;
  /** Presentación sin palabras traducibles ("946 ml") o el texto original cuando no se pudo interpretar ("32 oz"). */
  presentation: string | null;
  content: ParsedContent | null;
  /** GTIN-14 normalizado; solo si el dígito verificador es válido y es de circulación global. */
  gtin: string | null;
  /** Código tal como lo publica la tienda. */
  gtinRaw: string | null;
  imageUrl: string | null;
  url: string;
  currency: CurrencyCode;
  /** Precio actual por paquete. `null` cuando la fuente no lo informa (nunca 0). */
  price: number | null;
  /** Precio anterior, solo cuando es mayor que el actual. */
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
  offers: NormalizedOffer[];
}

export interface LocationInput {
  postalCode: string | null;
  label: string | null;
  lat: number | null;
  lng: number | null;
}

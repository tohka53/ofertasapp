import type { CurrencyCode, Offer, ParsedContent, Promotion, UnitPrice } from './api.models';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  signedInAt: string;
}

/**
 * Ubicación elegida para las consultas. El texto visible se arma en el idioma activo
 * (ver core/logic/location.ts); aquí solo se guardan los datos.
 * - `zone`: departamento y zona de Guatemala (código postal).
 * - `postalCode`: código postal escrito a mano.
 * - `zip`: código ZIP de EE. UU.
 * - `city`: ciudad principal con coordenadas.
 * - `gps`: coordenadas del dispositivo.
 */
export interface LocationSelection {
  mode: 'zone' | 'postalCode' | 'zip' | 'city' | 'gps';
  department: string | null;
  name: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
}

/**
 * Oferta elegida para un artículo de lista (copia inmutable del momento de la consulta).
 * `source: 'manual'` identifica un precio anotado por el usuario (no consultado por la app).
 */
export interface SelectedOffer {
  source: 'store' | 'manual';
  offerId: string;
  storeId: string;
  storeName: string;
  productId: string;
  skuId: string;
  name: string;
  brand: string | null;
  presentation: string | null;
  content: ParsedContent | null;
  gtin: string | null;
  gtinRaw: string | null;
  currency: CurrencyCode;
  price: number | null;
  listPrice: number | null;
  unitPrice: UnitPrice | null;
  availability: Offer['availability'];
  promotions: Promotion[];
  url: string;
  imageUrl: string | null;
  consultedAt: string;
  locationLabel: string | null;
  assignedStore: string | null;
}

export interface ListItem {
  id: string;
  productQuery: string;
  desiredPresentation: string | null;
  quantity: number;
  purchased: boolean;
  offer: SelectedOffer | null;
  addedAt: string;
  addedBy: string | null;
  /** Integrante de la lista a quien le toca comprar este producto. */
  assignedTo: string | null;
}

export interface ShoppingList {
  id: string;
  name: string;
  month: number;
  year: number;
  countryCode: string;
  currency: CurrencyCode;
  currencySymbol: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  familyId: string | null;
  role: 'admin' | 'editor';
  memberCount: number;
  purgeAt: string | null;
  items: ListItem[];
}

export interface Family {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  memberCount: number;
  role: 'admin' | 'member';
}

/** Precio que el usuario vio en una tienda y anotó en su lista. */
export interface ManualPriceInput {
  storeId: string;
  storeName: string;
  productName: string;
  presentation: string | null;
  price: number;
  seenOn: string;
  url: string;
}

export function toSelectedOffer(offer: Offer): SelectedOffer {
  return {
    source: 'store',
    offerId: offer.id,
    storeId: offer.storeId,
    storeName: offer.storeName,
    productId: offer.productId,
    skuId: offer.skuId,
    name: offer.name,
    brand: offer.brand,
    presentation: offer.presentation,
    content: offer.content,
    gtin: offer.gtin,
    gtinRaw: offer.gtinRaw,
    currency: offer.currency,
    price: offer.price,
    listPrice: offer.listPrice,
    unitPrice: offer.unitPrice,
    availability: offer.availability,
    promotions: offer.promotions,
    url: offer.url,
    imageUrl: offer.imageUrl,
    consultedAt: offer.consultedAt,
    locationLabel: offer.location.label,
    assignedStore: offer.location.assignedStore,
  };
}

export function manualOffer(input: ManualPriceInput, currency: CurrencyCode, id: string): SelectedOffer {
  return {
    source: 'manual',
    offerId: `manual:${id}`,
    storeId: input.storeId,
    storeName: input.storeName,
    productId: '',
    skuId: '',
    name: input.productName,
    brand: null,
    presentation: input.presentation,
    content: null,
    gtin: null,
    gtinRaw: null,
    currency,
    price: input.price,
    listPrice: null,
    unitPrice: null,
    availability: 'unknown',
    promotions: [],
    url: input.url,
    imageUrl: null,
    consultedAt: input.seenOn,
    locationLabel: null,
    assignedStore: null,
  };
}

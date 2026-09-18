/**
 * Subconjunto de campos usados de las respuestas públicas de VTEX.
 * Intelligent Search usa claves en minúscula para teasers; la Search API de
 * catálogo usa PascalCase (PromotionTeasers, DiscountHighLight).
 */

export interface VtexTeaserIS {
  name?: string;
  conditions?: { minimumQuantity?: number; parameters?: Array<{ name?: string; value?: string }> };
  effects?: { parameters?: Array<{ name?: string; value?: string }> };
}

export interface VtexTeaserLegacy {
  Name?: string;
  Conditions?: { MinimumQuantity?: number; Parameters?: Array<{ Name?: string; Value?: string }> };
  Effects?: { Parameters?: Array<{ Name?: string; Value?: string }> };
}

export interface VtexCommertialOffer {
  Price?: number;
  ListPrice?: number;
  PriceWithoutDiscount?: number;
  spotPrice?: number;
  AvailableQuantity?: number;
  PriceValidUntil?: string;
  teasers?: VtexTeaserIS[];
  discountHighlights?: Array<{ name?: string }>;
  PromotionTeasers?: VtexTeaserLegacy[];
  Teasers?: unknown[];
  DiscountHighLight?: Array<{ Name?: string; name?: string }>;
}

export interface VtexSeller {
  sellerId?: string;
  sellerName?: string;
  sellerDefault?: boolean;
  commertialOffer?: VtexCommertialOffer;
}

export interface VtexItem {
  itemId?: string;
  name?: string;
  nameComplete?: string;
  ean?: string;
  measurementUnit?: string;
  unitMultiplier?: number;
  images?: Array<{ imageUrl?: string }>;
  sellers?: VtexSeller[];
  variations?: Array<{ name?: string; values?: string[] }> | string[];
}

export interface VtexProperty {
  name?: string;
  values?: string[];
}

export interface VtexProduct {
  productId?: string;
  productName?: string;
  brand?: string;
  link?: string;
  linkText?: string;
  categories?: string[];
  properties?: VtexProperty[];
  clusterHighlights?: Array<{ id?: string; name?: string }> | Record<string, string>;
  items?: VtexItem[];
  // En la Search API de catálogo, las especificaciones vienen como claves del producto.
  [key: string]: unknown;
}

export interface VtexIntelligentSearchResponse {
  products?: VtexProduct[];
  recordsFiltered?: number;
}

export interface VtexRegion {
  id?: string;
  sellers?: Array<{ id?: string; name?: string }>;
}

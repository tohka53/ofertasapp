/**
 * Subconjunto de campos de la API pública de Kroger (developer.kroger.com) que usa el conector:
 * token OAuth2 de credenciales de cliente, Locations API y Products API.
 */

export interface KrogerTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface KrogerLocation {
  locationId?: string;
  chain?: string;
  name?: string;
  address?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

export interface KrogerLocationsResponse {
  data?: KrogerLocation[];
}

export interface KrogerPrice {
  regular?: number;
  promo?: number;
}

export interface KrogerItem {
  itemId?: string;
  size?: string;
  soldBy?: string;
  price?: KrogerPrice;
  inventory?: { stockLevel?: string };
}

export interface KrogerImage {
  perspective?: string;
  featured?: boolean;
  sizes?: Array<{ size?: string; url?: string }>;
}

export interface KrogerProduct {
  productId?: string;
  upc?: string;
  brand?: string;
  description?: string;
  categories?: string[];
  images?: KrogerImage[];
  items?: KrogerItem[];
  productPageURI?: string;
}

export interface KrogerProductsResponse {
  data?: KrogerProduct[];
  meta?: { pagination?: { total?: number } };
}

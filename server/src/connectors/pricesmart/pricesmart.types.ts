export interface PriceSmartDoc {
  pid?: string;
  title?: string;
  brand?: string;
  slug?: string;
  thumb_image?: string;
  master_sku?: string;
  currency?: string;
  fractionDigits?: number;
  variants?: Array<{ skuid?: string }>;
  [field: string]: unknown;
}

export interface PriceSmartSearchResponse {
  response?: {
    numFound?: number;
    start?: number;
    docs?: PriceSmartDoc[];
  };
}

export interface PriceSmartSearchBody {
  url: string;
  start: number;
  q: string;
  fq: string[];
  search_type: 'keyword';
  rows: number;
  account_id: string;
  auth_key: string;
  request_id: number;
  domain_key: string;
  fl: string;
  view_id: string;
}

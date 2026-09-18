import type { Offer, UnitPriceBasis } from '../models/api.models';

export type OfferSort = 'relevance' | 'price_asc' | 'price_desc' | 'unit_price_asc';

export interface OfferFilters {
  storeIds: string[];
  minPrice: number | null;
  maxPrice: number | null;
  onlyAvailable: boolean;
  onlyPromotions: boolean;
  sort: OfferSort;
}

const UNIT_ORDER: UnitPriceBasis[] = ['kg', 'L', 'oz', 'fl_oz', 'unit'];

export const DEFAULT_FILTERS: OfferFilters = {
  storeIds: [],
  minPrice: null,
  maxPrice: null,
  onlyAvailable: false,
  onlyPromotions: false,
  sort: 'relevance',
};

/** Filtra y ordena sin alterar los datos. Con un rango de precio, las ofertas sin precio se ocultan. */
export function applyFilters(offers: Offer[], filters: OfferFilters, dominantUnit: UnitPriceBasis | null = null): Offer[] {
  const hasRange = filters.minPrice !== null || filters.maxPrice !== null;
  const filtered = offers.filter((o) => {
    if (filters.storeIds.length && !filters.storeIds.includes(o.storeId)) return false;
    if (filters.onlyAvailable && o.availability !== 'available') return false;
    if (filters.onlyPromotions && o.promotions.length === 0) return false;
    if (hasRange) {
      if (o.price === null) return false;
      if (filters.minPrice !== null && o.price < filters.minPrice) return false;
      if (filters.maxPrice !== null && o.price > filters.maxPrice) return false;
    }
    return true;
  });

  const indexed = filtered.map((offer, index) => ({ offer, index }));
  const byIndex = (a: { index: number }, b: { index: number }) => a.index - b.index;
  const nullsLast = (a: number | null, b: number | null) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : a - b);

  switch (filters.sort) {
    case 'price_asc':
      indexed.sort((a, b) => nullsLast(a.offer.price, b.offer.price) || byIndex(a, b));
      break;
    case 'price_desc':
      indexed.sort((a, b) => nullsLast(a.offer.price === null ? null : -a.offer.price, b.offer.price === null ? null : -b.offer.price) || byIndex(a, b));
      break;
    case 'unit_price_asc': {
      const rank = (per: UnitPriceBasis | undefined) => (per === undefined ? 9 : per === dominantUnit ? 0 : UNIT_ORDER.indexOf(per) + 1);
      indexed.sort(
        (a, b) =>
          rank(a.offer.unitPrice?.per) - rank(b.offer.unitPrice?.per) ||
          nullsLast(a.offer.unitPrice?.value ?? null, b.offer.unitPrice?.value ?? null) ||
          byIndex(a, b),
      );
      break;
    }
    case 'relevance':
      break;
  }
  return indexed.map((i) => i.offer);
}

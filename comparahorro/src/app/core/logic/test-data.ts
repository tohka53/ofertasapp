import type { Offer, ParsedContent, Promotion } from '../models/api.models';

/** Constructor de ofertas para pruebas unitarias (valores de ejemplo, no datos de tiendas). */
export function makeOffer(overrides: Partial<Offer> & { id: string; storeId: string }): Offer {
  const content: ParsedContent | null = overrides.content ?? null;
  return {
    storeName: overrides.storeId,
    countryCode: 'GT',
    productId: overrides.id,
    skuId: overrides.id.split(':').at(-1) ?? overrides.id,
    name: 'Producto de prueba',
    brand: null,
    variant: null,
    presentation: content && content.displayUnit !== 'unit' ? `${content.displayAmount} ${content.displayUnit}` : null,
    content,
    gtin: null,
    gtinRaw: null,
    imageUrl: null,
    url: 'https://example.com/p',
    currency: 'GTQ',
    price: null,
    listPrice: null,
    unitPrice: null,
    availability: 'available',
    availableQuantity: 10,
    promotions: [],
    location: { label: null, assignedStore: null, appliedBy: null },
    category: null,
    consultedAt: '2026-09-16T15:00:00.000Z',
    sourceApi: 'intelligent-search',
    ...overrides,
  };
}

function content(amount: number, unit: ParsedContent['unit'], displayUnit: ParsedContent['displayUnit'], totalKnown = true): ParsedContent {
  return { amount, unit, displayAmount: amount, displayUnit, packCount: null, multiplied: false, source: 'name', totalKnown };
}

export function ml(amount: number, totalKnown = true): ParsedContent {
  return content(amount, 'ml', 'ml', totalKnown);
}

export function grams(amount: number): ParsedContent {
  return content(amount, 'g', 'g');
}

export function promotion(overrides: Partial<Promotion> & Pick<Promotion, 'kind'>): Promotion {
  return {
    source: 'teaser',
    minQuantity: null,
    payQuantity: null,
    promoUnitPrice: null,
    totalPrice: null,
    discountPercent: null,
    previousPrice: null,
    comboType: null,
    validFrom: null,
    validTo: null,
    raw: null,
    ...overrides,
  };
}

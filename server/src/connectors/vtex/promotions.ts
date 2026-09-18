import type { Promotion } from '../../domain/types.js';

/**
 * Promociones de catálogos VTEX, como datos estructurados (la app arma los textos).
 *
 * - `price_drop`: ListPrice mayor que Price (precio anterior publicado por la tienda).
 * - `teaser`: promociones condicionadas (cantidad mínima, etc.). Para las tiendas de
 *   Walmart Centroamérica el nombre del teaser sigue la convención que interpreta su
 *   propio storefront (componente walmartgt.walmart-components, verificado el 2026-09-16:
 *   "Promo,6x2,2026-07-22-2026-10-06-…" se muestra como "2 x Q12").
 * - `cluster_highlight`: colecciones destacadas curadas por la tienda (La Torre).
 */

export interface TeaserInput {
  name: string;
  minimumQuantity: number | null;
  /** Valor del primer parámetro de efectos (ej. MaximumUnitPriceDiscount en centavos). */
  firstEffectValue: string | null;
  effectName: string | null;
}

const DATE_RE = /\d{4}-\d{2}-\d{2}/g;
const AXB_RE = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i;

function dates(segment: string | undefined): { from: string | null; to: string | null } {
  const found = segment?.match(DATE_RE) ?? [];
  return { from: found[0] ?? null, to: found[1] ?? null };
}

function parseAxB(value: string | undefined): { a: number; b: number } | null {
  const m = value ? AXB_RE.exec(value.trim()) : null;
  if (!m) return null;
  return { a: Number(m[1]), b: Number(m[2]) };
}

export function emptyPromotion(kind: Promotion['kind'], source: Promotion['source'], raw: string | null): Promotion {
  return {
    kind,
    source,
    minQuantity: null,
    payQuantity: null,
    promoUnitPrice: null,
    totalPrice: null,
    discountPercent: null,
    previousPrice: null,
    comboType: null,
    validFrom: null,
    validTo: null,
    raw,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Réplica de la interpretación del storefront de Walmart Centroamérica. */
export function parseWalmartCaTeaser(teaser: TeaserInput): Promotion {
  const raw = teaser.name;
  const lower = raw.toLowerCase();
  const parts = lower.split(',');
  const effectCents = teaser.firstEffectValue !== null ? Number.parseInt(teaser.firstEffectValue, 10) : Number.NaN;

  if (lower.startsWith('promocombinaenfijo')) {
    const axb = parseAxB(parts[1]);
    const qty = teaser.minimumQuantity || axb?.b || null;
    const unitCents = Number.isFinite(effectCents) && effectCents > 0 ? effectCents : axb ? 100 * axb.a : null;
    const { from, to } = dates(parts[2]);
    const total = qty && unitCents ? Math.ceil((unitCents * qty) / 100) : null;
    return { ...emptyPromotion('combo', 'teaser', raw), comboType: 'fixed', minQuantity: qty, totalPrice: total, validFrom: from, validTo: to };
  }

  if (lower.startsWith('promocombinaenporcentaje')) {
    const axb = parseAxB(parts[1]);
    const qty = teaser.minimumQuantity || (axb ? axb.a : null);
    const percent = Number.isFinite(effectCents) && effectCents > 0 ? effectCents : axb ? axb.b : null;
    const { from, to } = dates(parts[3]);
    return { ...emptyPromotion('combo', 'teaser', raw), comboType: 'percent', minQuantity: qty, discountPercent: percent, validFrom: from, validTo: to };
  }

  if (lower.startsWith('promo,freeitem')) {
    const axb = parseAxB(parts[2]);
    const { from, to } = dates(parts[3]);
    return {
      ...emptyPromotion('free_item', 'teaser', raw),
      minQuantity: axb ? axb.a : teaser.minimumQuantity,
      payQuantity: axb ? axb.b : null,
      validFrom: from,
      validTo: to,
    };
  }

  if (lower.startsWith('promo,porcentaje')) {
    const axb = parseAxB(parts[2]);
    const { from, to } = dates(parts[4]);
    return {
      ...emptyPromotion('percentage', 'teaser', raw),
      minQuantity: axb ? axb.a : teaser.minimumQuantity,
      discountPercent: axb ? axb.b : null,
      validFrom: from,
      validTo: to,
    };
  }

  if (lower.startsWith('promo,bundle')) {
    return { ...emptyPromotion('bundle', 'teaser', raw), minQuantity: teaser.minimumQuantity };
  }

  if (lower.startsWith('promo,')) {
    const axb = parseAxB(parts[1]);
    if (axb) {
      const qty = teaser.minimumQuantity || axb.b;
      const effectIsUnitPrice = teaser.effectName === null || /MaximumUnitPriceDiscount/i.test(teaser.effectName);
      const unitCents = effectIsUnitPrice && Number.isFinite(effectCents) && effectCents > 0 ? effectCents : 100 * axb.a;
      const unitPrice = unitCents / 100;
      const { from, to } = dates(parts[2]);
      return {
        ...emptyPromotion('multi_buy', 'teaser', raw),
        minQuantity: qty,
        promoUnitPrice: round2(unitPrice),
        totalPrice: round2(unitPrice * qty),
        validFrom: from,
        validTo: to,
      };
    }
  }

  if (lower.startsWith('envio gratis')) {
    return emptyPromotion('free_shipping', 'teaser', raw);
  }

  return genericTeaser(teaser);
}

/** Teaser sin convención conocida: se informa sin interpretar montos. */
export function genericTeaser(teaser: TeaserInput): Promotion {
  return { ...emptyPromotion('unknown', 'teaser', teaser.name), minQuantity: teaser.minimumQuantity };
}

export function priceDropPromotion(price: number | null, listPrice: number | null): Promotion | null {
  if (price === null || listPrice === null || !(listPrice > price) || price <= 0) return null;
  const percent = Math.round((1 - price / listPrice) * 100);
  return { ...emptyPromotion('price_drop', 'list_price', null), previousPrice: listPrice, discountPercent: percent > 0 ? percent : null };
}

export function clusterHighlightPromotion(name: string): Promotion {
  return { ...emptyPromotion('store_highlight', 'cluster_highlight', name.trim()), minQuantity: /2do|segund/i.test(name) ? 2 : null };
}

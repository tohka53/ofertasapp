import type { Offer, UnitPriceBasis } from '../models/api.models';
import { normalizeText } from './format';

/**
 * Comparación entre tiendas.
 * - "gtin": mismo código de barras válido en 2 o más tiendas (mismo producto).
 * - "probable": misma marca, mismo contenido total conocido y nombre muy similar,
 *   sin códigos de barras contradictorios. Se muestra como coincidencia a verificar.
 * Productos de distinta marca o presentación nunca se agrupan: se presentan como alternativas.
 */

export type MatchType = 'gtin' | 'probable';

export interface ComparisonGroup {
  key: string;
  matchType: MatchType;
  offers: Offer[];
  storeIds: string[];
  /** Ofertas con el menor precio por paquete entre las comparables con precio y disponibles. */
  bestOfferIds: string[];
  /** Hay al menos 2 tiendas con precio conocido y producto disponible. */
  canCompare: boolean;
  /** Las tiendas reportan contenidos distintos para el mismo código de barras. */
  contentMismatch: boolean;
}

export interface ComparisonSummary {
  groups: ComparisonGroup[];
  groupByOfferId: Map<string, ComparisonGroup>;
  cheapestPackage: Offer | null;
  cheapestUnit: { offer: Offer; per: UnitPriceBasis } | null;
  dominantUnit: UnitPriceBasis | null;
}

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'en', 'y', 'para', 'x', 'marca', 'unidad', 'unidades', 'pack', 'caja', 'bolsa', 'botella', 'empaque', 'uht', 'the', 'of', 'and', 'with', 'ct', 'count']);
const UNIT_TOKEN = /^\d+([.,]\d+)?(kg|kgs|g|gr|grs|ml|l|lt|lts|oz|fl|lb|lbs|gal|qt|pt|ct|un|uds?|und)?\.?$/;

export function nameTokens(offer: Pick<Offer, 'name' | 'brand'>): Set<string> {
  const brandTokens = new Set(offer.brand ? normalizeText(offer.brand).split(/[^a-z0-9]+/) : []);
  return new Set(
    normalizeText(offer.name)
      .split(/[^a-z0-9.,]+/)
      .map((t) => t.replace(/[.,]+$/, ''))
      .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !brandTokens.has(t) && !UNIT_TOKEN.test(t) && !/^(ml|kg|gr|lt|lts|oz|fl|lb|lbs|gal|qt|pt|g|l)$/.test(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function normalizedBrand(brand: string | null): string | null {
  if (!brand) return null;
  const n = normalizeText(brand);
  return n && n !== 'sin marca' && n !== 'generico' && n !== 'generica' ? n : null;
}

function contentKey(offer: Offer): string | null {
  const c = offer.content;
  if (!c || !c.totalKnown || !(c.amount > 0)) return null;
  return `${c.unit}:${Math.round(c.amount)}`;
}

function contentsDiffer(offers: Offer[]): boolean {
  const known = offers.map((o) => o.content).filter((c) => c && c.amount > 0);
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      const a = known[i]!;
      const b = known[j]!;
      if (a.unit !== b.unit) return true;
      if (Math.abs(a.amount - b.amount) / Math.max(a.amount, b.amount) > 0.02) return true;
    }
  }
  return false;
}

/** Una oferta por tienda: la de menor precio conocido (o la primera). */
function onePerStore(offers: Offer[]): Offer[] {
  const byStore = new Map<string, Offer>();
  for (const offer of offers) {
    const current = byStore.get(offer.storeId);
    if (!current) byStore.set(offer.storeId, offer);
    else if (offer.price !== null && (current.price === null || offer.price < current.price)) byStore.set(offer.storeId, offer);
  }
  return [...byStore.values()];
}

function finalizeGroup(key: string, matchType: MatchType, offers: Offer[]): ComparisonGroup {
  const sorted = [...offers].sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY));
  const eligible = sorted.filter((o) => o.price !== null && o.availability !== 'unavailable');
  const eligibleStores = new Set(eligible.map((o) => o.storeId));
  const canCompare = eligibleStores.size >= 2;
  const min = eligible[0]?.price ?? null;
  return {
    key,
    matchType,
    offers: sorted,
    storeIds: [...new Set(sorted.map((o) => o.storeId))],
    bestOfferIds: canCompare && min !== null ? eligible.filter((o) => Math.abs(o.price! - min) < 0.005).map((o) => o.id) : [],
    canCompare,
    contentMismatch: matchType === 'gtin' && contentsDiffer(sorted),
  };
}

export function buildComparison(offers: Offer[], similarityThreshold = 0.5): ComparisonSummary {
  const groups: ComparisonGroup[] = [];
  const grouped = new Set<string>();

  // 1) Mismo código de barras.
  const byGtin = new Map<string, Offer[]>();
  for (const offer of offers) {
    if (!offer.gtin) continue;
    byGtin.set(offer.gtin, [...(byGtin.get(offer.gtin) ?? []), offer]);
  }
  for (const [gtin, list] of byGtin) {
    const perStore = onePerStore(list);
    if (perStore.length < 2) continue;
    groups.push(finalizeGroup(`gtin:${gtin}`, 'gtin', perStore));
    for (const o of list) grouped.add(o.id);
  }

  // 2) Coincidencias probables por marca + contenido + nombre.
  const buckets = new Map<string, Offer[]>();
  for (const offer of offers) {
    if (grouped.has(offer.id)) continue;
    const brand = normalizedBrand(offer.brand);
    const content = contentKey(offer);
    if (!brand || !content) continue;
    const key = `${brand}|${content}`;
    buckets.set(key, [...(buckets.get(key) ?? []), offer]);
  }
  for (const [key, list] of buckets) {
    if (new Set(list.map((o) => o.storeId)).size < 2) continue;
    const tokens = new Map(list.map((o) => [o.id, nameTokens(o)]));
    const used = new Set<string>();
    for (const seed of list) {
      if (used.has(seed.id)) continue;
      const cluster = [seed];
      for (const candidate of list) {
        if (candidate.id === seed.id || used.has(candidate.id) || cluster.some((c) => c.storeId === candidate.storeId)) continue;
        const conflictingGtin = cluster.some((c) => c.gtin && candidate.gtin && c.gtin !== candidate.gtin);
        if (conflictingGtin) continue;
        const similar = cluster.every((c) => jaccard(tokens.get(c.id)!, tokens.get(candidate.id)!) >= similarityThreshold);
        if (similar) cluster.push(candidate);
      }
      if (cluster.length >= 2) {
        cluster.forEach((c) => used.add(c.id));
        groups.push(finalizeGroup(`probable:${key}:${seed.id}`, 'probable', cluster));
      }
    }
  }

  const groupByOfferId = new Map<string, ComparisonGroup>();
  for (const group of groups) for (const offer of group.offers) groupByOfferId.set(offer.id, group);
  // Las ofertas duplicadas de una misma tienda con el mismo GTIN también apuntan al grupo.
  for (const offer of offers) {
    if (!groupByOfferId.has(offer.id) && offer.gtin) {
      const group = groups.find((g) => g.key === `gtin:${offer.gtin}`);
      if (group) groupByOfferId.set(offer.id, group);
    }
  }

  const priced = offers.filter((o) => o.price !== null && o.availability !== 'unavailable');
  const cheapestPackage = priced.reduce<Offer | null>((best, o) => (best === null || o.price! < best.price! ? o : best), null);

  const unitCounts = new Map<UnitPriceBasis, number>();
  for (const o of priced) if (o.unitPrice) unitCounts.set(o.unitPrice.per, (unitCounts.get(o.unitPrice.per) ?? 0) + 1);
  const dominantUnit = [...unitCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const cheapestUnitOffer = dominantUnit
    ? priced.filter((o) => o.unitPrice?.per === dominantUnit).reduce<Offer | null>((best, o) => (best === null || o.unitPrice!.value < best.unitPrice!.value ? o : best), null)
    : null;

  groups.sort((a, b) => Number(b.canCompare) - Number(a.canCompare) || (a.matchType === 'gtin' ? -1 : 1) - (b.matchType === 'gtin' ? -1 : 1) || b.storeIds.length - a.storeIds.length);

  return {
    groups,
    groupByOfferId,
    cheapestPackage,
    cheapestUnit: cheapestUnitOffer && dominantUnit ? { offer: cheapestUnitOffer, per: dominantUnit } : null,
    dominantUnit,
  };
}

/** Alternativas (no idénticas) con el mismo tipo de unidad, ordenadas por precio por unidad. */
export function alternativesFor(target: Offer, offers: Offer[], group: ComparisonGroup | undefined, limit = 6): Offer[] {
  if (!target.unitPrice) return [];
  const inGroup = new Set(group?.offers.map((o) => o.id) ?? []);
  return offers
    .filter((o) => o.id !== target.id && !inGroup.has(o.id) && o.unitPrice?.per === target.unitPrice!.per && o.price !== null && o.availability !== 'unavailable')
    .sort((a, b) => a.unitPrice!.value - b.unitPrice!.value)
    .slice(0, limit);
}

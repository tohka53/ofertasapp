import type { StoreDefinition, VtexIntegration } from '../../catalog/catalog.types.js';
import type { CurrencyCode, NormalizedOffer, OfferLocation, ParsedContent, Promotion, UnitSystem } from '../../domain/types.js';
import { normalizeGtin } from '../../domain/gtin.js';
import { computeUnitPrice, parseContentText, parseMeasurementUnit } from '../../domain/units.js';
import {
  clusterHighlightPromotion,
  emptyPromotion,
  genericTeaser,
  parseWalmartCaTeaser,
  priceDropPromotion,
  type TeaserInput,
} from './promotions.js';
import type { VtexCommertialOffer, VtexItem, VtexProduct, VtexSeller } from './vtex.types.js';

export interface NormalizeContext {
  store: StoreDefinition;
  integration: VtexIntegration;
  countryCode: string;
  currency: CurrencyCode;
  unitSystem: UnitSystem;
  consultedAt: string;
  location: OfferLocation;
  sourceApi: NormalizedOffer['sourceApi'];
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function absoluteUrl(baseUrl: string, product: VtexProduct): string {
  const link = typeof product.link === 'string' ? product.link : '';
  if (/^https?:\/\//i.test(link)) return link.replace(/^http:/i, 'https:');
  if (link.startsWith('/')) return `${baseUrl}${link}`;
  if (product.linkText) return `${baseUrl}/${product.linkText}/p`;
  return baseUrl;
}

function pickSeller(item: VtexItem): VtexSeller | null {
  const sellers = item.sellers ?? [];
  return (
    sellers.find((s) => (s.commertialOffer?.AvailableQuantity ?? 0) > 0 && s.sellerDefault) ??
    sellers.find((s) => (s.commertialOffer?.AvailableQuantity ?? 0) > 0) ??
    sellers.find((s) => s.sellerDefault) ??
    sellers[0] ??
    null
  );
}

function propertyValue(product: VtexProduct, propertyName: string): string | null {
  const fromArray = product.properties?.find((p) => p.name?.trim().toLowerCase() === propertyName.toLowerCase());
  const candidate = fromArray?.values?.[0];
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  // Search API de catálogo: la especificación es una clave del producto.
  const legacy = product[propertyName];
  if (Array.isArray(legacy) && typeof legacy[0] === 'string' && legacy[0].trim()) return legacy[0].trim();
  return null;
}

export function resolveContent(
  product: VtexProduct,
  item: VtexItem,
  integration: VtexIntegration,
  unitSystem: UnitSystem = 'metric',
): { content: ParsedContent | null; presentation: string | null } {
  const byMeasurement = parseMeasurementUnit(item.measurementUnit, item.unitMultiplier);
  if (byMeasurement.content) return byMeasurement;

  const name = item.nameComplete || item.name || product.productName || '';
  const byName = parseContentText(name, 'name', unitSystem);
  const fromProperties = integration.contentProperties
    .map((property) => propertyValue(product, property))
    .filter((value): value is string => Boolean(value))
    .map((value) => parseContentText(value, 'property', unitSystem));

  if (byName.content) {
    // "2Pack De 354 g" con propiedad "708 g": la propiedad confirma el total del empaque.
    const packed = byName.content;
    if (!packed.totalKnown && packed.packCount) {
      const expected = packed.amount * packed.packCount;
      const confirmed = fromProperties.find(
        (p) => p.content && p.content.unit === packed.unit && p.content.totalKnown && Math.abs(p.content.amount - expected) / expected <= 0.02,
      );
      if (confirmed?.content) {
        return { content: { ...confirmed.content, packCount: packed.packCount }, presentation: byName.presentation };
      }
    }
    return byName;
  }

  let presentation = byName.presentation;
  for (const parsed of fromProperties) {
    if (parsed.content) return parsed;
    presentation ??= parsed.presentation ?? null;
  }
  return { content: null, presentation };
}

function teaserInputs(offer: VtexCommertialOffer): TeaserInput[] {
  const inputs: TeaserInput[] = [];
  for (const t of offer.teasers ?? []) {
    if (!t?.name) continue;
    const effect = t.effects?.parameters?.[0];
    inputs.push({
      name: t.name,
      minimumQuantity: positiveNumber(t.conditions?.minimumQuantity),
      firstEffectValue: effect?.value ?? null,
      effectName: effect?.name ?? null,
    });
  }
  if (inputs.length === 0) {
    for (const t of offer.PromotionTeasers ?? []) {
      if (!t?.Name) continue;
      const effect = t.Effects?.Parameters?.[0];
      inputs.push({
        name: t.Name,
        minimumQuantity: positiveNumber(t.Conditions?.MinimumQuantity),
        firstEffectValue: effect?.Value ?? null,
        effectName: effect?.Name ?? null,
      });
    }
  }
  return inputs;
}

function clusterNames(product: VtexProduct): string[] {
  const raw = product.clusterHighlights;
  if (Array.isArray(raw)) return raw.map((c) => c?.name).filter((n): n is string => typeof n === 'string');
  if (raw && typeof raw === 'object') return Object.values(raw).filter((n): n is string => typeof n === 'string');
  return [];
}

export function buildPromotions(product: VtexProduct, offer: VtexCommertialOffer, price: number | null, listPrice: number | null, ctx: NormalizeContext): Promotion[] {
  const promotions: Promotion[] = [];
  const drop = priceDropPromotion(price, listPrice);
  if (drop) promotions.push(drop);

  for (const teaser of teaserInputs(offer)) {
    promotions.push(ctx.integration.promotions.teaserConvention === 'walmart-ca' ? parseWalmartCaTeaser(teaser) : genericTeaser(teaser));
  }

  const highlights = [
    ...(offer.discountHighlights ?? []).map((d) => d?.name),
    ...(offer.DiscountHighLight ?? []).map((d) => d?.Name ?? d?.name),
  ].filter((n): n is string => typeof n === 'string' && n.trim().length > 0);
  for (const name of highlights) {
    promotions.push(emptyPromotion('unknown', 'discount_highlight', name.trim()));
  }

  const pattern = ctx.integration.promotions.clusterHighlightPattern;
  if (pattern) {
    const re = new RegExp(pattern, 'i');
    for (const name of clusterNames(product)) {
      if (!re.test(name)) continue;
      // "Ofertas Publicadas" repite la rebaja ya informada por ListPrice.
      if (drop && /ofertas? publicadas?/i.test(name)) continue;
      promotions.push(clusterHighlightPromotion(name));
    }
  }
  return promotions;
}

function categoryName(product: VtexProduct): string | null {
  const first = product.categories?.[0];
  if (!first) return null;
  const segments = first.split('/').filter(Boolean);
  return segments.at(-1) ?? null;
}

function variantName(product: VtexProduct, item: VtexItem): string | null {
  const productName = (product.productName ?? '').trim().toLowerCase();
  const itemName = (item.name ?? '').trim();
  if (itemName && itemName.toLowerCase() !== productName && !productName.includes(itemName.toLowerCase())) return itemName;
  return null;
}

export function normalizeProduct(product: VtexProduct, ctx: NormalizeContext): NormalizedOffer[] {
  const offers: NormalizedOffer[] = [];
  const items = (product.items ?? []).slice(0, 5);
  for (const item of items) {
    const seller = pickSeller(item);
    const commertial = seller?.commertialOffer ?? {};
    const availableQuantity = typeof commertial.AvailableQuantity === 'number' ? commertial.AvailableQuantity : null;
    const price = positiveNumber(commertial.Price);
    const rawList = positiveNumber(commertial.ListPrice);
    const listPrice = price !== null && rawList !== null && rawList > price ? rawList : null;
    const { content, presentation } = resolveContent(product, item, ctx.integration, ctx.unitSystem);
    const gtinRaw = typeof item.ean === 'string' && item.ean.trim() ? item.ean.trim() : null;
    const skuId = item.itemId ?? '';
    const productId = product.productId ?? '';
    const name = (product.productName || item.nameComplete || item.name || '').trim();
    if (!name || !skuId) continue;

    offers.push({
      id: `${ctx.store.id}:${skuId}`,
      storeId: ctx.store.id,
      storeName: ctx.store.name,
      countryCode: ctx.countryCode,
      productId,
      skuId,
      name,
      brand: product.brand?.trim() ? product.brand.trim() : null,
      variant: variantName(product, item),
      presentation,
      content,
      gtin: normalizeGtin(gtinRaw),
      gtinRaw,
      imageUrl: item.images?.[0]?.imageUrl?.replace(/^http:/i, 'https:') ?? null,
      url: absoluteUrl(ctx.integration.baseUrl, product),
      currency: ctx.currency,
      price,
      listPrice,
      unitPrice: computeUnitPrice(price, content, ctx.unitSystem),
      availability: availableQuantity === null ? 'unknown' : availableQuantity > 0 ? 'available' : 'unavailable',
      availableQuantity,
      promotions: buildPromotions(product, commertial, price, listPrice, ctx),
      location: ctx.location,
      category: categoryName(product),
      consultedAt: ctx.consultedAt,
      sourceApi: ctx.sourceApi,
    });
  }
  return offers;
}

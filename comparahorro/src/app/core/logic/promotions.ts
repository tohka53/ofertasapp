import { translate } from '../i18n/translate';
import type { Lang, Promotion } from '../models/api.models';
import { capitalize, formatDate, formatMoney } from './format';

export interface PromotionText {
  label: string;
  conditions: string | null;
}

/** Textos de una promoción estructurada del servidor, en el idioma activo. */
export function promotionText(promo: Promotion, currency: string, storeName: string, lang: Lang): PromotionText {
  const money = (value: number | null) => formatMoney(value, currency);
  const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate(lang, key, params);
  const validity = validityText(promo, lang);

  switch (promo.kind) {
    case 'price_drop':
      return {
        label: promo.previousPrice !== null ? t('promo.price_drop.label', { price: money(promo.previousPrice) }) : t('promo.unknown.label'),
        conditions: join([promo.source === 'promo_price' ? t('promo.promo_price.conditions') : t('promo.price_drop.conditions'), validity]),
      };
    case 'multi_buy':
      return {
        label: promo.minQuantity && promo.totalPrice !== null ? `${promo.minQuantity} x ${money(promo.totalPrice)}` : t('promo.unknown.label'),
        conditions: join([
          promo.minQuantity && promo.promoUnitPrice !== null ? t('promo.multi_buy.conditions', { qty: promo.minQuantity, price: money(promo.promoUnitPrice) }) : null,
          validity,
        ]),
      };
    case 'combo': {
      let label = t('promo.combo.fallback');
      if (promo.minQuantity && promo.comboType === 'fixed' && promo.totalPrice !== null) label = t('promo.combo.fixed', { qty: promo.minQuantity, price: money(promo.totalPrice) });
      if (promo.minQuantity && promo.comboType === 'percent' && promo.discountPercent) label = t('promo.combo.percent', { qty: promo.minQuantity, percent: promo.discountPercent });
      return { label, conditions: join([promo.minQuantity ? t('promo.combo.conditions', { qty: promo.minQuantity }) : null, validity]) };
    }
    case 'free_item':
      return {
        label: promo.minQuantity && promo.payQuantity !== null ? `${promo.minQuantity} x ${promo.payQuantity}` : t('promo.free_item.fallback'),
        conditions: join([promo.minQuantity && promo.payQuantity !== null ? t('promo.free_item.conditions', { min: promo.minQuantity, pay: promo.payQuantity }) : null, validity]),
      };
    case 'percentage':
      return {
        label: promo.minQuantity && promo.discountPercent ? t('promo.percentage.label', { qty: promo.minQuantity, percent: promo.discountPercent }) : t('promo.percentage.fallback'),
        conditions: join([promo.minQuantity ? t('promo.percentage.conditions', { qty: promo.minQuantity }) : null, validity]),
      };
    case 'bundle':
      return { label: t('promo.bundle.label'), conditions: join([t('promo.bundle.conditions'), validity]) };
    case 'free_shipping':
      return { label: t('promo.free_shipping.label'), conditions: join([t('promo.free_shipping.conditions'), validity]) };
    case 'store_highlight':
      return {
        label: promo.raw?.trim() || t('promo.store_highlight.fallback'),
        conditions: join([t('promo.store_highlight.conditions', { store: storeName }), validity]),
      };
    default:
      return {
        label: t('promo.unknown.label'),
        conditions: join([promo.minQuantity ? t('promo.unknown.min', { qty: promo.minQuantity }) : t('promo.unknown.noConditions'), validity]),
      };
  }
}

function validityText(promo: Promotion, lang: Lang): string | null {
  const from = formatDate(promo.validFrom, lang);
  const to = formatDate(promo.validTo, lang);
  if (from && to) return translate(lang, 'promo.validRange', { from, to });
  if (to) return translate(lang, 'promo.validUntil', { to });
  return null;
}

function join(parts: Array<string | null>): string | null {
  const filtered = parts.filter((p): p is string => Boolean(p));
  return filtered.length ? capitalize(filtered.join(' · ')) : null;
}

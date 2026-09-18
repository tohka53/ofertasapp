import { describe, expect, it } from 'vitest';
import { clusterHighlightPromotion, parseWalmartCaTeaser, priceDropPromotion } from '../src/connectors/vtex/promotions.js';

describe('Promociones Walmart Centroamérica', () => {
  it('interpreta "Promo,6x2" como lo muestra walmart.com.gt ("2 x Q12")', () => {
    const promo = parseWalmartCaTeaser({ name: 'Promo,6x2,2026-07-22-2026-10-06-221939-12 TYPE_PROMO_GPP', minimumQuantity: 2, firstEffectValue: '600', effectName: 'MaximumUnitPriceDiscount' });
    expect(promo).toMatchObject({
      kind: 'multi_buy',
      minQuantity: 2,
      promoUnitPrice: 6,
      totalPrice: 12,
      validFrom: '2026-07-22',
      validTo: '2026-10-06',
    });
  });

  it('interpreta el teaser de Maxi Despensa ("2 x Q20")', () => {
    const promo = parseWalmartCaTeaser({ name: 'Promo,10x2,2026-07-20-2026-10-06-220371-10 TYPE_PROMO_GPP', minimumQuantity: 2, firstEffectValue: '1000', effectName: 'MaximumUnitPriceDiscount' });
    expect(promo).toMatchObject({ kind: 'multi_buy', minQuantity: 2, totalPrice: 20, promoUnitPrice: 10 });
  });

  it('usa el nombre cuando la Search API de catálogo no trae efectos', () => {
    const promo = parseWalmartCaTeaser({ name: 'Promo,6x2,2026-07-22-2026-10-06-221939-12 TYPE_PROMO_GPP', minimumQuantity: 2, firstEffectValue: null, effectName: null });
    expect(promo).toMatchObject({ kind: 'multi_buy', totalPrice: 12 });
  });

  it('otros formatos de la convención', () => {
    expect(parseWalmartCaTeaser({ name: 'Promo,freeitem,3x2,2026-01-01-2026-02-01', minimumQuantity: null, firstEffectValue: null, effectName: null })).toMatchObject({
      kind: 'free_item',
      minQuantity: 3,
      payQuantity: 2,
    });
    expect(parseWalmartCaTeaser({ name: 'Promo,porcentaje,2x15,x,2026-01-01-2026-02-01', minimumQuantity: null, firstEffectValue: null, effectName: null })).toMatchObject({
      kind: 'percentage',
      minQuantity: 2,
      discountPercent: 15,
    });
    expect(parseWalmartCaTeaser({ name: 'promocombinaenfijo,25x3,2026-01-01-2026-02-01', minimumQuantity: 3, firstEffectValue: '2500', effectName: null })).toMatchObject({
      kind: 'combo',
      comboType: 'fixed',
      minQuantity: 3,
      totalPrice: 75,
    });
  });

  it('no inventa montos en formatos desconocidos', () => {
    const promo = parseWalmartCaTeaser({ name: 'Campaña especial', minimumQuantity: 3, firstEffectValue: null, effectName: null });
    expect(promo).toMatchObject({ kind: 'unknown', minQuantity: 3, promoUnitPrice: null, totalPrice: null, raw: 'Campaña especial' });
  });
});

describe('Otras promociones', () => {
  it('rebaja por precio anterior', () => {
    expect(priceDropPromotion(11.65, 16.65)).toMatchObject({ kind: 'price_drop', previousPrice: 16.65, discountPercent: 30 });
    expect(priceDropPromotion(13, 13)).toBeNull();
    expect(priceDropPromotion(null, 16)).toBeNull();
  });

  it('colección destacada de La Torre', () => {
    expect(clusterHighlightPromotion('2do a 99% Descuento Exclusivo Online')).toMatchObject({ kind: 'store_highlight', minQuantity: 2, raw: '2do a 99% Descuento Exclusivo Online' });
  });
});

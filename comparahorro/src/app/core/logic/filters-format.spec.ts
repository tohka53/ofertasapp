import { applyFilters, DEFAULT_FILTERS } from './filters';
import { formatMoney, presentationLabel, unitPriceLabel } from './format';
import { matchesPresentation, neutralPresentation, parseDesiredPresentation } from './presentation';
import { grams, makeOffer, ml, promotion } from './test-data';

describe('filtros y orden', () => {
  const offers = [
    makeOffer({ id: 'a', storeId: 'wm', price: 20, unitPrice: { value: 20, per: 'L' } }),
    makeOffer({ id: 'b', storeId: 'lt', price: null }),
    makeOffer({ id: 'c', storeId: 'lt', price: 12, unitPrice: { value: 24, per: 'L' }, promotions: [promotion({ kind: 'price_drop', source: 'list_price', previousPrice: 15, discountPercent: 20 })] }),
    makeOffer({ id: 'd', storeId: 'md', price: 30, availability: 'unavailable', unitPrice: { value: 60, per: 'kg' } }),
  ];

  it('filtra por tienda, disponibilidad y promociones', () => {
    expect(applyFilters(offers, { ...DEFAULT_FILTERS, storeIds: ['lt'] }).map((o) => o.id)).toEqual(['b', 'c']);
    expect(applyFilters(offers, { ...DEFAULT_FILTERS, onlyAvailable: true }).map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(applyFilters(offers, { ...DEFAULT_FILTERS, onlyPromotions: true }).map((o) => o.id)).toEqual(['c']);
  });

  it('el rango de precio oculta ofertas sin precio en vez de tratarlas como cero', () => {
    expect(applyFilters(offers, { ...DEFAULT_FILTERS, maxPrice: 25 }).map((o) => o.id)).toEqual(['a', 'c']);
    expect(applyFilters(offers, { ...DEFAULT_FILTERS, minPrice: 0 }).map((o) => o.id)).toEqual(['a', 'c', 'd']);
  });

  it('ordena por precio con los precios ausentes al final', () => {
    expect(applyFilters(offers, { ...DEFAULT_FILTERS, sort: 'price_asc' }).map((o) => o.id)).toEqual(['c', 'a', 'd', 'b']);
    expect(applyFilters(offers, { ...DEFAULT_FILTERS, sort: 'price_desc' }).map((o) => o.id)).toEqual(['d', 'a', 'c', 'b']);
  });

  it('ordena por precio por unidad agrupando la unidad dominante primero', () => {
    expect(applyFilters(offers, { ...DEFAULT_FILTERS, sort: 'unit_price_asc' }, 'L').map((o) => o.id)).toEqual(['a', 'c', 'd', 'b']);
  });
});

describe('formato y presentación deseada', () => {
  it('formatea quetzales con símbolo y separadores', () => {
    expect(formatMoney(25.5)).toBe('Q 25.50');
    expect(formatMoney(1234.567)).toBe('Q 1,234.57');
    expect(formatMoney(null)).toBeNull();
    expect(unitPriceLabel({ value: 19.98, per: 'L' })).toBe('Q 19.98 por litro');
  });

  it('formatea dólares y precios por onza en inglés', () => {
    expect(formatMoney(3.49, 'USD')).toBe('$3.49');
    expect(formatMoney(1250, 'CRC')).toBe('₡ 1,250.00');
    expect(unitPriceLabel({ value: 19.98, per: 'L' }, 'GTQ', 'en')).toBe('Q 19.98 per liter');
    expect(unitPriceLabel({ value: 0.0234, per: 'fl_oz' }, 'USD', 'en')).toBe('$0.023 per fl oz');
    expect(unitPriceLabel({ value: 0.1834, per: 'oz' }, 'USD', 'es')).toBe('$0.183 por onza');
    expect(unitPriceLabel({ value: 2.5, per: 'unit' }, 'USD', 'en')).toBe('$2.50 per unit');
  });

  it('arma la presentación en el idioma activo sin inventar cantidades', () => {
    const units = { amount: 12, unit: 'unit' as const, displayAmount: 12, displayUnit: 'unit' as const, packCount: null, multiplied: false, source: 'name' as const, totalKnown: true };
    expect(presentationLabel(units, null, 'es')).toBe('12 unidades');
    expect(presentationLabel(units, null, 'en')).toBe('12 units');
    expect(presentationLabel({ ...ml(946), packCount: 6, totalKnown: false }, '946 ml', 'es')).toBe('946 ml · 6 piezas');
    expect(presentationLabel({ ...grams(330), displayAmount: 110, packCount: 3, multiplied: true }, '3 x 110 g', 'en')).toBe('3 x 110 g');
    expect(presentationLabel(null, '32 oz', 'es')).toBe('32 oz');
    expect(presentationLabel(null, null, 'es')).toBeNull();
    expect(neutralPresentation(units, null)).toBe('12 u');
    expect(parseDesiredPresentation(neutralPresentation(units, null))).toEqual({ amount: 12, unit: 'unit' });
  });

  it('interpreta y compara la presentación deseada', () => {
    expect(parseDesiredPresentation('1 litro')).toEqual({ amount: 1000, unit: 'ml' });
    expect(parseDesiredPresentation('400 g')).toEqual({ amount: 400, unit: 'g' });
    expect(parseDesiredPresentation('30 huevos')).toEqual({ amount: 30, unit: 'unit' });
    expect(parseDesiredPresentation('grande')).toBeNull();
    expect(matchesPresentation(ml(1000), parseDesiredPresentation('1 L'))).toBe(true);
    expect(matchesPresentation(ml(946), parseDesiredPresentation('1 L'))).toBe(false);
    expect(matchesPresentation(grams(400), parseDesiredPresentation('400g'))).toBe(true);
    expect(matchesPresentation(ml(2838, false), parseDesiredPresentation('2838 ml'))).toBe(false);
  });

  it('entiende unidades de EE. UU. en la presentación deseada', () => {
    expect(parseDesiredPresentation('1 gal')!.amount).toBeCloseTo(3785.41, 2);
    expect(parseDesiredPresentation('16 fl oz')).toEqual({ amount: 16 * 29.5735295625, unit: 'ml' });
    expect(parseDesiredPresentation('16fl oz')!.unit).toBe('ml');
    expect(parseDesiredPresentation('12 oz')).toEqual({ amount: 12 * 28.349523125, unit: 'g' });
    expect(parseDesiredPresentation('2 lbs')!.amount).toBeCloseTo(907.18, 2);
    expect(parseDesiredPresentation('12 eggs')).toEqual({ amount: 12, unit: 'unit' });
    expect(matchesPresentation(ml(3785.411784), parseDesiredPresentation('1 gallon'))).toBe(true);
  });
});

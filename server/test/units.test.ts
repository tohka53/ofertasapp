import { describe, expect, it } from 'vitest';
import { computeUnitPrice, contentDiffers, parseContentText, parseMeasurementUnit } from '../src/domain/units.js';

describe('parseContentText', () => {
  it.each([
    ['Leche Dos Pinos Pinito - 1000 ml', 'ml', 1000, 1000, 'ml', '1000 ml'],
    ['Leche Dos Pinos delactomy uht 0% grasa - 946 ml', 'ml', 946, 946, 'ml', '946 ml'],
    ['Arroz Arroz Precocido Parborizado Empaque - 400 g', 'g', 400, 400, 'g', '400 g'],
    ['Leche Pinito Dos Pinos en polvo vitaminada bolsa - 2200 g', 'g', 2200, 2200, 'g', '2200 g'],
    ['Leche Dos Pinos Polvo Pinito - 1.5 kg', 'g', 1500, 1.5, 'kg', '1.5 kg'],
    ['Aceite Olmeca, light -1250ml', 'ml', 1250, 1250, 'ml', '1250 ml'],
    ['Jalea Hagen Tres Cebollas Deli -225 g', 'g', 225, 225, 'g', '225 g'],
    ['Sopa Criolla Maggi Gallina Con Arroz y Chipilín 57g', 'g', 57, 57, 'g', '57 g'],
    ['Huevo de gallina Avícola Fátima blanco grande - 30 Uds', 'unit', 30, 30, 'unit', null],
    ['Huevo de Gallina Granjazul Blanco Grande - 60 Unidades', 'unit', 60, 60, 'unit', null],
    ['1lt.', 'ml', 1000, 1, 'L', '1 L'],
    ['400gr.', 'g', 400, 400, 'g', '400 g'],
    ['946ml.', 'ml', 946, 946, 'ml', '946 ml'],
    ['Aceite 1,250 ml', 'ml', 1250, 1250, 'ml', '1250 ml'],
    ['Agua Pura 5 Galones', 'ml', 5 * 3785.411784, 5, 'gal', '5 gal'],
    ['Arroz Mr. Dieck Blanco Saquito -25 lb', 'g', 25 * 453.59237, 25, 'lb', '25 lb'],
  ])('%s', (text, unit, amount, displayAmount, displayUnit, presentation) => {
    const { content, presentation: shown } = parseContentText(text, 'name');
    expect(content).not.toBeNull();
    expect(content!.unit).toBe(unit);
    expect(content!.amount).toBeCloseTo(amount, 3);
    expect(content!.displayAmount).toBeCloseTo(displayAmount, 3);
    expect(content!.displayUnit).toBe(displayUnit);
    expect(content!.totalKnown).toBe(true);
    expect(shown).toBe(presentation);
  });

  it('prefiere peso o volumen sobre un rango aproximado de unidades', () => {
    const { content } = parseContentText('Tomate De Cocina En Red 3 Libras - 5 a 7 Unidades Aproximadamente -', 'name');
    expect(content?.unit).toBe('g');
    expect(content?.amount).toBeCloseTo(3 * 453.59237, 3);
  });

  it('marca como ambiguo un empaque múltiple sin total explícito', () => {
    const pack = parseContentText('Leche Semidescremada Dos Pinos Delactomy 3 Pack - 2838 ml', 'name').content;
    expect(pack?.packCount).toBe(3);
    expect(pack?.totalKnown).toBe(false);
    const box = parseContentText('Leche Deslactosada Coronado Caja 12 Unidades - 12 L', 'name').content;
    expect(box?.packCount).toBe(12);
    expect(box?.totalKnown).toBe(false);
  });

  it('calcula el total en multiplicaciones explícitas', () => {
    const { content, presentation } = parseContentText('Jabón Protex 3 x 110 g', 'name');
    expect(content).toMatchObject({ unit: 'g', amount: 330, packCount: 3, multiplied: true, totalKnown: true });
    expect(presentation).toBe('3 x 110 g');
  });

  it('no confunde "Pack de 354 g" con 354 piezas', () => {
    const { content } = parseContentText('Arroz Omoa Blanco 2Pack De 354 g', 'name');
    expect(content).toMatchObject({ unit: 'g', amount: 354, packCount: 2, totalKnown: false });
  });

  it('no interpreta onzas sin "fl" (pueden ser peso o volumen)', () => {
    const result = parseContentText('Leche Blue Diamond Almond Breeze Vanilla Sin Azúcar - 32 oz', 'name');
    expect(result.content).toBeNull();
    expect(result.presentation).toBe('32 oz');
  });

  it('no confunde palabras con unidades', () => {
    expect(parseContentText('Omega 3 grasas saludables', 'name').content).toBeNull();
    expect(parseContentText('Leche UHT Descremada Delactomy', 'name').content).toBeNull();
  });
});

describe('parseMeasurementUnit', () => {
  it('usa measurementUnit cuando el producto se vende por peso', () => {
    expect(parseMeasurementUnit('kg', 0.5).content).toMatchObject({ unit: 'g', amount: 500, source: 'measurementUnit' });
    expect(parseMeasurementUnit('un', 1).content).toBeNull();
  });
});

describe('computeUnitPrice', () => {
  it('calcula precio por litro y por kilogramo', () => {
    const litro = parseContentText('946 ml', 'name').content;
    expect(computeUnitPrice(20.25, litro)).toEqual({ value: 21.4059, per: 'L' });
    const kilo = parseContentText('400 g', 'name').content;
    expect(computeUnitPrice(7.15, kilo)).toEqual({ value: 17.875, per: 'kg' });
  });

  it('calcula precio por unidad solo con 2 o más unidades', () => {
    expect(computeUnitPrice(38.72, parseContentText('30 Uds', 'name').content)).toEqual({ value: 1.2907, per: 'unit' });
    expect(computeUnitPrice(5, parseContentText('1 unidad', 'name').content)).toBeNull();
  });

  it('no calcula con precio ausente, cero o contenido ambiguo', () => {
    const content = parseContentText('1 L', 'name').content;
    expect(computeUnitPrice(null, content)).toBeNull();
    expect(computeUnitPrice(0, content)).toBeNull();
    expect(computeUnitPrice(60, parseContentText('3 Pack - 2838 ml', 'name').content)).toBeNull();
  });
});

describe('Unidades de EE. UU.', () => {
  it('interpreta oz como peso y fl oz como volumen', () => {
    const oz = parseContentText('Kroger Shredded Cheddar 16 oz', 'size', 'us').content;
    expect(oz).toMatchObject({ unit: 'g', displayAmount: 16, displayUnit: 'oz' });
    expect(oz!.amount).toBeCloseTo(453.59, 1);
    const floz = parseContentText('64 fl oz', 'size', 'us').content;
    expect(floz).toMatchObject({ unit: 'ml', displayUnit: 'fl oz' });
    expect(parseContentText('1 gal', 'size', 'us').content).toMatchObject({ unit: 'ml', displayUnit: 'gal' });
    expect(parseContentText('12 ct', 'size', 'us').content).toMatchObject({ unit: 'unit', amount: 12 });
  });

  it('calcula precio por onza y por onza líquida', () => {
    expect(computeUnitPrice(3.99, parseContentText('16 oz', 'size', 'us').content, 'us')).toEqual({ value: 0.2494, per: 'oz' });
    expect(computeUnitPrice(4.29, parseContentText('64 fl oz', 'size', 'us').content, 'us')).toEqual({ value: 0.067, per: 'fl_oz' });
  });

  it('en el sistema métrico "oz" sigue siendo ambiguo', () => {
    expect(parseContentText('16 oz', 'name', 'metric').content).toBeNull();
  });
});

describe('contentDiffers', () => {
  it('detecta contenidos distintos para el mismo código de barras', () => {
    const a = parseContentText('946 ml', 'name').content;
    const b = parseContentText('1lt.', 'property').content;
    expect(contentDiffers(a, b)).toBe(true);
    expect(contentDiffers(b, parseContentText('1000 ml', 'name').content)).toBe(false);
  });
});

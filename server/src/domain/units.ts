import type { BaseUnit, DisplayUnit, ParsedContent, UnitPrice, UnitSystem } from './types.js';

/**
 * Interpretación de presentaciones ("946 ml", "Caja 12 Unidades - 12 L", "400gr.", "64 fl oz").
 * Regla general: si el texto es ambiguo no se calcula precio por unidad.
 * En el sistema métrico "oz" sin "fl" puede ser peso o volumen y no se usa; en
 * tiendas de EE. UU. "oz" es onza de peso y "fl oz" de volumen.
 */

interface UnitDef {
  base: BaseUnit;
  factor: number;
  unit: DisplayUnit;
}

const OZ_WEIGHT: UnitDef = { base: 'g', factor: 28.349523125, unit: 'oz' };

const UNIT_DEFS: Array<{ pattern: RegExp; def: UnitDef | 'oz' }> = [
  { pattern: /^(kilogramos?|kilos?|kgs?|kilograms?)$/, def: { base: 'g', factor: 1000, unit: 'kg' } },
  { pattern: /^(gramos?|grs?|g|grams?)$/, def: { base: 'g', factor: 1, unit: 'g' } },
  { pattern: /^mg$/, def: { base: 'g', factor: 0.001, unit: 'mg' } },
  { pattern: /^(libras?|lbs?|pounds?)$/, def: { base: 'g', factor: 453.59237, unit: 'lb' } },
  { pattern: /^(litros?|lts?|ltr|l|liters?|litres?)$/, def: { base: 'ml', factor: 1000, unit: 'L' } },
  { pattern: /^(mililitros?|mls?|cc|milliliters?)$/, def: { base: 'ml', factor: 1, unit: 'ml' } },
  { pattern: /^(fl\.?\s*oz|onzas?\s+liquidas?|fluid\s+ounces?)$/, def: { base: 'ml', factor: 29.5735295625, unit: 'fl oz' } },
  { pattern: /^(galon(es)?|gal|gallons?)$/, def: { base: 'ml', factor: 3785.411784, unit: 'gal' } },
  { pattern: /^(qt|quarts?)$/, def: { base: 'ml', factor: 946.352946, unit: 'qt' } },
  { pattern: /^(pt|pints?)$/, def: { base: 'ml', factor: 473.176473, unit: 'pt' } },
  { pattern: /^(unidades|unidad|unds?|uds?|ud|un|u|piezas?|pzas?|ct|count)$/, def: { base: 'unit', factor: 1, unit: 'unit' } },
  { pattern: /^(onzas?|oz|ounces?)$/, def: 'oz' },
];

const UNIT_ALTERNATION =
  'kilogramos?|kilograms?|kilos?|kgs?|gramos?|grams?|grs?|g|mg|libras?|lbs?|pounds?|litros?|liters?|litres?|lts?|ltr|l|mililitros?|milliliters?|mls?|cc|fl\\.?\\s*oz|fluid\\s+ounces?|onzas?\\s+liquidas?|onzas?|ounces?|oz|galon(?:es)?|gallons?|gal|quarts?|qt|pints?|pt|unidades|unidad|unds?|uds?|ud|un|u|piezas?|pzas?|ct|count';

const QTY_UNIT_RE = new RegExp(`(?<![\\p{L}\\d.,])(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_ALTERNATION})(?![\\p{L}])\\.?`, 'giu');
const MULTI_RE = new RegExp(
  `(?<![\\p{L}\\d])(\\d+)\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_ALTERNATION})(?![\\p{L}])`,
  'iu',
);
const PACK_RE = /(?<![\p{L}\d])(\d+)\s*(?:-\s*)?(pack|paquetes?|pk|unidades|uds?|unds?|piezas?)(?![\p{L}])/iu;
const MEASURE_ALTERNATION =
  'kilogramos?|kilograms?|kilos?|kgs?|gramos?|grams?|grs?|g|mg|libras?|lbs?|pounds?|litros?|liters?|litres?|lts?|ltr|l|mililitros?|milliliters?|mls?|cc|fl\\.?\\s*oz|onzas?|ounces?|oz|galon(?:es)?|gallons?|gal|quarts?|qt|pints?|pt';
const PACK_PREFIX_RE = new RegExp(`(?:pack|paquete|caja|fardo|six\\s*pack)\\s*(?:de|of)?\\s*(\\d+)(?![\\d.,])(?!\\s*(?:${MEASURE_ALTERNATION})(?![\\p{L}]))`, 'iu');
const RANGE_BEFORE_RE = /\d+\s*(a|to)\s*$/iu;

export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function toNumber(raw: string): number {
  // "1,250" (separador de miles) frente a "1,5" (coma decimal).
  if (/^\d{1,3},\d{3}$/.test(raw)) return Number(raw.replace(',', ''));
  return Number(raw.replace(',', '.'));
}

function resolveUnit(token: string, system: UnitSystem): UnitDef | null | undefined {
  const normalized = stripAccents(token.toLowerCase()).replace(/\s+/g, ' ').trim();
  for (const entry of UNIT_DEFS) {
    if (!entry.pattern.test(normalized)) continue;
    if (entry.def === 'oz') return system === 'us' ? OZ_WEIGHT : null;
    return entry.def;
  }
  return undefined;
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

function neutralText(amount: number, unit: DisplayUnit): string | null {
  return unit === 'unit' ? null : `${formatNumber(amount)} ${unit}`;
}

interface QtyMatch {
  qty: number;
  def: UnitDef | null;
  index: number;
}

function findQuantities(text: string, system: UnitSystem): QtyMatch[] {
  const matches: QtyMatch[] = [];
  const normalized = stripAccents(text);
  QTY_UNIT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QTY_UNIT_RE.exec(normalized)) !== null) {
    const qty = toNumber(m[1] ?? '');
    const def = resolveUnit(m[2] ?? '', system);
    if (def === undefined || !Number.isFinite(qty) || qty <= 0) continue;
    // "5 a 7 unidades aproximadamente" es un rango, no un contenido.
    if (def?.base === 'unit' && RANGE_BEFORE_RE.test(normalized.slice(0, m.index))) continue;
    matches.push({ qty, def, index: m.index });
  }
  return matches;
}

function detectPackCount(text: string): number | null {
  const normalized = stripAccents(text);
  const prefix = PACK_PREFIX_RE.exec(normalized);
  if (prefix?.[1]) {
    const n = Number(prefix[1]);
    if (n >= 2) return n;
  }
  const suffix = PACK_RE.exec(normalized);
  if (suffix?.[1] && suffix[2] && /pack|paquete|pk/i.test(suffix[2])) {
    const n = Number(suffix[1]);
    if (n >= 2) return n;
  }
  return null;
}

export interface ContentParseResult {
  content: ParsedContent | null;
  /** Presentación sin palabras traducibles, o texto de la fuente que no se pudo interpretar (ej. "32 oz"). */
  presentation: string | null;
}

/**
 * Analiza un texto (nombre, propiedad o tamaño) y devuelve el contenido.
 * `totalKnown` es falso cuando hay un número de piezas y no se sabe si la
 * cantidad es por pieza o total (ej. "6 Pack - 946ml").
 */
export function parseContentText(text: string | null | undefined, source: ParsedContent['source'], system: UnitSystem = 'metric'): ContentParseResult {
  if (!text || !text.trim()) return { content: null, presentation: null };

  const normalized = stripAccents(text);
  const multi = MULTI_RE.exec(normalized);
  if (multi) {
    const count = Number(multi[1]);
    const qty = toNumber(multi[2] ?? '');
    const def = resolveUnit(multi[3] ?? '', system);
    if (def && count >= 1 && qty > 0) {
      return {
        content: {
          amount: count * qty * def.factor,
          unit: def.base,
          displayAmount: qty,
          displayUnit: def.unit,
          packCount: count,
          multiplied: true,
          source,
          totalKnown: true,
        },
        presentation: def.unit === 'unit' ? null : `${count} x ${formatNumber(qty)} ${def.unit}`,
      };
    }
  }

  const found = findQuantities(text, system);
  if (found.length === 0) return { content: null, presentation: null };

  // Se prefiere peso o volumen sobre conteo ("Caja 12 Unidades - 12 L"); entre iguales, el último.
  const measures = found.filter((f) => f.def !== null && f.def.base !== 'unit');
  const ambiguousOz = found.filter((f) => f.def === null);
  const counts = found.filter((f) => f.def?.base === 'unit');
  const chosen = measures.at(-1) ?? counts.at(-1) ?? null;

  if (!chosen || !chosen.def) {
    const oz = ambiguousOz.at(-1);
    return { content: null, presentation: oz ? `${formatNumber(oz.qty)} oz` : null };
  }

  const def = chosen.def;
  let packCount = detectPackCount(text);
  if (def.base !== 'unit' && packCount === null) {
    const countBefore = counts.find((c) => c.index < chosen.index && c.qty >= 2);
    if (countBefore) packCount = countBefore.qty;
  }
  if (def.base === 'unit') packCount = null;
  const totalKnown = def.base === 'unit' || packCount === null;

  return {
    content: {
      amount: chosen.qty * def.factor,
      unit: def.base,
      displayAmount: chosen.qty,
      displayUnit: def.unit,
      packCount,
      multiplied: false,
      source,
      totalKnown,
    },
    presentation: neutralText(chosen.qty, def.unit),
  };
}

const MEASUREMENT_UNITS: Record<string, UnitDef> = {
  kg: { base: 'g', factor: 1000, unit: 'kg' },
  g: { base: 'g', factor: 1, unit: 'g' },
  lb: { base: 'g', factor: 453.59237, unit: 'lb' },
  l: { base: 'ml', factor: 1000, unit: 'L' },
  ml: { base: 'ml', factor: 1, unit: 'ml' },
};

/** Contenido a partir de measurementUnit/unitMultiplier de VTEX (productos vendidos por peso o volumen). */
export function parseMeasurementUnit(measurementUnit: string | null | undefined, unitMultiplier: number | null | undefined): ContentParseResult {
  const def = measurementUnit ? MEASUREMENT_UNITS[measurementUnit.trim().toLowerCase()] : undefined;
  if (!def) return { content: null, presentation: null };
  const multiplier = typeof unitMultiplier === 'number' && unitMultiplier > 0 ? unitMultiplier : 1;
  return {
    content: {
      amount: multiplier * def.factor,
      unit: def.base,
      displayAmount: multiplier,
      displayUnit: def.unit,
      packCount: null,
      multiplied: false,
      source: 'measurementUnit',
      totalKnown: true,
    },
    presentation: neutralText(multiplier, def.unit),
  };
}

/**
 * Precio por unidad de comparación. Sistema métrico: kg, litro o unidad.
 * EE. UU.: onza de peso, onza líquida o unidad. Devuelve null si el precio o el contenido no son confiables.
 */
export function computeUnitPrice(price: number | null, content: ParsedContent | null, system: UnitSystem = 'metric'): UnitPrice | null {
  if (price === null || !Number.isFinite(price) || price <= 0) return null;
  if (!content || !content.totalKnown || !(content.amount > 0)) return null;
  switch (content.unit) {
    case 'g':
      return system === 'us'
        ? { value: round4(price / (content.amount / OZ_WEIGHT.factor)), per: 'oz' }
        : { value: round4(price / (content.amount / 1000)), per: 'kg' };
    case 'ml':
      return system === 'us'
        ? { value: round4(price / (content.amount / 29.5735295625)), per: 'fl_oz' }
        : { value: round4(price / (content.amount / 1000)), per: 'L' };
    case 'unit':
      return content.amount >= 2 ? { value: round4(price / content.amount), per: 'unit' } : null;
  }
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Diferencia relativa entre dos contenidos de la misma unidad base. */
export function contentDiffers(a: ParsedContent | null, b: ParsedContent | null, tolerance = 0.02): boolean {
  if (!a || !b) return false;
  if (a.unit !== b.unit) return true;
  const max = Math.max(a.amount, b.amount);
  return max > 0 && Math.abs(a.amount - b.amount) / max > tolerance;
}

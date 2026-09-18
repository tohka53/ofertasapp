import type { BaseUnit, ParsedContent } from '../models/api.models';
import { normalizeText } from './format';

/** Presentación deseada escrita por el usuario ("1 litro", "400 g", "30 huevos", "1 gal", "16 fl oz"). */
export interface DesiredPresentation {
  amount: number;
  unit: BaseUnit;
}

const UNITS: Array<[RegExp, BaseUnit, number]> = [
  [/^(kg|kgs|kilo|kilos|kilogramos?|kilograms?)$/, 'g', 1000],
  [/^(g|gr|grs|gramos?|grams?)$/, 'g', 1],
  [/^(lb|lbs|libras?|pounds?)$/, 'g', 453.59237],
  [/^(oz|onzas?|ounces?)$/, 'g', 28.349523125],
  [/^(l|lt|lts|litros?|liters?|litres?)$/, 'ml', 1000],
  [/^(ml|mililitros?|milliliters?|cc)$/, 'ml', 1],
  [/^floz$/, 'ml', 29.5735295625],
  [/^(gal|galon|galones|gallons?)$/, 'ml', 3785.411784],
  [/^(qt|quarts?)$/, 'ml', 946.352946],
  [/^(pt|pints?)$/, 'ml', 473.176473],
  [/^(u|un|und|uds?|unidades?|units?|huevos?|eggs?|piezas?|pieces?|ct|count)$/, 'unit', 1],
];

export function parseDesiredPresentation(text: string | null | undefined): DesiredPresentation | null {
  if (!text) return null;
  const normalized = normalizeText(text).replace(/(?<![a-z])fl\.?\s*oz(?![a-z])|onzas? liquidas?|fluid ounces?/g, 'floz');
  const match = /(\d+(?:[.,]\d+)?)\s*([a-z]+)/.exec(normalized);
  if (!match) return null;
  const amount = Number(match[1]!.replace(',', '.'));
  const token = match[2]!;
  for (const [pattern, unit, factor] of UNITS) {
    if (pattern.test(token) && amount > 0) return { amount: amount * factor, unit };
  }
  return null;
}

export function matchesPresentation(content: ParsedContent | null, desired: DesiredPresentation | null, tolerance = 0.02): boolean {
  if (!content || !desired || !content.totalKnown || content.unit !== desired.unit) return false;
  return Math.abs(content.amount - desired.amount) / Math.max(content.amount, desired.amount) <= tolerance;
}

/** Texto neutral para guardar como presentación deseada al añadir una oferta ("946 ml", "3 x 110 g", "12 u"). */
export function neutralPresentation(content: ParsedContent | null, presentation: string | null): string | null {
  if (presentation) return presentation;
  if (content?.displayUnit === 'unit') return `${content.multiplied && content.packCount ? content.packCount * content.displayAmount : content.displayAmount} u`;
  return null;
}

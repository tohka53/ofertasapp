import { intlLocale, translate } from '../i18n/translate';
import type { Lang, ParsedContent, UnitPrice, UnitPriceBasis } from '../models/api.models';

const SYMBOLS: Record<string, string> = { GTQ: 'Q', USD: '$', HNL: 'L', CRC: '₡', NIO: 'C$', BZD: 'BZ$' };

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? currency;
}

function groupThousands(fixed: string): string {
  const [int = '0', dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? grouped : `${grouped}.${dec}`;
}

/** "Q 1,234.50" o "$3.49". Nunca convierte un precio ausente en cero. */
export function formatMoney(amount: number | null | undefined, currency = 'GTQ', decimals = 2): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return null;
  const factor = 10 ** decimals;
  const fixed = (Math.round(amount * factor) / factor).toFixed(decimals);
  const symbol = currencySymbol(currency);
  return symbol === '$' ? `$${groupThousands(fixed)}` : `${symbol} ${groupThousands(fixed)}`;
}

export function formatCents(cents: number, currency = 'GTQ'): string {
  return formatMoney(cents / 100, currency)!;
}

export function unitName(per: UnitPriceBasis, lang: Lang = 'es'): string {
  return translate(lang, `unit.name.${per}`);
}

/** "Q 19.98 por litro", "$0.047 per fl oz". Las onzas usan 3 decimales cuando el valor es menor que 1. */
export function unitPriceLabel(unitPrice: UnitPrice | null | undefined, currency = 'GTQ', lang: Lang = 'es'): string | null {
  if (!unitPrice) return null;
  const decimals = (unitPrice.per === 'oz' || unitPrice.per === 'fl_oz') && unitPrice.value < 1 ? 3 : 2;
  return translate(lang, 'unit.pricePer', { price: formatMoney(unitPrice.value, currency, decimals), unit: unitName(unitPrice.per, lang) });
}

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

function cachedFormat(key: string, create: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  let format = dateTimeFormats.get(key);
  if (!format) {
    format = create();
    dateTimeFormats.set(key, format);
  }
  return format;
}

export function formatDateTime(iso: string | null | undefined, lang: Lang = 'es'): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return cachedFormat(`dt:${lang}`, () => new Intl.DateTimeFormat(intlLocale(lang), { dateStyle: 'short', timeStyle: 'short' })).format(date);
}

/** Fecha de calendario ("2026-09-16") sin desplazamiento por zona horaria. */
export function formatDate(isoDate: string | null | undefined, lang: Lang = 'es'): string | null {
  if (!isoDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return cachedFormat(`d:${lang}`, () => new Intl.DateTimeFormat(intlLocale(lang), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })).format(date);
}

export function monthName(month: number, lang: Lang = 'es'): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) return '';
  const date = new Date(Date.UTC(2026, month - 1, 15));
  return cachedFormat(`m:${lang}`, () => new Intl.DateTimeFormat(intlLocale(lang), { month: 'long', timeZone: 'UTC' })).format(date);
}

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAmount(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * Presentación en el idioma activo: "946 ml", "3 x 110 g", "12 unidades", "2 L · 6 piezas".
 * Si la fuente no se pudo interpretar, se muestra su texto original.
 */
export function presentationLabel(content: ParsedContent | null | undefined, fallback: string | null | undefined, lang: Lang = 'es'): string | null {
  if (!content) return fallback?.trim() || null;
  const amount = formatAmount(content.displayAmount);
  if (content.multiplied) {
    const each = content.displayUnit === 'unit' ? translate(lang, 'unit.units', { count: content.displayAmount }) : `${amount} ${content.displayUnit}`;
    return `${content.packCount ?? 1} x ${each}`;
  }
  if (content.displayUnit === 'unit') return translate(lang, 'unit.units', { count: content.displayAmount });
  const base = `${amount} ${content.displayUnit}`;
  return content.packCount ? `${base} · ${translate(lang, 'unit.pieces', { count: content.packCount })}` : base;
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

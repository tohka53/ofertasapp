import type { Lang } from '../models/api.models';

export type MessageParams = Record<string, string | number | null | undefined>;

const pluralRules: Record<Lang, Intl.PluralRules> = {
  es: new Intl.PluralRules('es'),
  en: new Intl.PluralRules('en'),
};

/**
 * Subconjunto de ICU MessageFormat:
 * - `{name}` inserta un parámetro.
 * - `{count, plural, =0 {…} one {# …} other {# …}}` elige por cantidad (`#` es la cantidad).
 * - `{value, select, a {…} other {…}}` elige por valor (`undefined` cuando falta el parámetro).
 */
export function formatMessage(template: string, params: MessageParams | undefined, lang: Lang): string {
  let out = '';
  let index = 0;
  while (index < template.length) {
    const char = template[index]!;
    if (char !== '{') {
      out += char;
      index++;
      continue;
    }
    const end = closingBrace(template, index);
    if (end === -1) {
      out += template.slice(index);
      break;
    }
    out += placeholder(template.slice(index + 1, end), params ?? {}, lang);
    index = end + 1;
  }
  return out;
}

function closingBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function placeholder(inner: string, params: MessageParams, lang: Lang): string {
  const firstComma = inner.indexOf(',');
  if (firstComma === -1) {
    const value = params[inner.trim()];
    return value === null || value === undefined ? '' : String(value);
  }
  const name = inner.slice(0, firstComma).trim();
  const rest = inner.slice(firstComma + 1);
  const secondComma = rest.indexOf(',');
  if (secondComma === -1) return '';
  const type = rest.slice(0, secondComma).trim();
  const options = parseOptions(rest.slice(secondComma + 1));
  const value = params[name];

  if (type === 'plural') {
    const count = Number(value ?? 0);
    const branch = options.get(`=${count}`) ?? options.get(pluralRules[lang].select(count)) ?? options.get('other') ?? '';
    return formatMessage(replaceHash(branch, String(count)), params, lang);
  }
  if (type === 'select') {
    const key = value === null || value === undefined || value === '' ? 'undefined' : String(value);
    return formatMessage(options.get(key) ?? options.get('other') ?? '', params, lang);
  }
  return '';
}

/** Reemplaza `#` solo en el primer nivel de la rama (no dentro de placeholders anidados). */
function replaceHash(branch: string, count: string): string {
  let depth = 0;
  let out = '';
  for (const char of branch) {
    if (char === '{') depth++;
    if (char === '}') depth--;
    out += char === '#' && depth === 0 ? count : char;
  }
  return out;
}

function parseOptions(body: string): Map<string, string> {
  const options = new Map<string, string>();
  let index = 0;
  while (index < body.length) {
    while (index < body.length && /\s/.test(body[index]!)) index++;
    const open = body.indexOf('{', index);
    if (open === -1) break;
    const key = body.slice(index, open).trim();
    const end = closingBrace(body, open);
    if (end === -1) break;
    options.set(key, body.slice(open + 1, end));
    index = end + 1;
  }
  return options;
}

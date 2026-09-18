/**
 * Normalización de códigos de barras (GTIN-8/12/13/14).
 * Solo se usan para comparar entre tiendas los códigos con dígito verificador
 * válido y de circulación global (se excluyen los de uso interno o peso variable).
 */

export function isValidGtinChecksum(digits: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return false;
  const body = digits.slice(0, -1);
  const check = Number(digits.at(-1));
  let sum = 0;
  for (let i = body.length - 1, pos = 0; i >= 0; i--, pos++) {
    const n = Number(body[i]);
    sum += pos % 2 === 0 ? n * 3 : n;
  }
  return (10 - (sum % 10)) % 10 === check;
}

/** Devuelve el GTIN-14 normalizado o null si no sirve para comparar entre tiendas. */
export function normalizeGtin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!isValidGtinChecksum(digits)) return null;

  const gtin14 = digits.padStart(14, '0');
  const gtin13 = gtin14.slice(1);

  if (digits.length !== 8) {
    // Prefijos GS1 de circulación restringida (uso interno / peso variable): 20-29 en GTIN-13,
    // y sistemas numéricos 2 y 4 en UPC-A (GTIN-13 con prefijo 02 o 04).
    if (gtin13.startsWith('2') || gtin13.startsWith('02') || gtin13.startsWith('04')) return null;
    // Demasiados ceros a la izquierda suele indicar un código interno de la tienda.
    if (/^0{6,}/.test(gtin13)) return null;
  }
  if (/^0+$/.test(gtin14)) return null;
  return gtin14;
}

/** Variantes de texto del código para buscarlo en catálogos que lo guardan con o sin ceros. */
export function gtinSearchVariants(gtin14: string): string[] {
  const variants = new Set<string>();
  const gtin13 = gtin14.slice(1);
  variants.add(gtin13);
  if (gtin13.startsWith('0')) variants.add(gtin13.slice(1));
  return [...variants];
}

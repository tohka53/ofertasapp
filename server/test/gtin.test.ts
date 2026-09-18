import { describe, expect, it } from 'vitest';
import { gtinSearchVariants, isValidGtinChecksum, normalizeGtin } from '../src/domain/gtin.js';

describe('GTIN', () => {
  it('valida dígitos verificadores reales publicados por las tiendas', () => {
    for (const ean of ['7441001698644', '7441078217731', '7404003090373', '0064992750190', '7401002902676']) {
      expect(isValidGtinChecksum(ean)).toBe(true);
    }
    expect(isValidGtinChecksum('7441001698645')).toBe(false);
  });

  it('normaliza a GTIN-14 y equipara códigos con o sin ceros', () => {
    expect(normalizeGtin('7441001698644')).toBe('07441001698644');
    expect(normalizeGtin('0064992750190')).toBe(normalizeGtin('064992750190'));
  });

  it('descarta códigos de uso interno o inválidos', () => {
    expect(normalizeGtin('0000000061490')).toBeNull();
    expect(isValidGtinChecksum('2000000012346')).toBe(true);
    expect(normalizeGtin('2000000012346')).toBeNull();
    expect(isValidGtinChecksum('0000000061490')).toBe(true);
    expect(normalizeGtin('abc')).toBeNull();
    expect(normalizeGtin(null)).toBeNull();
  });

  it('genera variantes de búsqueda', () => {
    expect(gtinSearchVariants('00064992750190')).toEqual(['0064992750190', '064992750190']);
    expect(gtinSearchVariants('07441001698644')).toEqual(['7441001698644']);
  });
});

import { locationLabel } from '../logic/location';
import { promotionText } from '../logic/promotions';
import { promotion } from '../logic/test-data';
import { defaultListName } from '../services/lists.service';
import { formatMessage } from './format-message';
import { EN } from './messages.en';
import { ES, type MessageKey } from './messages.es';
import { translate, translateMessage } from './translate';

function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return i;
  }
  return text.length;
}

function collect(template: string, names: Set<string>): Set<string> {
  for (let i = template.indexOf('{'); i !== -1; i = template.indexOf('{', i)) {
    const end = closing(template, i);
    const inner = template.slice(i + 1, end);
    const comma = inner.indexOf(',');
    if (comma === -1) {
      names.add(inner.trim());
    } else {
      names.add(inner.slice(0, comma).trim());
      const body = inner.slice(inner.indexOf(',', comma + 1) + 1);
      for (let j = body.indexOf('{'); j !== -1; j = body.indexOf('{', j)) {
        const branchEnd = closing(body, j);
        collect(body.slice(j + 1, branchEnd), names);
        j = branchEnd + 1;
      }
    }
    i = end + 1;
  }
  return names;
}

function placeholders(template: string): string[] {
  return [...collect(template, new Set())].sort();
}

describe('traducciones', () => {
  it('el diccionario en inglés tiene las mismas claves y parámetros que el español', () => {
    const keys = Object.keys(ES) as MessageKey[];
    expect(Object.keys(EN).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(EN[key].trim(), key).not.toBe('');
      expect(placeholders(EN[key]), key).toEqual(placeholders(ES[key]));
    }
  });

  it('aplica plurales, selección y parámetros', () => {
    expect(formatMessage('{n, plural, one {# tienda} other {# tiendas}}', { n: 1 }, 'es')).toBe('1 tienda');
    expect(formatMessage('{n, plural, one {# tienda} other {# tiendas}}', { n: 0 }, 'es')).toBe('0 tiendas');
    expect(formatMessage('{n, plural, =0 {ninguna} other {# de {total}}}', { n: 0, total: 3 }, 'es')).toBe('ninguna');
    expect(formatMessage('{n, plural, =0 {ninguna} other {# de {total}}}', { n: 2, total: 3 }, 'es')).toBe('2 de 3');
    expect(formatMessage('Sin respuesta{s, select, undefined {} other { ({s} s)}}', {}, 'es')).toBe('Sin respuesta');
    expect(formatMessage('Sin respuesta{s, select, undefined {} other { ({s} s)}}', { s: 8 }, 'es')).toBe('Sin respuesta (8 s)');
    expect(translate('es', 'queryStatus.responded', { responded: 3, queried: 3 })).toBe('Respondieron 3 de 3 tiendas consultadas');
    expect(translate('es', 'queryStatus.responded', { responded: 1, queried: 1 })).toBe('Respondió 1 de 1 tienda consultada');
    expect(translate('en', 'queryStatus.responded', { responded: 2, queried: 3 })).toBe('2 of 3 stores queried responded');
    expect(translate('es', 'selector.count', { selected: 5, queryable: 3, links: 2, total: 9 })).toBe('5 seleccionadas · 3 disponibles para consultar y 2 con enlace de 9 registradas');
    expect(translate('es', 'selector.count', { selected: 1, queryable: 1, links: 0, total: 1 })).toBe('1 seleccionada · 1 disponible para consultar de 1 registrada');
  });

  it('traduce los mensajes con código del servidor y avisa de códigos desconocidos', () => {
    expect(translateMessage('es', { code: 'no_branch', params: { store: 'Paiz' } })).toBe('Paiz no asignó una sucursal para esta ubicación.');
    expect(translateMessage('en', { code: 'no_branch', params: { store: 'Paiz' } })).toBe('Paiz did not assign a branch for this location.');
    expect(translateMessage('es', { code: 'upstream_http', params: { status: 500 } })).toBe('La fuente respondió HTTP 500');
    expect(translateMessage('en', { code: 'refresh.msg.not_found' })).toBe('The store no longer shows this product; the previous offer is kept');
    expect(translateMessage('es', { code: 'algo_nuevo' })).toBe('Error del servidor (algo_nuevo)');
    expect(translateMessage('es', null)).toBe('');
  });

  it('arma los textos de promociones estructuradas en ambos idiomas', () => {
    const multiBuy = promotion({ kind: 'multi_buy', minQuantity: 2, promoUnitPrice: 6, totalPrice: 12, validFrom: '2026-07-22', validTo: '2026-10-06' });
    expect(promotionText(multiBuy, 'GTQ', 'Walmart Guatemala', 'es')).toEqual({
      label: '2 x Q 12.00',
      conditions: 'Comprando 2 unidades o más, Q 6.00 c/u · vigente del 22/07/2026 al 06/10/2026 según la tienda',
    });
    expect(promotionText(multiBuy, 'GTQ', 'Walmart Guatemala', 'en')).toEqual({
      label: '2 x Q 12.00',
      conditions: 'When buying 2 or more, Q 6.00 each · valid from 07/22/2026 to 10/06/2026 according to the store',
    });
    expect(promotionText(promotion({ kind: 'price_drop', source: 'list_price', previousPrice: 15 }), 'USD', 'Tienda', 'en').label).toBe('Was $15.00');
    expect(promotionText(promotion({ kind: 'free_item', minQuantity: 3, payQuantity: 2 }), 'GTQ', 'Tienda', 'es')).toEqual({ label: '3 x 2', conditions: 'Lleva 3 y paga 2' });
    expect(promotionText(promotion({ kind: 'store_highlight', source: 'cluster_highlight', raw: '2do a mitad de precio' }), 'GTQ', 'La Torre', 'en')).toEqual({
      label: '2do a mitad de precio',
      conditions: 'Conditions set by La Torre; the discount is not included in the price shown and is confirmed in the cart',
    });
    expect(promotionText(promotion({ kind: 'unknown' }), 'GTQ', 'Tienda', 'es')).toEqual({ label: 'Promoción de la tienda', conditions: 'La fuente no publica las condiciones en el catálogo' });
  });

  it('nombra ubicaciones y listas en el idioma activo', () => {
    const base = { department: null, name: null, postalCode: null, lat: null, lng: null, isDefault: false };
    expect(locationLabel({ ...base, mode: 'zone', department: 'Guatemala', name: 'Guatemala Zona 1', postalCode: '01001', isDefault: true }, 'en')).toBe('Guatemala Zona 1 (01001)');
    expect(locationLabel({ ...base, mode: 'postalCode', postalCode: '13001' }, 'es')).toBe('Código postal 13001');
    expect(locationLabel({ ...base, mode: 'zip', postalCode: '45202' }, 'en')).toBe('ZIP code 45202');
    expect(locationLabel({ ...base, mode: 'city', name: 'San José', lat: 9.9281, lng: -84.0907 }, 'es')).toBe('San José');
    expect(locationLabel({ ...base, mode: 'gps', lat: 14.63491, lng: -90.50689 }, 'en')).toBe('GPS location (14.6349, -90.5069)');
    expect(locationLabel(null, 'es')).toBe('Sin ubicación');
    expect(defaultListName(9, 'es')).toBe('Compras de septiembre');
    expect(defaultListName(9, 'en')).toBe('September shopping');
  });
});

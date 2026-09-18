/**
 * Verificación en vivo de las integraciones (requiere acceso a Internet).
 * Uso: npm run verify:stores -- [término] [códigoPostal] [país] [estado]
 * Ejemplos:
 *   npm run verify:stores -- leche 01001
 *   npm run verify:stores -- arroz "" CR
 *   npm run verify:stores -- milk 45202 US OH   (requiere KROGER_CLIENT_ID y KROGER_CLIENT_SECRET)
 *
 * Consulta las tiendas reales con los mismos conectores del servidor y muestra:
 * estado por tienda, ubicación aplicada, primeras ofertas y coincidencias por
 * código de barras entre tiendas. No guarda nada.
 */
import { findCountry, isQueryable, storesForCountry } from '../src/catalog/catalog.js';
import { CITY_PRESETS } from '../src/catalog/locations.js';
import { loadConfig } from '../src/config/env.js';
import { ConnectorRegistry } from '../src/connectors/registry.js';
import { formatMoney } from '../src/domain/money.js';
import type { AppMessage, LocationInput, NormalizedOffer } from '../src/domain/types.js';
import { HttpClient } from '../src/http/http-client.js';
import { SearchService } from '../src/services/search.service.js';

const term = process.argv[2] || 'leche';
const countryCode = (process.argv[4] || 'GT').toUpperCase();
const postalCode = process.argv[3] || (countryCode === 'GT' ? '01001' : '');
const state = process.argv[5]?.toUpperCase() || null;

const country = findCountry(countryCode);
if (!country) {
  console.error(`País no soportado: ${countryCode}`);
  process.exit(1);
}

const config = { ...loadConfig(), httpCacheTtlMs: 0 };
const http = new HttpClient({ userAgent: config.userAgent, cacheTtlMs: 0, maxConcurrentPerHost: config.maxConcurrentPerHost });
const registry = new ConnectorRegistry(config, http);
const search = new SearchService(registry, config);

const stores = storesForCountry(country.code, state).filter((s) => isQueryable(s) || s.integration.kind === 'link');
const capital = CITY_PRESETS[country.code]?.[0];
const location: LocationInput | null = postalCode
  ? { postalCode, label: postalCode, lat: null, lng: null }
  : capital
    ? { postalCode: null, label: capital.name, lat: capital.lat, lng: capital.lng }
    : null;

const TEXT: Record<string, (p: Record<string, string | number>) => string> = {
  no_results: () => 'Sin resultados',
  link_only: () => 'Solo enlace a su sitio (no se consulta)',
  integration_pending: () => 'Integración pendiente',
  credentials_missing: (p) => `Faltan credenciales: ${p['vars']}`,
  legacy_fallback: () => 'Se usó la API de catálogo de respaldo (sin ubicación)',
  price_varies_no_location: (p) => `${p['store']} cambia precios según la ubicación; consulta sin ubicación`,
  availability_needs_location: (p) => `${p['store']} necesita ubicación para mostrar existencias`,
  geo_not_supported: (p) => `${p['store']} no acepta coordenadas GPS`,
  postal_not_supported: (p) => `${p['store']} no acepta código postal`,
  no_branch: (p) => `${p['store']} no asignó sucursal`,
  no_branch_price_zero: (p) => `${p['store']} no asignó sucursal; los productos pueden llegar sin precio`,
  location_failed: (p) => `No se pudo aplicar la ubicación en ${p['store']}`,
  zip_needed_for_prices: (p) => `${p['store']} necesita un código ZIP para devolver precios`,
  zip_required: (p) => `${p['store']} necesita un código ZIP`,
  offers_query_required: (p) => `${p['store']} necesita un término de búsqueda`,
  upstream_timeout: () => 'Sin respuesta a tiempo',
  upstream_network: (p) => `No se pudo conectar con la fuente (${p['detail']})`,
  upstream_http: (p) => `La fuente respondió HTTP ${p['status']}`,
  upstream_rejected: (p) => `La consulta fue rechazada (HTTP ${p['status']})`,
  upstream_unauthorized: () => 'Credenciales rechazadas (HTTP 401)',
  upstream_invalid_json: () => 'La fuente no devolvió JSON',
};

function text(msg: AppMessage | null): string {
  if (!msg) return '';
  return TEXT[msg.code]?.(msg.params ?? {}) ?? `${msg.code}${msg.params ? ' ' + JSON.stringify(msg.params) : ''}`;
}

console.log(`\nComparAhorro · verificación en vivo · ${new Date().toISOString()}`);
console.log(`Término: "${term}" · País: ${country.code}${state ? ` · Estado: ${state}` : ''} · Ubicación: ${location?.label ?? 'sin ubicación'}\n`);

const controller = new AbortController();
const response = await search.search({ countryCode: country.code, query: term, storeIds: stores.map((s) => s.id), location, signal: controller.signal });

for (const store of response.stores) {
  const branch = store.location ? ` · sucursal: ${store.location.assignedStores.join(', ') || 'sin asignar'}` : '';
  console.log(`[${store.status.toUpperCase()}] ${store.storeName} · ${store.resultCount} resultados · ${store.durationMs} ms${branch}`);
  if (store.message) console.log(`   ${text(store.message)}`);
  for (const warning of store.warnings) console.log(`   aviso: ${text(warning)}`);
  for (const offer of response.offers.filter((o) => o.storeId === store.storeId).slice(0, 3)) console.log(`   - ${describe(offer)}`);
}

const byGtin = new Map<string, NormalizedOffer[]>();
for (const offer of response.offers) {
  if (!offer.gtin || offer.price === null) continue;
  byGtin.set(offer.gtin, [...(byGtin.get(offer.gtin) ?? []), offer]);
}
const shared = [...byGtin.entries()].filter(([, offers]) => new Set(offers.map((o) => o.storeId)).size >= 2);
console.log(`\nMismo código de barras en 2 o más tiendas: ${shared.length}`);
for (const [gtin, offers] of shared.slice(0, 10)) {
  console.log(`  GTIN ${gtin}`);
  for (const offer of [...offers].sort((a, b) => a.price! - b.price!)) console.log(`   · ${offer.storeName}: ${describe(offer)}`);
}

const queried = response.stores.filter((s) => s.status !== 'pending');
const ok = queried.filter((s) => s.status === 'ok' && s.resultCount > 0).length;
console.log(`\nTiendas con resultados reales: ${ok} de ${queried.length} consultadas.`);
process.exit(ok >= 1 ? 0 : 1);

function describe(offer: NormalizedOffer): string {
  const price = offer.price === null ? 'precio no disponible' : formatMoney(offer.price, country!.currencySymbol);
  const unit = offer.unitPrice ? ` (${formatMoney(offer.unitPrice.value, country!.currencySymbol)}/${offer.unitPrice.per})` : '';
  const promos = offer.promotions.map((p) => p.kind).join(', ');
  return `${offer.name} · ${offer.presentation ?? 'presentación no disponible'} · ${price}${unit}${promos ? ` · promociones: ${promos}` : ''} · ${offer.url}`;
}

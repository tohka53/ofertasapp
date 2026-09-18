import type { KrogerBanner, LocalizedText, PendingIntegration, PendingReasonCode, StoreDefinition } from './catalog.types.js';
import { allStatesExcept, US_STATE_CODES } from './locations.js';

/**
 * Directorio de cadenas de supermercados de EE. UU. por estado (verificado el 2026-09-16).
 * Solo la familia Kroger tiene una API oficial de autoservicio con precio por tienda;
 * se habilita con credenciales propias en el servidor.
 */

const VERIFIED = '2026-09-16';
const UNKNOWN_PLATFORM: LocalizedText = { es: 'No determinada', en: 'Not determined' };

const REASONS: Record<PendingReasonCode, LocalizedText> = {
  no_public_api: {
    es: 'No se encontró una API pública oficial para consultar sus precios.',
    en: 'No official public API for its prices was found.',
  },
  no_online_catalog: {
    es: 'No se encontró una tienda en línea con catálogo y precios públicos.',
    en: 'No online store with a public catalog and prices was found.',
  },
  private_api: {
    es: 'Su tienda en línea usa una API privada sin documentación ni términos para terceros.',
    en: 'Its online store uses a private API with no documentation or third-party terms.',
  },
  requires_approval: {
    es: 'La API oficial requiere que la cadena apruebe el acceso.',
    en: 'The official API requires approval from the retailer.',
  },
  not_evaluated: {
    es: 'Cadena registrada en el directorio; su integración aún no se ha evaluado.',
    en: 'Chain listed in the directory; its integration has not been evaluated yet.',
  },
};

const HOW_TO_ENABLE: LocalizedText = {
  es: 'Solicitar a la cadena acceso autorizado (API o archivo de datos), crear un conector en server/src/connectors y configurar sus credenciales como variables de entorno del servidor.',
  en: 'Request authorized access (API or data file) from the retailer, add a connector in server/src/connectors and configure its credentials as server environment variables.',
};

function pending(reasonCode: PendingReasonCode, evidence: LocalizedText[] = [], howToEnable: LocalizedText = HOW_TO_ENABLE): PendingIntegration {
  return { kind: 'pending', reasonCode, reason: REASONS[reasonCode], howToEnable, evidence, verifiedAt: VERIFIED };
}

function chain(id: string, name: string, operator: string, website: string, states: string[], integration: PendingIntegration, sources: string[], notes: LocalizedText[] = []): StoreDefinition {
  return {
    id,
    countryCode: 'US',
    name,
    operator,
    website,
    platform: UNKNOWN_PLATFORM,
    states: [...states].sort(),
    integration,
    knownConditions: [],
    notes,
    sources,
  };
}

const ALBERTSONS_EVIDENCE: LocalizedText[] = [
  {
    es: 'Las APIs conocidas de Albertsons Companies son de publicidad (retail media) y requieren un acuerdo comercial.',
    en: 'The known Albertsons Companies APIs are for retail media advertising and require a commercial agreement.',
  },
];

const AHOLD_EVIDENCE: LocalizedText[] = [
  { es: 'No se encontró una API pública de Ahold Delhaize USA para sus marcas.', en: 'No public Ahold Delhaize USA API was found for its banners.' },
];

export const KROGER_BANNERS: KrogerBanner[] = [
  { name: 'Kroger', states: ['AL', 'AR', 'GA', 'IL', 'IN', 'KY', 'LA', 'MI', 'MO', 'MS', 'OH', 'SC', 'TN', 'TX', 'VA', 'WV'] },
  { name: 'Ralphs', states: ['CA'] },
  { name: 'Fred Meyer', states: ['AK', 'ID', 'OR', 'WA'] },
  { name: 'King Soopers', states: ['CO', 'WY'] },
  { name: 'City Market', states: ['CO', 'UT', 'WY'] },
  { name: "Smith's", states: ['AZ', 'ID', 'MT', 'NM', 'NV', 'UT', 'WY'] },
  { name: "Fry's", states: ['AZ'] },
  { name: 'QFC', states: ['OR', 'WA'] },
  { name: 'Harris Teeter', states: ['DC', 'DE', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA'] },
  { name: 'Dillons', states: ['KS'] },
  { name: 'Food 4 Less', states: ['CA', 'IL', 'IN'] },
  { name: "Mariano's", states: ['IL'] },
  { name: "Pick 'n Save", states: ['WI'] },
  { name: 'Metro Market', states: ['WI'] },
  { name: "Baker's", states: ['NE'] },
  { name: 'Gerbes', states: ['MO'] },
  { name: 'Jay C', states: ['IN'] },
  { name: 'Pay Less', states: ['IN'] },
];

const KROGER_STATES = [...new Set(KROGER_BANNERS.flatMap((b) => b.states))].sort();

export const US_STORES: StoreDefinition[] = [
  {
    id: 'kroger-us',
    countryCode: 'US',
    name: 'Kroger',
    operator: 'The Kroger Co.',
    website: 'https://www.kroger.com/',
    platform: { es: 'API oficial de Kroger (Locations y Products)', en: 'Official Kroger API (Locations and Products)' },
    states: KROGER_STATES,
    integration: {
      kind: 'kroger',
      banners: KROGER_BANNERS,
      docsUrl: 'https://developer.kroger.com/',
      note: {
        es: 'Requiere un código ZIP para ubicar la tienda más cercana: la API solo devuelve precios por tienda. Implementada según la documentación pública; no se probó en vivo porque requiere credenciales propias.',
        en: 'Requires a ZIP code to find the nearest store: the API only returns prices per store. Implemented from the public documentation; not tested live because it requires your own credentials.',
      },
      verifiedAt: VERIFIED,
    },
    knownConditions: [],
    notes: [],
    sources: ['https://developer.kroger.com/', 'https://www.kroger.com/stores/grocery'],
  },
  chain(
    'walmart-us',
    'Walmart',
    'Walmart Inc.',
    'https://www.walmart.com/',
    US_STATE_CODES,
    pending('requires_approval', [
      {
        es: 'La API de afiliados de Walmart (walmart.io) exige solicitud aprobada, llave RSA y firma por petición; los precios por tienda requieren una aprobación adicional.',
        en: 'The Walmart Affiliate API (walmart.io) requires an approved application, an RSA key and a signature per request; store-level prices need additional approval.',
      },
    ]),
    ['https://corporate.walmart.com/about/location-facts/united-states', 'https://walmart.io/apidocs/affiliates/introduction'],
  ),
  chain('target-us', 'Target', 'Target Corporation', 'https://www.target.com/', US_STATE_CODES, pending('no_public_api'), ['https://corporate.target.com/about/locations']),
  chain(
    'costco-us',
    'Costco',
    'Costco Wholesale',
    'https://www.costco.com/',
    allStatesExcept(['DC', 'RI', 'WV', 'WY']),
    pending('no_public_api'),
    ['https://en.wikipedia.org/wiki/Costco'],
    [{ es: 'Lista de estados con confianza media (fuentes de 2025).', en: 'State list with medium confidence (2025 sources).' }],
  ),
  chain(
    'sams-club-us',
    "Sam's Club",
    'Walmart Inc.',
    'https://www.samsclub.com/',
    allStatesExcept(['AK', 'DC', 'MA', 'OR', 'RI', 'VT', 'WA']),
    pending('not_evaluated'),
    ['https://www.storelocators.com/store-lists/sams_club'],
  ),
  chain('safeway-us', 'Safeway', 'Albertsons Companies', 'https://www.safeway.com/', ['AK', 'AZ', 'CA', 'CO', 'DC', 'DE', 'HI', 'ID', 'MD', 'MT', 'NE', 'NM', 'NV', 'OR', 'SD', 'VA', 'WA', 'WY'], pending('no_public_api', ALBERTSONS_EVIDENCE), ['https://local.safeway.com/safeway.html']),
  chain('albertsons-us', 'Albertsons', 'Albertsons Companies', 'https://www.albertsons.com/', ['AR', 'AZ', 'CA', 'CO', 'ID', 'LA', 'MT', 'ND', 'NM', 'NV', 'OK', 'OR', 'TX', 'UT', 'WA', 'WY'], pending('no_public_api', ALBERTSONS_EVIDENCE), ['https://local.albertsons.com/']),
  chain('vons-us', 'Vons', 'Albertsons Companies', 'https://www.vons.com/', ['CA', 'NV'], pending('no_public_api', ALBERTSONS_EVIDENCE), ['https://local.vons.com/']),
  chain('pavilions-us', 'Pavilions', 'Albertsons Companies', 'https://www.pavilions.com/', ['CA'], pending('no_public_api', ALBERTSONS_EVIDENCE), ['https://local.pavilions.com/']),
  chain('jewel-osco-us', 'Jewel-Osco', 'Albertsons Companies', 'https://www.jewelosco.com/', ['IA', 'IL', 'IN'], pending('no_public_api', ALBERTSONS_EVIDENCE), ['https://local.jewelosco.com/']),
  chain('shaws-us', "Shaw's", 'Albertsons Companies', 'https://www.shaws.com/', ['MA', 'ME', 'NH', 'RI', 'VT'], pending('no_public_api', ALBERTSONS_EVIDENCE), ['https://local.shaws.com/']),
  chain('acme-us', 'Acme Markets', 'Albertsons Companies', 'https://www.acmemarkets.com/', ['CT', 'DE', 'MD', 'NJ', 'NY', 'PA'], pending('no_public_api', ALBERTSONS_EVIDENCE), ['https://local.acmemarkets.com/']),
  chain('tom-thumb-us', 'Tom Thumb', 'Albertsons Companies', 'https://www.tomthumb.com/', ['TX'], pending('no_public_api', ALBERTSONS_EVIDENCE), ['https://local.tomthumb.com/']),
  chain('randalls-us', 'Randalls', 'Albertsons Companies', 'https://www.randalls.com/', ['TX'], pending('no_public_api', ALBERTSONS_EVIDENCE), ['https://local.randalls.com/']),
  chain('food-lion-us', 'Food Lion', 'Ahold Delhaize USA', 'https://www.foodlion.com/', ['DE', 'GA', 'KY', 'MD', 'NC', 'PA', 'SC', 'TN', 'VA', 'WV'], pending('no_public_api', AHOLD_EVIDENCE), ['https://en.wikipedia.org/wiki/Food_Lion']),
  chain('giant-food-us', 'Giant Food', 'Ahold Delhaize USA', 'https://giantfood.com/', ['DC', 'DE', 'MD', 'VA'], pending('no_public_api', AHOLD_EVIDENCE), ['https://en.wikipedia.org/wiki/Giant_Food_(Landover)']),
  chain('the-giant-company-us', 'The Giant Company', 'Ahold Delhaize USA', 'https://giantfoodstores.com/', ['MD', 'PA', 'VA', 'WV'], pending('no_public_api', AHOLD_EVIDENCE), ['https://en.wikipedia.org/wiki/The_Giant_Company']),
  chain('stop-and-shop-us', 'Stop & Shop', 'Ahold Delhaize USA', 'https://stopandshop.com/', ['CT', 'MA', 'NJ', 'NY', 'RI'], pending('no_public_api', AHOLD_EVIDENCE), ['https://stores.stopandshop.com/']),
  chain('hannaford-us', 'Hannaford', 'Ahold Delhaize USA', 'https://www.hannaford.com/', ['MA', 'ME', 'NH', 'NY', 'VT'], pending('no_public_api', AHOLD_EVIDENCE), ['https://stores.hannaford.com/']),
  chain('publix-us', 'Publix', 'Publix Super Markets', 'https://www.publix.com/', ['AL', 'FL', 'GA', 'KY', 'NC', 'SC', 'TN', 'VA'], pending('no_public_api'), ['https://en.wikipedia.org/wiki/Publix']),
  chain('heb-us', 'H-E-B', 'H.E. Butt Grocery Company', 'https://www.heb.com/', ['TX'], pending('no_public_api'), ['https://en.wikipedia.org/wiki/H-E-B']),
  chain(
    'aldi-us',
    'Aldi',
    'ALDI US',
    'https://www.aldi.us/',
    allStatesExcept(['AK', 'CO', 'HI', 'ID', 'MT', 'NM', 'OR', 'UT', 'WA', 'WY']),
    pending('no_public_api', [
      { es: 'Su tienda en línea funciona con la plataforma de Instacart.', en: 'Its online store runs on the Instacart platform.' },
    ]),
    ['https://www.storelocators.com/store-lists/aldi', 'https://www.prnewswire.com/news-releases/aldi-us-debuts-new-nationwide-digital-experience-using-instacarts-enterprise-technology-302727604.html'],
  ),
  chain("trader-joes-us", "Trader Joe's", "Trader Joe's", 'https://www.traderjoes.com/', allStatesExcept(['AK', 'HI', 'MS', 'MT', 'ND', 'SD', 'WV', 'WY']), pending('not_evaluated'), ['https://locations.traderjoes.com/']),
  chain(
    'whole-foods-us',
    'Whole Foods Market',
    'Amazon',
    'https://www.wholefoodsmarket.com/',
    allStatesExcept(['AK', 'DE', 'ND', 'SD', 'VT', 'WV']),
    pending('no_public_api', [
      {
        es: 'La API de Amazon para afiliados exige ventas calificadas y no ofrece precios por tienda.',
        en: "Amazon's affiliate API requires qualified sales and does not provide store-level prices.",
      },
    ]),
    ['https://www.mashed.com/2241086/states-without-whole-foods-locations-us/', 'https://affiliate-program.amazon.com/creatorsapi/docs'],
    [{ es: 'Lista de estados con confianza media.', en: 'State list with medium confidence.' }],
  ),
  chain('meijer-us', 'Meijer', 'Meijer', 'https://www.meijer.com/', ['IL', 'IN', 'KY', 'MI', 'OH', 'WI'], pending('no_public_api'), ['https://en.wikipedia.org/wiki/Meijer']),
  chain(
    'wegmans-us',
    'Wegmans',
    'Wegmans Food Markets',
    'https://www.wegmans.com/',
    ['CT', 'DC', 'DE', 'MA', 'MD', 'NC', 'NJ', 'NY', 'PA', 'VA'],
    pending('not_evaluated', [
      { es: 'Existe un portal de desarrolladores (dev.wegmans.io); el acceso público no está confirmado.', en: 'A developer portal exists (dev.wegmans.io); public access is not confirmed.' },
    ]),
    ['https://en.wikipedia.org/wiki/Wegmans', 'https://dev.wegmans.io/'],
  ),
  chain('hy-vee-us', 'Hy-Vee', 'Hy-Vee', 'https://www.hy-vee.com/', ['IA', 'IL', 'KS', 'MN', 'MO', 'NE', 'SD', 'WI'], pending('no_public_api'), ['https://www.hy-vee.com/stores/']),
  chain('giant-eagle-us', 'Giant Eagle', 'Giant Eagle', 'https://www.gianteagle.com/', ['IN', 'MD', 'OH', 'PA', 'WV'], pending('not_evaluated'), ['https://en.wikipedia.org/wiki/Giant_Eagle']),
  chain('winco-us', 'WinCo Foods', 'WinCo Foods', 'https://www.wincofoods.com/', ['AZ', 'CA', 'ID', 'MT', 'NV', 'OK', 'OR', 'TX', 'UT', 'WA'], pending('not_evaluated'), ['https://en.wikipedia.org/wiki/WinCo_Foods']),
  chain(
    'sprouts-us',
    'Sprouts Farmers Market',
    'Sprouts Farmers Market',
    'https://www.sprouts.com/',
    ['AL', 'AZ', 'CA', 'CO', 'DE', 'FL', 'GA', 'KS', 'LA', 'MD', 'MO', 'NC', 'NJ', 'NM', 'NV', 'NY', 'OK', 'PA', 'SC', 'TN', 'TX', 'UT', 'VA', 'WA', 'WY'],
    pending('not_evaluated'),
    ['https://www.sprouts.com/stores/'],
  ),
  chain('winn-dixie-us', 'Winn-Dixie', 'The Winn-Dixie Co.', 'https://www.winndixie.com/', ['FL', 'GA'], pending('not_evaluated'), ['https://en.wikipedia.org/wiki/Winn-Dixie']),
  chain('lidl-us', 'Lidl', 'Lidl US', 'https://www.lidl.com/', ['DC', 'DE', 'GA', 'MD', 'NC', 'NJ', 'NY', 'PA', 'SC', 'VA'], pending('not_evaluated'), ['https://mediacenter.lidl.com/pressreleases/2026/lidl-us-opening-a-fresh-new-grocery-store-in-falls-church-virginia']),
];

import type {
  CountryDefinition,
  KnownCondition,
  LinkIntegration,
  LocalizedText,
  PendingIntegration,
  PendingReasonCode,
  StoreDefinition,
  VtexIntegration,
  VtexLocationConfig,
} from './catalog.types.js';
import { US_STORES } from './stores-us.js';

/**
 * Catálogo configurable de países y tiendas.
 * Para agregar un país: añadirlo a COUNTRIES. Para agregar una tienda: añadir una
 * entrada a STORES con su integración (VTEX verificada, Kroger, enlace o pendiente).
 */

export const COUNTRIES: CountryDefinition[] = [
  { code: 'GT', name: { es: 'Guatemala', en: 'Guatemala' }, currency: 'GTQ', currencySymbol: 'Q', locale: 'es-GT', flag: '🇬🇹', unitSystem: 'metric', regionKind: 'none', locationMode: 'gt-zones' },
  // { code: 'BZ', name: { es: 'Belice', en: 'Belize' }, currency: 'BZD', currencySymbol: 'BZ$', locale: 'en-BZ', flag: '🇧🇿', unitSystem: 'metric', regionKind: 'none', locationMode: 'none' },
  // { code: 'SV', name: { es: 'El Salvador', en: 'El Salvador' }, currency: 'USD', currencySymbol: '$', locale: 'es-SV', flag: '🇸🇻', unitSystem: 'metric', regionKind: 'none', locationMode: 'cities' },
  // { code: 'HN', name: { es: 'Honduras', en: 'Honduras' }, currency: 'HNL', currencySymbol: 'L', locale: 'es-HN', flag: '🇭🇳', unitSystem: 'metric', regionKind: 'none', locationMode: 'cities' },
  // { code: 'NI', name: { es: 'Nicaragua', en: 'Nicaragua' }, currency: 'NIO', currencySymbol: 'C$', locale: 'es-NI', flag: '🇳🇮', unitSystem: 'metric', regionKind: 'none', locationMode: 'cities' },
  // { code: 'CR', name: { es: 'Costa Rica', en: 'Costa Rica' }, currency: 'CRC', currencySymbol: '₡', locale: 'es-CR', flag: '🇨🇷', unitSystem: 'metric', regionKind: 'none', locationMode: 'cities' },
  // { code: 'PA', name: { es: 'Panamá', en: 'Panama' }, currency: 'USD', currencySymbol: '$', locale: 'es-PA', flag: '🇵🇦', unitSystem: 'metric', regionKind: 'none', locationMode: 'cities' },
  // { code: 'US', name: { es: 'Estados Unidos', en: 'United States' }, currency: 'USD', currencySymbol: '$', locale: 'en-US', flag: '🇺🇸', unitSystem: 'us', regionKind: 'state', locationMode: 'us-zip' },
];

const VERIFIED = '2026-09-16';
const WALMART_CA = 'https://corporate.walmart.com/about/international/markets/central-america';
const PRICESMART_INVESTORS = 'https://investors.pricesmart.com/investor-overview/default.aspx';
const PRICESMART_10K = 'https://www.sec.gov/Archives/edgar/data/1041803/000104180325000060/psmt-20250831.htm';
const WALMART_PROPERTIES = ['Tamaño (Gramaje, Volumen)', 'Contenido Neto', 'Medida de peso'];

const NO_LOCATION: VtexLocationConfig = {
  supportsPostalCode: false,
  supportsGeoCoordinates: false,
  priceVariesByLocation: false,
  availabilityRequiresLocation: false,
  branchSellerIdPattern: null,
  branchNamePrefixToStrip: null,
  note: {
    es: 'Verificado el 16/09/2026: la búsqueda pública devuelve precios sin ubicación y las coordenadas de la capital no asignaron sucursal, por eso se consulta sin ubicación.',
    en: 'Verified on 09/16/2026: the public search returns prices without a location and the capital city coordinates did not assign a branch, so it is queried without a location.',
  },
};

function vtex(config: {
  baseUrl: string;
  salesChannel: number;
  countryIso3: string;
  locale: string;
  location?: VtexLocationConfig;
  teaserConvention?: 'walmart-ca' | null;
  clusterHighlightPattern?: string | null;
  offersClusterIds?: string[];
  contentProperties?: string[];
}): VtexIntegration {
  return {
    kind: 'vtex',
    baseUrl: config.baseUrl,
    salesChannel: config.salesChannel,
    countryIso3: config.countryIso3,
    locale: config.locale,
    location: config.location ?? NO_LOCATION,
    promotions: { teaserConvention: config.teaserConvention ?? null, clusterHighlightPattern: config.clusterHighlightPattern ?? null },
    offersClusterIds: config.offersClusterIds ?? [],
    contentProperties: config.contentProperties ?? WALMART_PROPERTIES,
    verifiedAt: VERIFIED,
  };
}

function vtexPlatform(account: string, channel: number): LocalizedText {
  return { es: `VTEX (cuenta ${account}, canal ${channel})`, en: `VTEX (account ${account}, channel ${channel})` };
}

const PENDING_REASON: Record<PendingReasonCode, LocalizedText> = {
  no_public_api: {
    es: 'No se encontró una API pública documentada para consultar sus precios.',
    en: 'No documented public API for its prices was found.',
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
    es: 'Tienda registrada en el directorio; su integración aún no se ha evaluado.',
    en: 'Store listed in the directory; its integration has not been evaluated yet.',
  },
};

const HOW_TO_ENABLE: LocalizedText = {
  es: 'Solicitar a la cadena acceso autorizado (API o archivo de datos), crear un conector en server/src/connectors y configurar sus credenciales como variables de entorno del servidor.',
  en: 'Request authorized access (API or data file) from the retailer, add a connector in server/src/connectors and configure its credentials as server environment variables.',
};

export function pending(reasonCode: PendingReasonCode, evidence: LocalizedText[] = [], howToEnable: LocalizedText = HOW_TO_ENABLE): PendingIntegration {
  return { kind: 'pending', reasonCode, reason: PENDING_REASON[reasonCode], howToEnable, evidence, verifiedAt: VERIFIED };
}

const UNKNOWN_PLATFORM: LocalizedText = { es: 'No determinada', en: 'Not determined' };

function priceSmart(countryCode: string, clubs: number, searchUrlTemplate: string | null): StoreDefinition {
  const membership: KnownCondition = {
    kind: 'membership',
    label: { es: 'Compras para miembros (membresía)', en: 'Shopping for members (membership)' },
    amount: null,
    sourceUrl: PRICESMART_10K,
    verifiedAt: VERIFIED,
  };
  const integration: LinkIntegration = {
    kind: 'link',
    searchUrlTemplate,
    reason: {
      es: 'PriceSmart no publica una API y su robots.txt bloquea el acceso automatizado, así que la app no lee su sitio. El enlace abre su búsqueda o su sitio en tu navegador.',
      en: 'PriceSmart has no public API and its robots.txt blocks automated access, so the app does not read its site. The link opens its search or website in your browser.',
    },
    howToEnable: {
      es: 'Solicitar a PriceSmart una licencia de datos o acceso autorizado (Investor Relations: ir@pricesmart.com) y configurarlo con variables de entorno del servidor.',
      en: 'Request a data license or authorized access from PriceSmart (Investor Relations: ir@pricesmart.com) and configure it with server environment variables.',
    },
    evidence: [
      { es: 'Consulta automatizada a pricesmart.com rechazada por robots.txt (16/09/2026).', en: 'Automated request to pricesmart.com refused by robots.txt (09/16/2026).' },
      ...(searchUrlTemplate
        ? [{ es: 'URL de búsqueda comprobada con una captura del sitio de Guatemala (16/09/2026).', en: 'Search URL confirmed with a screenshot of the Guatemala site (09/16/2026).' }]
        : []),
    ],
    verifiedAt: VERIFIED,
  };
  return {
    id: `pricesmart-${countryCode.toLowerCase()}`,
    countryCode,
    name: 'PriceSmart',
    operator: 'PriceSmart, Inc.',
    website: countryCode === 'GT' ? 'https://www.pricesmart.com/es-gt' : 'https://www.pricesmart.com/',
    platform: UNKNOWN_PLATFORM,
    states: null,
    integration,
    knownConditions: [membership],
    notes: [{ es: `${clubs} clubes en el país según PriceSmart.`, en: `${clubs} clubs in the country according to PriceSmart.` }],
    sources: [PRICESMART_INVESTORS, PRICESMART_10K],
  };
}

function directory(
  store: Omit<StoreDefinition, 'states' | 'knownConditions' | 'notes' | 'platform'> & Partial<Pick<StoreDefinition, 'knownConditions' | 'notes' | 'platform'>>,
): StoreDefinition {
  return { states: null, knownConditions: [], notes: [], platform: UNKNOWN_PLATFORM, ...store };
}

function priceSmartConnected(countryCode: string, clubs: number, pathLocale: string): StoreDefinition {
  const base = priceSmart(countryCode, clubs, null);
  return {
    ...base,
    website: `https://www.pricesmart.com/${pathLocale}`,
    platform: { es: 'Bloomreach Discovery', en: 'Bloomreach Discovery' },
    integration: {
      kind: 'pricesmart',
      baseUrl: 'https://www.pricesmart.com',
      viewId: countryCode,
      pathLocale,
      accountId: '7024',
      authKey: 'ev7libhybjg5h1d1',
      domainKey: 'pricesmart_bloomreach_io_es',
      verifiedAt: '2026-09-17',
    },
    sources: [`https://www.pricesmart.com/${pathLocale}/busqueda?q=leche`, ...base.sources],
  };
}

const GUATEMALA: StoreDefinition[] = [
  {
    id: 'walmart-gt',
    countryCode: 'GT',
    name: 'Walmart Guatemala',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.walmart.com.gt/',
    platform: vtexPlatform('walmartgt', 1),
    states: null,
    integration: vtex({
      baseUrl: 'https://www.walmart.com.gt',
      salesChannel: 1,
      countryIso3: 'GTM',
      locale: 'es-GT',
      teaserConvention: 'walmart-ca',
      location: {
        supportsPostalCode: true,
        supportsGeoCoordinates: true,
        priceVariesByLocation: true,
        availabilityRequiresLocation: false,
        branchSellerIdPattern: '^walmartgtwm',
        branchNamePrefixToStrip: null,
        note: {
          es: 'Verificado el 16/09/2026: con código postal 01001 la tienda asigna la sucursal WM-DEL NORTE y cambia precios (Leche Dos Pinos Pinito 1000 ml: Q 19.20 sin ubicación, Q 17.45 con ubicación). En zonas sin sucursal los productos llegan sin precio ni existencias.',
          en: 'Verified on 09/16/2026: with postal code 01001 the store assigns the WM-DEL NORTE branch and prices change (Dos Pinos Pinito milk 1000 ml: Q 19.20 without location, Q 17.45 with location). In zones without a branch, products come without price or stock.',
        },
      },
    }),
    knownConditions: [],
    notes: [{ es: 'Costos de envío no verificados en esta versión.', en: 'Shipping costs not verified in this version.' }],
    sources: ['https://www.walmart.com.gt/', WALMART_CA],
  },
  {
    id: 'paiz-gt',
    countryCode: 'GT',
    name: 'Paiz',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.paiz.com.gt/',
    platform: vtexPlatform('paizgt', 2),
    states: null,
    integration: vtex({
      baseUrl: 'https://www.paiz.com.gt',
      salesChannel: 2,
      countryIso3: 'GTM',
      locale: 'es-GT',
      teaserConvention: 'walmart-ca',
      location: {
        supportsPostalCode: true,
        supportsGeoCoordinates: false,
        priceVariesByLocation: false,
        availabilityRequiresLocation: false,
        branchSellerIdPattern: '^walmartgtsp',
        branchNamePrefixToStrip: null,
        note: {
          es: 'Verificado el 16/09/2026: el código postal 01001 asigna la sucursal PAIZ-ASUNCIÓN sin cambiar precios en la muestra. Las coordenadas GPS no asignaron sucursal.',
          en: 'Verified on 09/16/2026: postal code 01001 assigns the PAIZ-ASUNCIÓN branch without changing prices in the sample. GPS coordinates did not assign a branch.',
        },
      },
    }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.paiz.com.gt/', WALMART_CA],
  },
  {
    id: 'la-torre-gt',
    countryCode: 'GT',
    name: 'La Torre',
    operator: 'Unisuper',
    website: 'https://www.latorre.com.gt/',
    platform: vtexPlatform('latorremx', 1),
    states: null,
    integration: vtex({
      baseUrl: 'https://www.latorre.com.gt',
      salesChannel: 1,
      countryIso3: 'GTM',
      locale: 'es-GT',
      clusterHighlightPattern: 'descuento|oferta|promo|%|2x1|3x2|gratis|rebaja',
      offersClusterIds: ['137', '457'],
      contentProperties: ['Contenido Neto', 'Tamaño (Gramaje, Volumen)'],
      location: {
        supportsPostalCode: true,
        supportsGeoCoordinates: false,
        priceVariesByLocation: false,
        availabilityRequiresLocation: false,
        branchSellerIdPattern: '^latorremx',
        branchNamePrefixToStrip: 'latorremx',
        note: {
          es: 'Verificado el 16/09/2026: el código postal asigna sucursal (01001 → latorrezona2; 01010 → latorre20calle) sin cambiar precios en la muestra. No acepta coordenadas GPS.',
          en: 'Verified on 09/16/2026: the postal code assigns a branch (01001 → latorrezona2; 01010 → latorre20calle) without changing prices in the sample. It does not accept GPS coordinates.',
        },
      },
    }),
    knownConditions: [
      {
        kind: 'minimum_purchase',
        label: { es: 'Delivery programado: compra mínima de Q 350', en: 'Scheduled delivery: minimum purchase of Q 350' },
        amount: 350,
        sourceUrl: 'https://www.latorre.com.gt/leche-uht-descremada-delactomy-11097/p',
        verifiedAt: VERIFIED,
      },
      {
        kind: 'item_limit',
        label: { es: 'Delivery Express: máximo 40 artículos (aprox. 90 minutos)', en: 'Express delivery: up to 40 items (about 90 minutes)' },
        amount: null,
        sourceUrl: 'https://www.latorre.com.gt/leche-uht-descremada-delactomy-11097/p',
        verifiedAt: VERIFIED,
      },
    ],
    notes: [{ es: 'Costo de envío no publicado en las páginas verificadas.', en: 'Shipping cost not published on the verified pages.' }],
    sources: ['https://www.latorre.com.gt/', 'https://www.supermercadoslatorre.com/web/index.php/conocenos'],
  },
  {
    id: 'maxi-despensa-gt',
    countryCode: 'GT',
    name: 'Maxi Despensa',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.maxidespensa.com.gt/',
    platform: vtexPlatform('bodegagt', 3),
    states: null,
    integration: vtex({
      baseUrl: 'https://www.maxidespensa.com.gt',
      salesChannel: 3,
      countryIso3: 'GTM',
      locale: 'es-GT',
      teaserConvention: 'walmart-ca',
      location: {
        supportsPostalCode: true,
        supportsGeoCoordinates: false,
        priceVariesByLocation: false,
        availabilityRequiresLocation: false,
        branchSellerIdPattern: '^walmartgtbo',
        branchNamePrefixToStrip: null,
        note: {
          es: 'Verificado el 16/09/2026: el código postal asigna sucursal (01001 → Md Parroquia) sin cambiar precios en la muestra. No acepta coordenadas GPS.',
          en: 'Verified on 09/16/2026: the postal code assigns a branch (01001 → Md Parroquia) without changing prices in the sample. It does not accept GPS coordinates.',
        },
      },
    }),
    knownConditions: [
      {
        kind: 'shipping_fee',
        label: { es: 'Envío a domicilio: Q 9.95', en: 'Home delivery: Q 9.95' },
        amount: 9.95,
        sourceUrl: 'https://www.maxidespensa.com.gt/como-comprar',
        verifiedAt: VERIFIED,
      },
      {
        kind: 'free_shipping_threshold',
        label: { es: 'Envío gratis en compras mayores a Q 250.00', en: 'Free delivery on orders over Q 250.00' },
        amount: 250,
        sourceUrl: 'https://www.maxidespensa.com.gt/como-comprar',
        verifiedAt: VERIFIED,
      },
      {
        kind: 'pickup',
        label: { es: 'Recoger en tienda: sin costo', en: 'In-store pickup: free' },
        amount: 0,
        sourceUrl: 'https://www.maxidespensa.com.gt/como-comprar',
        verifiedAt: VERIFIED,
      },
      {
        kind: 'coverage',
        label: { es: 'Cobertura a domicilio: 10 km alrededor de las tiendas con servicio', en: 'Delivery coverage: 10 km around stores with the service' },
        amount: null,
        sourceUrl: 'https://www.maxidespensa.com.gt/como-comprar',
        verifiedAt: VERIFIED,
      },
    ],
    notes: [{ es: 'Envío con muebles o electrodomésticos: Q 40 (según la misma página).', en: 'Delivery with furniture or appliances: Q 40 (same page).' }],
    sources: ['https://www.maxidespensa.com.gt/', WALMART_CA],
  },
  priceSmartConnected('GT', 7, 'es-gt'),
  {
    id: 'suma-gt',
    countryCode: 'GT',
    name: 'SUMA',
    operator: 'Grupo de Tiendas Asociadas (GTA)',
    website: 'https://www.suma.com.gt/',
    platform: { es: 'Aplicación web Flutter de GTA', en: 'GTA Flutter web app' },
    states: null,
    integration: {
      kind: 'link',
      searchUrlTemplate: null,
      reason: {
        es: 'La tienda en línea de SUMA carga su catálogo desde una API GraphQL privada de Grupo de Tiendas Asociadas, sin documentación ni términos para terceros. La app no la consulta; el enlace abre su sitio.',
        en: "SUMA's online store loads its catalog from a private GraphQL API of Grupo de Tiendas Asociadas, with no documentation or third-party terms. The app does not query it; the link opens its website.",
      },
      howToEnable: {
        es: 'Solicitar acceso a GTA (gta.com.gt/contactanos.php, teléfono 2462-1200) y configurarlo con variables de entorno del servidor.',
        en: 'Request access from GTA (gta.com.gt/contactanos.php, phone +502 2462-1200) and configure it with server environment variables.',
      },
      evidence: [
        { es: 'Fuente oficial del formato: https://gta.com.gt/fn_suma.php', en: 'Official format page: https://gta.com.gt/fn_suma.php' },
        {
          es: 'suma.com.gt consume services-suma-ecommerce.gta.com.gt/graphql/ (16/09/2026).',
          en: 'suma.com.gt calls services-suma-ecommerce.gta.com.gt/graphql/ (09/16/2026).',
        },
      ],
      verifiedAt: VERIFIED,
    },
    knownConditions: [],
    notes: [],
    sources: ['https://gta.com.gt/fn_suma.php', 'https://gta.com.gt/contactanos.php'],
  },
  directory({
    id: 'despensa-familiar-gt',
    countryCode: 'GT',
    name: 'Despensa Familiar',
    operator: 'Walmart de México y Centroamérica',
    website: null,
    integration: pending('no_online_catalog'),
    sources: [WALMART_CA],
  }),
  directory({
    id: 'mi-super-fresh-gt',
    countryCode: 'GT',
    name: 'Mi Super Fresh',
    operator: 'Grupo de Tiendas Asociadas (GTA)',
    website: 'https://www.misuperfresh.com.gt/',
    integration: pending('not_evaluated'),
    sources: ['https://www.misuperfresh.com.gt/', 'https://gta.com.gt/fn_superdelbarrio.php'],
  }),
  directory({
    id: 'super-del-barrio-gt',
    countryCode: 'GT',
    name: 'Super del Barrio',
    operator: 'Grupo de Tiendas Asociadas (GTA)',
    website: 'https://gta.com.gt/fn_superdelbarrio.php',
    integration: pending('no_online_catalog'),
    sources: ['https://gta.com.gt/fn_superdelbarrio.php'],
  }),
];

const EL_SALVADOR: StoreDefinition[] = [
  {
    id: 'walmart-sv',
    countryCode: 'SV',
    name: 'Walmart El Salvador',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.walmart.com.sv/',
    platform: vtexPlatform('walmartsv', 1),
    states: null,
    integration: vtex({ baseUrl: 'https://www.walmart.com.sv', salesChannel: 1, countryIso3: 'SLV', locale: 'es-SV', teaserConvention: 'walmart-ca' }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.walmart.com.sv/', WALMART_CA],
  },
  {
    id: 'maxi-despensa-sv',
    countryCode: 'SV',
    name: 'Maxi Despensa El Salvador',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.maxidespensa.com.sv/',
    platform: vtexPlatform('bodegasv', 3),
    states: null,
    integration: vtex({ baseUrl: 'https://www.maxidespensa.com.sv', salesChannel: 3, countryIso3: 'SLV', locale: 'es-SV', teaserConvention: 'walmart-ca' }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.maxidespensa.com.sv/', WALMART_CA],
  },
  {
    id: 'despensa-don-juan-sv',
    countryCode: 'SV',
    name: 'La Despensa de Don Juan',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.ladespensadedonjuan.com.sv/',
    platform: vtexPlatform('despensasv', 2),
    states: null,
    integration: vtex({ baseUrl: 'https://www.ladespensadedonjuan.com.sv', salesChannel: 2, countryIso3: 'SLV', locale: 'es-SV', teaserConvention: 'walmart-ca' }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.ladespensadedonjuan.com.sv/', WALMART_CA],
  },
  directory({
    id: 'super-selectos-sv',
    countryCode: 'SV',
    name: 'Súper Selectos',
    operator: 'Grupo Calleja',
    website: 'https://www.superselectos.com/',
    platform: { es: 'Plataforma propia', en: 'Custom platform' },
    integration: pending('not_evaluated', [
      { es: 'Su sitio muestra catálogo con precios desde una plataforma propia.', en: 'Its website shows a catalog with prices from a custom platform.' },
    ]),
    sources: ['https://www.superselectos.com/'],
  }),
  directory({
    id: 'despensa-familiar-sv',
    countryCode: 'SV',
    name: 'Despensa Familiar',
    operator: 'Walmart de México y Centroamérica',
    website: null,
    integration: pending('no_online_catalog'),
    sources: [WALMART_CA],
  }),
  priceSmart('SV', 4, null),
];

const HONDURAS: StoreDefinition[] = [
  {
    id: 'walmart-hn',
    countryCode: 'HN',
    name: 'Walmart Honduras',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.walmart.com.hn/',
    platform: vtexPlatform('walmarthn', 1),
    states: null,
    integration: vtex({ baseUrl: 'https://www.walmart.com.hn', salesChannel: 1, countryIso3: 'HND', locale: 'es-HN', teaserConvention: 'walmart-ca' }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.walmart.com.hn/', WALMART_CA],
  },
  {
    id: 'paiz-hn',
    countryCode: 'HN',
    name: 'Paiz Honduras',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.paiz.com.hn/',
    platform: vtexPlatform('paizhn', 2),
    states: null,
    integration: vtex({ baseUrl: 'https://www.paiz.com.hn', salesChannel: 2, countryIso3: 'HND', locale: 'es-HN', teaserConvention: 'walmart-ca' }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.paiz.com.hn/', WALMART_CA],
  },
  {
    id: 'la-colonia-hn',
    countryCode: 'HN',
    name: 'Supermercados La Colonia',
    operator: 'Supermercados La Colonia (Honduras)',
    website: 'https://www.lacolonia.com/',
    platform: vtexPlatform('lacolonia', 1),
    states: null,
    integration: vtex({
      baseUrl: 'https://www.lacolonia.com',
      salesChannel: 1,
      countryIso3: 'HND',
      locale: 'es-HN',
      location: {
        supportsPostalCode: false,
        supportsGeoCoordinates: true,
        priceVariesByLocation: false,
        availabilityRequiresLocation: true,
        branchSellerIdPattern: '^lacolonia\\d+',
        branchNamePrefixToStrip: null,
        note: {
          es: 'Verificado el 16/09/2026: sin ubicación el catálogo aparece sin existencias; con coordenadas de Tegucigalpa asigna la sucursal lacolonia01 y muestra existencias, con los mismos precios en la muestra.',
          en: 'Verified on 09/16/2026: without a location the catalog shows no stock; with Tegucigalpa coordinates it assigns the lacolonia01 branch and shows stock, with the same prices in the sample.',
        },
      },
    }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.lacolonia.com/', 'https://www.vtex.com/es-mx/casos-de-clientes/supermercados-la-colonia-digitaliza-la-cercania-desde-la-compra-hasta-la-postventa/'],
  },
  directory({
    id: 'maxi-despensa-hn',
    countryCode: 'HN',
    name: 'Maxi Despensa Honduras',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://maxidespensa.com.hn/',
    integration: pending('no_online_catalog', [
      { es: 'Su sitio es informativo; no tiene catálogo con precios.', en: 'Its website is informational; it has no catalog with prices.' },
    ]),
    sources: ['https://maxidespensa.com.hn/', WALMART_CA],
  }),
  directory({
    id: 'despensa-familiar-hn',
    countryCode: 'HN',
    name: 'Despensa Familiar',
    operator: 'Walmart de México y Centroamérica',
    website: null,
    integration: pending('no_online_catalog'),
    sources: [WALMART_CA],
  }),
  directory({
    id: 'supermercados-colonial-hn',
    countryCode: 'HN',
    name: 'Supermercados Colonial',
    operator: null,
    website: 'https://supercolonial.com/',
    platform: { es: 'Shopify', en: 'Shopify' },
    integration: pending('not_evaluated'),
    sources: ['https://supercolonial.com/'],
  }),
  directory({
    id: 'comisariato-los-andes-hn',
    countryCode: 'HN',
    name: 'Comisariato Los Andes',
    operator: null,
    website: 'https://comisariatolosandes.com/',
    integration: pending('not_evaluated'),
    sources: ['https://comisariatolosandes.com/'],
  }),
  priceSmart('HN', 3, null),
];

const NICARAGUA: StoreDefinition[] = [
  {
    id: 'walmart-ni',
    countryCode: 'NI',
    name: 'Walmart Nicaragua',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.walmart.com.ni/',
    platform: vtexPlatform('walmartni', 1),
    states: null,
    integration: vtex({ baseUrl: 'https://www.walmart.com.ni', salesChannel: 1, countryIso3: 'NIC', locale: 'es-NI', teaserConvention: 'walmart-ca' }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.walmart.com.ni/', WALMART_CA],
  },
  {
    id: 'la-union-ni',
    countryCode: 'NI',
    name: 'La Unión',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.launion.com.ni/',
    platform: vtexPlatform('launionni', 2),
    states: null,
    integration: vtex({
      baseUrl: 'https://www.launion.com.ni',
      salesChannel: 2,
      countryIso3: 'NIC',
      locale: 'es-NI',
      teaserConvention: 'walmart-ca',
      location: {
        supportsPostalCode: false,
        supportsGeoCoordinates: true,
        priceVariesByLocation: false,
        availabilityRequiresLocation: false,
        branchSellerIdPattern: '^walmartnisp',
        branchNamePrefixToStrip: null,
        note: {
          es: 'Verificado el 16/09/2026: con coordenadas de Managua asigna la sucursal La Unión Carretera Masaya sin cambiar precios en la muestra.',
          en: 'Verified on 09/16/2026: with Managua coordinates it assigns the La Unión Carretera Masaya branch without changing prices in the sample.',
        },
      },
    }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.launion.com.ni/', WALMART_CA],
  },
  directory({
    id: 'la-colonia-ni',
    countryCode: 'NI',
    name: 'Supermercados La Colonia',
    operator: 'Supermercados La Colonia (Nicaragua)',
    website: 'https://lacolonia.com.ni/',
    platform: { es: 'Plataforma propia (Next.js)', en: 'Custom platform (Next.js)' },
    integration: pending('not_evaluated'),
    sources: ['https://lacolonia.com.ni/'],
  }),
  directory({
    id: 'pali-ni',
    countryCode: 'NI',
    name: 'Palí / Maxi Palí',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://maxipali.com.ni/',
    integration: pending('no_online_catalog', [
      { es: 'Su sitio es informativo; no tiene catálogo con precios.', en: 'Its website is informational; it has no catalog with prices.' },
    ]),
    sources: ['https://maxipali.com.ni/', WALMART_CA],
  }),
  priceSmart('NI', 2, null),
];

const COSTA_RICA: StoreDefinition[] = [
  {
    id: 'walmart-cr',
    countryCode: 'CR',
    name: 'Walmart Costa Rica',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.walmart.co.cr/',
    platform: vtexPlatform('walmartcr', 1),
    states: null,
    integration: vtex({
      baseUrl: 'https://www.walmart.co.cr',
      salesChannel: 1,
      countryIso3: 'CRI',
      locale: 'es-CR',
      teaserConvention: 'walmart-ca',
      location: {
        supportsPostalCode: false,
        supportsGeoCoordinates: true,
        priceVariesByLocation: false,
        availabilityRequiresLocation: false,
        branchSellerIdPattern: '^walmartcrwm',
        branchNamePrefixToStrip: null,
        note: {
          es: 'Verificado el 16/09/2026: con coordenadas de San José asigna la sucursal WM-TIBAS sin cambiar precios en la muestra.',
          en: 'Verified on 09/16/2026: with San José coordinates it assigns the WM-TIBAS branch without changing prices in the sample.',
        },
      },
    }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.walmart.co.cr/', WALMART_CA],
  },
  {
    id: 'masxmenos-cr',
    countryCode: 'CR',
    name: 'Más x Menos',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.masxmenos.cr/',
    platform: vtexPlatform('supermxmcr', 2),
    states: null,
    integration: vtex({
      baseUrl: 'https://www.masxmenos.cr',
      salesChannel: 2,
      countryIso3: 'CRI',
      locale: 'es-CR',
      teaserConvention: 'walmart-ca',
      location: {
        supportsPostalCode: false,
        supportsGeoCoordinates: true,
        priceVariesByLocation: false,
        availabilityRequiresLocation: false,
        branchSellerIdPattern: '^walmartcrsp',
        branchNamePrefixToStrip: null,
        note: {
          es: 'Verificado el 16/09/2026: con coordenadas de San José asigna la sucursal MxM-SABANA sin cambiar precios en la muestra.',
          en: 'Verified on 09/16/2026: with San José coordinates it assigns the MxM-SABANA branch without changing prices in the sample.',
        },
      },
    }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.masxmenos.cr/', WALMART_CA],
  },
  {
    id: 'maxipali-cr',
    countryCode: 'CR',
    name: 'Maxi Palí',
    operator: 'Walmart de México y Centroamérica',
    website: 'https://www.maxipali.co.cr/',
    platform: { es: 'VTEX (canal 3)', en: 'VTEX (channel 3)' },
    states: null,
    integration: vtex({ baseUrl: 'https://www.maxipali.co.cr', salesChannel: 3, countryIso3: 'CRI', locale: 'es-CR', teaserConvention: 'walmart-ca' }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.maxipali.co.cr/', WALMART_CA],
  },
  directory({
    id: 'auto-mercado-cr',
    countryCode: 'CR',
    name: 'Auto Mercado',
    operator: null,
    website: 'https://automercado.cr/',
    integration: pending('not_evaluated'),
    sources: ['https://automercado.cr/'],
  }),
  directory({
    id: 'megasuper-cr',
    countryCode: 'CR',
    name: 'Megasuper',
    operator: 'Corporación Megasuper',
    website: 'https://www.megasuper.com/',
    integration: pending('not_evaluated'),
    sources: ['https://info.megasuper.com/Sucursales.html'],
  }),
  directory({
    id: 'gessa-cr',
    countryCode: 'CR',
    name: 'Perimercados / Super Compro (GESSA)',
    operator: 'GESSA',
    website: 'https://gessa.cr/',
    integration: pending('not_evaluated'),
    sources: ['https://gessa.cr/'],
  }),
  priceSmart('CR', 10, null),
];

const PANAMA: StoreDefinition[] = [
  {
    id: 'super-xtra-pa',
    countryCode: 'PA',
    name: 'Super Xtra',
    operator: null,
    website: 'https://www.superxtra.com/',
    platform: vtexPlatform('superxtrapanama', 1),
    states: null,
    integration: vtex({
      baseUrl: 'https://www.superxtra.com',
      salesChannel: 1,
      countryIso3: 'PAN',
      locale: 'es-PA',
      location: {
        supportsPostalCode: false,
        supportsGeoCoordinates: true,
        priceVariesByLocation: false,
        availabilityRequiresLocation: false,
        branchSellerIdPattern: '^superxtrapanamat',
        branchNamePrefixToStrip: null,
        note: {
          es: 'Verificado el 16/09/2026: con coordenadas de Ciudad de Panamá asigna la sucursal superxtrapanamat023 sin cambiar precios en la muestra.',
          en: 'Verified on 09/16/2026: with Panama City coordinates it assigns the superxtrapanamat023 branch without changing prices in the sample.',
        },
      },
    }),
    knownConditions: [],
    notes: [],
    sources: ['https://www.superxtra.com/'],
  },
  directory({
    id: 'super-99-pa',
    countryCode: 'PA',
    name: 'Super 99',
    operator: null,
    website: 'https://www.super99.com/',
    platform: { es: 'Adobe Commerce (Magento)', en: 'Adobe Commerce (Magento)' },
    integration: pending('not_evaluated'),
    sources: ['https://www.super99.com/'],
  }),
  directory({
    id: 'riba-smith-pa',
    countryCode: 'PA',
    name: 'Riba Smith',
    operator: null,
    website: 'https://www.ribasmith.com/',
    integration: pending('not_evaluated'),
    sources: ['https://www.ribasmith.com/'],
  }),
  directory({
    id: 'supermercados-rey-pa',
    countryCode: 'PA',
    name: 'Supermercados Rey',
    operator: 'Grupo Rey',
    website: 'https://www.smrey.com/',
    integration: pending('not_evaluated'),
    sources: ['https://gruporey.com.pa/supermercados-rey/'],
  }),
  directory({
    id: 'el-machetazo-pa',
    countryCode: 'PA',
    name: 'El Machetazo',
    operator: null,
    website: 'https://www.elmachetazo.com/',
    integration: pending('not_evaluated'),
    sources: ['https://www.elmachetazo.com/'],
  }),
  directory({
    id: 'el-fuerte-pa',
    countryCode: 'PA',
    name: 'El Fuerte',
    operator: 'Grupo Raphael',
    website: 'https://www.elfuerte.com.pa/',
    platform: { es: 'Shopify', en: 'Shopify' },
    integration: pending('not_evaluated'),
    sources: ['https://www.elfuerte.com.pa/'],
  }),
  priceSmart('PA', 7, null),
];

const BELIZE: StoreDefinition[] = [
  directory({
    id: 'brodies-bz',
    countryCode: 'BZ',
    name: "Brodie's",
    operator: 'James Brodie & Co.',
    website: 'https://brodies.bz/',
    integration: pending('no_online_catalog'),
    sources: ['https://brodies.bz/'],
  }),
  directory({
    id: 'save-u-bz',
    countryCode: 'BZ',
    name: 'Save-U Supermarket',
    operator: null,
    website: null,
    integration: pending('no_online_catalog'),
    sources: ['https://www.facebook.com/saveusupermarketbz/'],
  }),
];

// export const STORES: StoreDefinition[] = [...GUATEMALA, ...BELIZE, ...EL_SALVADOR, ...HONDURAS, ...NICARAGUA, ...COSTA_RICA, ...PANAMA, ...US_STORES];
export const STORES: StoreDefinition[] = [...GUATEMALA];

export function findCountry(code: string): CountryDefinition | undefined {
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}

export function storesForCountry(code: string, state: string | null = null): StoreDefinition[] {
  const upper = code.toUpperCase();
  return STORES.filter((s) => s.countryCode === upper && (!state || !s.states || s.states.includes(state.toUpperCase())));
}

export function findStore(id: string): StoreDefinition | undefined {
  return STORES.find((s) => s.id === id);
}

export function isQueryable(store: StoreDefinition): boolean {
  return store.integration.kind === 'vtex' || store.integration.kind === 'kroger' || store.integration.kind === 'pricesmart';
}

# Integraciones de tiendas

Investigación y verificación realizadas el **16/09/2026** desde un navegador real (consultas `fetch` sin cookies a las mismas rutas que usa el conector) y con pruebas automatizadas sobre las respuestas capturadas. Ningún precio, producto o disponibilidad del código se inventa: el servidor consulta las fuentes en cada búsqueda y, si una falla, lo informa.

> **Estado de la verificación en vivo:** las tiendas VTEX de Guatemala y Centroamérica respondieron en vivo con las URLs que genera el servidor, y en Guatemala la app comparó el mismo producto entre tres tiendas (ver [Comparación real verificada](#comparación-real-verificada-entre-fuentes)). **Queda pendiente** ejecutar el servidor Node contra las tiendas desde una red con salida a Internet: en los entornos de prueba disponibles la red bloqueó esas conexiones (ver [Bloqueo](#bloqueo-servidor-node--tiendas)). La API de Kroger no se probó en vivo porque requiere credenciales propias.

## Resumen por país

| País | Consultadas desde el servidor | Solo enlace (sin consulta) | Registradas pendientes | Ubicación |
|---|---|---|---|---|
| Guatemala (GTQ) | Walmart Guatemala, Paiz, La Torre, Maxi Despensa | PriceSmart, SUMA | Despensa Familiar, Mi Super Fresh, Super del Barrio | Departamento y zona, código postal o GPS |
| Belice (BZD) | — | — | Brodie's, Save-U Supermarket | No aplica |
| El Salvador (USD) | Walmart El Salvador, Maxi Despensa El Salvador, La Despensa de Don Juan | PriceSmart | Súper Selectos, Despensa Familiar | Ciudad o GPS |
| Honduras (HNL) | Walmart Honduras, Paiz Honduras, Supermercados La Colonia | PriceSmart | Maxi Despensa Honduras, Despensa Familiar, Supermercados Colonial, Comisariato Los Andes | Ciudad o GPS |
| Nicaragua (NIO) | Walmart Nicaragua, La Unión | PriceSmart | Supermercados La Colonia, Palí / Maxi Palí | Ciudad o GPS |
| Costa Rica (CRC) | Walmart Costa Rica, Más x Menos, Maxi Palí | PriceSmart | Auto Mercado, Megasuper, Perimercados / Super Compro (GESSA) | Ciudad o GPS |
| Panamá (USD) | Super Xtra | PriceSmart | Super 99, Riba Smith, Supermercados Rey, El Machetazo, El Fuerte | Ciudad o GPS |
| Estados Unidos (USD) | Kroger y sus marcas, **solo con credenciales** | — | 31 cadenas y marcas, filtradas por estado | Código ZIP |

- **Consultadas:** el servidor pide los precios en vivo en cada búsqueda.
- **Solo enlace:** la app no lee su sitio; ofrece abrir su búsqueda (si la URL se comprobó) o su sitio, y anotar en la lista el precio que el usuario vea. Ese precio queda marcado como “Precio anotado por vos”, con la fecha, y no se actualiza automáticamente.
- **Pendientes:** aparecen con el motivo y cómo habilitarlas; no se pueden seleccionar.

El estado “Disponible para consultar” / “Temporalmente sin conexión” se calcula en vivo al abrir la selección de tiendas (`GET /api/countries/:code/stores?checkStatus=true`, caché de 60 s).

### Guatemala

| Tienda | Estado de la integración | Plataforma | Mecanismo | ¿Pide ubicación? |
|---|---|---|---|---|
| Walmart Guatemala | Comprobada con datos en vivo¹ | VTEX (`walmartgt`, canal 1) | Intelligent Search + regiones VTEX | **Sí**: el precio cambia según la sucursal asignada |
| Paiz | Rutas comprobadas en vivo¹ | VTEX (`paizgt`, canal 2) | Intelligent Search + regiones VTEX | Opcional (01001 asigna PAIZ-ASUNCIÓN; precio sin cambios en la muestra; GPS no asigna sucursal) |
| La Torre | Comprobada con datos en vivo¹ | VTEX (`latorremx`, canal 1) | Intelligent Search + regiones VTEX | Opcional (asigna sucursal; precio sin cambios en la muestra) |
| Maxi Despensa | Comprobada con datos en vivo¹ | VTEX (`bodegagt`, canal 3) | Intelligent Search + regiones VTEX | Opcional (asigna sucursal; precio sin cambios en la muestra) |
| PriceSmart | Solo enlace a su búsqueda | No determinada | `https://www.pricesmart.com/es-gt/busqueda?q={término}` | — |
| SUMA | Solo enlace a su sitio | App Flutter de GTA | `https://www.suma.com.gt/` | — |

¹ Rutas y respuestas verificadas en vivo desde un navegador y procesadas con el código de la app. Falta ejecutar el servidor Node contra la tienda desde una red con salida a Internet.

## Mecanismo común VTEX (Guatemala y Centroamérica)

Todas son rutas públicas de la plataforma VTEX; no requieren credenciales. En Guatemala, los `robots.txt` de Walmart, La Torre y Maxi Despensa no excluyen `/api/` (Walmart y Maxi excluyen `/account/`, `/login/*`, `/checkout/`…; La Torre además `/busca/*` y `/img/*`). El canal de venta público de cada tienda se tomó de `/api/segments` sin sesión.

1. **Región (opcional)** — `GET {tienda}/api/checkout/pub/regions?country={ISO3}&sc={canal}&postalCode={CP}`
   o, solo si la tienda lo acepta, `&geoCoordinates={lng};{lat}`. Devuelve `id` (regionId) y los vendedores/sucursales de esa zona.
2. **Búsqueda** — `GET {tienda}/api/io/_v/api/intelligent-search/product_search/?query={texto}&page=1&count=24&locale={locale del país}&hideUnavailableItems=false[&regionId=…]`
   - Ofertas: `&sort=discount:desc&hideUnavailableItems=true` y se conservan solo productos con rebaja o promoción.
   - Código de barras: `query={EAN}` y se filtra por GTIN idéntico.
3. **Respaldo** — si Intelligent Search responde 404/400/5xx o no es JSON: `GET {tienda}/api/catalog_system/pub/products/search?ft={texto}&_from=0&_to=23&sc={canal}`. Esta API no aplica región; la app lo advierte.
4. **Actualizar precios** — se vuelve a buscar cada SKU por su EAN (o nombre) con la región vigente, sin microcaché; si no aparece y el precio no depende de la ubicación, `fq=skuId:{id}`.

### Normalización

| Campo de la app | Fuente VTEX |
|---|---|
| Nombre, marca | `productName`, `brand` |
| Variante | `items[].name` cuando difiere del producto; si no, “No disponible” |
| Presentación | nombre (“- 946 ml”), propiedad `Contenido Neto` (La Torre), `Tamaño (Gramaje, Volumen)` o `Medida de peso`; `measurementUnit`/`unitMultiplier` para productos por peso |
| Precio actual | `commertialOffer.Price` **solo si es > 0**; si no, “Precio no disponible” |
| Precio anterior | `ListPrice` solo si es mayor que `Price` |
| Disponibilidad | `AvailableQuantity` (> 0 disponible, 0 sin existencias) |
| Código de barras | `items[].ean`, validado con dígito verificador GS1; se descartan prefijos de uso interno (20–29, 02, 04) |
| Imagen, enlace | `images[0].imageUrl`, `link` absoluto |
| Sucursal o zona | vendedores devueltos por la API de regiones |
| Fecha de consulta | momento real de la respuesta (se conserva aunque venga de la microcaché) |
| Precio por kg / L / unidad | calculado solo con contenido total conocido; en empaques “3 Pack - 2838 ml” o “Caja 12 Unidades - 12 L” la cantidad es ambigua y **no** se calcula; “oz” sin “fl” tampoco (en EE. UU. “oz” es peso y “fl oz” volumen, y el precio se calcula por onza) |

### Promociones

- El servidor devuelve cada promoción como datos (tipo, cantidad mínima, precio total, porcentaje, vigencia y texto original); la app arma el texto en español o inglés.
- **Rebaja**: `ListPrice > Price` → “Antes Q …” / “Was Q …”.
- **Tiendas de Walmart Centroamérica** (`teasers`): el nombre sigue la convención que interpreta su propio sitio (componente `walmartgt.walmart-components`). Verificado en la ficha del producto:
  - Walmart, EAN 7404003090373 (Arroz Albay 400 g, Q 7.15): teaser `Promo,6x2,2026-07-22-2026-10-06-…`, `minimumQuantity: 2`, `MaximumUnitPriceDiscount: 600` → el sitio muestra **“2 x Q12”**; la app muestra “2 x Q 12.00 · comprando 2 unidades o más, Q 6.00 c/u · vigente del 22/07/2026 al 06/10/2026”.
  - Maxi Despensa, EAN 7441078217731 (Leche Suli 1 L, Q 13.00): `Promo,10x2,…`, `MaximumUnitPriceDiscount: 1000` → sitio **“2 x Q20”**.
  - Formatos reconocidos: `Promo,AxB`, `Promo,freeitem,AxB`, `Promo,porcentaje,AxB`, `promocombinaenfijo`, `promocombinaenporcentaje`, `Promo,bundle`, `envio gratis`. Cualquier otro se informa como “Promoción de la tienda” sin inventar montos.
- **La Torre** (`clusterHighlights` curados): por ejemplo “2do a 99% Descuento Exclusivo Online” (se indica que requiere 2 unidades y que el descuento se confirma en el carrito). “Ofertas Publicadas” no se duplica cuando ya hay precio anterior.
- Las promociones **no** se restan del precio ni del total de la lista.

### Walmart Guatemala

- Sitio: https://www.walmart.com.gt/ · VTEX `walmartgt` · canal 1 · moneda GTQ.
- **La ubicación cambia precios.** Verificado con la búsqueda “leche dos pinos”:

  | Producto (EAN) | Sin región | Con CP 01001 (sucursal WM-DEL NORTE) |
  |---|---|---|
  | Leche Dos Pinos Pinito 1000 ml (7441001601118) | Q 19.20 | Q 17.45 |
  | Leche Pinito en polvo 2200 g (7441001612336) | Q 120.24 | Q 129.15 |
  | Leche Dos Pinos Delactomy 946 ml (7441001698644) | Q 20.25 | Q 18.90 |

- Regiones verificadas: 01001 → WM-DEL NORTE; 01010 → WM-PROCERES; 01057 → WM - NARANJO; 01064 → WM-VILLA NUEVA; 03001 y 04001 → WM-SAN CRISTOBAL; 05001 → WM-VILLA NUEVA; 09001 → WM-XELA. Con GPS (`geoCoordinates=-90.513;14.642`) → WM-DEL NORTE.
- En zonas sin sucursal (ej. 13001 Huehuetenango, 16001, 17001, 18001, 20001, 22001) la API solo devuelve un vendedor de marketplace y los productos llegan con `Price: 0` y `AvailableQuantity: 0`; la app los muestra **sin precio** y avisa.
- Por eso la app propone por defecto **Guatemala · Zona 1 (01001)** y permite cambiar departamento/zona, escribir el código postal o usar GPS.
- Los códigos de las 22 cabeceras departamentales (DD001) y del área metropolitana coinciden con el selector de ubicación del sitio.
- Costos de envío: no verificados en esta versión.

### La Torre

- Sitio: https://www.latorre.com.gt/ · VTEX `latorremx` · canal 1 · vendedor “Supermercados La Torre”.
- Presentación en la propiedad `Contenido Neto` (“1lt.”, “400gr.”).
- Región por código postal: 01001 → `latorrezona2`; 01010 → `latorre20calle`. No acepta coordenadas. Con región, precios y cantidad de resultados iguales en la muestra.
- Condiciones publicadas en la ficha de producto: Delivery programado con compra mínima de Q 350; Delivery Express máximo 40 artículos (≈ 90 min). Costo de envío no publicado en las páginas revisadas.

### Maxi Despensa

- Sitio: https://www.maxidespensa.com.gt/ · VTEX `bodegagt` · canal 3 (una petición sin cookies usa el canal 3; `sc=1` responde “sc 1 is not available for account bodegagt”).
- Región por código postal: 01001 → Md Parroquia; 01010 → Md Atanasio Tzul; 09001 → Md Quetzaltenango (más “WM Interior Bodega”). No acepta coordenadas. Precios sin cambios en la muestra.
- Condiciones de https://www.maxidespensa.com.gt/como-comprar: envío a domicilio Q 9.95; gratis en compras mayores a Q 250.00; con muebles o electrodomésticos Q 40; recoger en tienda sin costo; cobertura de 10 km alrededor de tiendas con servicio.
- En vivo (16/09/2026, CP 01001) “Leche Entera Dos Pinos Delactomy - 1000 ml” llegó con `Price: 0` y `AvailableQuantity: 0`: la app lo muestra como “Precio no disponible” y sin existencias, nunca como Q 0.00.

### Paiz (Guatemala)

- Sitio: https://www.paiz.com.gt/ · VTEX `paizgt` · canal 2.
- Región por código postal: 01001 → sucursal PAIZ-ASUNCIÓN, sin cambios de precio en la muestra. Las coordenadas GPS no asignaron sucursal, por eso el conector solo usa código postal.

### Comparación real verificada entre fuentes

Consulta en vivo del **16/09/2026, 16:57 UTC (10:57 hora de Guatemala)**, código postal **01001**, EAN **7441001698644** (Leche Dos Pinos Delactomy descremada):

| Tienda | Sucursal asignada | Presentación publicada | Precio | Precio por litro |
|---|---|---|---|---|
| Maxi Despensa | Md Parroquia | 946 ml | **Q 18.50** | Q 19.56 |
| Walmart Guatemala | WM-DEL NORTE | 946 ml | Q 18.90 (Q 20.25 sin ubicación) | Q 19.98 |
| La Torre | latorrezona2 | 1 L (“1lt.”) | Q 20.65 | Q 20.65 |

Cómo se verificó:

1. El servidor generó las URLs de región y de búsqueda por código de barras (`SearchService.byGtin`, sin red).
2. Esas URLs se ejecutaron en vivo desde un navegador sin cookies (HTTP 200, JSON). Walmart y Maxi Despensa asignaron la misma región que las respuestas capturadas en la mañana; La Torre asignó `latorrezona2`.
3. De cada respuesta se conservaron los campos que usa la normalización y se calculó un SHA-256 en el navegador.
4. El servidor procesó esas respuestas con su código real: pidió exactamente las mismas URLs, las tres tiendas quedaron en “Respondió” y los precios, contenidos y sucursales coinciden con la tabla. La lógica de comparación de Angular (`buildComparison`) formó un grupo por código de barras, marcó que las tiendas reportan contenidos distintos (946 ml y 1 L) e identificó el menor precio por paquete en Maxi Despensa (Q 18.50).

La prueba `server/test/live-capture.test.ts` repite los pasos 3 y 4 con `server/test/fixtures/live-delactomy-2026-09-16.json` y valida el hash. Los precios cambian con el tiempo: esta tabla documenta una consulta puntual, no precios vigentes.

En la búsqueda “leche delactomy” de ese momento (16:52 UTC, CP 01001) también coincidió el EAN 7441001601132 (Delactomy semidescremada 2 %): Maxi Despensa Q 18.50 (946 ml), Walmart Q 18.90 (946 ml) y La Torre Q 20.65 (“1lt.”).

### Bloqueo: servidor Node → tiendas

- Los entornos disponibles para esta entrega (contenedor en la nube y la máquina virtual Linux de la Mac) salen a Internet mediante un proxy con lista de dominios permitidos que **no incluye** los dominios de las tiendas (walmart.com.gt, paiz.com.gt, latorre.com.gt, maxidespensa.com.gt ni los de Centroamérica). Resultado: `fetch failed` en Node y `HTTP 403` del proxy con `curl`.
- En esas condiciones la app hizo lo esperado: marcó cada tienda como “Temporalmente sin conexión”, mostró las pendientes con su motivo y no devolvió ofertas.
- **Falta comprobar** que las tiendas acepten las peticiones del servidor Node (cabecera `User-Agent` propia, sin cookies) desde una red normal. Si alguna las rechaza (HTTP 403/429), la app lo indica como “La consulta fue rechazada”.
- Para cerrarlo, ejecuta en tu equipo, desde la raíz del proyecto:

  ```bash
  npm install
  npm run verify:stores -- "leche delactomy" 01001
  npm run verify:stores -- arroz "" CR
  ```

  El script usa los mismos conectores del servidor, imprime el estado por tienda, la sucursal asignada, las primeras ofertas y las coincidencias por código de barras, y termina con código 1 si ninguna tienda devuelve resultados.

## Centroamérica

Verificación del 16/09/2026 con el mismo mecanismo VTEX: `/api/segments` (canal, moneda y país), búsqueda sin región y búsqueda con las coordenadas de la capital (`/api/checkout/pub/regions?geoCoordinates=…`), comparando precios y existencias.

| País | Tienda | Cuenta y canal | Ubicación verificada |
|---|---|---|---|
| El Salvador | Walmart El Salvador (https://www.walmart.com.sv) | `walmartsv`, canal 1 | Precios sin ubicación; las coordenadas de San Salvador no asignaron sucursal. Se consulta sin ubicación. |
| El Salvador | Maxi Despensa El Salvador (https://www.maxidespensa.com.sv) | `bodegasv`, canal 3 | Igual que Walmart El Salvador. |
| El Salvador | La Despensa de Don Juan (https://www.ladespensadedonjuan.com.sv) | `despensasv`, canal 2 | Igual que Walmart El Salvador. |
| Honduras | Walmart Honduras (https://www.walmart.com.hn) | `walmarthn`, canal 1 | Precios sin ubicación; Tegucigalpa no asignó sucursal. |
| Honduras | Paiz Honduras (https://www.paiz.com.hn) | `paizhn`, canal 2 | Igual que Walmart Honduras. |
| Honduras | Supermercados La Colonia (https://www.lacolonia.com) | `lacolonia`, canal 1 | **Sin ubicación el catálogo aparece sin existencias**; con coordenadas de Tegucigalpa asigna `lacolonia01` y muestra existencias, con los mismos precios. La app pide ubicación y, sin ella, informa la disponibilidad como desconocida. |
| Nicaragua | Walmart Nicaragua (https://www.walmart.com.ni) | `walmartni`, canal 1 | Precios sin ubicación; Managua no asignó sucursal. |
| Nicaragua | La Unión (https://www.launion.com.ni) | `launionni`, canal 2 | Coordenadas de Managua → sucursal La Unión Carretera Masaya, sin cambios de precio. |
| Costa Rica | Walmart Costa Rica (https://www.walmart.co.cr) | `walmartcr`, canal 1 | Coordenadas de San José → WM-TIBAS, sin cambios de precio. |
| Costa Rica | Más x Menos (https://www.masxmenos.cr) | `supermxmcr`, canal 2 | Coordenadas de San José → MxM-SABANA, sin cambios de precio. |
| Costa Rica | Maxi Palí (https://www.maxipali.co.cr) | canal 3 | Precios sin ubicación; San José no asignó sucursal. |
| Panamá | Super Xtra (https://www.superxtra.com) | `superxtrapanama`, canal 1 | Coordenadas de Ciudad de Panamá → `superxtrapanamat023`, sin cambios de precio. |

- En tiendas donde una región sin vendedores devolvía productos con `Price: 0`, el conector consulta sin ubicación en lugar de mostrar precios en cero.
- Para las ciudades se usan coordenadas del centro (San Salvador, Tegucigalpa, Managua, San José, Ciudad de Panamá y otras principales); el GPS del navegador da más precisión.
- Belice: no se encontró una cadena con catálogo en línea y precios públicos.
- Registradas pendientes (sin catálogo en línea o sin evaluar): se listan en la app con su motivo y no se consultan.

## PriceSmart (Guatemala y Centroamérica)

- **Cómo se usa en la app:** al buscar, “Buscar “{término}” en PriceSmart” abre `https://www.pricesmart.com/es-gt/busqueda?q={término}` en tu navegador (la URL de Guatemala se comprobó con una captura del sitio). En El Salvador, Honduras, Nicaragua, Costa Rica y Panamá abre https://www.pricesmart.com/ porque su URL de búsqueda no se comprobó. Con “Anotar precio” guardas en tu lista el precio que viste, con fecha y la marca “Precio anotado por vos”.
- **Por qué no se consulta desde el servidor:** que el sitio muestre precios sin iniciar sesión no autoriza su lectura automatizada. La consulta automatizada a pricesmart.com fue rechazada por su `robots.txt` (16/09/2026) y no hay una API pública documentada, así que la app no extrae sus páginas.
- **Membresía:** PriceSmart vende a miembros; la condición se muestra en el catálogo con su fuente (informe anual 10-K).
- **Para habilitar la consulta:** solicitar a PriceSmart una licencia de datos o acceso autorizado (Investor Relations: ir@pricesmart.com), crear un conector en `server/src/connectors/` y configurar sus credenciales como variables de entorno del servidor. Angular nunca recibe esas credenciales.

## SUMA (Guatemala)

- **Cómo se usa en la app:** “Abrir sitio de SUMA” abre https://www.suma.com.gt/ y “Anotar precio” guarda el precio que veas, marcado como anotado por vos.
- Fuente oficial: formato SUMA de Grupo de Tiendas Asociadas (https://gta.com.gt/fn_suma.php). Su tienda en línea (“SUMA eCommerce”, aplicación Flutter) carga el catálogo desde una API GraphQL privada (`services-suma-ecommerce.gta.com.gt/graphql/`) con imágenes en `sumaclubimages.gta.com.gt`, sin documentación pública ni términos para terceros. No se conectó sin autorización.
- **Para habilitar la consulta:** solicitar acceso a GTA (https://gta.com.gt/contactanos.php, teléfono 2462-1200), implementar un conector con esas credenciales en el servidor y declararlas como variables de entorno.

## Estados Unidos

- Al elegir Estados Unidos, la app pide el **estado** y muestra solo las cadenas que operan en él (`GET /api/countries/US/stores?state=OH`). El directorio incluye 32 cadenas y marcas (Kroger más Walmart, Target, Costco, Sam's Club, Albertsons Companies, Ahold Delhaize USA, Publix, H-E-B, Aldi, Trader Joe's, Whole Foods Market, Meijer, Wegmans, Hy-Vee, Giant Eagle, WinCo Foods, Sprouts, Winn-Dixie, Lidl…), cada una con sus fuentes.
- Los catálogos están en inglés: la app sugiere buscar en inglés (por ejemplo milk, eggs) y calcula el precio por onza (`oz`) u onza líquida (`fl oz`).

### Kroger (API oficial, requiere credenciales)

- Marcas incluidas: Kroger, Ralphs, Fred Meyer, King Soopers, City Market, Smith's, Fry's, QFC, Harris Teeter, Dillons, Food 4 Less, Mariano's, Pick 'n Save, Metro Market, Baker's, Gerbes, Jay C y Pay Less, en los estados donde operan.
- Mecanismo del conector (según la documentación pública de https://developer.kroger.com; **no probado en vivo**):
  1. Token: `POST https://api.kroger.com/v1/connect/oauth2/token` con autenticación Basic (`client_id:client_secret`), `grant_type=client_credentials` y `scope=product.compact`. El token se reutiliza hasta su vencimiento.
  2. Tienda: `GET /v1/locations?filter.zipCode.near={ZIP}&filter.limit=1`.
  3. Productos: `GET /v1/products?filter.term={texto}&filter.locationId={tienda}&filter.limit=…`. Sin `locationId` la API no devuelve precios: la app lo avisa y muestra “Precio no disponible”.
  4. Normalización: precio promocional si es menor que el regular (el regular queda como precio anterior), `size` como presentación, `inventory.stockLevel` como disponibilidad y `productPageURI` como enlace.
- **Cómo habilitarla:**
  1. Crea una cuenta gratuita en https://developer.kroger.com y registra una aplicación con el alcance `product.compact`.
  2. Copia `server/.env.example` como `server/.env` y completa `KROGER_CLIENT_ID` y `KROGER_CLIENT_SECRET`.
  3. Reinicia el servidor. Kroger pasa de “Faltan credenciales” a “Disponible para consultar” y la app pide tu código ZIP.
  4. Compruébalo en vivo: `npm run verify:stores -- milk 45202 US OH`.

### Walmart y demás cadenas

- **Walmart:** la API oficial (Walmart Affiliate / Walmart.io) requiere aprobación y firma de cada petición; los precios por tienda requieren una aprobación adicional. Queda pendiente hasta contar con ese acceso.
- **Albertsons Companies** (Safeway, Albertsons, Vons, Pavilions, Jewel-Osco, Shaw's, Acme, Tom Thumb, Randalls): sus APIs conocidas son de publicidad y requieren acuerdo comercial.
- **Ahold Delhaize USA** (Food Lion, Giant Food, The Giant Company, Stop & Shop, Hannaford) y las demás cadenas: no se encontró una API pública oficial de precios, o aún no se evaluaron. Se listan como pendientes, sin consulta.

## Idiomas (español e inglés)

- El servidor no devuelve textos de interfaz: los avisos y errores llegan como códigos con parámetros (`{ "code": "no_branch", "params": { "store": "Paiz" } }`) y el catálogo usa textos `{ es, en }`.
- Angular traduce en tiempo real con diccionarios en `comparahorro/src/app/core/i18n/` (`messages.es.ts` define las claves; el compilador exige las mismas en `messages.en.ts` y una prueba verifica que coincidan los parámetros). El cambio de idioma no recarga la página, así que la sesión en memoria se conserva.
- Los nombres de productos, marcas y promociones de las tiendas se muestran como los publica cada tienda.

## Cómo agregar países y tiendas

1. País: añadirlo a `COUNTRIES` en `server/src/catalog/catalog.ts` (código, nombre `{ es, en }`, moneda, símbolo, locale, sistema de unidades, si usa estados y forma de ubicación). Sin tiendas, la app muestra “Sin fuentes conectadas”.
2. Tienda VTEX: añadir un `StoreDefinition` con `integration.kind: 'vtex'`, URL, canal verificado con `/api/segments`, `countryIso3`, locale, soporte de ubicación verificado y propiedades de contenido. El registro de conectores la toma automáticamente.
3. Tienda sin consulta: `integration.kind: 'link'` con `searchUrlTemplate` solo si la URL de búsqueda se comprobó; si no, `null` y se abre su sitio.
4. Otra plataforma: implementar `StoreConnector` (`server/src/connectors/connector.ts`) y registrarlo en `registry.ts`; sus credenciales van en `server/src/config/env.ts` y `server/.env.example`.
5. Ubicaciones: ciudades con coordenadas en `server/src/catalog/locations.ts`; estados de EE. UU. en la misma lista; zonas de Guatemala en `locations-gt.ts`.
6. Textos nuevos de la app: agregar la clave en `messages.es.ts` y su traducción en `messages.en.ts`; los avisos nuevos del servidor van como código (`server.<código>`).

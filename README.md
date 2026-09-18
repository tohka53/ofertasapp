# ComparAhorro

Buscador y comparador de precios entre supermercados de Guatemala, Centroamérica y Estados Unidos, con listas de compras mensuales, en español e inglés.

> **Cuentas reales y datos guardados.** El acceso es con correo y contraseña sobre **Supabase Auth** (confirmación por correo activada) y las listas, los grupos familiares y las preferencias viven en **Postgres** con seguridad a nivel de fila. Una lista se borra sola tres meses después del mes al que pertenece.

- **Frontend:** Angular 22 con NgModules (`standalone: false` en componentes, directivas y pipes), Angular Material, formularios reactivos y diseño adaptable.
- **Servidor:** Node.js + Express 5 + TypeScript, sin base de datos. Consulta cada tienda con su propio conector, normaliza las respuestas y nunca sustituye una consulta fallida por precios ficticios.

## Estado de la entrega

| Área | Estado |
|---|---|
| Guatemala: Walmart, Paiz, La Torre, Maxi Despensa | **Conectadas** mediante las APIs públicas de VTEX (sin claves). Walmart, La Torre y Maxi Despensa se compararon en vivo el 16/09/2026 con el código de la app; las rutas de Paiz se comprobaron en vivo. |
| Centroamérica: 12 tiendas VTEX en El Salvador, Honduras, Nicaragua, Costa Rica y Panamá | **Conectadas.** Canal, moneda y uso de ubicación verificados en vivo el 16/09/2026 (detalle por tienda en `docs/INTEGRACIONES.md`). Belice aparece con sus cadenas registradas y sin tiendas consultables. |
| PriceSmart (Guatemala y Centroamérica) y SUMA | **Solo enlace:** la app abre su búsqueda o su sitio y te deja anotar en tu lista el precio que veas, marcado como “Precio anotado por vos”. No se leen sus páginas: PriceSmart bloquea el acceso automatizado en `robots.txt` y SUMA usa una API privada. |
| Estados Unidos | Directorio de 32 cadenas y marcas filtrado por **estado**. **Kroger** y sus marcas se consultan con su API oficial al configurar `KROGER_CLIENT_ID` y `KROGER_CLIENT_SECRET` (no probado en vivo por falta de credenciales). Las demás quedan pendientes con su motivo. |
| Cuentas, listas compartidas y grupos familiares | **Conectados** a Supabase (`ofertasgt`): registro con correo y contraseña, invitaciones por correo con enlace, grupo familiar administrado por quien invita y borrado automático de listas con más de tres meses. |
| Despliegue | **Vercel:** Angular estático + el API Express como función serverless en `/api`. |
| Español e inglés | Selector de idioma en el acceso, en la barra superior y en Perfil; cambia al instante sin recargar ni perder la sesión. |
| Servidor Node consultando las tiendas en vivo | **Pendiente de comprobar en tu red** (ver [Verificación](#verificación)). |

Mecanismos, normalización, promociones y evidencia por tienda: [docs/INTEGRACIONES.md](docs/INTEGRACIONES.md).

## Requisitos

- Node.js **22.22.3 o superior** en la rama 22, o **24 LTS** (`.nvmrc` indica 24).
- npm 10 u 11.
- Salida a Internet hacia los sitios de las tiendas que elijas (por ejemplo `walmart.com.gt`, `paiz.com.gt`, `latorre.com.gt`, `maxidespensa.com.gt`) y, con credenciales, hacia `api.kroger.com`.

## Inicio rápido

```bash
npm install     # instala la raíz, server/ y comparahorro/
npm start       # API en http://127.0.0.1:3000 y Angular en http://localhost:4200
```

Abre http://localhost:4200 e inicia sesión con una cuenta de prueba. `npm start` también funciona dentro de `comparahorro/`. `ng serve` por sí solo levanta únicamente Angular: sin la API, las consultas fallan.

**¿Por qué hay un servidor?** Las APIs de las tiendas no envían `Access-Control-Allow-Origin`, así que el navegador bloquea sus respuestas cuando las pide una app de otro dominio, como `localhost:4200`. `server/` consulta las tiendas, normaliza los datos y Angular lo llama en `/api` mediante `comparahorro/proxy.conf.json`.

Compilación local tipo producción (Express sirve la API y la app compilada):

```bash
npm run build
npm run start:prod   # http://127.0.0.1:3000
```

## Cuentas

No hay cuentas ficticias: cada persona se registra con su correo y una contraseña de 8 caracteres o más. Supabase envía un correo de confirmación y, hasta abrir ese enlace, el acceso responde "Todavía no confirmaste tu correo".

- **Registro:** `/login/registro`
- **Recuperar contraseña:** `/login/recuperar` (llega un enlace a `/auth/nueva-clave`)
- **Confirmación:** el enlace del correo vuelve a `/auth/confirmado`

Al confirmar, un disparador de base de datos crea el perfil con el nombre que se escribió en el registro.

## Uso

1. **Acceso:** correo y contraseña. Si todavía no tienes cuenta, **Crear una cuenta** y confirma con el enlace que llega a tu correo. El selector **ES | EN** cambia el idioma en cualquier momento y queda guardado en tu perfil.
2. **País:** Guatemala, Belice, El Salvador, Honduras, Nicaragua, Costa Rica, Panamá o Estados Unidos, con el número de tiendas registradas y consultables.
3. **Estado (solo EE. UU.):** elige el estado; se muestran las cadenas que operan en él.
4. **Tiendas:** búsqueda por nombre, selección múltiple y “Seleccionar todas las disponibles” (consultables y de solo enlace). Cada tienda indica “Disponible para consultar”, “Temporalmente sin conexión”, “Solo enlace a su sitio”, “Faltan credenciales” o “Integración pendiente”, con el motivo y cómo habilitarla.
5. **Ubicación:** en Guatemala, departamento y zona (por defecto Guatemala · Zona 1, 01001), código postal o GPS; en Centroamérica, ciudad o GPS; en EE. UU., código ZIP. La app avisa cuando una tienda cambia precios (Walmart Guatemala, Kroger) o solo informa existencias con ubicación (La Colonia).
6. **Buscar productos:** resultados de las tiendas consultadas con filtros, orden por precio o precio por unidad (kg, litro, unidad; onza u onza líquida en EE. UU.), comparación por código de barras y “Añadir a mi lista”. Las tiendas de solo enlace aparecen en “Buscar también en sus sitios”, con “Anotar precio”.
7. **Ofertas:** rebajas y promociones publicadas por las tiendas, con sus condiciones en el idioma elegido.
8. **Mis listas:** listas por mes y año, necesidades pendientes, “Buscar mejores precios”, “Anotar precio”, agrupación por tienda con subtotales, total estimado solo de lo cotizado y “Actualizar precios” con confirmación. Los precios anotados se distinguen y no se actualizan automáticamente.
9. **Compartir una lista:** dentro de la lista, **Compartir** muestra quién tiene acceso, permite invitar por correo (con un enlace para reenviar por donde quieras) y quitar a alguien. Quien invita administra; el resto agrega, edita y quita productos.
10. **Grupos:** en **Grupos** creas un grupo familiar, invitas por correo y aceptas las invitaciones que te llegan. Toda lista asignada a un grupo la ven y la editan sus integrantes. Quien envía la invitación administra el grupo.
11. **Perfil:** nombre, contraseña, idioma, país, estado, tiendas y ubicación; los cambios se aplican de inmediato, se guardan en tu cuenta y las listas quedan separadas por país y moneda.

## Datos y privacidad

- **Lo que se guarda en Supabase:** perfil (nombre, correo, idioma, país, estado, tiendas y ubicación elegida), listas con sus artículos, grupos familiares, quién es integrante de cada cosa e invitaciones pendientes.
- **Quién puede verlo:** las políticas RLS solo dejan leer y escribir a los integrantes de la lista o del grupo. El perfil de otra persona solo es visible si comparten una lista, un grupo o una invitación pendiente.
- **Lo que no se guarda:** los resultados de búsqueda y las ofertas consultadas siguen viviendo solo en memoria del navegador; el servidor tampoco los guarda.
- **Borrado automático:** una lista de, por ejemplo, julio de 2026 se borra el 1 de noviembre de 2026 (tres meses después del cierre de su mes). La tarea corre todos los días a la 1:00 de Guatemala y, aunque no corriera, una lista vencida deja de ser visible por RLS.
- **Al servidor Node** llegan el término de búsqueda, las tiendas elegidas y la ubicación. Las coordenadas se envían solo a las tiendas que las aceptan; el ZIP, solo a Kroger.
- **Claves:** la app usa la URL del proyecto y la clave publicable de Supabase, que son públicas por diseño. La clave de servicio no está en el repositorio ni en el navegador.

## Configuración

Opcional: copia `server/.env.example` como `server/.env`.

| Variable | Predeterminado | Uso |
|---|---|---|
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Dirección del API |
| `STORE_TIMEOUT_MS` | `8000` | Límite de tiempo por tienda |
| `SEARCH_RESULTS_PER_STORE` | `24` | Resultados pedidos a cada tienda (máximo 50) |
| `HTTP_CACHE_TTL_MS` | `60000` | Microcaché de respuestas públicas; `0` la desactiva |
| `MAX_CONCURRENT_REQUESTS_PER_HOST` | `4` | Consultas simultáneas por tienda |
| `HTTP_USER_AGENT` | `Mozilla/5.0 (compatible; ComparAhorro/0.1; demo local)` | Identificación ante las tiendas |
| `STATIC_DIR` | `comparahorro/dist/comparahorro/browser`, si existe | App compilada que sirve Express |
| `KROGER_CLIENT_ID` / `KROGER_CLIENT_SECRET` | vacías | Credenciales de la API oficial de Kroger; sin ellas Kroger queda como “Faltan credenciales” |
| `KROGER_API_BASE_URL` | `https://api.kroger.com` | Dirección de la API de Kroger |

Las tiendas VTEX no requieren claves. Para Kroger: crea una cuenta gratuita en https://developer.kroger.com, registra una aplicación con el alcance `product.compact`, pon sus credenciales en `server/.env` y reinicia. Si PriceSmart o SUMA otorgan acceso en el futuro, sus credenciales también irán en el servidor; Angular nunca recibe secretos.

## Supabase

Proyecto: **ofertasgt** (`bvuwwdpwvfkhyowhflta`, región `us-east-1`).

1. **Esquema:** abre *SQL Editor → New query*, pega `supabase/schema.sql` completo y ejecútalo. Es idempotente: se puede volver a correr. Crea `profiles`, `families`, `family_members`, `shopping_lists`, `list_members`, `list_items` e `invitations`, con sus políticas RLS, los disparadores de alta de usuario y la purga diaria.
2. **Autenticación:** *Authentication → Providers → Email*, con **Confirm email** activado.
3. **URLs:** *Authentication → URL Configuration*. `Site URL` con la dirección de producción y, en `Redirect URLs`, agrega `http://localhost:4200/**` y `https://<tu-dominio>.vercel.app/**` para que funcionen la confirmación y el cambio de contraseña.
4. **Purga automática:** el script programa `purgar-listas-vencidas` con `pg_cron` a las 07:00 UTC (01:00 en Guatemala). Si `pg_cron` no estaba habilitado, actívalo en *Database → Extensions* y vuelve a ejecutar el último bloque del script. Aunque no corra, RLS deja invisible toda lista vencida.

Comprobaciones útiles desde el SQL Editor:

```sql
select * from cron.job where jobname = 'purgar-listas-vencidas';
select * from public.maintenance_log order by ran_at desc limit 5;
select public.purgar_listas_vencidas();
```

Claves en el frontend: `comparahorro/src/environments/environment.ts` guarda la URL del proyecto y la **clave publicable** (`sb_publishable_…`). Ambas son públicas por diseño; lo que protege los datos son las políticas RLS. La clave de servicio no se usa en ningún lado de este repositorio.

## Despliegue en Vercel

El repositorio se despliega tal cual, sin variables de entorno obligatorias:

| Ajuste | Valor |
|---|---|
| Framework Preset | Other |
| Build Command | `npm run build` (ya definido en `vercel.json`) |
| Output Directory | `comparahorro/dist/comparahorro/browser` |
| Install Command | `npm install` |

- `api/[...path].js` publica el servidor Express como una sola función serverless: toda petición a `/api/...` la atiende el mismo código que en local.
- `vercel.json` reescribe cualquier otra ruta a `index.html` para que funcionen las rutas de Angular (`/listas/:id`, `/invitacion/:token`, `/auth/nueva-clave`).
- Variables opcionales del servidor (`KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`, `STORE_TIMEOUT_MS`…) se configuran en *Settings → Environment Variables*.
- Después del primer despliegue, copia la dirección del sitio a la configuración de URLs de Supabase (paso 3 de la sección anterior).

## Scripts

| Comando (desde la raíz) | Qué hace |
|---|---|
| `npm start` o `npm run dev` | API con recarga (`tsx watch`) y `ng serve` en paralelo; también desde `comparahorro/` |
| `npm run build` | Compila el servidor (`server/dist`) y Angular (`comparahorro/dist`) |
| `npm run start:prod` | Inicia el servidor compilado y sirve la app compilada |
| `npm test` | Pruebas del servidor y de Angular (Vitest) |
| `npm run test:e2e` | Compila y ejecuta Playwright en escritorio y móvil |
| `npm run verify:stores -- [término] [códigoPostal] [país] [estado]` | Consulta en vivo las tiendas reales con los conectores del servidor (por ejemplo `arroz "" CR` o `milk 45202 US OH`); también desde `comparahorro/` |

## Verificación

- **Servidor (71 pruebas):** unidades y contenidos (incluidas onzas de EE. UU.), códigos de barras, promociones estructuradas, normalización VTEX, catálogo por país y estado, tiendas de Centroamérica, conector de Kroger con respuestas simuladas según su documentación, API (fallo de una tienda, tiempo agotado, ubicación y GPS, API de respaldo, validaciones con códigos) y la captura en vivo del 16/09/2026.
- **Angular (39 pruebas):** comparación, filtros y formato en ambos idiomas, presentaciones, promociones, ubicaciones, precios anotados, cálculos de listas en centavos, actualización de precios, sesión y un control que exige las mismas claves y parámetros en español e inglés.
- **E2E (14 pruebas):** acceso con las tres cuentas, flujo completo (país, tiendas, búsqueda, comparación, lista mensual, perfil), cambio de idioma sin perder la sesión, EE. UU. por estado, enlace de PriceSmart con precio anotado, fallo de una tienda, cancelación de búsquedas, recarga y navegación móvil sin desplazamiento horizontal. Usan `e2e/mock-stores.mjs`, que sirve respuestas reales capturadas (las tiendas sin captura responden como sin conexión) y solo se activa con `ALLOW_TEST_STORE_BASE_URLS=1`. La primera vez instala Chromium: `cd e2e && npm install && npx playwright install chromium`.

Resultados de esta entrega (16/09/2026):

- Compilación, pruebas del servidor (71/71) y de Angular (39/39) y E2E 14/14 con Chromium comprobados en Linux x64 con Node 24.
- Comparación en vivo del EAN 7441001698644 con código postal 01001, procesada con el código de la app: **Maxi Despensa Q 18.50 · Walmart Q 18.90 · La Torre Q 20.65**. La app agrupó el producto por código de barras y advirtió que las tiendas publican contenidos distintos (946 ml y 1 L). Detalle en `docs/INTEGRACIONES.md`.
- **Bloqueo identificado:** en los entornos usados para la entrega, la red no permitió que el servidor Node se conectara a las tiendas (proxy con lista de dominios permitidos). La app marcó cada tienda como “Temporalmente sin conexión” y no mostró precios. Para cerrar esa comprobación, ejecuta en tu equipo:

  ```bash
  npm run verify:stores -- "leche delactomy" 01001
  ```

## Estructura

```text
ofertasapp/
├── package.json             Scripts que orquestan servidor y frontend
├── vercel.json              Build, carpeta publicada y reescrituras del SPA
├── api/[...path].js         El API Express como función serverless de Vercel
├── supabase/schema.sql      Tablas, RLS, invitaciones y purga automática
├── comparahorro/            Angular 22 (NgModules)
│   └── src/app/
│       ├── core/            Modelos, servicios de datos (Supabase), guards, lógica pura e i18n (español e inglés)
│       ├── shared/          SharedModule: tarjetas, filtros, selectores, diálogos y pipes
│       ├── layout/          LayoutModule: barra superior y navegación inferior en móvil
│       └── features/        Módulos con carga diferida: auth, onboarding, search, offers, lists, families, invitations, profile
├── server/                  Express 5 + TypeScript
│   ├── src/catalog/         Países, tiendas por país y estado, zonas de Guatemala, ciudades y estados
│   ├── src/connectors/      Conectores VTEX y Kroger, y registro por tienda
│   ├── src/domain/          Oferta normalizada, GTIN, unidades y moneda
│   ├── src/services/        Búsqueda, ofertas, código de barras y actualización de precios
│   ├── src/routes/          API REST
│   ├── scripts/             verify-stores.ts (verificación en vivo)
│   └── test/                Vitest + supertest con respuestas reales capturadas
├── e2e/                     Playwright y tiendas simuladas solo para pruebas
└── docs/INTEGRACIONES.md    Investigación y estado de cada tienda
```

Los generadores de Angular están configurados en `angular.json` con `standalone: false`, de modo que `ng generate component|directive|pipe` crea declaraciones para NgModules.

## API

| Método y ruta | Descripción |
|---|---|
| `GET /api/health` | Estado del servidor |
| `GET /api/countries` | Países con número de tiendas registradas y conectadas |
| `GET /api/countries/:code/stores?checkStatus=true&state=OH` | Tiendas del país (o del estado en EE. UU.) con estado en vivo |
| `GET /api/countries/:code/locations` | Forma de ubicación del país: zonas con código postal, ciudades con coordenadas o estados |
| `POST /api/locations/resolve` | Sucursal que asigna cada tienda a una ubicación |
| `GET /api/search?country=GT&q=…&stores=…&postalCode=…` | Búsqueda en las tiendas seleccionadas (también `lat` y `lng`) |
| `GET /api/offers?country=GT&stores=…` | Productos con rebaja o promoción publicada |
| `GET /api/products/by-gtin?country=GT&gtin=…&stores=…` | Mismo código de barras en varias tiendas |
| `POST /api/products/refresh` | Actualiza precios de artículos de una lista y sugiere alternativas |

Cada respuesta de búsqueda incluye el estado de cada tienda (respondió, sin conexión, tiempo agotado, pendiente), sus avisos como códigos con parámetros (la app los traduce) y la hora real de consulta.

## Versiones utilizadas

| Paquete | Versión |
|---|---|
| Angular (`@angular/core`) | 22.1.6 |
| Angular CLI y `@angular/build` | 22.1.8 |
| Angular Material y CDK | 22.1.7 |
| RxJS | 7.8.2 |
| TypeScript | 6.0.3 |
| Express | 5.2.1 |
| zod | 4.6.5 |
| tsx | 4.23.13 |
| Vitest | 4.1.11 |
| supertest | 7.2.2 |
| Playwright | 1.56.1 |
| concurrently | 10.0.5 |

## Limitaciones conocidas

- Las invitaciones no salen por correo desde la app: se genera un enlace para compartirlo por el medio que prefieras, y a quien ya tiene cuenta también le aparece dentro de la app. Enviar el correo automáticamente requiere un servidor con la clave de servicio de Supabase.
- Los precios cambian: cada oferta muestra la hora en que se consultó. Los totales de las listas son estimaciones de lo cotizado.
- En zonas donde Walmart no asigna sucursal, sus productos llegan sin precio; la app lo avisa y no los cuenta en el total.
- Las promociones se muestran como las publica cada tienda y no se descuentan del total.
- Costos de envío: Maxi Despensa y La Torre muestran solo sus condiciones publicadas; los de Walmart no se verificaron.
- PriceSmart y SUMA no se consultan: sus precios solo entran a la lista si los anotás a mano. La URL de búsqueda de PriceSmart solo se comprobó para Guatemala.
- Kroger requiere credenciales propias y su conector no se probó en vivo. Las demás cadenas de EE. UU. no tienen integración.
- Las APIs públicas de las tiendas pueden cambiar o limitar el acceso sin aviso; si una tienda rechaza la consulta, la app lo informa y continúa con las demás.

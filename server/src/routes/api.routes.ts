import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { LocationInput } from '../domain/types.js';
import type { CatalogService } from '../services/catalog.service.js';
import { HttpError } from '../services/errors.js';
import type { SearchService } from '../services/search.service.js';

const countryCode = z.string().trim().regex(/^[A-Za-z]{2}$/, 'invalid_country').transform((v) => v.toUpperCase());
const storeList = z
  .string()
  .trim()
  .min(1, 'stores_required')
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.string().regex(/^[a-z0-9-]{2,40}$/, 'invalid_store')).min(1, 'stores_required').max(40, 'too_many_stores'));

const stateCode = z.string().trim().regex(/^[A-Za-z]{2}$/, 'invalid_state').transform((v) => v.toUpperCase());

const locationQuery = {
  postalCode: z.string().trim().regex(/^\d{4,6}$/, 'invalid_postal_code').optional(),
  locationLabel: z.string().trim().max(80).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
};

const LocationBody = z
  .object({
    postalCode: z.string().trim().regex(/^\d{4,6}$/).nullable().optional(),
    label: z.string().trim().max(80).nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
  })
  .nullable()
  .optional();

const SearchQuery = z.object({
  country: countryCode,
  q: z.string().trim().min(2, 'query_too_short').max(80, 'query_too_long'),
  stores: storeList,
  ...locationQuery,
});

const OffersQuery = z.object({
  country: countryCode,
  q: z.string().trim().max(80).optional().default(''),
  stores: storeList,
  ...locationQuery,
});

const GtinQuery = z.object({
  country: countryCode,
  gtin: z.string().trim().regex(/^\d{8,14}$/, 'invalid_gtin'),
  stores: storeList,
  ...locationQuery,
});

const RefreshBody = z.object({
  countryCode,
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(80),
        storeId: z.string().regex(/^[a-z0-9-]{2,40}$/),
        skuId: z.string().min(1).max(40),
        productId: z.string().max(40).nullable().optional(),
        gtinRaw: z.string().max(20).nullable(),
        name: z.string().min(1).max(200),
      }),
    )
    .min(1)
    .max(100),
  alternativeStoreIds: z.array(z.string().regex(/^[a-z0-9-]{2,40}$/)).max(40).default([]),
  location: LocationBody,
});

const ResolveBody = z.object({
  countryCode,
  storeIds: z.array(z.string().regex(/^[a-z0-9-]{2,40}$/)).min(1).max(40),
  location: z.object({
    postalCode: z.string().trim().regex(/^\d{4,6}$/).nullable().optional(),
    label: z.string().trim().max(80).nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
  }),
});

const KNOWN_CODES = new Set(['invalid_country', 'stores_required', 'invalid_store', 'too_many_stores', 'invalid_postal_code', 'query_too_short', 'query_too_long', 'invalid_gtin', 'invalid_state']);

function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues.find((i) => KNOWN_CODES.has(i.message));
    const detail = result.error.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join('; ');
    throw new HttpError(400, issue?.message ?? 'invalid_request', detail);
  }
  return result.data;
}

function locationFromQuery(q: { postalCode?: string | undefined; locationLabel?: string | undefined; lat?: number | undefined; lng?: number | undefined }): LocationInput | null {
  const hasGeo = q.lat !== undefined && q.lng !== undefined;
  if (!q.postalCode && !hasGeo) return null;
  return { postalCode: q.postalCode ?? null, label: q.locationLabel ?? null, lat: hasGeo ? q.lat! : null, lng: hasGeo ? q.lng! : null };
}

function locationFromBody(l: z.infer<typeof LocationBody>): LocationInput | null {
  if (!l) return null;
  const hasGeo = typeof l.lat === 'number' && typeof l.lng === 'number';
  if (!l.postalCode && !hasGeo) return null;
  return { postalCode: l.postalCode ?? null, label: l.label ?? null, lat: hasGeo ? l.lat! : null, lng: hasGeo ? l.lng! : null };
}

/** Cancela las consultas a las tiendas si el navegador abandona la petición. */
function requestSignal(res: Response): AbortSignal {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  return controller.signal;
}

export function apiRouter(catalog: CatalogService, search: SearchService): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'comparahorro-server', time: new Date().toISOString() });
  });

  router.get('/countries', (_req, res) => {
    res.json({ countries: catalog.listCountries() });
  });

  router.get('/countries/:code/stores', async (req: Request, res: Response) => {
    const code = parse(countryCode, req.params['code']);
    const checkStatus = req.query['checkStatus'] === 'true' || req.query['checkStatus'] === '1';
    const state = typeof req.query['state'] === 'string' && req.query['state'] ? parse(stateCode, req.query['state']) : null;
    res.json(await catalog.listStores(code, checkStatus, state, requestSignal(res)));
  });

  router.get('/countries/:code/locations', (req, res) => {
    const code = parse(countryCode, req.params['code']);
    res.json(catalog.locations(code));
  });

  router.post('/locations/resolve', async (req, res) => {
    const body = parse(ResolveBody, req.body);
    const location = locationFromBody(body.location);
    if (!location) throw new HttpError(400, 'location_required', 'A postal code or coordinates are required');
    res.json({ results: await catalog.resolveLocation(body.countryCode, body.storeIds, location, requestSignal(res)) });
  });

  router.get('/search', async (req, res) => {
    const q = parse(SearchQuery, req.query);
    res.json(await search.search({ countryCode: q.country, query: q.q, storeIds: q.stores, location: locationFromQuery(q), signal: requestSignal(res) }));
  });

  router.get('/offers', async (req, res) => {
    const q = parse(OffersQuery, req.query);
    res.json(await search.offers({ countryCode: q.country, query: q.q, storeIds: q.stores, location: locationFromQuery(q), signal: requestSignal(res) }));
  });

  router.get('/products/by-gtin', async (req, res) => {
    const q = parse(GtinQuery, req.query);
    res.json(await search.byGtin({ countryCode: q.country, query: q.gtin, storeIds: q.stores, location: locationFromQuery(q), signal: requestSignal(res) }));
  });

  router.post('/products/refresh', async (req, res) => {
    const body = parse(RefreshBody, req.body);
    res.json(
      await search.refresh({
        countryCode: body.countryCode,
        items: body.items.map((i) => ({ ...i, productId: i.productId ?? null })),
        alternativeStoreIds: body.alternativeStoreIds,
        location: locationFromBody(body.location),
        signal: requestSignal(res),
      }),
    );
  });

  return router;
}

import { join } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { AppConfig } from './config/env.js';
import { ConnectorRegistry } from './connectors/registry.js';
import { HttpClient, type FetchLike } from './http/http-client.js';
import { apiRouter } from './routes/api.routes.js';
import { CatalogService } from './services/catalog.service.js';
import { HttpError } from './services/errors.js';
import { SearchService } from './services/search.service.js';

export interface AppDependencies {
  fetchImpl?: FetchLike;
}

export function createApp(config: AppConfig, deps: AppDependencies = {}) {
  const http = new HttpClient({
    fetchImpl: deps.fetchImpl,
    userAgent: config.userAgent,
    cacheTtlMs: config.httpCacheTtlMs,
    maxConcurrentPerHost: config.maxConcurrentPerHost,
  });
  const registry = new ConnectorRegistry(config, http);
  const catalog = new CatalogService(registry);
  const search = new SearchService(registry, config);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(express.json({ limit: '200kb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', apiRouter(catalog, search));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Resource not found' } });
  });

  if (config.staticDir) {
    const staticDir = config.staticDir;
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(staticDir, 'index.html'));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.params ? { params: error.params } : {}) } });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ error: { code: 'invalid_json', message: 'Invalid JSON body' } });
      return;
    }
    console.error('[server] unhandled error', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } });
  });

  return app;
}

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = dirname(fileURLToPath(import.meta.url));

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('127.0.0.1'),
  STORE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(8000),
  SEARCH_RESULTS_PER_STORE: z.coerce.number().int().min(1).max(50).default(24),
  HTTP_CACHE_TTL_MS: z.coerce.number().int().min(0).max(600000).default(60000),
  MAX_CONCURRENT_REQUESTS_PER_HOST: z.coerce.number().int().min(1).max(16).default(4),
  HTTP_USER_AGENT: z.string().min(1).default('Mozilla/5.0 (compatible; ComparAhorro/0.1; demo local)'),
  STATIC_DIR: z.string().optional(),
  /** Credenciales de la API de Kroger (developer.kroger.com). Sin ellas la tienda queda pendiente. */
  KROGER_CLIENT_ID: z.string().trim().optional(),
  KROGER_CLIENT_SECRET: z.string().trim().optional(),
  KROGER_API_BASE_URL: z.url().default('https://api.kroger.com'),
  /** Solo pruebas automatizadas: JSON { "storeId": "http://127.0.0.1:4010/..." }. */
  TEST_STORE_BASE_URLS: z.string().optional(),
  ALLOW_TEST_STORE_BASE_URLS: z.string().optional(),
});

export interface AppConfig {
  nodeEnv: string;
  port: number;
  host: string;
  storeTimeoutMs: number;
  resultsPerStore: number;
  httpCacheTtlMs: number;
  maxConcurrentPerHost: number;
  userAgent: string;
  staticDir: string | null;
  storeBaseUrlOverrides: Record<string, string>;
  kroger: { clientId: string; clientSecret: string; apiBaseUrl: string } | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  const e = parsed.data;

  let overrides: Record<string, string> = {};
  if (e.TEST_STORE_BASE_URLS) {
    if (e.ALLOW_TEST_STORE_BASE_URLS !== '1') {
      throw new Error('TEST_STORE_BASE_URLS is only allowed in tests with ALLOW_TEST_STORE_BASE_URLS=1');
    }
    overrides = z.record(z.string(), z.url()).parse(JSON.parse(e.TEST_STORE_BASE_URLS));
  }

  const defaultStatic = resolve(here, '../../../comparahorro/dist/comparahorro/browser');
  const staticDir = e.STATIC_DIR ? resolve(e.STATIC_DIR) : existsSync(defaultStatic) ? defaultStatic : null;

  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    storeTimeoutMs: e.STORE_TIMEOUT_MS,
    resultsPerStore: e.SEARCH_RESULTS_PER_STORE,
    httpCacheTtlMs: e.HTTP_CACHE_TTL_MS,
    maxConcurrentPerHost: e.MAX_CONCURRENT_REQUESTS_PER_HOST,
    userAgent: e.HTTP_USER_AGENT,
    staticDir: staticDir && existsSync(staticDir) ? staticDir : null,
    storeBaseUrlOverrides: overrides,
    kroger:
      e.KROGER_CLIENT_ID && e.KROGER_CLIENT_SECRET
        ? { clientId: e.KROGER_CLIENT_ID, clientSecret: e.KROGER_CLIENT_SECRET, apiBaseUrl: overrides['kroger-us'] ?? e.KROGER_API_BASE_URL }
        : null,
  };
}

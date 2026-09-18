import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, type AppConfig } from '../src/config/env.js';
import type { FetchLike } from '../src/http/http-client.js';

const here = dirname(fileURLToPath(import.meta.url));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fixture(name: string): any {
  return JSON.parse(readFileSync(join(here, 'fixtures', `${name}.json`), 'utf8'));
}

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...loadConfig({ NODE_ENV: 'test', STORE_TIMEOUT_MS: '1500', HTTP_CACHE_TTL_MS: '0' }), staticDir: null, ...overrides };
}

export type Route = (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/** fetch simulado: cada ruta decide si responde a la URL. Registra las URLs pedidas. */
export function fakeFetch(routes: Route[]): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (input: string, init?: RequestInit) => {
    calls.push(input);
    const url = new URL(input);
    for (const route of routes) {
      const response = await route(url, init);
      if (response) return response;
    }
    return json({ message: 'not mocked' }, 404);
  }) as FetchLike & { calls: string[] };
  fn.calls = calls;
  return fn;
}

/** Simula una fuente que no responde hasta que se cancela la petición. */
export function hanging(init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
}

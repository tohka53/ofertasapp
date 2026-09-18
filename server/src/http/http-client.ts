import { TtlCache } from './ttl-cache.js';

export type UpstreamErrorKind = 'timeout' | 'network' | 'http' | 'invalid_json' | 'cancelled';

export class UpstreamError extends Error {
  constructor(
    readonly kind: UpstreamErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly detail: string | null = null,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export interface JsonResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  /** Momento real en que la fuente respondió (se conserva aunque venga de caché). */
  fetchedAt: string;
  fromCache: boolean;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs: number;
  useCache?: boolean;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  /** Clave de caché distinta de la URL (por ejemplo, para incluir la tienda asignada). */
  cacheKey?: string;
}

export interface HttpClientOptions {
  fetchImpl?: FetchLike;
  userAgent: string;
  cacheTtlMs: number;
  maxConcurrentPerHost: number;
}

class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  constructor(private readonly limit: number) {}

  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (this.active < this.limit) {
      this.active++;
      return () => this.release();
    }
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        const idx = this.queue.indexOf(grant);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new UpstreamError('cancelled', 'Request cancelled'));
      };
      const grant = () => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      this.queue.push(grant);
    });
    this.active++;
    return () => this.release();
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

/**
 * Cliente HTTP para fuentes externas: límite de tiempo, cancelación, límite de
 * concurrencia por host y microcaché en memoria de respuestas públicas idénticas.
 */
export class HttpClient {
  private readonly fetchImpl: FetchLike;
  private readonly cache: TtlCache<JsonResponse<unknown>>;
  private readonly semaphores = new Map<string, Semaphore>();

  constructor(private readonly options: HttpClientOptions) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.cache = new TtlCache(options.cacheTtlMs, 500);
  }

  async getJson<T>(url: string, opts: RequestOptions): Promise<JsonResponse<T>> {
    return this.requestJson<T>(url, opts);
  }

  /**
   * Petición JSON con límite de tiempo y cancelación. La microcaché solo se usa en GET sin
   * cabecera de autorización propia de la petición (respuestas públicas idénticas).
   */
  async requestJson<T>(url: string, opts: RequestOptions): Promise<JsonResponse<T>> {
    const method = opts.method ?? 'GET';
    const useCache = (opts.useCache ?? true) && method === 'GET';
    const cacheKey = opts.cacheKey ?? url;
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return { ...(cached as JsonResponse<T>), fromCache: true };
    }

    if (opts.signal?.aborted) throw new UpstreamError('cancelled', 'Request cancelled');
    const host = new URL(url).host;
    let semaphore = this.semaphores.get(host);
    if (!semaphore) {
      semaphore = new Semaphore(this.options.maxConcurrentPerHost);
      this.semaphores.set(host, semaphore);
    }

    const release = await semaphore.acquire(opts.signal);
    const timeoutSignal = AbortSignal.timeout(opts.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeoutSignal]) : timeoutSignal;

    try {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers: { accept: 'application/json', 'user-agent': this.options.userAgent, ...(opts.headers ?? {}) },
          body: opts.body,
          signal,
        });
      } catch (error) {
        throw this.classify(error, opts.signal, timeoutSignal, opts.timeoutMs);
      }

      if (!response.ok && response.status !== 206) {
        throw new UpstreamError('http', `Source responded HTTP ${response.status}`, response.status);
      }

      let text: string;
      try {
        text = await response.text();
      } catch (error) {
        throw this.classify(error, opts.signal, timeoutSignal, opts.timeoutMs);
      }

      let data: T;
      try {
        data = JSON.parse(text) as T;
      } catch {
        throw new UpstreamError('invalid_json', 'Source response is not JSON', response.status);
      }

      const result: JsonResponse<T> = {
        data,
        status: response.status,
        headers: response.headers,
        fetchedAt: new Date().toISOString(),
        fromCache: false,
      };
      if (useCache) this.cache.set(cacheKey, result as JsonResponse<unknown>);
      return result;
    } finally {
      release();
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  private classify(error: unknown, external: AbortSignal | undefined, timeout: AbortSignal, timeoutMs: number): UpstreamError {
    if (error instanceof UpstreamError) return error;
    if (external?.aborted) return new UpstreamError('cancelled', 'Request cancelled');
    if (timeout.aborted) return new UpstreamError('timeout', `No response within ${Math.round(timeoutMs / 1000)} s`, null, String(Math.round(timeoutMs / 1000)));
    const message = error instanceof Error ? error.message : String(error);
    return new UpstreamError('network', `Could not connect to the source (${message})`, null, message);
  }
}

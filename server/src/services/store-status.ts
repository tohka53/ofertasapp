import type { AppMessage, StoreQueryStatus } from '../domain/types.js';
import { UpstreamError } from '../http/http-client.js';

export function message(code: string, params?: Record<string, string | number>): AppMessage {
  return params ? { code, params } : { code };
}

/** Clasifica un error de consulta a una tienda en un estado y un mensaje con código. */
export function classifyError(error: unknown): { status: StoreQueryStatus; message: AppMessage } {
  if (error instanceof UpstreamError) {
    switch (error.kind) {
      case 'timeout':
        return { status: 'timeout', message: message('upstream_timeout', error.detail ? { seconds: error.detail } : undefined) };
      case 'cancelled':
        return { status: 'cancelled', message: message('cancelled') };
      case 'http':
        if (error.status === 401) return { status: 'error', message: message('upstream_unauthorized', { status: 401 }) };
        if (error.status === 403 || error.status === 429) return { status: 'error', message: message('upstream_rejected', { status: error.status }) };
        return { status: 'error', message: message('upstream_http', { status: error.status ?? 0 }) };
      case 'invalid_json':
        return { status: 'error', message: message('upstream_invalid_json') };
      case 'network':
        return { status: 'error', message: message('upstream_network', { detail: error.detail ?? error.message }) };
    }
  }
  return { status: 'error', message: message('unexpected_error', { detail: error instanceof Error ? error.message : String(error) }) };
}

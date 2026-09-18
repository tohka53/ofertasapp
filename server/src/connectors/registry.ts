import { COUNTRIES, STORES } from '../catalog/catalog.js';
import type { AppConfig } from '../config/env.js';
import { HttpClient } from '../http/http-client.js';
import type { StoreConnector } from './connector.js';
import { KrogerConnector } from './kroger/kroger-connector.js';
import { PriceSmartConnector } from './pricesmart/pricesmart-connector.js';
import { VtexConnector } from './vtex/vtex-connector.js';

/**
 * Crea un conector por tienda con integración operativa. Las tiendas pendientes o de solo
 * enlace no tienen conector; Kroger solo lo tiene cuando hay credenciales configuradas.
 */
export class ConnectorRegistry {
  private readonly connectors = new Map<string, StoreConnector>();

  constructor(
    private readonly config: AppConfig,
    http: HttpClient,
  ) {
    for (const store of STORES) {
      const country = COUNTRIES.find((c) => c.code === store.countryCode);
      if (!country) continue;
      if (store.integration.kind === 'vtex') {
        this.connectors.set(
          store.id,
          new VtexConnector(store, country, { http, timeoutMs: config.storeTimeoutMs, baseUrlOverride: config.storeBaseUrlOverrides[store.id] ?? null }),
        );
      } else if (store.integration.kind === 'pricesmart') {
        this.connectors.set(
          store.id,
          new PriceSmartConnector(store, country, { http, timeoutMs: config.storeTimeoutMs, baseUrlOverride: config.storeBaseUrlOverrides[store.id] ?? null }),
        );
      } else if (store.integration.kind === 'kroger' && config.kroger) {
        this.connectors.set(
          store.id,
          new KrogerConnector(store, country, {
            http,
            timeoutMs: config.storeTimeoutMs,
            credentials: { clientId: config.kroger.clientId, clientSecret: config.kroger.clientSecret },
            apiBaseUrl: config.kroger.apiBaseUrl,
          }),
        );
      }
    }
  }

  get(storeId: string): StoreConnector | undefined {
    return this.connectors.get(storeId);
  }

  krogerConfigured(): boolean {
    return this.config.kroger !== null;
  }
}

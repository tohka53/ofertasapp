import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import type { Country, LocationsResponse, StoresResponse, StoreSummary } from '../models/api.models';
import { ApiService } from './api.service';
import { SessionEventsService } from './session-events.service';

export function storesKey(countryCode: string, state: string | null): string {
  return state ? `${countryCode}:${state}` : countryCode;
}

/** Catálogo de países y tiendas del servidor, con estado de integraciones cacheado en memoria. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(ApiService);
  private readonly countriesState = signal<Country[] | null>(null);
  private readonly storesState = signal<Record<string, StoresResponse>>({});
  private readonly locationsState = signal<Record<string, LocationsResponse>>({});

  readonly countries = this.countriesState.asReadonly();
  readonly storesByKey = this.storesState.asReadonly();
  readonly locationsByCountry = this.locationsState.asReadonly();

  constructor() {
    inject(SessionEventsService)
      .reset$.pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.countriesState.set(null);
        this.storesState.set({});
        this.locationsState.set({});
      });
  }

  async loadCountries(): Promise<Country[]> {
    const cached = this.countriesState();
    if (cached) return cached;
    const countries = await firstValueFrom(this.api.countries());
    this.countriesState.set(countries);
    return countries;
  }

  country(code: string | null): Country | null {
    return code ? (this.countriesState()?.find((c) => c.code === code) ?? null) : null;
  }

  storesFor(countryCode: string | null, state: string | null): StoresResponse | undefined {
    return countryCode ? this.storesState()[storesKey(countryCode, state)] : undefined;
  }

  /** Consulta el catálogo del país (o del estado) y, opcionalmente, el estado actual de cada integración. */
  async loadStores(countryCode: string, checkStatus: boolean, state: string | null = null): Promise<StoresResponse> {
    const key = storesKey(countryCode, state);
    const cached = this.storesState()[key];
    if (cached && (!checkStatus || cached.stores.some((s) => s.checkedAt !== null) || !cached.stores.some((s) => s.queryable))) return cached;
    const response = await firstValueFrom(this.api.stores(countryCode, checkStatus, state));
    this.storesState.update((all) => ({ ...all, [key]: response }));
    return response;
  }

  async refreshStoreStatus(countryCode: string, state: string | null = null): Promise<StoresResponse> {
    const response = await firstValueFrom(this.api.stores(countryCode, true, state));
    this.storesState.update((all) => ({ ...all, [storesKey(countryCode, state)]: response }));
    return response;
  }

  async loadLocations(countryCode: string): Promise<LocationsResponse> {
    const cached = this.locationsState()[countryCode];
    if (cached) return cached;
    const response = await firstValueFrom(this.api.locations(countryCode));
    this.locationsState.update((all) => ({ ...all, [countryCode]: response }));
    return response;
  }

  /** Busca la tienda en cualquier catálogo cargado del país (con o sin estado). */
  store(countryCode: string, storeId: string): StoreSummary | undefined {
    for (const [key, response] of Object.entries(this.storesState())) {
      if (key !== countryCode && !key.startsWith(`${countryCode}:`)) continue;
      const found = response.stores.find((s) => s.id === storeId);
      if (found) return found;
    }
    return undefined;
  }
}

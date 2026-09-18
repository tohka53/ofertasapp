import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DEFAULT_FILTERS, type OfferFilters } from '../logic/filters';
import type { AppMessage, SearchResponse } from '../models/api.models';
import { PreferencesService } from './preferences.service';
import { SessionEventsService } from './session-events.service';

export interface ResultsState {
  query: string;
  response: SearchResponse | null;
  error: AppMessage | null;
  filters: OfferFilters;
}

const EMPTY: ResultsState = { query: '', response: null, error: null, filters: DEFAULT_FILTERS };

/**
 * Últimos resultados de "Buscar productos" y "Ofertas" para conservarlos al cambiar de pestaña.
 * Se limpian al cerrar sesión y cuando cambian país, estado, tiendas o ubicación.
 */
@Injectable({ providedIn: 'root' })
export class SearchStateService {
  readonly search = signal<ResultsState>(EMPTY);
  readonly offers = signal<ResultsState>(EMPTY);

  constructor() {
    inject(SessionEventsService)
      .reset$.pipe(takeUntilDestroyed())
      .subscribe(() => this.clear());
    inject(PreferencesService)
      .changes$.pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.search.update((s) => ({ ...s, response: null, error: null, filters: DEFAULT_FILTERS }));
        this.offers.set(EMPTY);
      });
  }

  clear(): void {
    this.search.set(EMPTY);
    this.offers.set(EMPTY);
  }
}

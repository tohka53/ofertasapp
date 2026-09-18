import { computed, DestroyRef, Directive, inject, signal, type WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { catchError, EMPTY, map, of, Subject, switchMap, type Observable } from 'rxjs';
import { I18nService } from '../core/i18n/i18n.service';
import { buildComparison } from '../core/logic/compare';
import { applyFilters, DEFAULT_FILTERS, type OfferFilters } from '../core/logic/filters';
import type { AppMessage, Offer, SearchResponse, StoreSummary } from '../core/models/api.models';
import { describeApiError } from '../core/services/api.service';
import { NotifyService } from '../core/services/notify.service';
import { PreferencesService } from '../core/services/preferences.service';
import type { ResultsState } from '../core/services/search-state.service';
import { AddToListDialogComponent, type AddToListResult } from './dialogs/add-to-list-dialog.component';
import { CompareDialogComponent, type CompareDialogData } from './dialogs/compare-dialog.component';
import { ManualPriceDialogComponent, type ManualPriceDialogData, type ManualPriceResult } from './dialogs/manual-price-dialog.component';

type Outcome = { query: string; response: SearchResponse } | { query: string; error: AppMessage };

/**
 * Lógica común de páginas con resultados de tiendas: una sola consulta activa
 * (las anteriores se cancelan con switchMap), filtros, comparación y diálogos.
 */
@Directive()
export abstract class OfferResultsBase {
  protected readonly dialog = inject(MatDialog);
  protected readonly notify = inject(NotifyService);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly i18n = inject(I18nService);
  readonly preferences = inject(PreferencesService);

  protected abstract readonly state: WritableSignal<ResultsState>;
  protected abstract fetch(query: string): Observable<SearchResponse>;

  readonly loading = signal(false);
  readonly pendingQuery = signal<string | null>(null);
  private readonly trigger$ = new Subject<string | null>();

  readonly response = computed(() => this.state().response);
  readonly error = computed(() => this.state().error);
  readonly filters = computed(() => this.state().filters);
  readonly summary = computed(() => buildComparison(this.response()?.offers ?? []));
  readonly visibleOffers = computed(() => applyFilters(this.response()?.offers ?? [], this.filters(), this.summary().dominantUnit));
  readonly comparableGroups = computed(() => this.summary().groups.filter((g) => g.storeIds.length >= 2));
  readonly respondedCount = computed(() => this.response()?.stores.filter((s) => s.status === 'ok').length ?? 0);
  readonly currencySymbol = computed(() => this.preferences.country()?.currencySymbol ?? 'Q');
  readonly defaultUnit = computed(() => (this.preferences.country()?.unitSystem === 'us' ? 'oz' : 'kg'));

  protected startListening(): void {
    this.trigger$
      .pipe(
        switchMap((query) => {
          if (query === null) {
            this.loading.set(false);
            this.pendingQuery.set(null);
            return EMPTY;
          }
          this.loading.set(true);
          this.pendingQuery.set(query);
          return this.fetch(query).pipe(
            map((response): Outcome => ({ query, response })),
            catchError((error: unknown) => of<Outcome>({ query, error: describeApiError(error) })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((outcome) => {
        this.loading.set(false);
        this.pendingQuery.set(null);
        if ('response' in outcome) {
          this.state.set({ query: outcome.query, response: outcome.response, error: null, filters: DEFAULT_FILTERS });
        } else {
          this.state.update((s) => ({ ...s, query: outcome.query, response: null, error: outcome.error }));
        }
      });
  }

  protected run(query: string): void {
    this.trigger$.next(query);
  }

  cancel(): void {
    this.trigger$.next(null);
  }

  updateFilters(filters: OfferFilters): void {
    this.state.update((s) => ({ ...s, filters }));
  }

  resetFilters(): void {
    this.updateFilters(DEFAULT_FILTERS);
  }

  openCompare(offer: Offer): void {
    const response = this.response();
    if (!response) return;
    this.dialog.open<CompareDialogComponent, CompareDialogData>(CompareDialogComponent, {
      data: { offer, offers: response.offers, summary: this.summary() },
      width: '760px',
      maxWidth: '96vw',
      autoFocus: false,
    });
  }

  openAddToList(offer: Offer): void {
    this.dialog
      .open<AddToListDialogComponent, { offer: Offer }, AddToListResult>(AddToListDialogComponent, { data: { offer }, width: '520px', maxWidth: '96vw' })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.notify.info(this.i18n.t(result.merged ? 'addToList.merged' : 'addToList.added', { list: result.listName }));
      });
  }

  openManualPrice(store: StoreSummary, productName: string): void {
    this.dialog
      .open<ManualPriceDialogComponent, ManualPriceDialogData, ManualPriceResult>(ManualPriceDialogComponent, {
        data: { storeId: store.id, productName: productName.trim() },
        width: '560px',
        maxWidth: '96vw',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.notify.info(this.i18n.t('detail.manualSaved', { list: result.listName }));
      });
  }

  trackOffer(_index: number, offer: Offer): string {
    return offer.id;
  }
}

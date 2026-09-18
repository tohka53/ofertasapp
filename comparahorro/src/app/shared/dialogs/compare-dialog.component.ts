import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { I18nService } from '../../core/i18n/i18n.service';
import { alternativesFor, buildComparison, type ComparisonGroup, type ComparisonSummary } from '../../core/logic/compare';
import type { AppMessage, Offer, SearchResponse } from '../../core/models/api.models';
import { ApiService, describeApiError } from '../../core/services/api.service';
import { NotifyService } from '../../core/services/notify.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { AddToListDialogComponent, type AddToListResult } from './add-to-list-dialog.component';

export interface CompareDialogData {
  offer: Offer;
  offers: Offer[];
  summary: ComparisonSummary;
}

@Component({
  selector: 'app-compare-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './compare-dialog.component.html',
  styleUrl: './compare-dialog.component.scss',
})
export class CompareDialogComponent {
  readonly data = inject<CompareDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(ApiService);
  private readonly preferences = inject(PreferencesService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searching = signal(false);
  readonly gtinSearch = signal<SearchResponse | null>(null);
  readonly gtinError = signal<AppMessage | null>(null);

  /** Grupo comparable: primero el de los resultados; si se buscó el código, se recalcula con esas ofertas. */
  readonly group = computed<ComparisonGroup | undefined>(() => {
    const extra = this.gtinSearch();
    if (extra) {
      const merged = new Map<string, Offer>();
      for (const o of [this.data.offer, ...(this.data.summary.groupByOfferId.get(this.data.offer.id)?.offers ?? []), ...extra.offers]) merged.set(o.id, o);
      return buildComparison([...merged.values()]).groupByOfferId.get(this.data.offer.id);
    }
    return this.data.summary.groupByOfferId.get(this.data.offer.id);
  });

  readonly alternatives = computed(() => alternativesFor(this.data.offer, this.data.offers, this.group()));
  readonly alternativesPool = computed(() => [this.data.offer, ...this.alternatives()].filter((o) => o.price !== null));
  readonly cheapestPackageId = computed(() => this.minBy(this.alternativesPool(), (o) => o.price!)?.id ?? null);
  readonly cheapestUnitId = computed(() => this.minBy(this.alternativesPool().filter((o) => o.unitPrice), (o) => o.unitPrice!.value)?.id ?? null);
  readonly unit = computed(() => this.data.offer.unitPrice?.per ?? null);

  searchByGtin(): void {
    const code = this.data.offer.gtinRaw ?? this.data.offer.gtin;
    const country = this.preferences.countryCode();
    const stores = this.preferences.queryableStoreIds();
    if (!code || !country || stores.length === 0) return;
    this.searching.set(true);
    this.gtinError.set(null);
    this.api
      .byGtin(country, code, stores, this.preferences.location())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.gtinSearch.set(response);
          this.searching.set(false);
        },
        error: (error: unknown) => {
          this.gtinError.set(describeApiError(error));
          this.searching.set(false);
        },
      });
  }

  addToList(offer: Offer): void {
    this.dialog
      .open<AddToListDialogComponent, { offer: Offer }, AddToListResult>(AddToListDialogComponent, { data: { offer }, width: '520px' })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.notify.info(this.i18n.t(result.merged ? 'addToList.merged' : 'addToList.added', { list: result.listName }));
      });
  }

  private minBy(offers: Offer[], value: (o: Offer) => number): Offer | undefined {
    return offers.reduce<Offer | undefined>((best, o) => (best === undefined || value(o) < value(best) ? o : best), undefined);
  }
}

import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { catchError, map, of, Subject, switchMap } from 'rxjs';
import { buildComparison } from '../../core/logic/compare';
import { matchesPresentation, parseDesiredPresentation } from '../../core/logic/presentation';
import type { AppMessage, Offer, SearchResponse } from '../../core/models/api.models';
import { ApiService, describeApiError } from '../../core/services/api.service';
import { ListsService } from '../../core/services/lists.service';
import { PreferencesService } from '../../core/services/preferences.service';

export interface BestPriceDialogData {
  listId: string;
  itemIds: string[];
}

interface OptionRow {
  offer: Offer;
  matchesDesired: boolean;
  isBestComparable: boolean;
}

@Component({
  selector: 'app-best-price-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './best-price-dialog.component.html',
  styleUrl: './best-price-dialog.component.scss',
})
export class BestPriceDialogComponent {
  readonly data = inject<BestPriceDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<BestPriceDialogComponent, number>);
  private readonly api = inject(ApiService);
  private readonly lists = inject(ListsService);
  readonly preferences = inject(PreferencesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly index = signal(0);
  readonly loading = signal(false);
  readonly response = signal<SearchResponse | null>(null);
  readonly error = signal<AppMessage | null>(null);
  readonly selectedOfferId = signal<string | null>(null);
  readonly assigned = signal(0);
  private readonly search$ = new Subject<string>();

  readonly list = computed(() => this.lists.lists().find((l) => l.id === this.data.listId) ?? null);
  readonly item = computed(() => this.list()?.items.find((i) => i.id === this.data.itemIds[this.index()]) ?? null);
  readonly isLast = computed(() => this.index() >= this.data.itemIds.length - 1);

  readonly options = computed<OptionRow[]>(() => {
    const response = this.response();
    const item = this.item();
    if (!response || !item) return [];
    const desired = parseDesiredPresentation(item.desiredPresentation);
    const comparison = buildComparison(response.offers);
    const rows = response.offers.map((offer) => ({
      offer,
      matchesDesired: matchesPresentation(offer.content, desired),
      isBestComparable: comparison.groupByOfferId.get(offer.id)?.bestOfferIds.includes(offer.id) ?? false,
    }));
    const priceOf = (o: Offer) => o.price ?? Number.POSITIVE_INFINITY;
    return rows.sort(
      (a, b) =>
        Number(b.offer.price !== null) - Number(a.offer.price !== null) ||
        Number(b.matchesDesired) - Number(a.matchesDesired) ||
        (desired ? priceOf(a.offer) - priceOf(b.offer) : (a.offer.unitPrice?.value ?? priceOf(a.offer)) - (b.offer.unitPrice?.value ?? priceOf(b.offer))),
    );
  });
  readonly hasDesired = computed(() => parseDesiredPresentation(this.item()?.desiredPresentation) !== null);

  constructor() {
    this.search$
      .pipe(
        switchMap((query) => {
          this.loading.set(true);
          this.error.set(null);
          this.response.set(null);
          this.selectedOfferId.set(null);
          return this.api.search(this.preferences.countryCode()!, query, this.preferences.queryableStoreIds(), this.preferences.location()).pipe(
            map((response) => ({ response, error: null as AppMessage | null })),
            catchError((error: unknown) => of({ response: null, error: describeApiError(error) })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ response, error }) => {
        this.loading.set(false);
        this.response.set(response);
        this.error.set(error);
      });

    // Solo cambia de consulta al avanzar de artículo (no cuando se asigna una oferta al actual).
    effect(() => {
      this.index();
      untracked(() => {
        const item = this.item();
        if (item && this.preferences.queryableStoreIds().length) this.search$.next(item.productQuery);
      });
    });
  }

  choose(): void {
    const item = this.item();
    const option = this.options().find((o) => o.offer.id === this.selectedOfferId());
    if (!item || !option || option.offer.price === null) return;
    this.lists.setOffer(this.data.listId, item.id, option.offer);
    this.assigned.update((n) => n + 1);
    this.next();
  }

  next(): void {
    if (this.isLast()) {
      this.ref.close(this.assigned());
      return;
    }
    this.index.update((i) => i + 1);
  }

  finish(): void {
    this.ref.close(this.assigned());
  }
}

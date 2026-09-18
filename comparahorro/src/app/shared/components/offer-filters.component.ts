import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { OfferFilters, OfferSort } from '../../core/logic/filters';
import type { StoreQueryResult, UnitPriceBasis } from '../../core/models/api.models';

@Component({
  selector: 'app-offer-filters',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filters">
      <fieldset>
        <legend>{{ 'filters.stores' | t }}</legend>
        @for (store of stores(); track store.storeId) {
          <mat-checkbox
            [checked]="filters().storeIds.length === 0 || filters().storeIds.includes(store.storeId)"
            [disabled]="store.status !== 'ok'"
            (change)="toggleStore(store.storeId, $event.checked)"
          >
            {{ store.storeName }} <span class="ca-muted">({{ store.resultCount }})</span>
          </mat-checkbox>
        }
      </fieldset>

      <fieldset class="range">
        <legend>{{ 'filters.priceRange' | t: { symbol: currencySymbol() } }}</legend>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>{{ 'filters.min' | t }}</mat-label>
          <input matInput type="number" min="0" step="0.01" inputmode="decimal" [value]="filters().minPrice ?? ''" (change)="setPrice('minPrice', $any($event.target).value)" />
        </mat-form-field>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>{{ 'filters.max' | t }}</mat-label>
          <input matInput type="number" min="0" step="0.01" inputmode="decimal" [value]="filters().maxPrice ?? ''" (change)="setPrice('maxPrice', $any($event.target).value)" />
        </mat-form-field>
        @if (filters().minPrice !== null || filters().maxPrice !== null) {
          <p class="ca-small ca-muted hint">{{ 'filters.rangeHint' | t }}</p>
        }
      </fieldset>

      <fieldset>
        <legend>{{ 'filters.show' | t }}</legend>
        <mat-slide-toggle [checked]="filters().onlyAvailable" (change)="patch({ onlyAvailable: $event.checked })">{{ 'filters.onlyAvailable' | t }}</mat-slide-toggle>
        <mat-slide-toggle [checked]="filters().onlyPromotions" (change)="patch({ onlyPromotions: $event.checked })">{{ 'filters.onlyPromotions' | t }}</mat-slide-toggle>
      </fieldset>

      <mat-form-field subscriptSizing="dynamic">
        <mat-label>{{ 'filters.sortBy' | t }}</mat-label>
        <mat-select [value]="filters().sort" (selectionChange)="patch({ sort: $event.value })">
          <mat-option value="relevance">{{ 'filters.sort.relevance' | t }}</mat-option>
          <mat-option value="price_asc">{{ 'filters.sort.priceAsc' | t }}</mat-option>
          <mat-option value="price_desc">{{ 'filters.sort.priceDesc' | t }}</mat-option>
          <mat-option value="unit_price_asc">{{ 'filters.sort.unitAsc' | t: { unit: (dominantUnit() ?? defaultUnit() | unitName) } }}</mat-option>
        </mat-select>
      </mat-form-field>
      @if (filters().sort === 'unit_price_asc') {
        <p class="ca-small ca-muted hint">{{ 'filters.unitHint' | t: { unit: (dominantUnit() ?? defaultUnit() | unitName) } }}</p>
      }

      <button mat-button type="button" (click)="reset.emit()">{{ 'search.clearFilters' | t }}</button>
    </div>
  `,
  styles: `
    .filters { display: grid; gap: 12px; }
    fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: 4px; min-width: 0; }
    legend { font: var(--mat-sys-title-small); margin-bottom: 4px; }
    .range { grid-template-columns: 1fr 1fr; gap: 8px; }
    .range legend, .range .hint { grid-column: 1 / -1; }
    .hint { margin: 0; }
  `,
})
export class OfferFiltersComponent {
  readonly filters = input.required<OfferFilters>();
  readonly stores = input.required<StoreQueryResult[]>();
  readonly currencySymbol = input('Q');
  readonly dominantUnit = input<UnitPriceBasis | null>(null);
  readonly defaultUnit = input<UnitPriceBasis>('kg');

  readonly changed = output<OfferFilters>();
  readonly reset = output<void>();

  patch(changes: Partial<OfferFilters>): void {
    this.changed.emit({ ...this.filters(), ...changes, sort: (changes.sort ?? this.filters().sort) as OfferSort });
  }

  setPrice(key: 'minPrice' | 'maxPrice', raw: string): void {
    const value = raw === '' ? null : Number(raw);
    this.patch({ [key]: value !== null && Number.isFinite(value) && value >= 0 ? value : null });
  }

  toggleStore(storeId: string, checked: boolean): void {
    const okStores = this.stores().filter((s) => s.status === 'ok').map((s) => s.storeId);
    const current = this.filters().storeIds.length ? this.filters().storeIds : okStores;
    const next = checked ? [...new Set([...current, storeId])] : current.filter((id) => id !== storeId);
    this.patch({ storeIds: next.length === okStores.length ? [] : next });
  }
}

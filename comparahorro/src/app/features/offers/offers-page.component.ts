import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import type { Observable } from 'rxjs';
import type { MessageKey } from '../../core/i18n/translate';
import type { SearchResponse } from '../../core/models/api.models';
import { ApiService } from '../../core/services/api.service';
import { SearchStateService } from '../../core/services/search-state.service';
import { OfferResultsBase } from '../../shared/offer-results.base';

interface Category {
  key: MessageKey;
  es: string;
  en: string;
}

const CATEGORIES: Category[] = [
  { key: 'offers.all', es: '', en: '' },
  { key: 'offers.category.rice', es: 'arroz', en: 'rice' },
  { key: 'offers.category.milk', es: 'leche', en: 'milk' },
  { key: 'offers.category.eggs', es: 'huevos', en: 'eggs' },
  { key: 'offers.category.oil', es: 'aceite', en: 'oil' },
  { key: 'offers.category.detergent', es: 'detergente', en: 'detergent' },
];

@Component({
  selector: 'app-offers-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ca-page">
      <h1 class="ca-page-title">{{ 'offers.title' | t }}</h1>
      <p class="ca-page-subtitle">{{ 'offers.subtitle' | t: { stores: storeNames() || ('offers.yourStores' | t) } }}</p>

      @if (preferences.queryableStoreIds().length) {
        <form class="bar" (submit)="$event.preventDefault(); submit()">
          <mat-form-field subscriptSizing="dynamic" class="term">
            <mat-label>{{ 'offers.filter' | t }}</mat-label>
            <mat-icon matPrefix>local_offer</mat-icon>
            <input matInput [formControl]="termControl" maxlength="80" autocomplete="off" />
          </mat-form-field>
          @if (loading()) {
            <button mat-stroked-button type="button" (click)="cancel()">{{ 'common.cancel' | t }}</button>
          } @else {
            <button mat-flat-button type="submit">{{ 'offers.submit' | t }}</button>
          }
        </form>
        <div class="ca-row chips">
          @for (category of categories(); track category.key) {
            <button mat-stroked-button type="button" [class.active]="state().query === category.value && !!response()" (click)="pick(category.value)">
              {{ category.key | t }}
            </button>
          }
        </div>
      } @else {
        <div class="ca-notice info"><mat-icon aria-hidden="true">travel_explore</mat-icon><span>{{ 'offers.noQueryable' | t }}</span></div>
      }

      @if (preferences.linkStores().length) {
        <app-link-stores class="block" [stores]="preferences.linkStores()" [allowNote]="false" />
      }

      @if (loading()) {
        <div class="ca-surface loading" role="status">
          <mat-progress-bar mode="indeterminate" />
          <span>{{ 'offers.loading' | t }}</span>
        </div>
      }
      @if (error(); as message) {
        <div class="ca-notice error" role="alert"><mat-icon aria-hidden="true">error</mat-icon><span>{{ message | msg }}</span></div>
      }

      @if (response(); as result) {
        <app-store-query-status class="block" [stores]="result.stores" />
        @if (result.offers.length === 0) {
          <app-empty-state icon="sell" [title]="'offers.emptyTitle' | t" [message]="(respondedCount() ? 'offers.emptyResponded' : 'offers.emptyNone') | t" />
        } @else {
          <div class="ca-row counts">
            <strong>{{ 'offers.count' | t: { count: visibleOffers().length } }}</strong>
            <span class="ca-spacer"></span>
            <mat-form-field subscriptSizing="dynamic" class="store-filter">
              <mat-label>{{ 'offers.store' | t }}</mat-label>
              <mat-select [value]="filters().storeIds[0] ?? ''" (selectionChange)="filterStore($event.value)">
                <mat-option value="">{{ 'offers.all' | t }}</mat-option>
                @for (store of result.stores; track store.storeId) {
                  @if (store.status === 'ok') {
                    <mat-option [value]="store.storeId">{{ store.storeName }} ({{ store.resultCount }})</mat-option>
                  }
                }
              </mat-select>
            </mat-form-field>
          </div>
          <div class="ca-grid">
            @for (offer of visibleOffers(); track offer.id) {
              <app-offer-card [offer]="offer" [group]="summary().groupByOfferId.get(offer.id)" (compare)="openCompare($event)" (addToList)="openAddToList($event)" />
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .bar .term { flex: 1 1 280px; }
    .bar button { height: 52px; }
    .chips { margin: 8px 0 12px; gap: 6px; }
    .chips button { border-radius: 999px; }
    .chips button.active { background: var(--mat-sys-secondary-container); }
    .loading { display: grid; gap: 8px; margin: 12px 0; }
    .block { display: block; margin: 12px 0; }
    .counts { margin: 8px 0 12px; }
    .store-filter { width: 240px; max-width: 100%; }
  `,
})
export class OffersPageComponent extends OfferResultsBase {
  private readonly api = inject(ApiService);
  protected readonly state = inject(SearchStateService).offers;

  readonly termControl = new FormControl(this.state().query, { nonNullable: true });
  readonly storeNames = computed(() => this.preferences.queryableStores().map((s) => s.name).join(', '));
  /** Los términos van en el idioma de los catálogos del país; la etiqueta, en el de la interfaz. */
  readonly categories = computed(() => {
    const catalog = this.preferences.country()?.locale.startsWith('en') ? 'en' : 'es';
    return CATEGORIES.map((c) => ({ key: c.key, value: c[catalog] }));
  });

  constructor() {
    super();
    this.startListening();
    // El catalogo de tiendas llega despues del primer render: se espera a tenerlo
    // para lanzar la consulta, en vez de dejar la pantalla vacia sin avisar.
    effect(() => {
      const stores = this.preferences.queryableStoreIds();
      untracked(() => {
        if (stores.length && !this.state().response && !this.loading()) this.run(this.state().query);
      });
    });
  }

  protected fetch(query: string): Observable<SearchResponse> {
    return this.api.offers(this.preferences.countryCode()!, query, this.preferences.queryableStoreIds(), this.preferences.location());
  }

  submit(): void {
    this.run(this.termControl.value.trim());
  }

  pick(value: string): void {
    this.termControl.setValue(value);
    this.run(value);
  }

  filterStore(storeId: string): void {
    this.updateFilters({ ...this.filters(), storeIds: storeId ? [storeId] : [] });
  }
}

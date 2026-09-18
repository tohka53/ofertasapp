import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, Validators } from '@angular/forms';
import { map, type Observable } from 'rxjs';
import type { Lang, LocationsResponse, SearchResponse } from '../../core/models/api.models';
import { ApiService } from '../../core/services/api.service';
import { CatalogService } from '../../core/services/catalog.service';
import { SearchStateService } from '../../core/services/search-state.service';
import { OfferResultsBase } from '../../shared/offer-results.base';

const SUGGESTIONS: Record<Lang, string[]> = {
  es: ['arroz', 'leche', 'huevos', 'aceite', 'detergente'],
  en: ['milk', 'eggs', 'bread', 'coffee', 'rice'],
};

@Component({
  selector: 'app-search-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-page.component.html',
  styleUrl: './search-page.component.scss',
})
export class SearchPageComponent extends OfferResultsBase implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalog = inject(CatalogService);
  private readonly searchState = inject(SearchStateService);
  protected readonly state = this.searchState.search;

  readonly isHandset = toSignal(inject(BreakpointObserver).observe('(max-width: 959.98px)').pipe(map((r) => r.matches)), { initialValue: false });
  readonly queryControl = new FormControl(this.state().query, { nonNullable: true, validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)] });
  readonly locations = signal<LocationsResponse | null>(null);
  readonly linkQuery = signal(this.state().query);

  /** Idioma de los catálogos de las tiendas del país (las búsquedas se envían tal cual a cada tienda). */
  readonly catalogLang = computed<Lang>(() => (this.preferences.country()?.locale.startsWith('en') ? 'en' : 'es'));
  readonly suggestions = computed(() => SUGGESTIONS[this.catalogLang()]);
  readonly queryableNames = computed(() => this.preferences.queryableStores().map((s) => s.name).join(', '));
  readonly stockStoreNames = computed(() => this.preferences.stockNeedsLocation().map((s) => s.name).join(', '));

  constructor() {
    super();
    this.startListening();
  }

  ngOnInit(): void {
    const code = this.preferences.countryCode();
    if (code) {
      void this.catalog.loadStores(code, false, this.preferences.stateCode());
      void this.catalog.loadLocations(code).then((l) => this.locations.set(l)).catch(() => undefined);
    }
    const { query, response, error } = this.state();
    if (query && !response && !error && this.preferences.queryableStoreIds().length) this.run(query);
  }

  protected fetch(query: string): Observable<SearchResponse> {
    return this.api.search(this.preferences.countryCode()!, query, this.preferences.queryableStoreIds(), this.preferences.location());
  }

  submit(): void {
    const query = this.queryControl.value.trim();
    if (query.length < 2) {
      this.queryControl.markAsTouched();
      return;
    }
    this.queryControl.setValue(query);
    this.linkQuery.set(query);
    if (this.preferences.queryableStoreIds().length === 0) {
      this.state.update((s) => ({ ...s, query }));
      return;
    }
    this.run(query);
  }

  searchSuggestion(term: string): void {
    this.queryControl.setValue(term);
    this.submit();
  }

  useDefaultLocation(): void {
    const defaults = this.locations()?.defaultLocation;
    if (!defaults) return;
    this.preferences.setLocation({
      mode: 'zone',
      department: defaults.department,
      name: defaults.name,
      postalCode: defaults.postalCode,
      lat: null,
      lng: null,
      isDefault: true,
    });
    const query = this.queryControl.value.trim();
    if (query.length >= 2 && this.preferences.queryableStoreIds().length) this.run(query);
  }
}

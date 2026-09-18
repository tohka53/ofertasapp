import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject } from 'rxjs';
import type { Country, LocalizedText, StoreSummary } from '../models/api.models';
import type { LocationSelection } from '../models/app.models';
import { CatalogService } from './catalog.service';
import { SessionEventsService } from './session-events.service';

export type PreferenceChange = 'country' | 'state' | 'stores' | 'location';

/** País, estado, tiendas y ubicación elegidos por el usuario durante la sesión (solo memoria). */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly catalog = inject(CatalogService);
  private readonly countryCodeState = signal<string | null>(null);
  private readonly stateCodeState = signal<string | null>(null);
  private readonly storeIdsState = signal<string[]>([]);
  private readonly locationState = signal<LocationSelection | null>(null);
  private readonly changesSubject = new Subject<PreferenceChange>();

  readonly countryCode = this.countryCodeState.asReadonly();
  readonly stateCode = this.stateCodeState.asReadonly();
  readonly selectedStoreIds = this.storeIdsState.asReadonly();
  readonly location = this.locationState.asReadonly();
  readonly changes$: Observable<PreferenceChange> = this.changesSubject.asObservable();

  readonly country = computed<Country | null>(() => this.catalog.country(this.countryCodeState()));
  readonly requiresState = computed(() => this.country()?.regionKind === 'state');

  readonly stateName = computed<LocalizedText | null>(() => {
    const code = this.countryCodeState();
    const state = this.stateCodeState();
    if (!code || !state) return null;
    return this.catalog.locationsByCountry()[code]?.states.find((s) => s.code === state)?.name ?? { es: state, en: state };
  });

  readonly selectedStores = computed<StoreSummary[]>(() => {
    const stores = this.catalog.storesFor(this.countryCodeState(), this.stateCodeState())?.stores ?? [];
    const ids = this.storeIdsState();
    return stores.filter((s) => ids.includes(s.id));
  });

  /** Tiendas que el servidor consulta; las de solo enlace se muestran aparte. */
  readonly queryableStores = computed(() => this.selectedStores().filter((s) => s.queryable));
  readonly queryableStoreIds = computed(() => this.queryableStores().map((s) => s.id));
  readonly linkStores = computed(() => this.selectedStores().filter((s) => s.integrationKind === 'link'));

  readonly setupComplete = computed(() => this.countryCodeState() !== null && this.storeIdsState().length > 0);

  /** Alguna tienda consultada publica precios distintos por ubicación. */
  readonly locationRequired = computed(() => this.queryableStores().some((s) => s.location.priceVariesByLocation));
  readonly stockNeedsLocation = computed(() => this.queryableStores().filter((s) => s.location.availabilityRequiresLocation));
  readonly locationUseful = computed(() => this.queryableStores().some((s) => s.location.usesLocation));

  constructor() {
    inject(SessionEventsService)
      .reset$.pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.countryCodeState.set(null);
        this.stateCodeState.set(null);
        this.storeIdsState.set([]);
        this.locationState.set(null);
      });
  }

  /** Cambiar de país obliga a elegir de nuevo estado, tiendas y ubicación; las listas quedan ligadas a su país. */
  setCountry(code: string): void {
    if (this.countryCodeState() === code) return;
    this.countryCodeState.set(code);
    this.stateCodeState.set(null);
    this.storeIdsState.set([]);
    this.locationState.set(null);
    this.changesSubject.next('country');
  }

  setState(code: string | null): void {
    if (this.stateCodeState() === code) return;
    this.stateCodeState.set(code);
    this.storeIdsState.set([]);
    this.locationState.set(null);
    this.changesSubject.next('state');
  }

  setStores(ids: string[]): void {
    this.storeIdsState.set([...new Set(ids)]);
    this.changesSubject.next('stores');
  }

  setLocation(location: LocationSelection | null): void {
    this.locationState.set(location);
    this.changesSubject.next('location');
  }
}

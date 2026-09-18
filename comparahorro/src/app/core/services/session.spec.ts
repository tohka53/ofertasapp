import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../i18n/i18n.service';
import { makeOffer } from '../logic/test-data';
import type { Country } from '../models/api.models';
import { SupabaseService } from '../supabase/supabase.service';
import { ListsService } from './lists.service';
import { PreferencesService } from './preferences.service';
import { SearchStateService } from './search-state.service';
import { SessionEventsService } from './session-events.service';

const guatemala: Country = {
  code: 'GT',
  name: { es: 'Guatemala', en: 'Guatemala' },
  currency: 'GTQ',
  currencySymbol: 'Q',
  locale: 'es-GT',
  flag: '',
  unitSystem: 'metric',
  regionKind: 'none',
  locationMode: 'gt-zones',
  storeCount: 9,
  connectedStoreCount: 4,
};

/** Doble de Supabase: acepta cualquier encadenamiento y resuelve sin red. */
function fakeClient(): unknown {
  const result = { data: { purge_at: '2027-01-01' }, error: null };
  const node: unknown = new Proxy(function noop() {}, {
    get(_target, property) {
      if (property === 'then') return (resolve: (value: unknown) => void) => resolve(result);
      if (property === 'auth') {
        return {
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
          getSession: async () => ({ data: { session: null }, error: null }),
        };
      }
      return () => node;
    },
    apply() {
      return node;
    },
  }) as unknown;
  return node;
}

describe('Listas y preferencias de la sesión', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SupabaseService, useValue: { client: fakeClient() } }],
    });
  });

  it('al cerrar la sesión se limpian preferencias, listas y resultados', () => {
    const preferences = TestBed.inject(PreferencesService);
    const lists = TestBed.inject(ListsService);
    const searchState = TestBed.inject(SearchStateService);

    preferences.setCountry('GT');
    preferences.setStores(['walmart-gt']);
    const list = lists.create({ name: 'Compras de septiembre', month: 9, year: 2026 }, guatemala);
    lists.addOffer(list.id, makeOffer({ id: 'walmart-gt:1', storeId: 'walmart-gt', price: 10 }), 2);
    searchState.search.update((s) => ({ ...s, query: 'leche' }));

    TestBed.inject(SessionEventsService).emitReset();

    expect(preferences.countryCode()).toBeNull();
    expect(preferences.selectedStoreIds()).toEqual([]);
    expect(lists.lists()).toEqual([]);
    expect(searchState.search().query).toBe('');
  });

  it('las listas quedan ligadas a su país y no aceptan ofertas de otra moneda', () => {
    const preferences = TestBed.inject(PreferencesService);
    const lists = TestBed.inject(ListsService);
    preferences.setCountry('GT');
    const list = lists.create({ name: '', month: 9, year: 2026 }, guatemala);
    expect(list.name).toBe('Compras de septiembre');
    expect(() => lists.addOffer(list.id, makeOffer({ id: 'x:1', storeId: 'x', countryCode: 'SV', price: 1 }), 1)).toThrow();
    const first = lists.addOffer(list.id, makeOffer({ id: 'walmart-gt:1', storeId: 'walmart-gt', price: 10 }), 2);
    const again = lists.addOffer(list.id, makeOffer({ id: 'walmart-gt:1', storeId: 'walmart-gt', price: 10 }), 3);
    expect([first.merged, again.merged]).toEqual([false, true]);
    expect(lists.get(list.id)!.items[0]!.quantity).toBe(5);

    preferences.setCountry('SV');
    expect(lists.listsForCurrentCountry()).toEqual([]);
    expect(lists.otherCountriesListCount()).toBe(1);
    expect(preferences.selectedStoreIds()).toEqual([]);
  });

  it('una lista nueva nace con su propietario como único integrante y con fecha de borrado', () => {
    const lists = TestBed.inject(ListsService);
    const list = lists.create({ name: 'Julio', month: 7, year: 2026, familyId: null }, guatemala);
    expect(list.role).toBe('admin');
    expect(list.memberCount).toBe(1);
    expect(list.familyId).toBeNull();
  });

  it('cambiar de estado reinicia tiendas y ubicación; cambiar de país también quita el estado', () => {
    const preferences = TestBed.inject(PreferencesService);
    preferences.setCountry('US');
    preferences.setState('OH');
    preferences.setStores(['kroger-us']);
    preferences.setLocation({ mode: 'zip', department: null, name: null, postalCode: '45202', lat: null, lng: null, isDefault: false });
    preferences.setState('TX');
    expect(preferences.selectedStoreIds()).toEqual([]);
    expect(preferences.location()).toBeNull();
    preferences.setCountry('GT');
    expect(preferences.stateCode()).toBeNull();
  });

  it('el idioma cambia sin recargar y nombra las listas nuevas', () => {
    const i18n = TestBed.inject(I18nService);
    const lists = TestBed.inject(ListsService);
    expect(i18n.lang()).toBe('es');
    i18n.setLang('en');
    expect(lists.create({ name: '', month: 9, year: 2026 }, guatemala).name).toBe('September shopping');
    TestBed.tick();
    expect(document.documentElement.lang).toBe('en');
    i18n.setLang('es');
  });
});

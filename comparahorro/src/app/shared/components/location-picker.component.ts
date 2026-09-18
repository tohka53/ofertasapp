import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { MessageKey } from '../../core/i18n/translate';
import type { AppMessage, CityPreset, DepartmentLocations, LocationResolution, LocationsResponse, StoreSummary } from '../../core/models/api.models';
import type { LocationSelection } from '../../core/models/app.models';
import { ApiService, describeApiError } from '../../core/services/api.service';
import { CatalogService } from '../../core/services/catalog.service';

type Mode = LocationSelection['mode'];

const MODES_BY_COUNTRY: Record<LocationsResponse['mode'], Mode[]> = {
  'gt-zones': ['zone', 'postalCode', 'gps'],
  cities: ['city', 'gps'],
  'us-zip': ['zip'],
  none: [],
};

@Component({
  selector: 'app-location-picker',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './location-picker.component.html',
  styleUrl: './location-picker.component.scss',
})
export class LocationPickerComponent {
  private readonly catalog = inject(CatalogService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly countryCode = input.required<string>();
  readonly value = input<LocationSelection | null>(null);
  readonly stores = input<StoreSummary[]>([]);
  readonly applyLabel = input<MessageKey>('picker.apply');
  readonly apply = output<LocationSelection>();

  readonly locations = signal<LocationsResponse | null>(null);
  readonly loadError = signal<AppMessage | null>(null);
  readonly mode = signal<Mode>('zone');
  readonly department = signal<string | null>(null);
  readonly zonePostalCode = signal<string | null>(null);
  readonly manualPostalCode = signal('');
  readonly zip = signal('');
  readonly cityName = signal<string | null>(null);
  readonly gps = signal<{ lat: number; lng: number; accuracy: number } | null>(null);
  readonly gpsStatus = signal<'idle' | 'locating' | 'denied' | 'error'>('idle');
  readonly gpsMessage = signal<MessageKey | null>(null);
  readonly resolving = signal(false);
  readonly resolution = signal<LocationResolution[] | null>(null);
  readonly resolutionError = signal<AppMessage | null>(null);

  readonly modes = computed<Mode[]>(() => MODES_BY_COUNTRY[this.locations()?.mode ?? 'none']);
  readonly departments = computed<DepartmentLocations[]>(() => this.locations()?.departments ?? []);
  readonly zoneOptions = computed(() => this.departments().find((d) => d.name === this.department())?.options ?? []);
  readonly cities = computed<CityPreset[]>(() => this.locations()?.cities ?? []);
  readonly queryableStores = computed(() => this.stores().filter((s) => s.queryable));
  readonly geoStoreNames = computed(() => this.queryableStores().filter((s) => s.location.supportsGeoCoordinates).map((s) => s.name).join(', '));
  readonly nonGeoStoreNames = computed(() =>
    this.queryableStores()
      .filter((s) => s.location.usesLocation && !s.location.supportsGeoCoordinates)
      .map((s) => s.name)
      .join(', '),
  );
  readonly geolocationAvailable = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  readonly candidate = computed<LocationSelection | null>(() => {
    const base = { department: null, name: null, postalCode: null, lat: null, lng: null, isDefault: false };
    switch (this.mode()) {
      case 'zone': {
        const option = this.zoneOptions().find((o) => o.postalCode === this.zonePostalCode());
        if (!option) return null;
        const defaults = this.locations()?.defaultLocation;
        return {
          ...base,
          mode: 'zone',
          department: this.department(),
          name: option.name,
          postalCode: option.postalCode,
          isDefault: defaults?.postalCode === option.postalCode && defaults.department === this.department(),
        };
      }
      case 'postalCode': {
        const code = this.manualPostalCode().trim();
        return /^\d{5}$/.test(code) ? { ...base, mode: 'postalCode', postalCode: code } : null;
      }
      case 'zip': {
        const code = this.zip().trim();
        return /^\d{5}$/.test(code) ? { ...base, mode: 'zip', postalCode: code } : null;
      }
      case 'city': {
        const city = this.cities().find((c) => c.name === this.cityName());
        return city ? { ...base, mode: 'city', name: city.name, lat: city.lat, lng: city.lng } : null;
      }
      case 'gps': {
        const coords = this.gps();
        return coords ? { ...base, mode: 'gps', lat: coords.lat, lng: coords.lng } : null;
      }
    }
  });

  constructor() {
    effect(() => {
      const code = this.countryCode();
      untracked(() => {
        this.catalog
          .loadLocations(code)
          .then((response) => {
            this.locations.set(response);
            this.initFromValue(response);
          })
          .catch((error: unknown) => this.loadError.set(describeApiError(error)));
      });
    });
  }

  private initFromValue(response: LocationsResponse): void {
    const allowed = MODES_BY_COUNTRY[response.mode];
    const current = this.value();
    if (current && allowed.includes(current.mode)) {
      this.mode.set(current.mode);
      switch (current.mode) {
        case 'zone':
          this.department.set(current.department);
          this.zonePostalCode.set(current.postalCode);
          break;
        case 'postalCode':
          this.manualPostalCode.set(current.postalCode ?? '');
          break;
        case 'zip':
          this.zip.set(current.postalCode ?? '');
          break;
        case 'city':
          this.cityName.set(current.name);
          break;
        case 'gps':
          if (current.lat !== null && current.lng !== null) this.gps.set({ lat: current.lat, lng: current.lng, accuracy: 0 });
          break;
      }
      return;
    }
    this.mode.set(allowed[0] ?? 'zone');
    if (response.defaultLocation) {
      this.department.set(response.defaultLocation.department);
      this.zonePostalCode.set(response.defaultLocation.postalCode);
    }
    this.cityName.set(response.cities[0]?.name ?? null);
  }

  modeKey(mode: Mode): MessageKey {
    return `picker.mode.${mode}`;
  }

  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.resolution.set(null);
  }

  selectDepartment(name: string): void {
    this.department.set(name);
    this.zonePostalCode.set(this.zoneOptions()[0]?.postalCode ?? null);
    this.resolution.set(null);
  }

  selectZone(postalCode: string): void {
    this.zonePostalCode.set(postalCode);
    this.resolution.set(null);
  }

  selectCity(name: string): void {
    this.cityName.set(name);
    this.resolution.set(null);
  }

  setManualPostalCode(value: string): void {
    this.manualPostalCode.set(value.replace(/\D/g, '').slice(0, 5));
    this.resolution.set(null);
  }

  setZip(value: string): void {
    this.zip.set(value.replace(/\D/g, '').slice(0, 5));
    this.resolution.set(null);
  }

  locate(): void {
    if (!this.geolocationAvailable) {
      this.gpsStatus.set('error');
      this.gpsMessage.set('picker.gpsUnavailable');
      return;
    }
    this.gpsStatus.set('locating');
    this.gpsMessage.set(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.gps.set({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: Math.round(position.coords.accuracy) });
        this.gpsStatus.set('idle');
        this.resolution.set(null);
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        this.gpsStatus.set(denied ? 'denied' : 'error');
        this.gpsMessage.set(denied ? 'picker.gpsDenied' : 'picker.gpsError');
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  checkBranches(): void {
    const candidate = this.candidate();
    const storeIds = this.queryableStores().map((s) => s.id);
    if (!candidate || storeIds.length === 0) return;
    this.resolving.set(true);
    this.resolutionError.set(null);
    this.api
      .resolveLocation(this.countryCode(), storeIds, candidate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          this.resolution.set(results);
          this.resolving.set(false);
        },
        error: (error: unknown) => {
          this.resolutionError.set(describeApiError(error));
          this.resolving.set(false);
        },
      });
  }

  submit(): void {
    const candidate = this.candidate();
    if (candidate) this.apply.emit(candidate);
  }
}

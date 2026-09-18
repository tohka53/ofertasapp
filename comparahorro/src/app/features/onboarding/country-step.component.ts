import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AppMessage, Country } from '../../core/models/api.models';
import { describeApiError } from '../../core/services/api.service';
import { CatalogService } from '../../core/services/catalog.service';
import { PreferencesService } from '../../core/services/preferences.service';

@Component({
  selector: 'app-country-step',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="ca-page-title">{{ 'country.title' | t }}</h1>
    <p class="ca-page-subtitle">{{ 'country.subtitle' | t }}</p>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" [attr.aria-label]="'country.loading' | t" />
    }
    @if (error(); as message) {
      <div class="ca-notice error" role="alert">
        <mat-icon aria-hidden="true">error</mat-icon>
        <span>{{ message | msg }}</span>
        <button mat-button type="button" (click)="load()">{{ 'common.retry' | t }}</button>
      </div>
    }

    <div class="countries">
      @for (country of countries(); track country.code) {
        <button type="button" class="country" [class.selected]="preferences.countryCode() === country.code" (click)="choose(country)" [attr.data-country]="country.code">
          <span class="flag" aria-hidden="true">{{ country.flag }}</span>
          <span class="text">
            <strong>{{ country.name | loc }}</strong>
            <span class="ca-small ca-muted">
              @if (country.storeCount === 0) {
                {{ 'country.noSources' | t }}
              } @else {
                {{ 'country.summary' | t: { stores: country.storeCount, connected: country.connectedStoreCount, currency: country.currency } }}
              }
            </span>
            @if (country.regionKind === 'state') {
              <span class="ca-small ca-muted">{{ 'country.byState' | t }}</span>
            }
          </span>
          <mat-icon aria-hidden="true">chevron_right</mat-icon>
        </button>
      }
    </div>
  `,
  styles: `
    .countries { display: grid; gap: 8px; margin-top: 8px; }
    .country { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; border: 1px solid var(--mat-sys-outline-variant); border-radius: 16px; padding: 14px 16px; background: var(--mat-sys-surface); cursor: pointer; font: inherit; color: inherit; }
    .country:hover, .country:focus-visible { border-color: var(--mat-sys-primary); }
    .country.selected { border-color: var(--mat-sys-primary); background: var(--ca-highlight-bg); }
    .flag { font-size: 32px; line-height: 1; }
    .text { display: grid; flex: 1 1 auto; min-width: 0; }
  `,
})
export class CountryStepComponent implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  readonly preferences = inject(PreferencesService);

  readonly countries = signal<Country[]>([]);
  readonly loading = signal(false);
  readonly error = signal<AppMessage | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.countries.set(await this.catalog.loadCountries());
    } catch (error) {
      this.error.set(describeApiError(error));
    } finally {
      this.loading.set(false);
    }
  }

  choose(country: Country): void {
    this.preferences.setCountry(country.code);
    void this.router.navigateByUrl(country.regionKind === 'state' && !this.preferences.stateCode() ? '/configurar/estado' : '/configurar/tiendas');
  }
}

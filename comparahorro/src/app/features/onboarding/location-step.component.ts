import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { MessageKey } from '../../core/i18n/translate';
import type { LocationSelection } from '../../core/models/app.models';
import { PreferencesService } from '../../core/services/preferences.service';

@Component({
  selector: 'app-location-step',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="ca-page-title">{{ 'location.title' | t }}</h1>
    @if (preferences.locationRequired()) {
      <div class="ca-notice warn">
        <mat-icon aria-hidden="true">location_on</mat-icon>
        <span>
          {{ 'location.requiredPrefix' | t }}<strong>{{ 'location.requiredStrong' | t }}</strong>{{ requiredSuffix() | t }}
        </span>
      </div>
    } @else {
      <p class="ca-page-subtitle">{{ 'location.optional' | t }}</p>
    }
    @if (stockStores()) {
      <div class="ca-notice info">
        <mat-icon aria-hidden="true">inventory_2</mat-icon>
        <span>{{ 'location.stockNeedsLocation' | t: { stores: stockStores() } }}</span>
      </div>
    }

    <section class="ca-surface">
      @if (preferences.countryCode(); as code) {
        <app-location-picker
          [countryCode]="code"
          [value]="preferences.location()"
          [stores]="preferences.selectedStores()"
          [applyLabel]="'location.saveAndSearch'"
          (apply)="save($event)"
        />
      }
    </section>

    <div class="footer">
      <a mat-button routerLink="/configurar/tiendas"><mat-icon>arrow_back</mat-icon> {{ 'onboarding.step.stores' | t }}</a>
      <span class="ca-spacer"></span>
      @if (!preferences.locationRequired()) {
        <button mat-button type="button" (click)="skip()">{{ 'location.skip' | t }}</button>
      }
    </div>
  `,
  styles: `
    .ca-notice { margin-bottom: 12px; }
    .footer { display: flex; gap: 8px; align-items: center; margin-top: 16px; }
  `,
})
export class LocationStepComponent {
  readonly preferences = inject(PreferencesService);
  private readonly router = inject(Router);

  readonly requiredSuffix = computed<MessageKey>(() => `location.requiredSuffix.${this.preferences.country()?.locationMode ?? 'none'}`);
  readonly stockStores = computed(() => this.preferences.stockNeedsLocation().map((s) => s.name).join(', '));

  save(location: LocationSelection): void {
    this.preferences.setLocation(location);
    void this.router.navigateByUrl('/buscar');
  }

  skip(): void {
    this.preferences.setLocation(null);
    void this.router.navigateByUrl('/buscar');
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import type { AppMessage, StoresResponse } from '../../core/models/api.models';
import { describeApiError } from '../../core/services/api.service';
import { CatalogService } from '../../core/services/catalog.service';
import { PreferencesService } from '../../core/services/preferences.service';

@Component({
  selector: 'app-stores-step',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="ca-page-title">
      @if (preferences.stateName(); as state) {
        {{ 'stores.titleState' | t: { state: (state | loc) } }}
      } @else {
        {{ 'stores.title' | t }}
      }
    </h1>
    <p class="ca-page-subtitle">{{ 'stores.subtitle' | t }}</p>

    @if (loading()) {
      <div class="ca-surface loading" role="status">
        <mat-progress-bar mode="indeterminate" />
        <span>{{ 'stores.loading' | t: { place: place() } }}</span>
      </div>
    }
    @if (error(); as message) {
      <div class="ca-notice error" role="alert">
        <mat-icon aria-hidden="true">error</mat-icon>
        <span>{{ message | msg }}</span>
        <button mat-button type="button" (click)="load(true)">{{ 'common.retry' | t }}</button>
      </div>
    }

    @if (response(); as data) {
      @if (data.stores.length === 0) {
        <app-empty-state icon="store_mall_directory" [title]="'stores.emptyTitle' | t: { place: place() }" [message]="'stores.emptyMessage' | t">
          <a mat-flat-button routerLink="/configurar/pais">{{ 'stores.otherCountry' | t }}</a>
        </app-empty-state>
      } @else {
        @if (noSelectable()) {
          <div class="ca-notice warn no-selectable">
            <mat-icon aria-hidden="true">info</mat-icon>
            <span>{{ 'stores.noSelectable' | t: { place: place() } }}</span>
          </div>
        }
        <app-store-selector [stores]="data.stores" [selected]="selection()" [state]="data.state" (selectedChange)="selection.set($event)" />
        @if (hasQueryable()) {
          <div class="ca-row status-note">
            <span class="ca-small ca-muted">{{ 'stores.checkedAt' | t: { date: (checkedAt() | dateTime: 'common.notChecked') } }}</span>
            <button mat-button type="button" (click)="load(true)" [disabled]="loading()">
              <mat-icon>refresh</mat-icon>
              {{ 'stores.recheck' | t }}
            </button>
          </div>
        }
      }
    }

    <div class="footer">
      @if (preferences.requiresState()) {
        <a mat-button routerLink="/configurar/estado"><mat-icon>arrow_back</mat-icon> {{ 'stores.changeState' | t }}</a>
      } @else {
        <a mat-button routerLink="/configurar/pais"><mat-icon>arrow_back</mat-icon> {{ 'onboarding.step.country' | t }}</a>
      }
      <span class="ca-spacer"></span>
      <button mat-flat-button type="button" (click)="continue()" [disabled]="selection().length === 0">
        {{ 'stores.continue' | t }}
        <mat-icon iconPositionEnd>arrow_forward</mat-icon>
      </button>
    </div>
  `,
  styles: `
    .loading { display: grid; gap: 8px; margin-bottom: 12px; }
    .no-selectable { margin-bottom: 12px; }
    .status-note { justify-content: space-between; margin-top: 8px; }
    .footer { display: flex; gap: 8px; align-items: center; margin-top: 16px; position: sticky; bottom: 0; background: var(--mat-sys-surface-container-lowest); padding: 12px 0; border-top: 1px solid var(--mat-sys-outline-variant); }
  `,
})
export class StoresStepComponent implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly preferences = inject(PreferencesService);

  readonly response = signal<StoresResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<AppMessage | null>(null);
  readonly selection = signal<string[]>([...this.preferences.selectedStoreIds()]);
  readonly checkedAt = computed(() => this.response()?.stores.find((s) => s.checkedAt)?.checkedAt ?? null);
  readonly hasQueryable = computed(() => this.response()?.stores.some((s) => s.queryable) ?? false);
  readonly noSelectable = computed(() => !!this.response()?.stores.length && !this.response()!.stores.some((s) => s.selectable));

  readonly place = computed(() => {
    const state = this.preferences.stateName();
    if (state) return this.i18n.loc(state);
    return this.i18n.loc(this.response()?.country.name ?? this.preferences.country()?.name);
  });

  ngOnInit(): void {
    void this.load(false);
  }

  async load(force: boolean): Promise<void> {
    const code = this.preferences.countryCode();
    if (!code) return;
    const state = this.preferences.stateCode();
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = force ? await this.catalog.refreshStoreStatus(code, state) : await this.catalog.loadStores(code, true, state);
      this.response.set(response);
      const valid = new Set(response.stores.filter((s) => s.selectable).map((s) => s.id));
      this.selection.update((ids) => ids.filter((id) => valid.has(id)));
    } catch (error) {
      this.error.set(describeApiError(error));
    } finally {
      this.loading.set(false);
    }
  }

  continue(): void {
    const ids = this.selection();
    if (!ids.length) return;
    this.preferences.setStores(ids);
    const usesLocation = this.response()?.stores.some((s) => ids.includes(s.id) && s.queryable && s.location.usesLocation) ?? false;
    void this.router.navigateByUrl(usesLocation ? '/configurar/ubicacion' : '/buscar');
  }
}

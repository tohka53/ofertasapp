import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { normalizeText } from '../../core/logic/format';
import type { AppMessage, StateOption } from '../../core/models/api.models';
import { describeApiError } from '../../core/services/api.service';
import { CatalogService } from '../../core/services/catalog.service';
import { PreferencesService } from '../../core/services/preferences.service';

@Component({
  selector: 'app-state-step',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="ca-page-title">{{ 'state.title' | t }}</h1>
    <p class="ca-page-subtitle">{{ 'state.subtitle' | t: { country: (preferences.country()?.name | loc) } }}</p>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (error(); as message) {
      <div class="ca-notice error" role="alert">
        <mat-icon aria-hidden="true">error</mat-icon>
        <span>{{ message | msg }}</span>
        <button mat-button type="button" (click)="load()">{{ 'common.retry' | t }}</button>
      </div>
    }

    <mat-form-field class="ca-full-width filter" subscriptSizing="dynamic">
      <mat-label>{{ 'state.filter' | t }}</mat-label>
      <mat-icon matPrefix>search</mat-icon>
      <input matInput [value]="filter()" (input)="filter.set($any($event.target).value)" autocomplete="off" />
    </mat-form-field>

    @if (!loading() && visible().length === 0 && states().length) {
      <p class="ca-small ca-muted">{{ 'state.noMatch' | t: { term: filter() } }}</p>
    }

    <div class="states">
      @for (state of visible(); track state.code) {
        <button type="button" class="state" [class.selected]="preferences.stateCode() === state.code" (click)="choose(state)" [attr.data-state]="state.code">
          <strong>{{ state.name | loc }}</strong>
          <span class="ca-small ca-muted">{{ state.code }}</span>
        </button>
      }
    </div>

    <div class="footer">
      <a mat-button routerLink="/configurar/pais"><mat-icon>arrow_back</mat-icon> {{ 'onboarding.step.country' | t }}</a>
    </div>
  `,
  styles: `
    .filter { margin: 4px 0 12px; }
    .states { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr)); }
    .state { display: flex; justify-content: space-between; align-items: center; gap: 8px; text-align: left; border: 1px solid var(--mat-sys-outline-variant); border-radius: 12px; padding: 12px 14px; background: var(--mat-sys-surface); cursor: pointer; font: inherit; color: inherit; }
    .state:hover, .state:focus-visible { border-color: var(--mat-sys-primary); }
    .state.selected { border-color: var(--mat-sys-primary); background: var(--ca-highlight-bg); }
    .footer { display: flex; margin-top: 16px; }
  `,
})
export class StateStepComponent implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly preferences = inject(PreferencesService);

  readonly states = signal<StateOption[]>([]);
  readonly loading = signal(false);
  readonly error = signal<AppMessage | null>(null);
  readonly filter = signal('');

  readonly visible = computed(() => {
    const term = normalizeText(this.filter());
    const lang = this.i18n.lang();
    const sorted = [...this.states()].sort((a, b) => a.name[lang].localeCompare(b.name[lang], lang));
    return term ? sorted.filter((s) => normalizeText(`${s.name.es} ${s.name.en} ${s.code}`).includes(term)) : sorted;
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const code = this.preferences.countryCode();
    if (!code) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      this.states.set((await this.catalog.loadLocations(code)).states);
    } catch (error) {
      this.error.set(describeApiError(error));
    } finally {
      this.loading.set(false);
    }
  }

  choose(state: StateOption): void {
    this.preferences.setState(state.code);
    void this.router.navigateByUrl('/configurar/tiendas');
  }
}

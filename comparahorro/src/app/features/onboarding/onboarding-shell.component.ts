import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import type { MessageKey } from '../../core/i18n/translate';
import { AuthService } from '../../core/services/auth.service';
import { PreferencesService } from '../../core/services/preferences.service';

@Component({
  selector: 'app-onboarding-shell',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar class="toolbar">
      <span class="brand"><mat-icon aria-hidden="true">savings</mat-icon> {{ 'app.name' | t }}</span>
      <span class="ca-spacer"></span>
      <app-language-switch />
      <span class="ca-small user">{{ auth.user()?.name }}</span>
      @if (preferences.setupComplete()) {
        <a mat-button routerLink="/buscar">{{ 'onboarding.goToSearch' | t }}</a>
      }
    </mat-toolbar>
    <main class="ca-page ca-page-narrow">
      <ol class="steps" [attr.aria-label]="'onboarding.steps' | t">
        @for (step of steps(); track step.path; let i = $index) {
          <li [class.current]="current() === step.path" [attr.aria-current]="current() === step.path ? 'step' : null">
            <span class="num">{{ i + 1 }}</span> {{ step.label | t }}
          </li>
        }
      </ol>
      <router-outlet />
    </main>
  `,
  styles: `
    .toolbar { background: var(--mat-sys-surface-container); border-bottom: 1px solid var(--mat-sys-outline-variant); gap: 8px; }
    .brand { display: inline-flex; gap: 8px; align-items: center; color: var(--mat-sys-primary); font-weight: 700; }
    .user { margin: 0 8px; }
    .steps { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 8px 0 16px; }
    .steps li { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px 4px 4px; border-radius: 999px; background: var(--mat-sys-surface-container); font: var(--mat-sys-label-large); }
    .steps li.current { background: var(--ca-highlight-bg); color: var(--ca-highlight-fg); box-shadow: inset 0 0 0 1px var(--mat-sys-primary); }
    .num { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--mat-sys-surface); font-weight: 700; }
    @media (max-width: 599px) { .user { display: none; } .brand { font-size: 0; gap: 0; } .brand .mat-icon { font-size: 24px; } }
  `,
})
export class OnboardingShellComponent {
  readonly auth = inject(AuthService);
  readonly preferences = inject(PreferencesService);
  private readonly router = inject(Router);

  readonly steps = computed<Array<{ path: string; label: MessageKey }>>(() => [
    { path: 'pais', label: 'onboarding.step.country' },
    ...(this.preferences.requiresState() ? [{ path: 'estado', label: 'onboarding.step.state' as MessageKey }] : []),
    { path: 'tiendas', label: 'onboarding.step.stores' },
    { path: 'ubicacion', label: 'onboarding.step.location' },
  ]);

  readonly current = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split('/').at(-1)?.split('?')[0] ?? ''),
    ),
    { initialValue: this.router.url.split('/').at(-1)?.split('?')[0] ?? '' },
  );
}

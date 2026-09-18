import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-confirmed',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './login.component.scss',
  template: `
    <main class="login-page">
      <mat-card appearance="outlined" class="login-card">
        <div class="brand">
          <mat-icon aria-hidden="true">{{ ready() ? 'verified' : 'hourglass_top' }}</mat-icon>
          <div>
            <h1>{{ (ready() ? 'confirmed.title' : 'confirmed.waiting') | t }}</h1>
            <p class="ca-muted">{{ (ready() ? 'confirmed.subtitle' : 'confirmed.waitingText') | t }}</p>
          </div>
        </div>
        <div class="buttons">
          @if (ready()) {
            <a mat-flat-button routerLink="/configurar/pais">{{ 'confirmed.continue' | t }}</a>
          } @else {
            <a mat-stroked-button routerLink="/login">{{ 'register.goToLogin' | t }}</a>
          }
        </div>
      </mat-card>
    </main>
  `,
})
export class ConfirmedComponent {
  private readonly auth = inject(AuthService);
  readonly ready = computed(() => this.auth.isAuthenticated());
}

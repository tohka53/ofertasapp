import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import type { AppMessage } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './login.component.scss',
  template: `
    <main class="login-page">
      <mat-card appearance="outlined" class="login-card">
        <div class="top">
          <div class="brand">
            <mat-icon aria-hidden="true">lock_reset</mat-icon>
            <div>
              <h1>{{ 'forgot.title' | t }}</h1>
              <p class="ca-muted">{{ 'forgot.subtitle' | t }}</p>
            </div>
          </div>
        </div>

        @if (sent()) {
          <div class="ca-notice ok" role="status">
            <mat-icon aria-hidden="true">mark_email_read</mat-icon>
            <span>{{ 'forgot.sent' | t: { email: email.value } }}</span>
          </div>
        } @else {
          <form class="form" (ngSubmit)="submit()" novalidate>
            <mat-form-field>
              <mat-label>{{ 'login.email' | t }}</mat-label>
              <mat-icon matPrefix>mail</mat-icon>
              <input matInput type="email" [formControl]="email" autocomplete="email" inputmode="email" />
              @if (email.hasError('email')) {
                <mat-error>{{ 'login.emailInvalid' | t }}</mat-error>
              }
            </mat-form-field>
            @if (error(); as message) {
              <div class="ca-notice error" role="alert">
                <mat-icon aria-hidden="true">error</mat-icon>
                <span>{{ message | msg }}</span>
              </div>
            }
            <div class="buttons">
              <a mat-stroked-button routerLink="/login">{{ 'forgot.back' | t }}</a>
              <button mat-flat-button type="submit" [disabled]="busy() || email.invalid">
                {{ (busy() ? 'common.working' : 'forgot.submit') | t }}
              </button>
            </div>
          </form>
        }
      </mat-card>
    </main>
  `,
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  readonly email = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });
  readonly error = signal<AppMessage | null>(null);
  readonly busy = signal(false);
  readonly sent = signal(false);

  async submit(): Promise<void> {
    if (this.email.invalid) {
      this.email.markAsTouched();
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    const result = await this.auth.requestPasswordReset(this.email.value);
    this.busy.set(false);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    this.sent.set(true);
  }
}

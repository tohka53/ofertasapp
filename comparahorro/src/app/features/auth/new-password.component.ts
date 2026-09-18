import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import type { AppMessage } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';

function samePassword(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-new-password',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './login.component.scss',
  template: `
    <main class="login-page">
      <mat-card appearance="outlined" class="login-card">
        <div class="brand">
          <mat-icon aria-hidden="true">password</mat-icon>
          <div>
            <h1>{{ 'newPassword.title' | t }}</h1>
            <p class="ca-muted">{{ 'newPassword.subtitle' | t }}</p>
          </div>
        </div>

        @if (!signedIn()) {
          <div class="ca-notice warn" role="alert">
            <mat-icon aria-hidden="true">link_off</mat-icon>
            <span>{{ 'newPassword.invalidLink' | t }}</span>
          </div>
          <div class="buttons">
            <a mat-flat-button routerLink="/login/recuperar">{{ 'forgot.submit' | t }}</a>
          </div>
        } @else {
          <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <mat-form-field>
              <mat-label>{{ 'newPassword.password' | t }}</mat-label>
              <mat-icon matPrefix>lock</mat-icon>
              <input matInput type="password" formControlName="password" autocomplete="new-password" />
              <mat-hint>{{ 'register.passwordHint' | t }}</mat-hint>
              @if (form.controls.password.hasError('minlength')) {
                <mat-error>{{ 'register.passwordShort' | t }}</mat-error>
              }
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'register.confirm' | t }}</mat-label>
              <mat-icon matPrefix>lock_reset</mat-icon>
              <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
              @if (form.hasError('mismatch') && form.controls.confirm.touched) {
                <mat-error>{{ 'register.mismatch' | t }}</mat-error>
              }
            </mat-form-field>
            @if (error(); as message) {
              <div class="ca-notice error" role="alert">
                <mat-icon aria-hidden="true">error</mat-icon>
                <span>{{ message | msg }}</span>
              </div>
            }
            <div class="buttons">
              <button mat-flat-button type="submit" [disabled]="busy()">{{ (busy() ? 'common.working' : 'newPassword.submit') | t }}</button>
            </div>
          </form>
        }
      </mat-card>
    </main>
  `,
})
export class NewPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly signedIn = computed(() => this.auth.isAuthenticated());
  readonly error = signal<AppMessage | null>(null);
  readonly busy = signal(false);

  readonly form = new FormGroup(
    {
      password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
      confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: samePassword },
  );

  async submit(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    const result = await this.auth.updatePassword(this.form.controls.password.value);
    this.busy.set(false);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    await this.router.navigateByUrl('/buscar');
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { AppMessage } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { NotifyService } from '../../core/services/notify.service';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-login',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);

  readonly hidePassword = signal(true);
  readonly error = signal<AppMessage | null>(null);
  readonly busy = signal(false);
  readonly needsConfirmation = computed(() => this.error()?.code === 'auth.error.emailNotConfirmed');

  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  next(): string {
    const value = this.route.snapshot.queryParamMap.get('next');
    return value && value.startsWith('/') ? value : '/buscar';
  }

  async submit(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    const { email, password } = this.form.getRawValue();
    const result = await this.auth.signIn(email, password);
    this.busy.set(false);
    if (!result.ok) {
      this.error.set(result.message);
      this.form.controls.password.reset('');
      return;
    }
    await this.router.navigateByUrl(this.next());
  }

  async resend(): Promise<void> {
    const email = this.form.controls.email.value;
    if (!email) return;
    this.busy.set(true);
    await this.auth.resendConfirmation(email);
    this.busy.set(false);
    this.notify.info(this.i18n.t('register.resent'));
  }
}

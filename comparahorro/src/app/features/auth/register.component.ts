import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { AppMessage } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { NotifyService } from '../../core/services/notify.service';
import { I18nService } from '../../core/i18n/i18n.service';

function samePassword(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.component.html',
  styleUrl: './login.component.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);

  readonly hidePassword = signal(true);
  readonly error = signal<AppMessage | null>(null);
  readonly busy = signal(false);
  readonly sent = signal(false);

  readonly form = new FormGroup(
    {
      fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(60)] }),
      email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
      password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
      confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: samePassword },
  );

  get email(): string {
    return this.form.controls.email.value;
  }

  async submit(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    const { email, password, fullName } = this.form.getRawValue();
    const result = await this.auth.signUp(email, password, fullName);
    this.busy.set(false);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    if (result.needsConfirmation) {
      this.sent.set(true);
      return;
    }
    const next = this.route.snapshot.queryParamMap.get('next');
    await this.router.navigateByUrl(next && next.startsWith('/') ? next : '/configurar/pais');
  }

  async resend(): Promise<void> {
    this.busy.set(true);
    await this.auth.resendConfirmation(this.email);
    this.busy.set(false);
    this.notify.info(this.i18n.t('register.resent'));
  }
}

import { computed, inject, Injectable, signal } from '@angular/core';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import type { AppMessage } from '../models/api.models';
import type { SessionUser } from '../models/app.models';
import { SupabaseService } from '../supabase/supabase.service';
import { SessionEventsService } from './session-events.service';

export type AuthOutcome = { ok: true; needsConfirmation: boolean } | { ok: false; message: AppMessage };

const CODE_MAP: Record<string, string> = {
  invalid_credentials: 'auth.error.invalidCredentials',
  email_not_confirmed: 'auth.error.emailNotConfirmed',
  user_already_exists: 'auth.error.userExists',
  email_exists: 'auth.error.userExists',
  weak_password: 'auth.error.weakPassword',
  same_password: 'auth.error.samePassword',
  over_email_send_rate_limit: 'auth.error.rateLimit',
  over_request_rate_limit: 'auth.error.rateLimit',
  email_address_invalid: 'auth.error.emailInvalid',
  validation_failed: 'auth.error.validation',
  signup_disabled: 'auth.error.signupDisabled',
  otp_expired: 'auth.error.linkExpired',
};

export function describeAuthError(error: AuthError | Error | null): AppMessage {
  if (!error) return { code: 'auth.error.unexpected' };
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const mapped = CODE_MAP[code];
  if (mapped) return { code: mapped };
  const status = 'status' in error && typeof error.status === 'number' ? error.status : 0;
  if (status === 0) return { code: 'auth.error.network' };
  if (status === 429) return { code: 'auth.error.rateLimit' };
  return { code: 'auth.error.unexpected' };
}

function toSessionUser(user: User): SessionUser {
  const metadata = (user.user_metadata ?? {}) as { full_name?: string };
  const email = user.email ?? '';
  return {
    id: user.id,
    name: metadata.full_name?.trim() || email.split('@')[0] || email,
    email,
    signedInAt: new Date().toISOString(),
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly events = inject(SessionEventsService);
  private readonly currentUser = signal<SessionUser | null>(null);
  private readonly readyState = signal(false);
  private activeUserId: string | null = null;

  readonly user = this.currentUser.asReadonly();
  readonly ready = this.readyState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly userId = computed(() => this.currentUser()?.id ?? null);

  constructor() {
    this.supabase.client.auth.onAuthStateChange((_event, session) => this.applySession(session));
  }

  /** Recupera la sesion guardada antes de que el enrutador evalue los guards. */
  async restore(): Promise<void> {
    try {
      const { data } = await this.supabase.client.auth.getSession();
      this.applySession(data.session);
    } finally {
      this.readyState.set(true);
    }
  }

  async signIn(email: string, password: string): Promise<AuthOutcome> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    return error ? { ok: false, message: describeAuthError(error) } : { ok: true, needsConfirmation: false };
  }

  async signUp(email: string, password: string, fullName: string): Promise<AuthOutcome> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/confirmado`,
      },
    });
    if (error) return { ok: false, message: describeAuthError(error) };
    return { ok: true, needsConfirmation: data.session === null };
  }

  async resendConfirmation(email: string): Promise<AuthOutcome> {
    const { error } = await this.supabase.client.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmado` },
    });
    return error ? { ok: false, message: describeAuthError(error) } : { ok: true, needsConfirmation: true };
  }

  async requestPasswordReset(email: string): Promise<AuthOutcome> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/nueva-clave`,
    });
    return error ? { ok: false, message: describeAuthError(error) } : { ok: true, needsConfirmation: true };
  }

  async updatePassword(password: string): Promise<AuthOutcome> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    return error ? { ok: false, message: describeAuthError(error) } : { ok: true, needsConfirmation: false };
  }

  async updateName(fullName: string): Promise<AuthOutcome> {
    const { error } = await this.supabase.client.auth.updateUser({ data: { full_name: fullName.trim() } });
    if (error) return { ok: false, message: describeAuthError(error) };
    const current = this.currentUser();
    if (current) this.currentUser.set({ ...current, name: fullName.trim() });
    return { ok: true, needsConfirmation: false };
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.applySession(null);
  }

  private applySession(session: Session | null): void {
    const user = session?.user ?? null;
    const id = user?.id ?? null;
    if (id === this.activeUserId) {
      if (user) {
        const current = this.currentUser();
        const next = toSessionUser(user);
        this.currentUser.set(current ? { ...next, signedInAt: current.signedInAt } : next);
      }
      return;
    }
    this.activeUserId = id;
    this.events.emitReset();
    this.currentUser.set(user ? toSessionUser(user) : null);
  }
}

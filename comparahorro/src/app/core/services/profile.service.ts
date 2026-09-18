import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { I18nService } from '../i18n/i18n.service';
import type { Lang } from '../models/api.models';
import type { ProfileRow } from '../models/db.models';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { PreferencesService } from './preferences.service';

const COLUMNS = 'id, email, full_name, lang, country_code, state_code, store_ids, location, created_at, updated_at';

/** Perfil del usuario en Supabase: nombre, idioma, pais, estado, tiendas y ubicacion. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly preferences = inject(PreferencesService);
  private readonly i18n = inject(I18nService);
  private readonly profileState = signal<ProfileRow | null>(null);
  private readonly restoredState = signal(false);
  private applying = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly profile = this.profileState.asReadonly();
  readonly restored = this.restoredState.asReadonly();

  constructor() {
    effect(() => {
      const id = this.auth.userId();
      untracked(() => {
        if (!id) {
          this.profileState.set(null);
          this.restoredState.set(false);
          return;
        }
        void this.load(id);
      });
    });

    effect(() => {
      const lang = this.i18n.lang();
      untracked(() => {
        if (this.profileState()?.lang !== lang) this.schedule();
      });
    });

    this.preferences.changes$.pipe(takeUntilDestroyed()).subscribe(() => this.schedule());
  }

  async load(userId: string): Promise<void> {
    const { data, error } = await this.supabase.client.from('profiles').select(COLUMNS).eq('id', userId).maybeSingle();
    if (error || !data) {
      this.restoredState.set(true);
      return;
    }
    const row = data as ProfileRow;
    this.profileState.set(row);
    this.apply(row);
    this.restoredState.set(true);
  }

  async setFullName(fullName: string): Promise<void> {
    const id = this.auth.userId();
    if (!id) return;
    await this.supabase.client.from('profiles').update({ full_name: fullName.trim() }).eq('id', id);
    const row = this.profileState();
    if (row) this.profileState.set({ ...row, full_name: fullName.trim() });
  }

  private apply(row: ProfileRow): void {
    this.applying = true;
    try {
      if (row.lang === 'es' || row.lang === 'en') this.i18n.setLang(row.lang as Lang);
      if (row.country_code) this.preferences.setCountry(row.country_code);
      if (row.state_code) this.preferences.setState(row.state_code);
      if (row.store_ids?.length) this.preferences.setStores(row.store_ids);
      if (row.location) this.preferences.setLocation(row.location);
    } finally {
      this.applying = false;
    }
  }

  private schedule(): void {
    if (this.applying || !this.auth.userId() || !this.restoredState()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), 700);
  }

  private async save(): Promise<void> {
    const id = this.auth.userId();
    if (!id) return;
    const patch = {
      lang: this.i18n.lang(),
      country_code: this.preferences.countryCode(),
      state_code: this.preferences.stateCode(),
      store_ids: this.preferences.selectedStoreIds(),
      location: this.preferences.location(),
    };
    const { error } = await this.supabase.client.from('profiles').update(patch).eq('id', id);
    if (error) return;
    const row = this.profileState();
    if (row) this.profileState.set({ ...row, ...patch } as ProfileRow);
  }
}

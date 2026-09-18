import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { I18nService } from '../i18n/i18n.service';
import type { Family } from '../models/app.models';
import type { FamilyRow, MemberInfo } from '../models/db.models';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { NotifyService } from './notify.service';
import { SessionEventsService } from './session-events.service';

const FAMILY_COLUMNS = 'id, name, owner_id, created_at, updated_at, family_members(user_id, role)';

/** Grupos familiares: quien crea el grupo o recibe el rol de administrador maneja sus miembros. */
@Injectable({ providedIn: 'root' })
export class FamiliesService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);
  private readonly familiesState = signal<Family[]>([]);
  private readonly loadingState = signal(false);

  readonly families = this.familiesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly adminFamilies = computed(() => this.familiesState().filter((f) => f.role === 'admin'));

  constructor() {
    inject(SessionEventsService)
      .reset$.pipe(takeUntilDestroyed())
      .subscribe(() => this.familiesState.set([]));

    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (userId) void this.reload();
      });
    });
  }

  get(familyId: string | null): Family | undefined {
    if (!familyId) return undefined;
    return this.familiesState().find((f) => f.id === familyId);
  }

  async reload(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    this.loadingState.set(true);
    const { data, error } = await this.supabase.client.from('families').select(FAMILY_COLUMNS).order('created_at');
    this.loadingState.set(false);
    if (error) {
      this.notify.error(this.i18n.t('data.loadError'));
      return;
    }
    this.familiesState.set(
      (data as FamilyRow[]).map((row) => {
        const members = row.family_members ?? [];
        const mine = members.find((m) => m.user_id === userId);
        return {
          id: row.id,
          name: row.name,
          ownerId: row.owner_id,
          createdAt: row.created_at,
          memberCount: members.length,
          role: row.owner_id === userId || mine?.role === 'admin' ? 'admin' : 'member',
        } satisfies Family;
      }),
    );
  }

  async create(name: string): Promise<Family | null> {
    const userId = this.auth.userId();
    if (!userId) return null;
    const { error } = await this.supabase.client.from('families').insert({ name: name.trim(), owner_id: userId });
    if (error) {
      this.notify.error(this.i18n.t('data.saveError'));
      return null;
    }
    await this.reload();
    return this.familiesState().find((f) => f.name === name.trim()) ?? null;
  }

  async rename(familyId: string, name: string): Promise<boolean> {
    const { error } = await this.supabase.client.from('families').update({ name: name.trim() }).eq('id', familyId);
    if (error) {
      this.notify.error(this.i18n.t('data.saveError'));
      return false;
    }
    await this.reload();
    return true;
  }

  async remove(familyId: string): Promise<boolean> {
    const { error } = await this.supabase.client.from('families').delete().eq('id', familyId);
    if (error) {
      this.notify.error(this.i18n.t('data.saveError'));
      return false;
    }
    await this.reload();
    return true;
  }

  async leave(familyId: string): Promise<boolean> {
    const userId = this.auth.userId();
    if (!userId) return false;
    const { error } = await this.supabase.client.from('family_members').delete().eq('family_id', familyId).eq('user_id', userId);
    if (error) {
      this.notify.error(this.i18n.t('data.saveError'));
      return false;
    }
    await this.reload();
    return true;
  }

  async members(familyId: string): Promise<MemberInfo[]> {
    const { data, error } = await this.supabase.client.rpc('miembros_de_familia', { p_family: familyId });
    if (error) {
      this.notify.error(this.i18n.t('data.loadError'));
      return [];
    }
    return (data ?? []) as MemberInfo[];
  }

  async removeMember(familyId: string, userId: string): Promise<boolean> {
    const { error } = await this.supabase.client.from('family_members').delete().eq('family_id', familyId).eq('user_id', userId);
    if (error) {
      this.notify.error(this.i18n.t('data.saveError'));
      return false;
    }
    await this.reload();
    return true;
  }
}

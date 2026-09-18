import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { PostgrestError } from '@supabase/supabase-js';
import { I18nService } from '../i18n/i18n.service';
import type { AppMessage } from '../models/api.models';
import type { InvitationPreview, MemberInfo, PendingInvitation, SentInvitation } from '../models/db.models';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { NotifyService } from './notify.service';
import { SessionEventsService } from './session-events.service';

export type InviteResult = { ok: true; token: string } | { ok: false; message: AppMessage };

const RPC_ERRORS: Record<string, string> = {
  no_autorizado: 'invite.error.notAllowed',
  correo_propio: 'invite.error.ownEmail',
  correo_invalido: 'invite.error.invalidEmail',
  ya_es_miembro: 'invite.error.alreadyMember',
  invitacion_no_encontrada: 'invite.error.notFound',
  invitacion_no_vigente: 'invite.error.notPending',
  invitacion_vencida: 'invite.error.expired',
  invitacion_de_otro_correo: 'invite.error.otherEmail',
  sin_sesion: 'invite.error.noSession',
  destino_invalido: 'invite.error.invalidTarget',
};

function describeRpcError(error: PostgrestError | null): AppMessage {
  if (!error) return { code: 'data.saveError' };
  for (const [needle, key] of Object.entries(RPC_ERRORS)) {
    if (error.message?.includes(needle)) return { code: key };
  }
  return { code: 'data.saveError' };
}

/** Invitaciones por correo a una lista compartida o a un grupo familiar. */
@Injectable({ providedIn: 'root' })
export class InvitationsService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);
  private readonly pendingState = signal<PendingInvitation[]>([]);

  readonly pending = this.pendingState.asReadonly();

  constructor() {
    inject(SessionEventsService)
      .reset$.pipe(takeUntilDestroyed())
      .subscribe(() => this.pendingState.set([]));

    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (userId) void this.reload();
      });
    });
  }

  async reload(): Promise<void> {
    if (!this.auth.userId()) return;
    const { data, error } = await this.supabase.client.rpc('mis_invitaciones');
    if (error) return;
    this.pendingState.set((data ?? []) as PendingInvitation[]);
  }

  linkFor(token: string): string {
    return `${window.location.origin}/invitacion/${token}`;
  }

  async invite(target: { listId?: string; familyId?: string; email: string; role: string }): Promise<InviteResult> {
    const { data, error } = await this.supabase.client.rpc('crear_invitacion', {
      p_list: target.listId ?? null,
      p_family: target.familyId ?? null,
      p_email: target.email,
      p_role: target.role,
    });
    if (error || !data) return { ok: false, message: describeRpcError(error) };
    return { ok: true, token: (data as { token: string }).token };
  }

  async accept(token: string): Promise<{ ok: boolean; message?: AppMessage }> {
    const { error } = await this.supabase.client.rpc('aceptar_invitacion', { p_token: token });
    if (error) return { ok: false, message: describeRpcError(error) };
    await this.reload();
    return { ok: true };
  }

  async reject(token: string): Promise<{ ok: boolean; message?: AppMessage }> {
    const { error } = await this.supabase.client.rpc('rechazar_invitacion', { p_token: token });
    if (error) return { ok: false, message: describeRpcError(error) };
    await this.reload();
    return { ok: true };
  }

  async preview(token: string): Promise<InvitationPreview | null> {
    const { data, error } = await this.supabase.client.rpc('ver_invitacion', { p_token: token });
    if (error) return null;
    const rows = (data ?? []) as InvitationPreview[];
    return rows[0] ?? null;
  }

  async sentFor(target: { listId?: string; familyId?: string }): Promise<SentInvitation[]> {
    let query = this.supabase.client
      .from('invitations')
      .select('id, token, email, role, status, created_at, expires_at, list_id, family_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    query = target.listId ? query.eq('list_id', target.listId) : query.eq('family_id', target.familyId ?? '');
    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as SentInvitation[];
  }

  async revoke(invitationId: string): Promise<boolean> {
    const { error } = await this.supabase.client
      .from('invitations')
      .update({ status: 'revoked', responded_at: new Date().toISOString() })
      .eq('id', invitationId);
    if (error) {
      this.notify.error(this.i18n.t('data.saveError'));
      return false;
    }
    return true;
  }

  async listMembers(listId: string): Promise<MemberInfo[]> {
    const { data, error } = await this.supabase.client.rpc('miembros_de_lista', { p_list: listId });
    if (error) {
      this.notify.error(this.i18n.t('data.loadError'));
      return [];
    }
    return (data ?? []) as MemberInfo[];
  }

  async removeListMember(listId: string, userId: string): Promise<boolean> {
    const { error } = await this.supabase.client.from('list_members').delete().eq('list_id', listId).eq('user_id', userId);
    if (error) {
      this.notify.error(this.i18n.t('data.saveError'));
      return false;
    }
    return true;
  }
}

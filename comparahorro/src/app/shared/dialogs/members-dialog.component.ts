import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { I18nService } from '../../core/i18n/i18n.service';
import type { MessageKey } from '../../core/i18n/translate';
import type { AppMessage } from '../../core/models/api.models';
import type { MemberInfo, SentInvitation } from '../../core/models/db.models';
import { AuthService } from '../../core/services/auth.service';
import { FamiliesService } from '../../core/services/families.service';
import { InvitationsService } from '../../core/services/invitations.service';
import { NotifyService } from '../../core/services/notify.service';

export interface MembersDialogData {
  kind: 'lista' | 'familia';
  id: string;
  name: string;
  canManage: boolean;
}

@Component({
  selector: 'app-members-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'members.title' | t: { name: data.name } }}</h2>
    <mat-dialog-content class="content">
      <section>
        <h3 class="ca-small">{{ 'members.people' | t: { count: members().length } }}</h3>
        <ul class="people">
          @for (member of members(); track member.user_id) {
            <li>
              <mat-icon aria-hidden="true">{{ member.es_propietario ? 'shield_person' : 'person' }}</mat-icon>
              <span class="who">
                <strong>{{ member.nombre }}</strong>
                <span class="ca-small ca-muted">{{ member.email }} · {{ roleKey(member.rol) | t }}</span>
              </span>
              @if (data.canManage && !member.es_propietario && member.user_id !== myId()) {
                <button mat-icon-button type="button" (click)="removeMember(member)" [attr.aria-label]="'members.remove' | t: { name: member.nombre }">
                  <mat-icon>person_remove</mat-icon>
                </button>
              }
            </li>
          }
        </ul>
      </section>

      @if (data.canManage) {
        <mat-divider />
        <section>
          <h3 class="ca-small">{{ 'members.inviteTitle' | t }}</h3>
          <p class="ca-small ca-muted">{{ 'members.inviteHelp' | t }}</p>
          <form class="invite" [formGroup]="form" (ngSubmit)="invite()" novalidate>
            <mat-form-field class="ca-full-width">
              <mat-label>{{ 'members.inviteEmail' | t }}</mat-label>
              <mat-icon matPrefix>alternate_email</mat-icon>
              <input matInput type="email" formControlName="email" autocomplete="off" inputmode="email" />
              @if (form.controls.email.hasError('email')) {
                <mat-error>{{ 'login.emailInvalid' | t }}</mat-error>
              }
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'members.inviteRole' | t }}</mat-label>
              <mat-select formControlName="role">
                <mat-option value="editor">{{ roleKey(editorRole) | t }}</mat-option>
                <mat-option value="admin">{{ 'members.role.admin' | t }}</mat-option>
              </mat-select>
            </mat-form-field>
            <button mat-flat-button type="submit" [disabled]="busy() || form.invalid">
              <mat-icon>send</mat-icon>
              {{ 'members.send' | t }}
            </button>
          </form>

          @if (error(); as message) {
            <div class="ca-notice error" role="alert">
              <mat-icon aria-hidden="true">error</mat-icon>
              <span>{{ message | msg }}</span>
            </div>
          }

          @if (lastLink(); as link) {
            <div class="ca-notice ok" role="status">
              <mat-icon aria-hidden="true">link</mat-icon>
              <span>
                {{ 'members.linkReady' | t }}
                <code class="link">{{ link }}</code>
              </span>
              <button mat-button type="button" (click)="copy(link)">{{ 'members.copy' | t }}</button>
            </div>
          }
        </section>

        @if (invitations().length) {
          <section>
            <h3 class="ca-small">{{ 'members.pendingTitle' | t: { count: invitations().length } }}</h3>
            <ul class="people">
              @for (invitation of invitations(); track invitation.id) {
                <li>
                  <mat-icon aria-hidden="true">schedule_send</mat-icon>
                  <span class="who">
                    <strong>{{ invitation.email }}</strong>
                    <span class="ca-small ca-muted">{{ 'members.expires' | t: { date: (invitation.expires_at | calendarDate) } }}</span>
                  </span>
                  <button mat-button type="button" (click)="copy(linkFor(invitation))">{{ 'members.copy' | t }}</button>
                  <button mat-icon-button type="button" (click)="revoke(invitation)" [attr.aria-label]="'members.revoke' | t">
                    <mat-icon>cancel</mat-icon>
                  </button>
                </li>
              }
            </ul>
          </section>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" mat-dialog-close>{{ 'common.close' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content { display: grid; gap: 12px; min-width: min(520px, 78vw); }
    .people { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .people li { display: flex; align-items: center; gap: 8px; }
    .who { display: grid; min-width: 0; flex: 1 1 auto; }
    .who span { overflow-wrap: anywhere; }
    .invite { display: grid; grid-template-columns: minmax(0, 2fr) minmax(120px, 1fr); gap: 8px; align-items: start; }
    .invite button { grid-column: 1 / -1; justify-self: start; }
    .link { overflow-wrap: anywhere; font-size: 0.78rem; display: block; }
    h3 { margin: 0 0 4px; }
  `,
})
export class MembersDialogComponent {
  readonly data = inject<MembersDialogData>(MAT_DIALOG_DATA);
  private readonly invitationsService = inject(InvitationsService);
  private readonly families = inject(FamiliesService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly i18n = inject(I18nService);

  readonly members = signal<MemberInfo[]>([]);
  readonly invitations = signal<SentInvitation[]>([]);
  readonly error = signal<AppMessage | null>(null);
  readonly lastLink = signal<string | null>(null);
  readonly busy = signal(false);
  readonly editorRole = this.data.kind === 'lista' ? 'editor' : 'member';

  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    role: new FormControl(this.data.kind === 'lista' ? 'editor' : 'member', { nonNullable: true }),
  });

  constructor() {
    void this.refresh();
  }

  myId(): string | null {
    return this.auth.userId();
  }

  roleKey(role: string): MessageKey {
    return `members.role.${role}` as MessageKey;
  }

  linkFor(invitation: SentInvitation): string {
    return this.invitationsService.linkFor(invitation.token);
  }

  async refresh(): Promise<void> {
    const members =
      this.data.kind === 'lista' ? await this.invitationsService.listMembers(this.data.id) : await this.families.members(this.data.id);
    this.members.set(members);
    if (!this.data.canManage) return;
    const target = this.data.kind === 'lista' ? { listId: this.data.id } : { familyId: this.data.id };
    this.invitations.set(await this.invitationsService.sentFor(target));
  }

  async invite(): Promise<void> {
    this.error.set(null);
    this.lastLink.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    const { email, role } = this.form.getRawValue();
    const target = this.data.kind === 'lista' ? { listId: this.data.id } : { familyId: this.data.id };
    const result = await this.invitationsService.invite({ ...target, email, role });
    this.busy.set(false);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    this.form.controls.email.reset('');
    this.lastLink.set(this.invitationsService.linkFor(result.token));
    await this.refresh();
  }

  async revoke(invitation: SentInvitation): Promise<void> {
    if (!(await this.invitationsService.revoke(invitation.id))) return;
    this.lastLink.set(null);
    await this.refresh();
  }

  async removeMember(member: MemberInfo): Promise<void> {
    const ok =
      this.data.kind === 'lista'
        ? await this.invitationsService.removeListMember(this.data.id, member.user_id)
        : await this.families.removeMember(this.data.id, member.user_id);
    if (ok) await this.refresh();
  }

  async copy(link: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      this.notify.info(this.i18n.t('members.copied'));
    } catch {
      this.notify.error(this.i18n.t('members.copyFailed'));
    }
  }
}

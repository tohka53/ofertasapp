import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { I18nService } from '../../core/i18n/i18n.service';
import type { MessageKey } from '../../core/i18n/translate';
import type { Family } from '../../core/models/app.models';
import type { PendingInvitation } from '../../core/models/db.models';
import { AuthService } from '../../core/services/auth.service';
import { FamiliesService } from '../../core/services/families.service';
import { InvitationsService } from '../../core/services/invitations.service';
import { ListsService } from '../../core/services/lists.service';
import { NotifyService } from '../../core/services/notify.service';
import { MembersDialogComponent, type MembersDialogData } from '../../shared/dialogs/members-dialog.component';
import {
  ConfirmDialogComponent,
  TextFormDialogComponent,
  type ConfirmDialogData,
  type TextFormDialogData,
} from '../../shared/dialogs/simple-dialogs.component';

@Component({
  selector: 'app-families-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ca-page">
      <div class="ca-row header">
        <div>
          <h1 class="ca-page-title">{{ 'families.title' | t }}</h1>
          <p class="ca-page-subtitle">{{ 'families.subtitle' | t }}</p>
        </div>
        <span class="ca-spacer"></span>
        <button mat-flat-button type="button" (click)="create()">
          <mat-icon>group_add</mat-icon>
          {{ 'families.new' | t }}
        </button>
      </div>

      <section id="invitaciones" class="ca-surface invites">
        <h2 class="ca-section-title">{{ 'invite.pendingTitle' | t: { count: invitations.pending().length } }}</h2>
        @if (invitations.pending().length === 0) {
          <p class="ca-muted ca-small">{{ 'invite.pendingEmpty' | t }}</p>
        } @else {
          <ul>
            @for (invitation of invitations.pending(); track invitation.id) {
              <li>
                <mat-icon aria-hidden="true">{{ invitation.contexto === 'lista' ? 'checklist' : 'diversity_3' }}</mat-icon>
                <span class="who">
                  <strong>{{ invitation.contexto_nombre }}</strong>
                  <span class="ca-small ca-muted">
                    {{ 'invite.pendingFrom' | t: { who: invitation.invitado_por, kind: kindKey(invitation.contexto) | t } }}
                  </span>
                </span>
                <button mat-button type="button" (click)="reject(invitation)">{{ 'invitation.reject' | t }}</button>
                <button mat-flat-button type="button" (click)="accept(invitation)">{{ 'invitation.accept' | t }}</button>
              </li>
            }
          </ul>
        }
      </section>

      @if (families.families().length === 0) {
        <app-empty-state icon="diversity_3" [title]="'families.emptyTitle' | t" [message]="'families.emptyMessage' | t">
          <button mat-flat-button type="button" (click)="create()">{{ 'families.new' | t }}</button>
        </app-empty-state>
      } @else {
        <div class="ca-grid">
          @for (family of families.families(); track family.id) {
            <article class="ca-surface family">
              <strong>{{ family.name }}</strong>
              <span class="ca-small ca-muted">
                {{ 'families.members' | t: { count: family.memberCount } }} · {{ roleKey(family.role) | t }}
              </span>
              <span class="ca-small ca-muted">{{ 'families.listCount' | t: { count: listCount(family.id) } }}</span>
              <div class="actions">
                <button mat-button type="button" (click)="openMembers(family)">
                  <mat-icon>group</mat-icon>
                  {{ 'families.manage' | t }}
                </button>
                @if (family.role === 'admin') {
                  <button mat-button type="button" (click)="rename(family)">{{ 'families.rename' | t }}</button>
                }
                @if (family.ownerId === userId()) {
                  <button mat-button type="button" (click)="remove(family)">{{ 'families.delete' | t }}</button>
                } @else {
                  <button mat-button type="button" (click)="leave(family)">{{ 'families.leave' | t }}</button>
                }
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .header { align-items: flex-start; }
    .invites { display: grid; gap: 8px; margin-bottom: 16px; }
    .invites ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .invites li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .who { display: grid; flex: 1 1 200px; min-width: 0; }
    .family { display: grid; gap: 4px; }
    .actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    h2 { margin: 0; }
  `,
})
export class FamiliesPageComponent {
  readonly families = inject(FamiliesService);
  readonly invitations = inject(InvitationsService);
  private readonly lists = inject(ListsService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18nService);
  private readonly notify = inject(NotifyService);

  userId(): string | null {
    return this.auth.userId();
  }

  roleKey(role: string): MessageKey {
    return `members.role.${role}` as MessageKey;
  }

  kindKey(context: string): MessageKey {
    return `invitation.kind.${context}` as MessageKey;
  }

  listCount(familyId: string): number {
    return this.lists.lists().filter((l) => l.familyId === familyId).length;
  }

  create(): void {
    const data: TextFormDialogData = {
      title: this.i18n.t('families.newTitle'),
      label: this.i18n.t('families.name'),
      confirmLabel: this.i18n.t('families.new'),
    };
    this.dialog
      .open<TextFormDialogComponent, TextFormDialogData, string>(TextFormDialogComponent, { data, width: '420px', maxWidth: '94vw' })
      .afterClosed()
      .subscribe(async (name) => {
        if (!name) return;
        const family = await this.families.create(name);
        if (family) this.openMembers(family);
      });
  }

  rename(family: Family): void {
    const data: TextFormDialogData = { title: this.i18n.t('families.rename'), label: this.i18n.t('families.name'), value: family.name };
    this.dialog
      .open<TextFormDialogComponent, TextFormDialogData, string>(TextFormDialogComponent, { data, width: '420px', maxWidth: '94vw' })
      .afterClosed()
      .subscribe(async (name) => {
        if (name) await this.families.rename(family.id, name);
      });
  }

  openMembers(family: Family): void {
    const data: MembersDialogData = { kind: 'familia', id: family.id, name: family.name, canManage: family.role === 'admin' };
    this.dialog.open(MembersDialogComponent, { data, width: '560px', maxWidth: '96vw' });
  }

  remove(family: Family): void {
    this.confirm('families.deleteConfirm', family.name, async () => {
      await this.families.remove(family.id);
      await this.lists.reload();
    });
  }

  leave(family: Family): void {
    this.confirm('families.leaveConfirm', family.name, async () => {
      await this.families.leave(family.id);
      await this.lists.reload();
    });
  }

  async accept(invitation: PendingInvitation): Promise<void> {
    const result = await this.invitations.accept(invitation.token);
    if (!result.ok) {
      this.notify.error(this.i18n.msg(result.message ?? { code: 'data.saveError' }));
      return;
    }
    await Promise.all([this.lists.reload(), this.families.reload()]);
  }

  async reject(invitation: PendingInvitation): Promise<void> {
    await this.invitations.reject(invitation.token);
  }

  private confirm(messageKey: 'families.deleteConfirm' | 'families.leaveConfirm', name: string, action: () => Promise<void>): void {
    const data: ConfirmDialogData = {
      title: this.i18n.t(messageKey === 'families.deleteConfirm' ? 'families.delete' : 'families.leave'),
      message: this.i18n.t(messageKey, { name }),
    };
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { data })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) void action();
      });
  }
}

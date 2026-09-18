import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { MessageKey } from '../../core/i18n/translate';
import type { AppMessage } from '../../core/models/api.models';
import type { InvitationPreview } from '../../core/models/db.models';
import { AuthService } from '../../core/services/auth.service';
import { FamiliesService } from '../../core/services/families.service';
import { InvitationsService } from '../../core/services/invitations.service';
import { ListsService } from '../../core/services/lists.service';

@Component({
  selector: 'app-invitation-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../auth/login.component.scss',
  template: `
    <main class="login-page">
      <mat-card appearance="outlined" class="login-card">
        <div class="top">
          <div class="brand">
            <mat-icon aria-hidden="true">group_add</mat-icon>
            <div>
              <h1>{{ 'invitation.title' | t }}</h1>
              <p class="ca-muted">{{ 'invitation.subtitle' | t }}</p>
            </div>
          </div>
          <app-language-switch />
        </div>

        @if (!signedIn()) {
          <div class="ca-notice info" role="note">
            <mat-icon aria-hidden="true">login</mat-icon>
            <span>{{ 'invitation.needsSession' | t }}</span>
          </div>
          <div class="buttons">
            <a mat-stroked-button [routerLink]="['/login']" [queryParams]="{ next: currentUrl }">{{ 'login.submit' | t }}</a>
            <a mat-flat-button [routerLink]="['/login/registro']" [queryParams]="{ next: currentUrl }">{{ 'login.createAccount' | t }}</a>
          </div>
        } @else if (loading()) {
          <p class="ca-muted">{{ 'common.working' | t }}</p>
        } @else if (!preview()) {
          <div class="ca-notice error" role="alert">
            <mat-icon aria-hidden="true">link_off</mat-icon>
            <span>{{ 'invite.error.notFound' | t }}</span>
          </div>
          <div class="buttons"><a mat-flat-button routerLink="/listas">{{ 'invitation.goToLists' | t }}</a></div>
        } @else {
          <div class="ca-notice info" role="note">
            <mat-icon aria-hidden="true">{{ preview()!.contexto === 'lista' ? 'checklist' : 'diversity_3' }}</mat-icon>
            <span>
              {{
                'invitation.details'
                  | t
                    : {
                        who: preview()!.invitado_por,
                        kind: kindKey(preview()!.contexto) | t,
                        name: preview()!.contexto_nombre
                      }
              }}
            </span>
          </div>

          @if (preview()!.estado !== 'pending') {
            <div class="ca-notice warn" role="alert">
              <mat-icon aria-hidden="true">info</mat-icon>
              <span>{{ statusKey(preview()!.estado) | t }}</span>
            </div>
            <div class="buttons"><a mat-flat-button routerLink="/listas">{{ 'invitation.goToLists' | t }}</a></div>
          } @else if (!preview()!.es_para_mi) {
            <div class="ca-notice warn" role="alert">
              <mat-icon aria-hidden="true">person_alert</mat-icon>
              <span>{{ 'invitation.otherEmail' | t: { email: preview()!.correo } }}</span>
            </div>
            <div class="buttons"><button mat-stroked-button type="button" (click)="signOut()">{{ 'shell.logout' | t }}</button></div>
          } @else {
            @if (error(); as message) {
              <div class="ca-notice error" role="alert">
                <mat-icon aria-hidden="true">error</mat-icon>
                <span>{{ message | msg }}</span>
              </div>
            }
            <div class="buttons">
              <button mat-stroked-button type="button" (click)="reject()" [disabled]="busy()">{{ 'invitation.reject' | t }}</button>
              <button mat-flat-button type="button" (click)="accept()" [disabled]="busy()">
                <mat-icon>check</mat-icon>
                {{ 'invitation.accept' | t }}
              </button>
            </div>
          }
        }
      </mat-card>
    </main>
  `,
})
export class InvitationPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly invitations = inject(InvitationsService);
  private readonly auth = inject(AuthService);
  private readonly lists = inject(ListsService);
  private readonly families = inject(FamiliesService);

  readonly preview = signal<InvitationPreview | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<AppMessage | null>(null);
  readonly signedIn = computed(() => this.auth.isAuthenticated());
  readonly currentUrl = `/invitacion/${this.route.snapshot.paramMap.get('token') ?? ''}`;

  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  constructor() {
    if (this.auth.isAuthenticated()) void this.load();
    else this.loading.set(false);
  }

  kindKey(context: string): MessageKey {
    return `invitation.kind.${context}` as MessageKey;
  }

  statusKey(status: string): MessageKey {
    return `invitation.status.${status}` as MessageKey;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.preview.set(await this.invitations.preview(this.token));
    this.loading.set(false);
  }

  async accept(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    const result = await this.invitations.accept(this.token);
    this.busy.set(false);
    if (!result.ok) {
      this.error.set(result.message ?? { code: 'data.saveError' });
      return;
    }
    await Promise.all([this.lists.reload(), this.families.reload()]);
    await this.router.navigateByUrl(this.preview()?.contexto === 'familia' ? '/grupos' : '/listas');
  }

  async reject(): Promise<void> {
    this.busy.set(true);
    await this.invitations.reject(this.token);
    this.busy.set(false);
    await this.router.navigateByUrl('/listas');
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login'], { queryParams: { next: this.currentUrl } });
  }
}

import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { I18nService } from '../core/i18n/i18n.service';
import type { MessageKey } from '../core/i18n/translate';
import { AuthService } from '../core/services/auth.service';
import { CatalogService } from '../core/services/catalog.service';
import { ListsService } from '../core/services/lists.service';
import { PreferencesService } from '../core/services/preferences.service';
import { ConfirmDialogComponent, type ConfirmDialogData } from '../shared/dialogs/simple-dialogs.component';

interface NavItem {
  path: string;
  label: MessageKey;
  short: MessageKey;
  icon: string;
}

@Component({
  selector: 'app-shell',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly lists = inject(ListsService);
  private readonly i18n = inject(I18nService);
  readonly preferences = inject(PreferencesService);

  readonly user = this.auth.user;
  readonly isHandset = toSignal(inject(BreakpointObserver).observe('(max-width: 767.98px)').pipe(map((r) => r.matches)), { initialValue: false });

  readonly nav: NavItem[] = [
    { path: '/buscar', label: 'nav.search', short: 'nav.searchShort', icon: 'search' },
    { path: '/ofertas', label: 'nav.offers', short: 'nav.offers', icon: 'local_offer' },
    { path: '/listas', label: 'nav.lists', short: 'nav.lists', icon: 'checklist' },
    { path: '/grupos', label: 'nav.families', short: 'nav.familiesShort', icon: 'diversity_3' },
    { path: '/perfil', label: 'nav.profile', short: 'nav.profile', icon: 'person' },
  ];

  readonly listCount = computed(() => this.lists.lists().length);

  constructor() {
    const catalog = inject(CatalogService);
    effect(() => {
      const code = this.preferences.countryCode();
      untracked(() => {
        if (!code) return;
        void catalog.loadCountries().catch(() => []);
        void catalog.loadStores(code, false, this.preferences.stateCode()).catch(() => undefined);
      });
    });
  }

  logout(): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: { title: this.i18n.t('shell.logout'), message: this.i18n.t('shell.logoutMessage'), confirmLabel: this.i18n.t('shell.logout') },
      })
      .afterClosed()
      .subscribe(async (confirmed) => {
        if (!confirmed) return;
        await this.auth.signOut();
        await this.router.navigateByUrl('/login');
      });
  }
}

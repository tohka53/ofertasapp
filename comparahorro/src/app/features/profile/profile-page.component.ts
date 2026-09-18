import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { locationLabel } from '../../core/logic/location';
import type { AppMessage, Country, StateOption, StoresResponse } from '../../core/models/api.models';
import type { LocationSelection } from '../../core/models/app.models';
import { describeApiError } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import { ListsService } from '../../core/services/lists.service';
import { NotifyService } from '../../core/services/notify.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ProfileService } from '../../core/services/profile.service';
import {
  ConfirmDialogComponent,
  TextFormDialogComponent,
  type ConfirmDialogData,
  type TextFormDialogData,
} from '../../shared/dialogs/simple-dialogs.component';

@Component({
  selector: 'app-profile-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly preferences = inject(PreferencesService);
  private readonly catalog = inject(CatalogService);
  private readonly lists = inject(ListsService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly profile = inject(ProfileService);

  readonly countries = signal<Country[]>([]);
  readonly states = signal<StateOption[]>([]);
  readonly stores = signal<StoresResponse | null>(null);
  readonly storesLoading = signal(false);
  readonly error = signal<AppMessage | null>(null);
  readonly storeDraft = signal<string[]>([...this.preferences.selectedStoreIds()]);

  readonly storesDirty = computed(() => {
    const saved = [...this.preferences.selectedStoreIds()].sort().join(',');
    return [...this.storeDraft()].sort().join(',') !== saved;
  });
  readonly priceByLocationStores = computed(() =>
    this.preferences
      .queryableStores()
      .filter((s) => s.location.priceVariesByLocation)
      .map((s) => s.name)
      .join(', '),
  );
  readonly listCountByCountry = computed(() => {
    const counts: Record<string, number> = {};
    for (const list of this.lists.lists()) counts[list.countryCode] = (counts[list.countryCode] ?? 0) + 1;
    return counts;
  });
  readonly sortedStates = computed(() => {
    const lang = this.i18n.lang();
    return [...this.states()].sort((a, b) => a.name[lang].localeCompare(b.name[lang], lang));
  });

  async ngOnInit(): Promise<void> {
    try {
      this.countries.set(await this.catalog.loadCountries());
      const code = this.preferences.countryCode();
      if (code && this.preferences.requiresState()) this.states.set((await this.catalog.loadLocations(code)).states);
    } catch (error) {
      this.error.set(describeApiError(error));
    }
    await this.loadStores();
  }

  async loadStores(force = false): Promise<void> {
    const code = this.preferences.countryCode();
    if (!code) return;
    const state = this.preferences.stateCode();
    this.storesLoading.set(true);
    try {
      this.stores.set(force ? await this.catalog.refreshStoreStatus(code, state) : await this.catalog.loadStores(code, true, state));
    } catch (error) {
      this.error.set(describeApiError(error));
    } finally {
      this.storesLoading.set(false);
    }
  }

  changeCountry(code: string): void {
    if (code === this.preferences.countryCode()) return;
    const target = this.countries().find((c) => c.code === code);
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: this.i18n.t('profile.changeCountryTitle', { country: target ? this.i18n.loc(target.name) : code }),
          message: this.i18n.t('profile.changeCountryMessage'),
          confirmLabel: this.i18n.t('profile.changeCountryConfirm'),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.preferences.setCountry(code);
        void this.router.navigateByUrl(target?.regionKind === 'state' ? '/configurar/estado' : '/configurar/tiendas');
      });
  }

  changeState(code: string): void {
    if (code === this.preferences.stateCode()) return;
    const target = this.states().find((s) => s.code === code);
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: this.i18n.t('profile.changeStateTitle', { state: target ? this.i18n.loc(target.name) : code }),
          message: this.i18n.t('profile.changeStateMessage'),
          confirmLabel: this.i18n.t('profile.changeStateConfirm'),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.preferences.setState(code);
        void this.router.navigateByUrl('/configurar/tiendas');
      });
  }

  saveStores(): void {
    const ids = this.storeDraft();
    if (!ids.length) {
      this.notify.error(this.i18n.t('profile.selectOneStore'));
      return;
    }
    this.preferences.setStores(ids);
    this.notify.info(this.i18n.t('profile.storesSaved'));
  }

  saveLocation(location: LocationSelection): void {
    this.preferences.setLocation(location);
    this.notify.info(this.i18n.t('profile.locationApplied', { label: locationLabel(location, this.i18n.lang()) }));
  }

  clearLocation(): void {
    this.preferences.setLocation(null);
    this.notify.info(this.i18n.t('profile.locationCleared'));
  }

  changeName(): void {
    const data: TextFormDialogData = {
      title: this.i18n.t('profile.changeName'),
      label: this.i18n.t('profile.name'),
      value: this.auth.user()?.name ?? '',
    };
    this.dialog
      .open<TextFormDialogComponent, TextFormDialogData, string>(TextFormDialogComponent, { data, width: '420px', maxWidth: '94vw' })
      .afterClosed()
      .subscribe(async (name) => {
        if (!name) return;
        await this.auth.updateName(name);
        await this.profile.setFullName(name);
        this.notify.info(this.i18n.t('profile.nameSaved'));
      });
  }

  async resetPassword(): Promise<void> {
    const email = this.auth.user()?.email;
    if (!email) return;
    const result = await this.auth.requestPasswordReset(email);
    this.notify.info(this.i18n.t(result.ok ? 'profile.passwordSent' : 'data.saveError', { email }));
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

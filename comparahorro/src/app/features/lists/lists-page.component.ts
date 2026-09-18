import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { CatalogService } from '../../core/services/catalog.service';
import { NotifyService } from '../../core/services/notify.service';
import { summarizeList } from '../../core/logic/list-math';
import type { ShoppingList } from '../../core/models/app.models';
import { defaultListName, ListsService } from '../../core/services/lists.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ListFormDialogComponent, type ListFormResult } from '../../shared/dialogs/simple-dialogs.component';

@Component({
  selector: 'app-lists-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ca-page">
      <div class="ca-row header">
        <div>
          <h1 class="ca-page-title">{{ 'lists.title' | t }}</h1>
          <p class="ca-page-subtitle">{{ 'lists.subtitle' | t: { country: (preferences.country()?.name | loc), currency: preferences.country()?.currency } }}</p>
        </div>
        <span class="ca-spacer"></span>
        <button mat-flat-button type="button" (click)="create()">
          <mat-icon>add</mat-icon>
          {{ 'lists.new' | t }}
        </button>
      </div>

      @if (lists.otherCountriesListCount()) {
        <div class="ca-notice info">
          <mat-icon aria-hidden="true">public</mat-icon>
          <span>{{ 'lists.otherCountries' | t: { count: lists.otherCountriesListCount() } }}</span>
        </div>
      }

      @if (cards().length === 0) {
        <app-empty-state icon="checklist" [title]="'lists.emptyTitle' | t" [message]="'lists.emptyMessage' | t">
          <button mat-flat-button type="button" (click)="create()">{{ 'lists.createDefault' | t: { name: currentListName() } }}</button>
        </app-empty-state>
      } @else {
        <div class="ca-grid">
          @for (card of cards(); track card.list.id) {
            <a class="list-card ca-surface" [routerLink]="['/listas', card.list.id]">
              <strong>{{ card.list.name }}</strong>
              <span class="ca-muted">{{ card.list.month | monthName }} {{ card.list.year }}</span>
              <span>{{ 'lists.cardItems' | t: { items: card.summary.itemCount, pending: card.summary.pendingItems.length } }}</span>
              @if (card.list.memberCount > 1 || card.list.familyId) {
                <span class="shared ca-small">
                  <mat-icon aria-hidden="true">groups</mat-icon>
                  {{ 'lists.cardShared' | t: { count: card.list.memberCount } }}
                </span>
              }
              <span class="total">{{ 'lists.cardTotal' | t }} <strong>{{ card.summary.totalCents | cents: card.list.currency }}</strong></span>
              <span class="ca-small ca-muted">{{ 'lists.cardNote' | t }}</span>
              @if (card.list.purgeAt) {
                <span class="ca-small ca-muted">{{ 'lists.cardPurge' | t: { date: (card.list.purgeAt | calendarDate) } }}</span>
              }
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .header { align-items: flex-start; }
    .ca-notice { margin-bottom: 12px; }
    .list-card { display: grid; gap: 4px; text-decoration: none; color: inherit; }
    .list-card:hover, .list-card:focus-visible { border-color: var(--mat-sys-primary); }
    .total { margin-top: 4px; }
    .shared { display: flex; align-items: center; gap: 4px; color: var(--mat-sys-primary); }
    .shared .mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `,
})
export class ListsPageComponent {
  readonly lists = inject(ListsService);
  readonly preferences = inject(PreferencesService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly catalog = inject(CatalogService);
  private readonly notify = inject(NotifyService);

  readonly cards = computed(() => this.lists.listsForCurrentCountry().map((list: ShoppingList) => ({ list, summary: summarizeList(list) })));
  readonly currentListName = computed(() => defaultListName(new Date().getMonth() + 1, this.i18n.lang()));

  async create(): Promise<void> {
    let country = this.preferences.country();
    if (!country) {
      await this.catalog.loadCountries().catch(() => []);
      country = this.preferences.country();
    }
    if (!country) {
      this.notify.error(this.i18n.t('data.loadError'));
      return;
    }
    this.dialog
      .open<ListFormDialogComponent, object, ListFormResult>(ListFormDialogComponent, { data: {}, width: '480px', maxWidth: '96vw' })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        const list = this.lists.create(result, country);
        void this.router.navigate(['/listas', list.id]);
      });
  }
}

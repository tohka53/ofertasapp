import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { lineSubtotalCents, summarizeList } from '../../core/logic/list-math';
import type { KnownCondition, LocalizedText } from '../../core/models/api.models';
import type { ListItem } from '../../core/models/app.models';
import { CatalogService } from '../../core/services/catalog.service';
import { FamiliesService } from '../../core/services/families.service';
import { AuthService } from '../../core/services/auth.service';
import { InvitationsService } from '../../core/services/invitations.service';
import type { MemberInfo } from '../../core/models/db.models';
import { ListsService } from '../../core/services/lists.service';
import { NotifyService } from '../../core/services/notify.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ManualPriceDialogComponent, type ManualPriceDialogData, type ManualPriceResult } from '../../shared/dialogs/manual-price-dialog.component';
import { MembersDialogComponent, type MembersDialogData } from '../../shared/dialogs/members-dialog.component';
import { ConfirmDialogComponent, ListFormDialogComponent, type ConfirmDialogData, type ListFormResult } from '../../shared/dialogs/simple-dialogs.component';
import { BestPriceDialogComponent, type BestPriceDialogData } from './best-price-dialog.component';
import { ItemFormDialogComponent, type ItemFormResult } from './item-form-dialog.component';
import { RefreshDialogComponent } from './refresh-dialog.component';

@Component({
  selector: 'app-list-detail',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './list-detail.component.html',
  styleUrl: './list-detail.component.scss',
})
export class ListDetailComponent {
  private readonly listsService = inject(ListsService);
  private readonly catalog = inject(CatalogService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly preferences = inject(PreferencesService);
  private readonly families = inject(FamiliesService);
  private readonly invitations = inject(InvitationsService);
  private readonly auth = inject(AuthService);

  /** Parámetro de ruta :id (bindToComponentInputs). */
  readonly id = input.required<string>();

  readonly list = computed(() => this.listsService.lists().find((l) => l.id === this.id()) ?? null);
  readonly summary = computed(() => {
    const list = this.list();
    return list ? summarizeList(list) : null;
  });
  readonly editable = computed(() => this.list()?.countryCode === this.preferences.countryCode());

  /** Integrantes de la lista, para asignar responsable de compra. */
  readonly members = signal<MemberInfo[]>([]);
  private loadedMembersFor: string | null = null;

  readonly assignedToMe = computed(() => {
    const me = this.auth.userId();
    if (!me) return 0;
    return this.list()?.items.filter((i) => i.assignedTo === me && !i.purchased).length ?? 0;
  });

  constructor() {
    effect(() => {
      const list = this.list();
      untracked(() => {
        if (!list || list.memberCount < 2) {
          this.members.set([]);
          this.loadedMembersFor = null;
          return;
        }
        if (this.loadedMembersFor === list.id) return;
        this.loadedMembersFor = list.id;
        void this.invitations.listMembers(list.id).then((people) => this.members.set(people));
      });
    });
  }

  assigneeName(item: ListItem): string {
    if (!item.assignedTo) return this.i18n.t('detail.assignNobody');
    return this.members().find((m) => m.user_id === item.assignedTo)?.nombre ?? this.i18n.t('detail.assignUnknown');
  }

  assign(item: ListItem, userId: string | null): void {
    const list = this.list();
    if (list) this.listsService.setAssignee(list.id, item.id, userId);
  }

  familyName(): string | null {
    return this.families.get(this.list()?.familyId ?? null)?.name ?? null;
  }

  openMembers(): void {
    const list = this.list();
    if (!list) return;
    const data: MembersDialogData = { kind: 'lista', id: list.id, name: list.name, canManage: list.role === 'admin' };
    this.dialog.open(MembersDialogComponent, { data, width: '560px', maxWidth: '96vw' });
  }

  leaveList(): void {
    const list = this.list();
    if (!list) return;
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: this.i18n.t('detail.leave'),
          message: this.i18n.t('detail.leaveMessage', { name: list.name }),
          confirmLabel: this.i18n.t('detail.leave'),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.listsService.leave(list.id);
        void this.router.navigateByUrl('/listas');
      });
  }

  subtotal(item: ListItem): number | null {
    return lineSubtotalCents(item);
  }

  conditions(storeId: string): KnownCondition[] {
    const list = this.list();
    return list ? (this.catalog.store(list.countryCode, storeId)?.knownConditions ?? []) : [];
  }

  storeNotes(storeId: string): LocalizedText[] {
    const list = this.list();
    return list ? (this.catalog.store(list.countryCode, storeId)?.notes ?? []) : [];
  }

  editList(): void {
    const list = this.list();
    if (!list) return;
    this.dialog
      .open<ListFormDialogComponent, object, ListFormResult>(ListFormDialogComponent, { data: { list }, width: '480px', maxWidth: '96vw' })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.listsService.update(list.id, result);
      });
  }

  deleteList(): void {
    const list = this.list();
    if (!list) return;
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: this.i18n.t('detail.delete'),
          message: this.i18n.t('detail.deleteMessage', { name: list.name, count: list.items.length }),
          confirmLabel: this.i18n.t('detail.deleteConfirm'),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.listsService.remove(list.id);
        void this.router.navigateByUrl('/listas');
      });
  }

  addItem(): void {
    const list = this.list();
    if (!list) return;
    this.dialog
      .open<ItemFormDialogComponent, void, ItemFormResult>(ItemFormDialogComponent, { width: '520px', maxWidth: '96vw' })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.listsService.addManualItem(list.id, result);
        this.notify.info(this.i18n.t('detail.itemPending', { name: result.productQuery }));
      });
  }

  findBestPrices(itemIds?: string[]): void {
    const list = this.list();
    const summary = this.summary();
    if (!list || !summary) return;
    const ids = itemIds ?? (summary.pendingItems.length ? summary.pendingItems.map((i) => i.id) : list.items.map((i) => i.id));
    if (!ids.length) {
      this.notify.info(this.i18n.t('detail.addItemsFirst'));
      return;
    }
    this.dialog
      .open<BestPriceDialogComponent, BestPriceDialogData, number>(BestPriceDialogComponent, { data: { listId: list.id, itemIds: ids }, width: '820px', maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe((assigned) => {
        if (assigned) this.notify.info(this.i18n.t('detail.assigned', { count: assigned }));
      });
  }

  notePrice(item: ListItem): void {
    const list = this.list();
    if (!list) return;
    this.dialog
      .open<ManualPriceDialogComponent, ManualPriceDialogData, ManualPriceResult>(ManualPriceDialogComponent, {
        data: { listId: list.id, itemId: item.id, storeId: item.offer?.storeId, productName: item.offer?.name ?? item.productQuery, presentation: item.offer?.presentation ?? item.desiredPresentation },
        width: '560px',
        maxWidth: '96vw',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.notify.info(this.i18n.t('detail.manualSaved', { list: result.listName }));
      });
  }

  refreshPrices(): void {
    const list = this.list();
    if (!list) return;
    if (!list.items.some((i) => i.offer?.source === 'store')) {
      this.notify.info(this.i18n.t('detail.nothingToRefresh'));
      return;
    }
    this.dialog
      .open<RefreshDialogComponent, { listId: string }, number>(RefreshDialogComponent, { data: { listId: list.id }, width: '760px', maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe((applied) => {
        if (applied !== undefined) this.notify.info(applied ? this.i18n.t('detail.appliedChanges', { count: applied }) : this.i18n.t('detail.noChanges'));
      });
  }

  setQuantity(item: ListItem, raw: string | number): void {
    const list = this.list();
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!list || !Number.isInteger(value) || value < 1 || value > 999) {
      this.notify.error(this.i18n.t('detail.quantityError'));
      return;
    }
    this.listsService.setQuantity(list.id, item.id, value);
  }

  step(item: ListItem, delta: number): void {
    const next = item.quantity + delta;
    if (next >= 1 && next <= 999) this.setQuantity(item, next);
  }

  togglePurchased(item: ListItem, purchased: boolean): void {
    const list = this.list();
    if (list) this.listsService.togglePurchased(list.id, item.id, purchased);
  }

  removeItem(item: ListItem): void {
    const list = this.list();
    if (!list) return;
    this.listsService.removeItem(list.id, item.id);
    this.notify.info(this.i18n.t('detail.removed', { name: item.offer?.name ?? item.productQuery }));
  }

  clearOffer(item: ListItem): void {
    const list = this.list();
    if (list) this.listsService.setOffer(list.id, item.id, null);
  }
}

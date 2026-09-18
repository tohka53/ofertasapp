import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { MessageKey } from '../../core/i18n/translate';
import { computeRefreshChanges, type RefreshChange, type RefreshChangeKind } from '../../core/logic/refresh-diff';
import type { AppMessage, RefreshResponse } from '../../core/models/api.models';
import { ApiService, describeApiError } from '../../core/services/api.service';
import { ListsService } from '../../core/services/lists.service';
import { PreferencesService } from '../../core/services/preferences.service';

@Component({
  selector: 'app-refresh-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'refresh.title' | t }}</h2>
    <mat-dialog-content class="content">
      @if (loading()) {
        <div class="loading" role="status">
          <mat-progress-bar mode="indeterminate" />
          <span class="ca-small">{{ 'refresh.loading' | t }}</span>
        </div>
      }
      @if (error(); as message) {
        <div class="ca-notice error" role="alert"><mat-icon aria-hidden="true">error</mat-icon><span>{{ message | msg }}</span></div>
      }
      @if (manualCount()) {
        <p class="ca-small ca-muted">{{ 'refresh.manualSkipped' | t: { count: manualCount() } }}</p>
      }
      @if (response(); as result) {
        <app-store-query-status [stores]="result.stores" />
        @if (actionable().length === 0) {
          <div class="ca-notice info">
            <mat-icon aria-hidden="true">task_alt</mat-icon>
            <span>{{ 'refresh.noChanges' | t }}</span>
          </div>
        }
        <ul class="changes">
          @for (change of actionable(); track change.id) {
            <li [class.store-change]="change.changesStore">
              @if (change.proposed) {
                <mat-checkbox [checked]="isSelected(change)" (change)="toggle(change, $event.checked)" [attr.aria-label]="'refresh.applyAria' | t: { name: change.productName }" />
              } @else {
                <mat-icon class="info-icon" aria-hidden="true">info</mat-icon>
              }
              <div class="detail">
                <div class="ca-row">
                  <strong>{{ change.productName }}</strong>
                  <app-status-tag [label]="label(change.kind) | t" [tone]="tone(change.kind)" />
                </div>
                <div class="ca-small">
                  {{
                    'refresh.current'
                      | t
                        : {
                            price: (change.current.price | money: change.current.currency : 'common.noPrice'),
                            store: change.current.storeName,
                            date: (change.current.consultedAt | dateTime),
                          }
                  }}
                </div>
                @if (change.proposed; as proposed) {
                  <div class="ca-small">
                    {{ (change.changesStore ? 'refresh.alternative' : 'refresh.new') | t }}: <strong>{{ proposed.price | money: proposed.currency : 'common.noPrice' }}</strong>
                    {{ 'refresh.proposedAt' | t: { store: proposed.storeName, presentation: (proposed | presentation | orNA), date: (proposed.consultedAt | dateTime) } }}
                  </div>
                }
                <div class="ca-small ca-muted">{{ change.message | msg }}{{ change.changesStore ? ('refresh.changesStore' | t) : '' }}</div>
              </div>
            </li>
          }
        </ul>
        @if (unchangedCount()) {
          <p class="ca-small ca-muted">{{ 'refresh.unchanged' | t: { count: unchangedCount() } }}</p>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | t }}</button>
      <button mat-flat-button type="button" (click)="apply()" [disabled]="loading() || !response()">{{ 'refresh.apply' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content { display: grid; gap: 12px; padding-top: 8px; }
    .loading { display: grid; gap: 6px; }
    .changes { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; align-items: start; border: 1px solid var(--mat-sys-outline-variant); border-radius: 12px; padding: 8px 10px; }
    li.store-change { border-style: dashed; }
    .detail { display: grid; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
    .info-icon { margin: 8px; color: var(--ca-muted); }
  `,
})
export class RefreshDialogComponent implements OnInit {
  readonly data = inject<{ listId: string }>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<RefreshDialogComponent, number>);
  private readonly api = inject(ApiService);
  private readonly lists = inject(ListsService);
  private readonly preferences = inject(PreferencesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<AppMessage | null>(null);
  readonly response = signal<RefreshResponse | null>(null);
  readonly changes = signal<RefreshChange[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly manualCount = signal(0);

  readonly actionable = computed(() => this.changes().filter((c) => c.kind !== 'unchanged'));
  readonly unchangedCount = computed(() => this.changes().filter((c) => c.kind === 'unchanged').length);

  ngOnInit(): void {
    const list = this.lists.get(this.data.listId);
    const country = this.preferences.countryCode();
    if (!list || !country || list.countryCode !== country) {
      this.loading.set(false);
      this.error.set({ code: 'refresh.wrongCountry' });
      return;
    }
    this.manualCount.set(list.items.filter((i) => i.offer?.source === 'manual').length);
    const items = list.items
      .filter((i) => i.offer?.source === 'store')
      .map((i) => ({ key: i.id, storeId: i.offer!.storeId, skuId: i.offer!.skuId, productId: i.offer!.productId || null, gtinRaw: i.offer!.gtinRaw, name: i.offer!.name }));
    if (items.length === 0) {
      this.loading.set(false);
      this.error.set({ code: 'refresh.nothing' });
      return;
    }
    this.api
      .refresh(country, items, this.preferences.queryableStoreIds(), this.preferences.location())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const current = this.lists.get(this.data.listId);
          const changes = current ? computeRefreshChanges(current, response) : [];
          this.response.set(response);
          this.changes.set(changes);
          this.selectedIds.set(new Set(changes.filter((c) => c.selectedByDefault).map((c) => c.id)));
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(describeApiError(error));
          this.loading.set(false);
        },
      });
  }

  label(kind: RefreshChangeKind): MessageKey {
    return `refresh.kind.${kind}`;
  }

  tone(kind: RefreshChangeKind): 'ok' | 'warn' | 'error' | 'info' | 'neutral' {
    switch (kind) {
      case 'price_down':
      case 'back_available':
        return 'ok';
      case 'price_up':
      case 'now_unavailable':
      case 'price_missing':
        return 'warn';
      case 'store_error':
      case 'not_found':
        return 'error';
      case 'cheaper_elsewhere':
        return 'info';
      default:
        return 'neutral';
    }
  }

  isSelected(change: RefreshChange): boolean {
    return this.selectedIds().has(change.id);
  }

  toggle(change: RefreshChange, checked: boolean): void {
    this.selectedIds.update((ids) => {
      const next = new Set(ids);
      if (checked) next.add(change.id);
      else next.delete(change.id);
      return next;
    });
  }

  apply(): void {
    const confirmed = this.changes().filter((c) => this.selectedIds().has(c.id));
    this.lists.applyRefresh(this.data.listId, confirmed);
    this.ref.close(confirmed.filter((c) => c.kind !== 'unchanged').length);
  }
}

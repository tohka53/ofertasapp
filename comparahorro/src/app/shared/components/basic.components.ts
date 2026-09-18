import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import type { MessageKey } from '../../core/i18n/translate';
import { promotionText, type PromotionText } from '../../core/logic/promotions';
import type { Lang, Promotion, StoreQueryResult } from '../../core/models/api.models';
import { InvitationsService } from '../../core/services/invitations.service';

export type Tone = 'ok' | 'warn' | 'error' | 'info' | 'neutral' | 'best';

@Component({
  selector: 'app-invitations-banner',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (invitations.pending().length; as count) {
      <div class="invitations-banner" role="note">
        <mat-icon aria-hidden="true">mark_email_unread</mat-icon>
        <span>{{ 'invite.bannerText' | t: { count: count } }}</span>
        <a mat-button routerLink="/grupos" fragment="invitaciones">{{ 'invite.bannerAction' | t }}</a>
      </div>
    }
  `,
  styles: `
    .invitations-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 16px;
      font: var(--mat-sys-body-small);
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .mat-icon { font-size: 18px; width: 18px; height: 18px; flex: 0 0 auto; }
    a { margin-left: auto; }
  `,
})
export class InvitationsBannerComponent {
  readonly invitations = inject(InvitationsService);
}

@Component({
  selector: 'app-language-switch',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-button-toggle-group
      class="ca-lang-switch"
      hideSingleSelectionIndicator
      [value]="i18n.lang()"
      (change)="select($event.value)"
      [attr.aria-label]="'lang.label' | t"
    >
      @for (option of options; track option.lang) {
        <mat-button-toggle [value]="option.lang" [aria-label]="option.name" [attr.lang]="option.lang">{{ option.short }}</mat-button-toggle>
      }
    </mat-button-toggle-group>
  `,
  styles: `
    :host { display: inline-flex; }
  `,
})
export class LanguageSwitchComponent {
  readonly i18n = inject(I18nService);
  readonly options: ReadonlyArray<{ lang: Lang; short: string; name: string }> = [
    { lang: 'es', short: 'ES', name: 'Español' },
    { lang: 'en', short: 'EN', name: 'English' },
  ];

  select(lang: Lang): void {
    this.i18n.setLang(lang);
  }
}

@Component({
  selector: 'app-empty-state',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="empty" [attr.aria-label]="title()">
      <mat-icon class="icon" aria-hidden="true">{{ icon() }}</mat-icon>
      <h2>{{ title() }}</h2>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      <div class="actions"><ng-content /></div>
    </section>
  `,
  styles: `
    .empty { text-align: center; padding: 32px 16px; color: var(--mat-sys-on-surface-variant); }
    .icon { font-size: 48px; width: 48px; height: 48px; color: var(--mat-sys-primary); }
    h2 { font: var(--mat-sys-title-large); color: var(--mat-sys-on-surface); margin: 12px 0 4px; }
    p { margin: 0 auto 16px; max-width: 520px; }
    .actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('info');
  readonly title = input.required<string>();
  readonly message = input<string | null>(null);
}

@Component({
  selector: 'app-status-tag',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'ca-tag ' + tone()" [matTooltip]="tooltip() ?? ''" [matTooltipDisabled]="!tooltip()">
    @if (icon()) {
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
    }
    {{ label() }}
  </span>`,
})
export class StatusTagComponent {
  readonly label = input.required<string>();
  readonly tone = input<Tone>('neutral');
  readonly icon = input<string | null>(null);
  readonly tooltip = input<string | null>(null);
}

@Component({
  selector: 'app-promotion-list',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length) {
      <ul class="promos" [attr.aria-label]="'promo.aria' | t">
        @for (item of items(); track $index) {
          <li>
            <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
            <div>
              <strong>{{ item.text.label }}</strong>
              @if (item.promo.discountPercent && item.promo.kind === 'price_drop') {
                <span class="ca-muted"> · −{{ item.promo.discountPercent }} %</span>
              }
              @if (item.text.conditions) {
                <div class="ca-small ca-muted">{{ item.text.conditions }}</div>
              }
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .promos { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    li { display: flex; gap: 6px; align-items: flex-start; font: var(--mat-sys-body-small); }
    .mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--mat-sys-tertiary); flex: 0 0 auto; margin-top: 1px; }
  `,
})
export class PromotionListComponent {
  private readonly i18n = inject(I18nService);

  readonly promotions = input.required<Promotion[]>();
  readonly currency = input('GTQ');
  readonly storeName = input('');

  readonly items = computed<Array<{ promo: Promotion; text: PromotionText; icon: string }>>(() => {
    const lang = this.i18n.lang();
    return this.promotions().map((promo) => ({ promo, text: promotionText(promo, this.currency(), this.storeName(), lang), icon: iconFor(promo) }));
  });
}

function iconFor(promo: Promotion): string {
  switch (promo.kind) {
    case 'price_drop':
      return 'trending_down';
    case 'multi_buy':
    case 'free_item':
    case 'percentage':
      return 'local_offer';
    case 'free_shipping':
      return 'local_shipping';
    default:
      return 'sell';
  }
}

@Component({
  selector: 'app-store-query-status',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ca-surface status" aria-live="polite">
      <div class="ca-row">
        <mat-icon aria-hidden="true" [class.ok]="failed().length === 0">{{ failed().length ? 'report' : 'task_alt' }}</mat-icon>
        <strong>{{ 'queryStatus.responded' | t: { responded: responded().length, queried: queried().length } }}</strong>
        @if (pending().length) {
          <span class="ca-muted ca-small">{{ 'queryStatus.pending' | t: { count: pending().length } }}</span>
        }
      </div>
      <div class="ca-row chips">
        @for (store of stores(); track store.storeId) {
          <app-status-tag
            [label]="store.storeName + ': ' + (chipKey(store) | t: { count: store.resultCount })"
            [tone]="toneFor(store)"
            [icon]="iconFor(store)"
            [tooltip]="store.message | msg"
          />
        }
      </div>
      @if (details().length) {
        <mat-expansion-panel class="details" [expanded]="failed().length > 0">
          <mat-expansion-panel-header>
            <mat-panel-title>{{ 'queryStatus.details' | t }}</mat-panel-title>
          </mat-expansion-panel-header>
          <ul>
            @for (store of details(); track store.storeId) {
              <li>
                <strong>{{ store.storeName }}</strong> — {{ labelKey(store) | t }}
                @if (store.message) {
                  <div class="ca-small">{{ store.message | msg }}</div>
                }
                @if (store.location) {
                  <div class="ca-small">
                    {{
                      'queryStatus.location'
                        | t
                          : {
                              label: store.location.label || store.location.postalCode || 'GPS',
                              branches: store.location.assignedStores.length ? store.location.assignedStores.join(', ') : ('queryStatus.noBranch' | t),
                            }
                    }}
                  </div>
                }
                @for (warning of store.warnings; track $index) {
                  <div class="ca-small warn">{{ warning | msg }}</div>
                }
              </li>
            }
          </ul>
        </mat-expansion-panel>
      }
    </section>
  `,
  styles: `
    .status { display: grid; gap: 8px; }
    .chips { gap: 6px; }
    .mat-icon { color: var(--ca-warning); }
    .mat-icon.ok { color: var(--ca-success); }
    .details { box-shadow: none; border: 1px solid var(--mat-sys-outline-variant); }
    ul { margin: 0; padding-left: 18px; display: grid; gap: 8px; }
    .warn { color: var(--ca-warning); }
  `,
})
export class StoreQueryStatusComponent {
  readonly stores = input.required<StoreQueryResult[]>();

  readonly queried = computed(() => this.stores().filter((s) => s.status !== 'pending'));
  readonly responded = computed(() => this.stores().filter((s) => s.status === 'ok'));
  readonly failed = computed(() => this.stores().filter((s) => s.status === 'error' || s.status === 'timeout'));
  readonly pending = computed(() => this.stores().filter((s) => s.status === 'pending'));
  readonly details = computed(() => this.stores().filter((s) => s.status !== 'ok' || s.warnings.length > 0 || s.location !== null));

  chipKey(store: StoreQueryResult): MessageKey {
    switch (store.status) {
      case 'ok':
        return 'queryStatus.results';
      case 'timeout':
        return 'queryStatus.chip.timeout';
      case 'cancelled':
        return 'queryStatus.chip.cancelled';
      case 'pending':
        return 'queryStatus.chip.pending';
      default:
        return 'queryStatus.chip.error';
    }
  }

  labelKey(store: StoreQueryResult): MessageKey {
    return `queryStatus.label.${store.status}`;
  }

  toneFor(store: StoreQueryResult): Tone {
    if (store.status === 'ok') return store.warnings.length ? 'warn' : 'ok';
    if (store.status === 'pending') return 'neutral';
    return 'error';
  }

  iconFor(store: StoreQueryResult): string {
    if (store.status === 'ok') return store.warnings.length ? 'info' : 'check_circle';
    if (store.status === 'pending') return 'hourglass_empty';
    return 'cloud_off';
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ComparisonGroup } from '../../core/logic/compare';
import type { Offer } from '../../core/models/api.models';

@Component({
  selector: 'app-comparison-groups',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="groups">
      @for (group of groups(); track group.key) {
        <article class="group ca-surface">
          <header>
            <app-status-tag
              [label]="(group.matchType === 'gtin' ? 'groups.sameGtin' : 'groups.probable') | t"
              [tone]="group.matchType === 'gtin' ? 'ok' : 'warn'"
              [icon]="group.matchType === 'gtin' ? 'qr_code_2' : 'help_outline'"
            />
            <h3>{{ group.offers[0]?.name }}</h3>
            <span class="ca-small ca-muted">{{ group.offers[0]?.brand | orNA }} · {{ group.offers[0] | presentation | orNA }}</span>
          </header>
          @if (group.contentMismatch) {
            <div class="ca-notice warn">
              <mat-icon aria-hidden="true">warning</mat-icon>
              <span>{{ 'groups.contentMismatch' | t }}</span>
            </div>
          }
          @if (!group.canCompare) {
            <div class="ca-notice info">
              <mat-icon aria-hidden="true">info</mat-icon>
              <span>{{ 'groups.notEnough' | t }}</span>
            </div>
          }
          <ul>
            @for (offer of group.offers; track offer.id) {
              <li [class.best]="group.bestOfferIds.includes(offer.id)">
                <span class="store">
                  <strong>{{ offer.storeName }}</strong>
                  <span class="ca-small ca-muted">{{ offer | presentation | orNA }}{{ offer.availability === 'unavailable' ? ('groups.outOfStock' | t) : '' }}</span>
                </span>
                <span class="price">
                  <strong>{{ offer.price | money: offer.currency : 'common.priceNotAvailable' }}</strong>
                  <span class="ca-small">{{ offer.unitPrice | unitPrice: offer.currency : 'groups.noUnitPrice' }}</span>
                </span>
                @if (group.bestOfferIds.includes(offer.id)) {
                  <app-status-tag class="best-tag" [label]="'card.best' | t" tone="best" icon="savings" />
                }
              </li>
            }
          </ul>
          <button mat-button type="button" (click)="open.emit(group.offers[0]!)">
            <mat-icon>compare_arrows</mat-icon>
            {{ 'groups.view' | t }}
          </button>
        </article>
      }
    </div>
  `,
  styles: `
    .groups { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); }
    .group { display: grid; gap: 8px; align-content: start; }
    header { display: grid; gap: 4px; }
    h3 { margin: 0; font: var(--mat-sys-title-small); overflow-wrap: anywhere; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; padding: 8px 10px; border-radius: 10px; background: var(--mat-sys-surface-container-low); }
    li.best { background: var(--ca-highlight-bg); }
    .store, .price { display: grid; min-width: 0; }
    .price { text-align: right; }
    .best-tag { flex-basis: 100%; }
    button { justify-self: start; }
  `,
})
export class ComparisonGroupsComponent {
  readonly groups = input.required<ComparisonGroup[]>();
  readonly open = output<Offer>();
}

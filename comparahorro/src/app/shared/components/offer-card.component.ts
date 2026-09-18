import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { MessageKey } from '../../core/i18n/translate';
import type { ComparisonGroup } from '../../core/logic/compare';
import type { Offer } from '../../core/models/api.models';
import type { Tone } from './basic.components';

@Component({
  selector: 'app-offer-card',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offer-card.component.html',
  styleUrl: './offer-card.component.scss',
})
export class OfferCardComponent {
  readonly offer = input.required<Offer>();
  readonly group = input<ComparisonGroup | undefined>(undefined);
  readonly showActions = input(true);

  readonly compare = output<Offer>();
  readonly addToList = output<Offer>();

  readonly isBest = computed(() => this.group()?.bestOfferIds.includes(this.offer().id) ?? false);
  readonly extraPromotions = computed(() => this.offer().promotions.filter((p) => p.kind !== 'price_drop'));

  readonly availabilityKey = computed<MessageKey>(() => {
    switch (this.offer().availability) {
      case 'available':
        return 'card.available';
      case 'unavailable':
        return 'card.unavailable';
      default:
        return 'card.availabilityUnknown';
    }
  });

  readonly availabilityTone = computed<Tone>(() => {
    switch (this.offer().availability) {
      case 'available':
        return 'ok';
      case 'unavailable':
        return 'error';
      default:
        return 'neutral';
    }
  });

  readonly groupKey = computed<MessageKey | null>(() => {
    const group = this.group();
    if (!group) return null;
    return group.matchType === 'gtin' ? 'card.sameGtin' : 'card.probable';
  });
}

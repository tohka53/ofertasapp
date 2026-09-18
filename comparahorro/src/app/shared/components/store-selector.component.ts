import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { MessageKey } from '../../core/i18n/translate';
import { normalizeText } from '../../core/logic/format';
import type { StoreSummary } from '../../core/models/api.models';
import type { Tone } from './basic.components';

interface StatusView {
  key: MessageKey;
  tone: Tone;
  icon: string;
}

@Component({
  selector: 'app-store-selector',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './store-selector.component.html',
  styleUrl: './store-selector.component.scss',
})
export class StoreSelectorComponent {
  readonly stores = input.required<StoreSummary[]>();
  readonly selected = input.required<string[]>();
  readonly state = input<string | null>(null);
  readonly selectedChange = output<string[]>();

  readonly filter = signal('');

  readonly visibleStores = computed(() => {
    const term = normalizeText(this.filter());
    return term ? this.stores().filter((s) => normalizeText(s.name).includes(term)) : this.stores();
  });

  readonly selectableIds = computed(() => this.stores().filter((s) => s.selectable).map((s) => s.id));
  readonly availableIds = computed(() => this.stores().filter((s) => s.queryable && s.status === 'available').map((s) => s.id));
  readonly linkIds = computed(() => this.stores().filter((s) => s.integrationKind === 'link').map((s) => s.id));
  readonly quickIds = computed(() => [...this.availableIds(), ...this.linkIds()]);
  readonly allQuickSelected = computed(() => this.quickIds().length > 0 && this.quickIds().every((id) => this.selected().includes(id)));

  isSelected(store: StoreSummary): boolean {
    return this.selected().includes(store.id);
  }

  toggle(store: StoreSummary, checked: boolean): void {
    if (!store.selectable) return;
    const next = checked ? [...this.selected(), store.id] : this.selected().filter((id) => id !== store.id);
    this.selectedChange.emit([...new Set(next)]);
  }

  /** Selecciona las tiendas con consulta operativa y las que ofrecen enlace a su sitio. */
  selectAllAvailable(): void {
    const keep = this.selected().filter((id) => this.selectableIds().includes(id));
    this.selectedChange.emit([...new Set([...keep, ...this.quickIds()])]);
  }

  clear(): void {
    this.selectedChange.emit([]);
  }

  status(store: StoreSummary): StatusView {
    if (store.integrationKind === 'link') return { key: 'status.link', tone: 'info', icon: 'open_in_new' };
    if (store.pendingReasonCode === 'credentials_missing') return { key: 'status.credentials', tone: 'warn', icon: 'key' };
    switch (store.status) {
      case 'available':
        return { key: 'status.available', tone: 'ok', icon: 'check_circle' };
      case 'offline':
        return { key: 'status.offline', tone: 'error', icon: 'cloud_off' };
      case 'pending':
        return { key: 'status.pending', tone: 'neutral', icon: 'hourglass_empty' };
      default:
        return { key: 'status.unchecked', tone: 'info', icon: 'help_outline' };
    }
  }

  reasonKey(store: StoreSummary): MessageKey | null {
    if (store.integrationKind !== 'pending' || !store.pendingReasonCode || store.pendingReasonCode === 'credentials_missing') return null;
    return `reason.${store.pendingReasonCode}`;
  }

}

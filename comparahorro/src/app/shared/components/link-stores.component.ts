import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { StoreSummary } from '../../core/models/api.models';

export interface LinkTarget {
  store: StoreSummary;
  url: string | null;
  searches: boolean;
}

/** Enlace a la búsqueda del sitio de una tienda sin consulta automática (solo con plantilla comprobada). */
export function storeLink(store: StoreSummary, query: string): LinkTarget {
  const term = query.trim();
  if (store.searchUrlTemplate && term) {
    return { store, url: store.searchUrlTemplate.replace('{query}', encodeURIComponent(term)), searches: true };
  }
  return { store, url: store.website, searches: false };
}

@Component({
  selector: 'app-link-stores',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (targets().length) {
      <section class="ca-surface links" [attr.aria-label]="'links.title' | t">
        <h2 class="title">
          <mat-icon aria-hidden="true">travel_explore</mat-icon>
          {{ 'links.title' | t }}
        </h2>
        <p class="ca-small ca-muted">{{ 'links.explain' | t }}</p>
        <ul>
          @for (target of targets(); track target.store.id) {
            <li [attr.data-link-store]="target.store.id">
              @if (target.url) {
                <a mat-stroked-button [href]="target.url" target="_blank" rel="noopener noreferrer">
                  <mat-icon>open_in_new</mat-icon>
                  {{ target.searches ? ('links.searchIn' | t: { query: query().trim(), store: target.store.name }) : ('links.open' | t: { store: target.store.name }) }}
                </a>
              } @else {
                <span class="ca-small">{{ target.store.name }}</span>
              }
              @if (allowNote()) {
                <button mat-button type="button" (click)="note.emit(target.store)" [attr.aria-label]="'links.noteAria' | t: { store: target.store.name }">
                  <mat-icon>edit_note</mat-icon>
                  {{ 'links.note' | t }}
                </button>
              }
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    .links { display: grid; gap: 6px; }
    .title { font: var(--mat-sys-title-small); margin: 0; display: flex; align-items: center; gap: 8px; }
    p { margin: 0; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
    a { max-width: 100%; white-space: normal; height: auto; min-height: 40px; }
  `,
})
export class LinkStoresComponent {
  readonly stores = input.required<StoreSummary[]>();
  readonly query = input('');
  readonly allowNote = input(true);
  readonly note = output<StoreSummary>();

  readonly targets = computed(() => this.stores().map((store) => storeLink(store, this.query())));
}

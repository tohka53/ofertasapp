import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, Validators, type ValidationErrors } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { I18nService } from '../../core/i18n/i18n.service';
import { MONTHS } from '../../core/logic/format';
import type { StoreSummary } from '../../core/models/api.models';
import type { ManualPriceInput } from '../../core/models/app.models';
import { CatalogService } from '../../core/services/catalog.service';
import { defaultListName, ListsService } from '../../core/services/lists.service';
import { NotifyService } from '../../core/services/notify.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { storeLink } from '../components/link-stores.component';
import { NEW_LIST } from './add-to-list-dialog.component';

export interface ManualPriceDialogData {
  storeId?: string;
  productName?: string;
  presentation?: string | null;
  listId?: string;
  itemId?: string;
}

export interface ManualPriceResult {
  listId: string;
  listName: string;
}

export function localIsoDate(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function notFutureDate(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return { date: true };
  return value > localIsoDate() ? { future: true } : null;
}

@Component({
  selector: 'app-manual-price-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'manual.title' | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="content">
        <p class="ca-notice info">
          <mat-icon aria-hidden="true">edit_note</mat-icon>
          <span>{{ 'manual.explain' | t }}</span>
        </p>

        @if (!data.listId) {
          <mat-form-field class="ca-full-width">
            <mat-label>{{ 'addToList.list' | t }}</mat-label>
            <mat-select formControlName="listId">
              @for (list of lists(); track list.id) {
                <mat-option [value]="list.id">{{ list.name }} · {{ list.month | monthName }} {{ list.year }}</mat-option>
              }
              <mat-option [value]="newListValue">{{ 'addToList.newList' | t }}</mat-option>
            </mat-select>
          </mat-form-field>
          @if (form.controls.listId.value === newListValue) {
            <div class="row">
              <mat-form-field class="wide">
                <mat-label>{{ 'addToList.newName' | t }}</mat-label>
                <input matInput formControlName="newName" maxlength="60" />
              </mat-form-field>
              <mat-form-field>
                <mat-label>{{ 'addToList.month' | t }}</mat-label>
                <mat-select formControlName="newMonth">
                  @for (month of months; track month) {
                    <mat-option [value]="month">{{ month | monthName }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field>
                <mat-label>{{ 'addToList.year' | t }}</mat-label>
                <input matInput type="number" formControlName="newYear" min="2024" max="2100" />
              </mat-form-field>
            </div>
          }
        }

        <mat-form-field class="ca-full-width">
          <mat-label>{{ 'manual.store' | t }}</mat-label>
          <mat-select formControlName="storeId">
            @for (store of stores(); track store.id) {
              <mat-option [value]="store.id">{{ store.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (storeUrl(); as url) {
          <a class="open" mat-button [href]="url" target="_blank" rel="noopener noreferrer">
            <mat-icon>open_in_new</mat-icon>
            {{ 'manual.openStore' | t: { store: selectedStore()?.name ?? '' } }}
          </a>
        }

        <mat-form-field class="ca-full-width">
          <mat-label>{{ 'manual.product' | t }}</mat-label>
          <input matInput formControlName="productName" maxlength="120" autocomplete="off" />
          @if (form.controls.productName.invalid) {
            <mat-error>{{ 'itemForm.productError' | t }}</mat-error>
          }
        </mat-form-field>

        <div class="row">
          <mat-form-field>
            <mat-label>{{ 'manual.price' | t: { symbol: currencySymbol() } }}</mat-label>
            <input matInput type="number" formControlName="price" min="0.01" step="0.01" inputmode="decimal" />
            @if (form.controls.price.invalid) {
              <mat-error>{{ 'manual.priceError' | t }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'manual.presentation' | t }}</mat-label>
            <input matInput formControlName="presentation" maxlength="40" autocomplete="off" />
          </mat-form-field>
          @if (!data.itemId) {
            <mat-form-field>
              <mat-label>{{ 'addToList.quantity' | t }}</mat-label>
              <input matInput type="number" formControlName="quantity" min="1" max="999" step="1" />
              @if (form.controls.quantity.invalid) {
                <mat-error>{{ 'addToList.quantityError' | t }}</mat-error>
              }
            </mat-form-field>
          }
          <mat-form-field>
            <mat-label>{{ 'manual.seenOn' | t }}</mat-label>
            <input matInput type="date" formControlName="seenOn" [max]="today" />
            @if (form.controls.seenOn.invalid) {
              <mat-error>{{ 'manual.dateError' | t }}</mat-error>
            }
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">{{ 'manual.save' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content { display: grid; gap: 4px; padding-top: 8px; }
    .ca-notice { margin: 0 0 8px; }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0 12px; }
    .row .wide { grid-column: 1 / -1; }
    .open { justify-self: start; margin: -8px 0 8px; }
  `,
})
export class ManualPriceDialogComponent {
  readonly data = inject<ManualPriceDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ManualPriceDialogComponent, ManualPriceResult>);
  private readonly listsService = inject(ListsService);
  private readonly preferences = inject(PreferencesService);
  private readonly catalog = inject(CatalogService);
  private readonly i18n = inject(I18nService);
  private readonly notify = inject(NotifyService);

  readonly months = MONTHS;
  readonly newListValue = NEW_LIST;
  readonly today = localIsoDate();
  private readonly now = new Date();

  readonly lists = computed(() => this.listsService.listsForCurrentCountry());
  readonly currencySymbol = computed(() => this.preferences.country()?.currencySymbol ?? '');

  /** Todas las tiendas registradas del país (o estado): el precio pudo verse en su sitio o en la tienda física. */
  readonly stores = computed<StoreSummary[]>(() => {
    const selected = new Set(this.preferences.selectedStoreIds());
    const all = this.catalog.storesFor(this.preferences.countryCode(), this.preferences.stateCode())?.stores ?? [];
    return [...all].sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)) || a.name.localeCompare(b.name));
  });

  private readonly existingItem = this.data.listId && this.data.itemId ? this.listsService.get(this.data.listId)?.items.find((i) => i.id === this.data.itemId) : undefined;

  readonly form = new FormGroup({
    listId: new FormControl(this.data.listId ?? this.lists().at(-1)?.id ?? NEW_LIST, { nonNullable: true, validators: [Validators.required] }),
    newName: new FormControl(defaultListName(this.now.getMonth() + 1, this.i18n.lang()), { nonNullable: true }),
    newMonth: new FormControl(this.now.getMonth() + 1, { nonNullable: true }),
    newYear: new FormControl(this.now.getFullYear(), { nonNullable: true, validators: [Validators.min(2024), Validators.max(2100)] }),
    storeId: new FormControl(this.data.storeId ?? this.defaultStoreId(), { nonNullable: true, validators: [Validators.required] }),
    productName: new FormControl(this.data.productName ?? this.existingItem?.productQuery ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    presentation: new FormControl(this.data.presentation ?? this.existingItem?.desiredPresentation ?? '', { nonNullable: true, validators: [Validators.maxLength(40)] }),
    price: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0.01), Validators.max(1_000_000)] }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(999), Validators.pattern(/^\d+$/)] }),
    seenOn: new FormControl(this.today, { nonNullable: true, validators: [notFutureDate] }),
  });

  private readonly storeIdValue = toSignal(this.form.controls.storeId.valueChanges, { initialValue: this.form.controls.storeId.value });
  readonly selectedStore = computed(() => this.stores().find((s) => s.id === this.storeIdValue()) ?? null);
  readonly storeUrl = computed(() => {
    const store = this.selectedStore();
    return store ? storeLink(store, this.data.productName ?? '').url : null;
  });

  private defaultStoreId(): string {
    const selected = this.preferences.selectedStores();
    return (selected.find((s) => s.integrationKind === 'link') ?? selected[0])?.id ?? '';
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const store = this.stores().find((s) => s.id === value.storeId);
    const price = Number(value.price);
    if (!store) {
      this.notify.error(this.i18n.t('manual.noStore'));
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      this.notify.error(this.i18n.t('manual.priceError'));
      return;
    }

    let listId = this.data.listId ?? value.listId;
    let listName = this.listsService.get(listId)?.name ?? '';
    if (!this.data.listId && listId === NEW_LIST) {
      const country = this.preferences.country();
      if (!country) {
        this.notify.error(this.i18n.t('data.loadError'));
        return;
      }
      const list = this.listsService.create({ name: value.newName, month: value.newMonth, year: value.newYear }, country);
      listId = list.id;
      listName = list.name;
    }

    const input: ManualPriceInput = {
      storeId: store.id,
      storeName: store.name,
      productName: value.productName.trim(),
      presentation: value.presentation.trim() || null,
      price: Math.round(price * 100) / 100,
      seenOn: value.seenOn,
      url: storeLink(store, value.productName).url ?? '',
    };
    if (this.data.itemId) this.listsService.setManualPrice(listId, this.data.itemId, input);
    else this.listsService.addManualPrice(listId, input, Number(value.quantity));
    this.ref.close({ listId, listName });
  }
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { I18nService } from '../../core/i18n/i18n.service';
import { MONTHS } from '../../core/logic/format';
import type { Offer } from '../../core/models/api.models';
import { defaultListName, ListsService } from '../../core/services/lists.service';
import { PreferencesService } from '../../core/services/preferences.service';

export interface AddToListResult {
  listId: string;
  listName: string;
  merged: boolean;
}

export const NEW_LIST = '__nueva__';

@Component({
  selector: 'app-add-to-list-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'addToList.title' | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="content">
        <div class="ca-surface summary">
          <strong>{{ data.offer.name }}</strong>
          <span class="ca-small ca-muted">{{ data.offer.storeName }} · {{ data.offer | presentation | orNA }}</span>
          <span>{{ data.offer.price | money: data.offer.currency : 'common.priceNotAvailable' }}</span>
          @if (data.offer.price === null) {
            <span class="ca-notice warn">{{ 'addToList.noPrice' | t }}</span>
          }
        </div>

        <mat-form-field appearance="outline" class="ca-full-width">
          <mat-label>{{ 'addToList.list' | t }}</mat-label>
          <mat-select formControlName="listId">
            @for (list of lists(); track list.id) {
              <mat-option [value]="list.id">{{ list.name }} · {{ list.month | monthName }} {{ list.year }}</mat-option>
            }
            <mat-option [value]="newListValue">{{ 'addToList.newList' | t }}</mat-option>
          </mat-select>
        </mat-form-field>

        @if (form.controls.listId.value === newListValue) {
          <div class="new-list">
            <mat-form-field appearance="outline" class="ca-full-width">
              <mat-label>{{ 'addToList.newName' | t }}</mat-label>
              <input matInput formControlName="newName" maxlength="60" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'addToList.month' | t }}</mat-label>
              <mat-select formControlName="newMonth">
                @for (month of months; track month) {
                  <mat-option [value]="month">{{ month | monthName }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'addToList.year' | t }}</mat-label>
              <input matInput type="number" formControlName="newYear" min="2024" max="2100" />
            </mat-form-field>
          </div>
        }

        <mat-form-field appearance="outline">
          <mat-label>{{ 'addToList.quantity' | t }}</mat-label>
          <input matInput type="number" formControlName="quantity" min="1" max="999" step="1" />
          @if (form.controls.quantity.invalid) {
            <mat-error>{{ 'addToList.quantityError' | t }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">{{ 'common.add' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content { display: grid; gap: 8px; padding-top: 8px; }
    .summary { display: grid; gap: 4px; }
    .new-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0 12px; }
    .new-list > :first-child { grid-column: 1 / -1; }
  `,
})
export class AddToListDialogComponent {
  readonly data = inject<{ offer: Offer }>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<AddToListDialogComponent, AddToListResult>);
  private readonly listsService = inject(ListsService);
  private readonly preferences = inject(PreferencesService);
  private readonly i18n = inject(I18nService);

  readonly months = MONTHS;
  readonly newListValue = NEW_LIST;
  readonly lists = computed(() => this.listsService.lists().filter((l) => l.countryCode === this.data.offer.countryCode));
  private readonly now = new Date();

  readonly form = new FormGroup({
    listId: new FormControl(this.lists().at(-1)?.id ?? NEW_LIST, { nonNullable: true, validators: [Validators.required] }),
    newName: new FormControl(defaultListName(this.now.getMonth() + 1, this.i18n.lang()), { nonNullable: true }),
    newMonth: new FormControl(this.now.getMonth() + 1, { nonNullable: true }),
    newYear: new FormControl(this.now.getFullYear(), { nonNullable: true, validators: [Validators.min(2024), Validators.max(2100)] }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(999), Validators.pattern(/^\d+$/)] }),
  });

  save(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    let listId = value.listId;
    let listName = this.lists().find((l) => l.id === listId)?.name ?? '';
    if (listId === NEW_LIST) {
      const country = this.preferences.country();
      if (!country || country.code !== this.data.offer.countryCode) return;
      const list = this.listsService.create({ name: value.newName, month: value.newMonth, year: value.newYear }, country);
      listId = list.id;
      listName = list.name;
    }
    const { merged } = this.listsService.addOffer(listId, this.data.offer, Number(value.quantity));
    this.ref.close({ listId, listName, merged });
  }
}

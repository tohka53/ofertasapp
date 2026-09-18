import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { I18nService } from '../../core/i18n/i18n.service';
import type { ShoppingList } from '../../core/models/app.models';
import { FamiliesService } from '../../core/services/families.service';
import { defaultListName } from '../../core/services/lists.service';
import { MONTHS } from '../../core/logic/format';

/** Textos ya traducidos al abrir el diálogo. */
export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">{{ data.cancelLabel ?? ('common.cancel' | t) }}</button>
      <button mat-flat-button type="button" [mat-dialog-close]="true" cdkFocusInitial>{{ data.confirmLabel ?? ('common.confirm' | t) }}</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}

export interface ListFormResult {
  name: string;
  month: number;
  year: number;
  familyId: string | null;
}

@Component({
  selector: 'app-list-form-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ (data.list ? 'listForm.editTitle' : 'listForm.newTitle') | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline" class="ca-full-width">
          <mat-label>{{ 'listForm.name' | t }}</mat-label>
          <input matInput formControlName="name" maxlength="60" autocomplete="off" />
          @if (form.controls.name.hasError('required')) {
            <mat-error>{{ 'listForm.nameRequired' | t }}</mat-error>
          }
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'addToList.month' | t }}</mat-label>
            <mat-select formControlName="month" (selectionChange)="onMonthChange()">
              @for (month of months; track month) {
                <mat-option [value]="month">{{ month | monthName }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'addToList.year' | t }}</mat-label>
            <input matInput type="number" formControlName="year" min="2024" max="2100" />
            @if (form.controls.year.invalid) {
              <mat-error>{{ 'listForm.yearError' | t }}</mat-error>
            }
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="ca-full-width">
          <mat-label>{{ 'listForm.family' | t }}</mat-label>
          <mat-select formControlName="familyId">
            <mat-option [value]="null">{{ 'listForm.noFamily' | t }}</mat-option>
            @for (family of families.families(); track family.id) {
              <mat-option [value]="family.id">{{ family.name }}</mat-option>
            }
          </mat-select>
          <mat-hint>{{ 'listForm.familyHint' | t }}</mat-hint>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">{{ (data.list ? 'common.save' : 'listForm.create') | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .fields { display: grid; gap: 4px; padding-top: 8px; }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  `,
})
export class ListFormDialogComponent {
  readonly data = inject<{ list?: ShoppingList }>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ListFormDialogComponent, ListFormResult>);
  private readonly i18n = inject(I18nService);
  readonly families = inject(FamiliesService);
  readonly months = MONTHS;
  private readonly now = new Date();
  private nameTouchedByUser = !!this.data.list;

  readonly form = new FormGroup({
    name: new FormControl(this.data.list?.name ?? defaultListName(this.now.getMonth() + 1, this.i18n.lang()), {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    month: new FormControl(this.data.list?.month ?? this.now.getMonth() + 1, { nonNullable: true, validators: [Validators.required] }),
    year: new FormControl(this.data.list?.year ?? this.now.getFullYear(), { nonNullable: true, validators: [Validators.required, Validators.min(2024), Validators.max(2100)] }),
    familyId: new FormControl<string | null>(this.data.list?.familyId ?? null),
  });

  constructor() {
    this.form.controls.name.valueChanges.subscribe(() => {
      if (this.form.controls.name.dirty) this.nameTouchedByUser = true;
    });
  }

  onMonthChange(): void {
    if (!this.nameTouchedByUser) this.form.controls.name.setValue(defaultListName(this.form.controls.month.value, this.i18n.lang()));
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.ref.close({ name: value.name.trim(), month: value.month, year: value.year, familyId: value.familyId ?? null });
  }
}

export interface TextFormDialogData {
  title: string;
  label: string;
  value?: string;
  confirmLabel?: string;
  maxLength?: number;
}

@Component({
  selector: 'app-text-form-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="ca-full-width">
          <mat-label>{{ data.label }}</mat-label>
          <input matInput formControlName="value" [maxlength]="data.maxLength ?? 60" autocomplete="off" cdkFocusInitial />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">{{ data.confirmLabel ?? ('common.save' | t) }}</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class TextFormDialogComponent {
  readonly data = inject<TextFormDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<TextFormDialogComponent, string>);
  readonly form = new FormGroup({
    value: new FormControl(this.data.value ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(this.data.maxLength ?? 60)],
    }),
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.ref.close(this.form.controls.value.value.trim());
  }
}

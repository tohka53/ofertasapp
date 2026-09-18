import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

export interface ItemFormResult {
  productQuery: string;
  desiredPresentation: string | null;
  quantity: number;
}

@Component({
  selector: 'app-item-form-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'itemForm.title' | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="fields">
        <p class="ca-small ca-muted">{{ 'itemForm.help' | t }}</p>
        <mat-form-field class="ca-full-width">
          <mat-label>{{ 'itemForm.product' | t }}</mat-label>
          <input matInput formControlName="productQuery" [placeholder]="'itemForm.productPlaceholder' | t" maxlength="80" autocomplete="off" />
          @if (form.controls.productQuery.hasError('required') || form.controls.productQuery.hasError('minlength')) {
            <mat-error>{{ 'itemForm.productError' | t }}</mat-error>
          }
        </mat-form-field>
        <div class="row">
          <mat-form-field>
            <mat-label>{{ 'itemForm.desired' | t }}</mat-label>
            <input matInput formControlName="desiredPresentation" [placeholder]="'itemForm.desiredPlaceholder' | t" maxlength="40" autocomplete="off" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'addToList.quantity' | t }}</mat-label>
            <input matInput type="number" formControlName="quantity" min="1" max="999" step="1" />
            @if (form.controls.quantity.invalid) {
              <mat-error>{{ 'itemForm.quantityError' | t }}</mat-error>
            }
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">{{ 'common.add' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .fields { display: grid; gap: 4px; }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0 12px; }
  `,
})
export class ItemFormDialogComponent {
  private readonly ref = inject(MatDialogRef<ItemFormDialogComponent, ItemFormResult>);

  readonly form = new FormGroup({
    productQuery: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)] }),
    desiredPresentation: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40)] }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(999), Validators.pattern(/^\d+$/)] }),
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.ref.close({ productQuery: value.productQuery.trim(), desiredPresentation: value.desiredPresentation.trim() || null, quantity: Number(value.quantity) });
  }
}

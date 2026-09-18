import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { I18nService } from '../i18n/i18n.service';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(I18nService);

  info(message: string): void {
    this.snackBar.open(message, this.i18n.t('common.close'), { duration: 4000 });
  }

  error(message: string): void {
    this.snackBar.open(message, this.i18n.t('common.close'), { duration: 7000, politeness: 'assertive' });
  }
}

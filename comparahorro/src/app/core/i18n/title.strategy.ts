import { effect, inject, Injectable, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';
import { I18nService } from './i18n.service';
import { isMessageKey } from './translate';

/** Títulos de ruta como claves de traducción; se actualizan al cambiar el idioma. */
@Injectable()
export class I18nTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private snapshot: RouterStateSnapshot | null = null;

  constructor() {
    super();
    effect(() => {
      this.i18n.lang();
      untracked(() => {
        if (this.snapshot) this.apply(this.snapshot);
      });
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.snapshot = snapshot;
    this.apply(snapshot);
  }

  private apply(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    const app = this.i18n.t('app.name');
    this.title.setTitle(key && isMessageKey(key) ? `${this.i18n.t(key)} · ${app}` : app);
  }
}

import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { AppMessage, Lang, LocalizedText } from '../models/api.models';
import { intlLocale, LANGS, localized, translate, translateMessage, type MessageKey, type MessageParams } from './translate';

/**
 * Idioma de la interfaz (español o inglés). Cambia en tiempo real, sin recargar,
 * porque la sesión vive solo en memoria. Se usa español por defecto.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  private readonly langState = signal<Lang>('es');

  readonly lang = this.langState.asReadonly();
  readonly locale = computed(() => intlLocale(this.langState()));

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.langState();
    });
  }

  setLang(lang: Lang): void {
    if (LANGS.includes(lang)) this.langState.set(lang);
  }

  t(key: MessageKey, params?: MessageParams): string {
    return translate(this.langState(), key, params);
  }

  loc(text: LocalizedText | null | undefined): string {
    return localized(this.langState(), text);
  }

  msg(message: AppMessage | null | undefined): string {
    return translateMessage(this.langState(), message);
  }
}

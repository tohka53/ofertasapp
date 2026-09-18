import { inject, Pipe, type PipeTransform } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import type { MessageKey, MessageParams } from '../../core/i18n/translate';
import { formatCents, formatDate, formatDateTime, formatMoney, monthName, presentationLabel, unitName, unitPriceLabel } from '../../core/logic/format';
import { locationLabel } from '../../core/logic/location';
import type { AppMessage, LocalizedText, ParsedContent, UnitPrice, UnitPriceBasis } from '../../core/models/api.models';
import type { LocationSelection } from '../../core/models/app.models';

/** Texto traducido. Es impuro para reflejar el cambio de idioma sin recargar. */
@Pipe({ name: 't', standalone: false, pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: MessageKey, params?: MessageParams): string {
    return this.i18n.t(key, params);
  }
}

/** Texto `{ es, en }` publicado por el servidor. */
@Pipe({ name: 'loc', standalone: false, pure: false })
export class LocalizedPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(text: LocalizedText | null | undefined): string {
    return this.i18n.loc(text);
  }
}

/** Mensaje con código del servidor o de la app. */
@Pipe({ name: 'msg', standalone: false, pure: false })
export class MessagePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(message: AppMessage | null | undefined): string {
    return this.i18n.msg(message);
  }
}

/** Importe con símbolo ("Q 25.50"). Un valor ausente se muestra como texto, nunca como cero. */
@Pipe({ name: 'money', standalone: false, pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: number | null | undefined, currency = 'GTQ', fallback: MessageKey = 'common.notAvailable'): string {
    return formatMoney(value, currency) ?? this.i18n.t(fallback);
  }
}

@Pipe({ name: 'cents', standalone: false })
export class CentsPipe implements PipeTransform {
  transform(value: number, currency = 'GTQ'): string {
    return formatCents(value, currency);
  }
}

@Pipe({ name: 'unitPrice', standalone: false, pure: false })
export class UnitPricePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: UnitPrice | null | undefined, currency = 'GTQ', fallback: MessageKey = 'common.notAvailable'): string {
    return unitPriceLabel(value, currency, this.i18n.lang()) ?? this.i18n.t(fallback);
  }
}

@Pipe({ name: 'unitName', standalone: false, pure: false })
export class UnitNamePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: UnitPriceBasis | null | undefined): string {
    return value ? unitName(value, this.i18n.lang()) : '';
  }
}

@Pipe({ name: 'dateTime', standalone: false, pure: false })
export class DateTimePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: string | null | undefined, fallback: MessageKey = 'common.notAvailable'): string {
    return formatDateTime(value, this.i18n.lang()) ?? this.i18n.t(fallback);
  }
}

@Pipe({ name: 'calendarDate', standalone: false, pure: false })
export class CalendarDatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: string | null | undefined, fallback: MessageKey = 'common.notAvailable'): string {
    return formatDate(value, this.i18n.lang()) ?? this.i18n.t(fallback);
  }
}

@Pipe({ name: 'monthName', standalone: false, pure: false })
export class MonthNamePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(month: number): string {
    return monthName(month, this.i18n.lang());
  }
}

/** Presentación de una oferta en el idioma activo (usa el contenido interpretado si existe). */
@Pipe({ name: 'presentation', standalone: false, pure: false })
export class PresentationPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(offer: { content: ParsedContent | null; presentation: string | null } | null | undefined): string | null {
    return offer ? presentationLabel(offer.content, offer.presentation, this.i18n.lang()) : null;
  }
}

@Pipe({ name: 'locationLabel', standalone: false, pure: false })
export class LocationLabelPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(location: LocationSelection | null | undefined): string {
    return locationLabel(location, this.i18n.lang());
  }
}

/** Texto o "No disponible". */
@Pipe({ name: 'orNA', standalone: false, pure: false })
export class OrNotAvailablePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: string | number | null | undefined, fallback: MessageKey = 'common.notAvailable'): string {
    if (value === null || value === undefined) return this.i18n.t(fallback);
    const text = String(value).trim();
    return text ? text : this.i18n.t(fallback);
  }
}

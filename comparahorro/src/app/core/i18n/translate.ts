import type { AppMessage, Lang, LocalizedText } from '../models/api.models';
import { formatMessage, type MessageParams } from './format-message';
import { EN } from './messages.en';
import { ES, type MessageKey } from './messages.es';

export type { MessageKey } from './messages.es';
export type { MessageParams } from './format-message';

const DICTIONARIES: Record<Lang, Record<MessageKey, string>> = { es: ES, en: EN };

export const LANGS: readonly Lang[] = ['es', 'en'];

export function isMessageKey(value: string): value is MessageKey {
  return Object.prototype.hasOwnProperty.call(ES, value);
}

export function translate(lang: Lang, key: MessageKey, params?: MessageParams): string {
  return formatMessage(DICTIONARIES[lang][key], params, lang);
}

export function localized(lang: Lang, text: LocalizedText | null | undefined): string {
  return text ? text[lang] || text.es : '';
}

/** Mensajes con código del servidor (`server.<código>`) o claves propias de la app. */
export function translateMessage(lang: Lang, message: AppMessage | null | undefined): string {
  if (!message) return '';
  if (isMessageKey(message.code)) return translate(lang, message.code, message.params);
  const key = `server.${message.code}`;
  if (isMessageKey(key)) return translate(lang, key, message.params);
  return translate(lang, 'server.unknown', { code: message.code });
}

export function intlLocale(lang: Lang): string {
  return lang === 'es' ? 'es-GT' : 'en-US';
}

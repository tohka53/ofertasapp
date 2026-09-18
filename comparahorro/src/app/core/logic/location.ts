import { translate } from '../i18n/translate';
import type { Lang } from '../models/api.models';
import type { LocationSelection } from '../models/app.models';

/** Texto de la ubicación elegida en el idioma activo; también se envía al servidor como etiqueta. */
export function locationLabel(location: LocationSelection | null | undefined, lang: Lang): string {
  if (!location) return translate(lang, 'loc.none');
  switch (location.mode) {
    case 'zone':
      return location.name && location.postalCode ? `${location.name} (${location.postalCode})` : (location.postalCode ?? '');
    case 'postalCode':
      return translate(lang, 'loc.postalCode', { code: location.postalCode });
    case 'zip':
      return translate(lang, 'loc.zip', { code: location.postalCode });
    case 'city':
      return location.name ?? '';
    case 'gps':
      return translate(lang, 'loc.gps', { lat: location.lat?.toFixed(4), lng: location.lng?.toFixed(4) });
  }
}

export function usesPostalCode(location: LocationSelection): boolean {
  return (location.mode === 'zone' || location.mode === 'postalCode' || location.mode === 'zip') && !!location.postalCode;
}

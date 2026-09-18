import type { LocalizedText } from './catalog.types.js';

export interface CityPreset {
  name: string;
  /** Centro aproximado de la ciudad; la tienda asigna la sucursal más cercana. */
  lat: number;
  lng: number;
}

/** Ciudades principales por país para tiendas que asignan sucursal por coordenadas. */
export const CITY_PRESETS: Record<string, CityPreset[]> = {
  SV: [
    { name: 'San Salvador', lat: 13.6929, lng: -89.2182 },
    { name: 'Santa Ana', lat: 13.9942, lng: -89.5597 },
    { name: 'San Miguel', lat: 13.4833, lng: -88.1833 },
  ],
  HN: [
    { name: 'Tegucigalpa', lat: 14.0723, lng: -87.1921 },
    { name: 'San Pedro Sula', lat: 15.5042, lng: -88.025 },
    { name: 'La Ceiba', lat: 15.7597, lng: -86.7822 },
    { name: 'Choluteca', lat: 13.3007, lng: -87.1908 },
  ],
  NI: [
    { name: 'Managua', lat: 12.115, lng: -86.2362 },
    { name: 'León', lat: 12.4379, lng: -86.878 },
    { name: 'Granada', lat: 11.9344, lng: -85.956 },
    { name: 'Masaya', lat: 11.9744, lng: -86.0942 },
  ],
  CR: [
    { name: 'San José', lat: 9.9281, lng: -84.0907 },
    { name: 'Alajuela', lat: 10.0163, lng: -84.2116 },
    { name: 'Heredia', lat: 9.9981, lng: -84.117 },
    { name: 'Cartago', lat: 9.8644, lng: -83.9194 },
    { name: 'Liberia', lat: 10.6346, lng: -85.4407 },
  ],
  PA: [
    { name: 'Ciudad de Panamá', lat: 8.9824, lng: -79.5199 },
    { name: 'San Miguelito', lat: 9.0333, lng: -79.5 },
    { name: 'Colón', lat: 9.3592, lng: -79.9014 },
    { name: 'David', lat: 8.4273, lng: -82.4308 },
  ],
};

export interface StateOption {
  code: string;
  name: LocalizedText;
}

export const US_STATES: StateOption[] = [
  { code: 'AL', name: { es: 'Alabama', en: 'Alabama' } },
  { code: 'AK', name: { es: 'Alaska', en: 'Alaska' } },
  { code: 'AZ', name: { es: 'Arizona', en: 'Arizona' } },
  { code: 'AR', name: { es: 'Arkansas', en: 'Arkansas' } },
  { code: 'CA', name: { es: 'California', en: 'California' } },
  { code: 'CO', name: { es: 'Colorado', en: 'Colorado' } },
  { code: 'CT', name: { es: 'Connecticut', en: 'Connecticut' } },
  { code: 'DE', name: { es: 'Delaware', en: 'Delaware' } },
  { code: 'DC', name: { es: 'Distrito de Columbia', en: 'District of Columbia' } },
  { code: 'FL', name: { es: 'Florida', en: 'Florida' } },
  { code: 'GA', name: { es: 'Georgia', en: 'Georgia' } },
  { code: 'HI', name: { es: 'Hawái', en: 'Hawaii' } },
  { code: 'ID', name: { es: 'Idaho', en: 'Idaho' } },
  { code: 'IL', name: { es: 'Illinois', en: 'Illinois' } },
  { code: 'IN', name: { es: 'Indiana', en: 'Indiana' } },
  { code: 'IA', name: { es: 'Iowa', en: 'Iowa' } },
  { code: 'KS', name: { es: 'Kansas', en: 'Kansas' } },
  { code: 'KY', name: { es: 'Kentucky', en: 'Kentucky' } },
  { code: 'LA', name: { es: 'Luisiana', en: 'Louisiana' } },
  { code: 'ME', name: { es: 'Maine', en: 'Maine' } },
  { code: 'MD', name: { es: 'Maryland', en: 'Maryland' } },
  { code: 'MA', name: { es: 'Massachusetts', en: 'Massachusetts' } },
  { code: 'MI', name: { es: 'Míchigan', en: 'Michigan' } },
  { code: 'MN', name: { es: 'Minnesota', en: 'Minnesota' } },
  { code: 'MS', name: { es: 'Misisipi', en: 'Mississippi' } },
  { code: 'MO', name: { es: 'Misuri', en: 'Missouri' } },
  { code: 'MT', name: { es: 'Montana', en: 'Montana' } },
  { code: 'NE', name: { es: 'Nebraska', en: 'Nebraska' } },
  { code: 'NV', name: { es: 'Nevada', en: 'Nevada' } },
  { code: 'NH', name: { es: 'Nuevo Hampshire', en: 'New Hampshire' } },
  { code: 'NJ', name: { es: 'Nueva Jersey', en: 'New Jersey' } },
  { code: 'NM', name: { es: 'Nuevo México', en: 'New Mexico' } },
  { code: 'NY', name: { es: 'Nueva York', en: 'New York' } },
  { code: 'NC', name: { es: 'Carolina del Norte', en: 'North Carolina' } },
  { code: 'ND', name: { es: 'Dakota del Norte', en: 'North Dakota' } },
  { code: 'OH', name: { es: 'Ohio', en: 'Ohio' } },
  { code: 'OK', name: { es: 'Oklahoma', en: 'Oklahoma' } },
  { code: 'OR', name: { es: 'Oregón', en: 'Oregon' } },
  { code: 'PA', name: { es: 'Pensilvania', en: 'Pennsylvania' } },
  { code: 'RI', name: { es: 'Rhode Island', en: 'Rhode Island' } },
  { code: 'SC', name: { es: 'Carolina del Sur', en: 'South Carolina' } },
  { code: 'SD', name: { es: 'Dakota del Sur', en: 'South Dakota' } },
  { code: 'TN', name: { es: 'Tennessee', en: 'Tennessee' } },
  { code: 'TX', name: { es: 'Texas', en: 'Texas' } },
  { code: 'UT', name: { es: 'Utah', en: 'Utah' } },
  { code: 'VT', name: { es: 'Vermont', en: 'Vermont' } },
  { code: 'VA', name: { es: 'Virginia', en: 'Virginia' } },
  { code: 'WA', name: { es: 'Washington', en: 'Washington' } },
  { code: 'WV', name: { es: 'Virginia Occidental', en: 'West Virginia' } },
  { code: 'WI', name: { es: 'Wisconsin', en: 'Wisconsin' } },
  { code: 'WY', name: { es: 'Wyoming', en: 'Wyoming' } },
];

export const US_STATE_CODES = US_STATES.map((s) => s.code);

export function allStatesExcept(excluded: string[]): string[] {
  return US_STATE_CODES.filter((code) => !excluded.includes(code));
}

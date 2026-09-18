/**
 * Ubicaciones de Guatemala usadas para consultar precios regionales.
 * Códigos postales de 5 dígitos: departamento (2) + municipio o zona (3).
 * Las cabeceras y los municipios metropolitanos coinciden con el selector de
 * ubicación de walmart.com.gt; una muestra (01001, 01010, 01057, 01064, 03001,
 * 04001, 05001, 09001, 13001, 16001, 17001, 18001, 20001, 22001) se comprobó el
 * 16/09/2026 contra la API pública de regiones. Para otros municipios la
 * aplicación permite escribir el código postal.
 */

export interface LocationOption {
  name: string;
  postalCode: string;
}

export interface DepartmentLocations {
  name: string;
  options: LocationOption[];
}

const cityZones = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 24, 25].map((zone) => ({
  name: `Guatemala Zona ${zone}`,
  postalCode: `010${String(zone).padStart(2, '0')}`,
}));

export const GT_LOCATIONS: DepartmentLocations[] = [
  {
    name: 'Guatemala',
    options: [
      ...cityZones,
      { name: 'Mixco', postalCode: '01057' },
      { name: 'Villa Nueva', postalCode: '01064' },
      { name: 'San Miguel Petapa', postalCode: '01066' },
      { name: 'Villa Canales', postalCode: '01065' },
      { name: 'Amatitlán', postalCode: '01063' },
      { name: 'Fraijanes', postalCode: '01062' },
      { name: 'Santa Catarina Pinula', postalCode: '01051' },
      { name: 'San José Pinula', postalCode: '01052' },
    ],
  },
  { name: 'Alta Verapaz', options: [{ name: 'Cobán', postalCode: '16001' }] },
  { name: 'Baja Verapaz', options: [{ name: 'Salamá', postalCode: '15001' }] },
  { name: 'Chimaltenango', options: [{ name: 'Chimaltenango', postalCode: '04001' }] },
  { name: 'Chiquimula', options: [{ name: 'Chiquimula', postalCode: '20001' }] },
  { name: 'El Progreso', options: [{ name: 'Guastatoya', postalCode: '02001' }] },
  { name: 'Escuintla', options: [{ name: 'Escuintla', postalCode: '05001' }] },
  { name: 'Huehuetenango', options: [{ name: 'Huehuetenango', postalCode: '13001' }] },
  { name: 'Izabal', options: [{ name: 'Puerto Barrios', postalCode: '18001' }] },
  { name: 'Jalapa', options: [{ name: 'Jalapa', postalCode: '21001' }] },
  { name: 'Jutiapa', options: [{ name: 'Jutiapa', postalCode: '22001' }] },
  { name: 'Petén', options: [{ name: 'Flores', postalCode: '17001' }] },
  { name: 'Quetzaltenango', options: [{ name: 'Quetzaltenango', postalCode: '09001' }] },
  { name: 'Quiché', options: [{ name: 'Santa Cruz del Quiché', postalCode: '14001' }] },
  { name: 'Retalhuleu', options: [{ name: 'Retalhuleu', postalCode: '11001' }] },
  { name: 'Sacatepéquez', options: [{ name: 'Antigua Guatemala', postalCode: '03001' }] },
  { name: 'San Marcos', options: [{ name: 'San Marcos', postalCode: '12001' }] },
  { name: 'Santa Rosa', options: [{ name: 'Cuilapa', postalCode: '06001' }] },
  { name: 'Sololá', options: [{ name: 'Sololá', postalCode: '07001' }] },
  { name: 'Suchitepéquez', options: [{ name: 'Mazatenango', postalCode: '10001' }] },
  { name: 'Totonicapán', options: [{ name: 'Totonicapán', postalCode: '08001' }] },
  { name: 'Zacapa', options: [{ name: 'Zacapa', postalCode: '19001' }] },
];

export const GT_DEFAULT_LOCATION = { department: 'Guatemala', name: 'Guatemala Zona 1', postalCode: '01001' };

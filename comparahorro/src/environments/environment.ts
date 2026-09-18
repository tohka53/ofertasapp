/**
 * Conexion con Supabase. La URL y la clave publicable son datos publicos del
 * proyecto: la seguridad la aplican las politicas RLS definidas en
 * supabase/schema.sql. Nunca poner aqui la clave de servicio.
 */
export const environment = {
  supabaseUrl: 'https://bvuwwdpwvfkhyowhflta.supabase.co',
  supabasePublishableKey: 'sb_publishable_0uCsi0mg8LNkA1m9ro2Dlw_fEpbr2w9',
  apiBaseUrl: '/api',
};

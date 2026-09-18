import { inject } from '@angular/core';
import { Router, type ActivatedRouteSnapshot, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CatalogService } from '../services/catalog.service';
import { PreferencesService } from '../services/preferences.service';

/** Rutas protegidas: requieren una sesion de Supabase activa. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: state.url && state.url !== '/' ? { next: state.url } : {} });
};

/** Evita volver al inicio de sesion con una sesion activa. */
export const guestGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  if (!auth.isAuthenticated()) return true;
  const next = route.queryParamMap.get('next');
  return inject(Router).parseUrl(next && next.startsWith('/') ? next : '/buscar');
};

/** El pais elegido requiere estado (EE. UU.) y todavia no se eligio. */
export async function missingState(): Promise<boolean> {
  const preferences = inject(PreferencesService);
  const catalog = inject(CatalogService);
  const code = preferences.countryCode();
  if (!code || preferences.stateCode()) return false;
  const countries = await catalog.loadCountries().catch(() => []);
  return countries.find((c) => c.code === code)?.regionKind === 'state';
}

/** Buscar, Ofertas y Mis listas requieren pais y al menos una tienda seleccionada. */
export const setupGuard: CanActivateFn = () => {
  const preferences = inject(PreferencesService);
  const router = inject(Router);
  if (!preferences.countryCode()) return router.createUrlTree(['/configurar/pais']);
  if (preferences.selectedStoreIds().length === 0) return router.createUrlTree(['/configurar/tiendas']);
  return true;
};

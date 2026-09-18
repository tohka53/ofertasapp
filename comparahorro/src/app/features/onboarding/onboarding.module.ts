import { inject, NgModule } from '@angular/core';
import { Router, RouterModule, type CanActivateFn, type Routes } from '@angular/router';
import { missingState } from '../../core/guards/auth.guards';
import { CatalogService } from '../../core/services/catalog.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { SharedModule } from '../../shared/shared.module';
import { CountryStepComponent } from './country-step.component';
import { LocationStepComponent } from './location-step.component';
import { OnboardingShellComponent } from './onboarding-shell.component';
import { StateStepComponent } from './state-step.component';
import { StoresStepComponent } from './stores-step.component';

const requireCountry: CanActivateFn = () =>
  inject(PreferencesService).countryCode() ? true : inject(Router).createUrlTree(['/configurar/pais']);

/** Solo para países con estados (EE. UU.). */
const requireStateCountry: CanActivateFn = async () => {
  const preferences = inject(PreferencesService);
  const catalog = inject(CatalogService);
  const router = inject(Router);
  const countries = await catalog.loadCountries().catch(() => []);
  const country = countries.find((c) => c.code === preferences.countryCode());
  return country?.regionKind === 'state' ? true : router.createUrlTree(['/configurar/tiendas']);
};

const requireState: CanActivateFn = async () => {
  const router = inject(Router);
  return (await missingState()) ? router.createUrlTree(['/configurar/estado']) : true;
};

const requireStores: CanActivateFn = () =>
  inject(PreferencesService).selectedStoreIds().length ? true : inject(Router).createUrlTree(['/configurar/tiendas']);

const routes: Routes = [
  {
    path: '',
    component: OnboardingShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pais' },
      { path: 'pais', title: 'title.country', component: CountryStepComponent },
      { path: 'estado', title: 'title.state', component: StateStepComponent, canActivate: [requireCountry, requireStateCountry] },
      { path: 'tiendas', title: 'title.stores', component: StoresStepComponent, canActivate: [requireCountry, requireState] },
      { path: 'ubicacion', title: 'title.location', component: LocationStepComponent, canActivate: [requireCountry, requireStores] },
    ],
  },
];

@NgModule({
  declarations: [OnboardingShellComponent, CountryStepComponent, StateStepComponent, StoresStepComponent, LocationStepComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class OnboardingModule {}

import { NgModule } from '@angular/core';
import { RouterModule, TitleStrategy, type Routes } from '@angular/router';
import { authGuard, guestGuard, setupGuard } from './core/guards/auth.guards';
import { I18nTitleStrategy } from './core/i18n/title.strategy';
import { ShellComponent } from './layout/shell.component';

const routes: Routes = [
  {
    path: 'login',
    title: 'title.login',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.module').then((m) => m.AuthModule),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth-callback.module').then((m) => m.AuthCallbackModule),
  },
  {
    path: 'invitacion/:token',
    title: 'title.invitation',
    loadChildren: () => import('./features/invitations/invitations.module').then((m) => m.InvitationsModule),
  },
  {
    path: 'configurar',
    canActivate: [authGuard],
    loadChildren: () => import('./features/onboarding/onboarding.module').then((m) => m.OnboardingModule),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'buscar' },
      {
        path: 'buscar',
        title: 'nav.search',
        canActivate: [setupGuard],
        loadChildren: () => import('./features/search/search.module').then((m) => m.SearchModule),
      },
      {
        path: 'ofertas',
        title: 'nav.offers',
        canActivate: [setupGuard],
        loadChildren: () => import('./features/offers/offers.module').then((m) => m.OffersModule),
      },
      {
        path: 'listas',
        title: 'nav.lists',
        canActivate: [setupGuard],
        loadChildren: () => import('./features/lists/lists.module').then((m) => m.ListsModule),
      },
      {
        path: 'grupos',
        title: 'nav.families',
        loadChildren: () => import('./features/families/families.module').then((m) => m.FamiliesModule),
      },
      {
        path: 'perfil',
        title: 'nav.profile',
        loadChildren: () => import('./features/profile/profile.module').then((m) => m.ProfileModule),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled', bindToComponentInputs: true })],
  exports: [RouterModule],
  providers: [{ provide: TitleStrategy, useClass: I18nTitleStrategy }],
})
export class AppRoutingModule {}

import { provideHttpClient, withFetch } from '@angular/common/http';
import { inject, LOCALE_ID, NgModule, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthService } from './core/services/auth.service';
import { FamiliesService } from './core/services/families.service';
import { InvitationsService } from './core/services/invitations.service';
import { ListsService } from './core/services/lists.service';
import { ProfileService } from './core/services/profile.service';
import { LayoutModule } from './layout/layout.module';
import { SharedModule } from './shared/shared.module';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, AppRoutingModule, SharedModule, LayoutModule],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      const profile = inject(ProfileService);
      inject(ListsService);
      inject(FamiliesService);
      inject(InvitationsService);
      await auth.restore();
      const userId = auth.userId();
      if (userId) await profile.load(userId);
    }),
    { provide: LOCALE_ID, useValue: 'es-GT' },
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-icons-outlined' } },
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}

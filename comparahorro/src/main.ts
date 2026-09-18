import { registerLocaleData } from '@angular/common';
import localeEsGt from '@angular/common/locales/es-GT';
import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app.module';

registerLocaleData(localeEsGt);

platformBrowser()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));

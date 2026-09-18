import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { OffersPageComponent } from './offers-page.component';

const routes: Routes = [{ path: '', component: OffersPageComponent }];

@NgModule({
  declarations: [OffersPageComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class OffersModule {}

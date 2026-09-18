import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { FamiliesPageComponent } from './families-page.component';

const routes: Routes = [{ path: '', component: FamiliesPageComponent }];

@NgModule({
  declarations: [FamiliesPageComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class FamiliesModule {}

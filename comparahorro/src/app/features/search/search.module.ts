import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { SearchPageComponent } from './search-page.component';

const routes: Routes = [{ path: '', component: SearchPageComponent }];

@NgModule({
  declarations: [SearchPageComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class SearchModule {}

import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { BestPriceDialogComponent } from './best-price-dialog.component';
import { ItemFormDialogComponent } from './item-form-dialog.component';
import { ListDetailComponent } from './list-detail.component';
import { ListsPageComponent } from './lists-page.component';
import { RefreshDialogComponent } from './refresh-dialog.component';

const routes: Routes = [
  { path: '', component: ListsPageComponent },
  { path: ':id', component: ListDetailComponent },
];

@NgModule({
  declarations: [ListsPageComponent, ListDetailComponent, ItemFormDialogComponent, BestPriceDialogComponent, RefreshDialogComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ListsModule {}

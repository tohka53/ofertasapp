import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  InvitationsBannerComponent,
  EmptyStateComponent,
  LanguageSwitchComponent,
  PromotionListComponent,
  StatusTagComponent,
  StoreQueryStatusComponent,
} from './components/basic.components';
import { ComparisonGroupsComponent } from './components/comparison-groups.component';
import { LinkStoresComponent } from './components/link-stores.component';
import { LocationPickerComponent } from './components/location-picker.component';
import { OfferCardComponent } from './components/offer-card.component';
import { OfferFiltersComponent } from './components/offer-filters.component';
import { StoreSelectorComponent } from './components/store-selector.component';
import { AddToListDialogComponent } from './dialogs/add-to-list-dialog.component';
import { CompareDialogComponent } from './dialogs/compare-dialog.component';
import { ManualPriceDialogComponent } from './dialogs/manual-price-dialog.component';
import { MembersDialogComponent } from './dialogs/members-dialog.component';
import { ConfirmDialogComponent, ListFormDialogComponent, TextFormDialogComponent } from './dialogs/simple-dialogs.component';
import { MaterialModule } from './material.module';
import {
  CalendarDatePipe,
  CentsPipe,
  DateTimePipe,
  LocalizedPipe,
  LocationLabelPipe,
  MessagePipe,
  MoneyPipe,
  MonthNamePipe,
  OrNotAvailablePipe,
  PresentationPipe,
  TranslatePipe,
  UnitNamePipe,
  UnitPricePipe,
} from './pipes/format.pipes';

const DECLARATIONS = [
  InvitationsBannerComponent,
  LanguageSwitchComponent,
  LinkStoresComponent,
  ManualPriceDialogComponent,
  EmptyStateComponent,
  StatusTagComponent,
  PromotionListComponent,
  StoreQueryStatusComponent,
  OfferCardComponent,
  OfferFiltersComponent,
  ComparisonGroupsComponent,
  StoreSelectorComponent,
  LocationPickerComponent,
  AddToListDialogComponent,
  CompareDialogComponent,
  ConfirmDialogComponent,
  ListFormDialogComponent,
  MembersDialogComponent,
  TextFormDialogComponent,
  TranslatePipe,
  LocalizedPipe,
  MessagePipe,
  MoneyPipe,
  CentsPipe,
  UnitPricePipe,
  UnitNamePipe,
  DateTimePipe,
  CalendarDatePipe,
  MonthNamePipe,
  PresentationPipe,
  LocationLabelPipe,
  OrNotAvailablePipe,
];

@NgModule({
  declarations: DECLARATIONS,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MaterialModule],
  exports: [CommonModule, ReactiveFormsModule, RouterModule, MaterialModule, ...DECLARATIONS],
})
export class SharedModule {}

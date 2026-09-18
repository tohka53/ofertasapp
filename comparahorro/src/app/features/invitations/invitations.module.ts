import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { InvitationPageComponent } from './invitation-page.component';

const routes: Routes = [{ path: '', component: InvitationPageComponent }];

@NgModule({
  declarations: [InvitationPageComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class InvitationsModule {}

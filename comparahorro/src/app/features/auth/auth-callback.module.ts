import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ConfirmedComponent } from './confirmed.component';
import { NewPasswordComponent } from './new-password.component';

const routes: Routes = [
  { path: 'confirmado', title: 'title.confirmed', component: ConfirmedComponent },
  { path: 'nueva-clave', title: 'title.newPassword', component: NewPasswordComponent },
  { path: '**', redirectTo: 'confirmado' },
];

@NgModule({
  declarations: [ConfirmedComponent, NewPasswordComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class AuthCallbackModule {}

import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ForgotPasswordComponent } from './forgot-password.component';
import { LoginComponent } from './login.component';
import { RegisterComponent } from './register.component';

const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'registro', title: 'title.register', component: RegisterComponent },
  { path: 'recuperar', title: 'title.forgot', component: ForgotPasswordComponent },
];

@NgModule({
  declarations: [LoginComponent, RegisterComponent, ForgotPasswordComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class AuthModule {}

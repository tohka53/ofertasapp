import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { ShellComponent } from './shell.component';

@NgModule({
  declarations: [ShellComponent],
  imports: [SharedModule],
  exports: [ShellComponent],
})
export class LayoutModule {}

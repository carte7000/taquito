import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SignerSelectModule } from 'src/app/components/signer-select/signer-select.module';
import { AccountComponent } from './account.component';


@NgModule({
  declarations: [AccountComponent],
  imports: [
    CommonModule,
    SignerSelectModule,
  ],
  exports: [AccountComponent],
})
export class AccountModule { }

import { Component, OnInit } from '@angular/core';
import { TaquitoService } from 'src/app/taquito.service';

@Component({
  selector: 'tz-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss']
})
export class AccountComponent implements OnInit {

  constructor(
    private taquito: TaquitoService
  ) { }

  ngOnInit() {
  }

  async transfer() {
    const op = await this.taquito.transfer({ to: 'tz1KrmbTZsPQzUJBBpatjWFEw2p6Lo9dnyC3', amount: 0.000001 })
    await op.confirmation();
    alert('Yeah')
  }

  async contract() {
    const op = await this.taquito.contract();
    await op.confirmation();
    alert('Yeah contract')
  }

}

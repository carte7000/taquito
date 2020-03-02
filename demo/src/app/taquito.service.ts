import { Injectable } from '@angular/core';
import { Tezos, TezosToolkit, TezBridgeWallet, BeaconWallet } from '@taquito/taquito';
import { OriginateParams, TransferParams } from '@taquito/taquito/dist/types/operations/types';
import { TezBridgeSigner } from '@taquito/tezbridge-signer';

import { NetworkSelectService } from './components/network-select/network-select.service';
import { Network } from './models/network.model';

@Injectable({
  providedIn: 'root',
})
export class TaquitoService {
  private taquito: TezosToolkit = Tezos;

  constructor(private networkSelect: NetworkSelectService) { }

  public setNetwork(network: Network) {
    this.networkSelect.select(network);
    this.taquito.setProvider({ rpc: Network.getUrl(network) });
  }

  public importFaucetKey(key) {
    const email = key.email;
    const password = key.password;
    const mnemonic = key.mnemonic.join(' ');
    const secret = key.secret;

    return this.taquito.importKey(email, password, mnemonic, secret);
  }

  public async selectTezBridgeSigner() {
    this.taquito['_wallet'] = new TezBridgeWallet(this.taquito['_context'], this.taquito['_contract'])
    this.taquito.setProvider({ rpc: this.taquito.rpc, signer: new TezBridgeSigner() });
  }

  public async selectBeaconWallet() {
    this.taquito['_wallet'] = new BeaconWallet('test', this.taquito['_contract'], this.taquito['_context'])
    await this.taquito['_wallet'].init();
  }

  public async originate(contract: OriginateParams) {
    const operation = await this.taquito.wallet.originate(contract);
    return operation;
  }

  public async delegate(params) {
    await this.taquito.wallet.setDelegate({ delegate: 'tz1PirboZKFVqkfE45hVLpkpXaZtLk3mqC17', source: null })
  }

  public async transfer(params: TransferParams) {
    return this.taquito.wallet.transfer(params)
  }

  public async contract() {
    const contract = await this.taquito.wallet.at('KT1CstdKc9TtdDPkSy9dQVZLMYPCYrzTonSB');
    return contract.methods.increment(1).send();
  }

  public async getContract(address: string) {
    const contract = await this.taquito.contract.at(address);

    return {
      account: await this.taquito.rpc.getContract(address),
      storage: await contract.storage(),
      script: contract.script,
    };
  }
}

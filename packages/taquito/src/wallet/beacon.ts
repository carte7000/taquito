import { DAppClient } from '@airgap/beacon-sdk/dist/clients/DappClient';
import { PermissionResponse } from "@airgap/beacon-sdk/dist/messages/Messages";
import { TezosOperationType } from "@airgap/beacon-sdk/dist/operations/OperationTypes";
import { RpcClient } from '@taquito/rpc';
import { encodeKeyHash } from "@taquito/utils";
import { Context } from "../context";
import { ContractProvider } from "../contract";
import { Contract } from "../contract/contract";
import { createOriginationOperation, createRegisterDelegateOperation, createSetDelegateOperation, createTransferOperation } from "../contract/prepare";
import { DelegateParams, OriginateParams, TransferParams } from "../operations/types";
import { OriginationWalletOperation, WalletOperation, WalletProvider } from "./interface";


export class BeaconWallet implements WalletProvider {

  public client: DAppClient;

  private permissions?: PermissionResponse;

  constructor(name: string, private contractProvider: ContractProvider, private context: Context) {
    this.client = new DAppClient(name)
  }

  async init() {
    const result = await this.client.requestPermissions()
    this.permissions = result;
  }

  async pkh() {
    return encodeKeyHash(this.permissions!.permissions.pubkey);
  }

  async originate(contract: OriginateParams): Promise<OriginationWalletOperation> {
    const op = await createOriginationOperation(contract)
    const network = this.permissions!.permissions.networks;
    const { transactionHashes } = await this.client.requestOperation({
      network: network[0],
      operationDetails: [{
        ...op,
        kind: TezosOperationType.ORIGINATION,
      }]
    })
    const context = this.context.clone()
    context.rpc = new RpcClient('')

    return new OriginationWalletOperation(transactionHashes[0], this, this.context)
  }

  async setDelegate(params: DelegateParams): Promise<WalletOperation> {
    const network = this.permissions!.permissions.networks;
    const op = await createSetDelegateOperation(params)
    const { transactionHashes } = await this.client.requestOperation({
      network: network[0],
      operationDetails: [{
        ...op,
        kind: TezosOperationType.DELEGATION,
      }]
    })
    return new WalletOperation(transactionHashes[0], this.context.clone())
  }

  async registerDelegate(): Promise<WalletOperation> {
    const network = this.permissions!.permissions.networks;
    const op = await createRegisterDelegateOperation({}, this.permissions!.permissions.pubkey);
    const { transactionHashes } = await this.client.requestOperation({
      network: network[0],
      operationDetails: [{
        ...op,
        kind: TezosOperationType.DELEGATION,
      }]
    })
    return new WalletOperation(transactionHashes[0], this.context.clone())
  }

  async transfer(params: TransferParams): Promise<WalletOperation> {
    const network = this.permissions!.permissions.networks;
    const op = await createTransferOperation(params);
    const { transactionHashes } = await this.client.requestOperation({
      network: network[0],
      operationDetails: [{
        ...op,
        kind: TezosOperationType.TRANSACTION,
      }]
    })
    return new WalletOperation(transactionHashes[0], this.context.clone())
  }

  async at(address: string): Promise<Contract<WalletProvider>> {
    const script = await this.context.rpc.getScript(address);
    const entrypoints = await this.context.rpc.getEntrypoints(address);
    return new Contract(address, script, this, this.contractProvider, entrypoints);
  }

}

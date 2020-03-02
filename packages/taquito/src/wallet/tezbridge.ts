import { WalletProvider, WalletOperation, OriginationWalletOperation } from "./interface";
import { OriginateParams, DelegateParams, TransferParams, OpKind } from "../operations/types";
import { Contract } from "../contract/contract";
import { ContractProvider } from "../contract";
import { Context } from "../context";
import { createOriginationOperation, createSetDelegateOperation, createRegisterDelegateOperation, createTransferOperation } from "../contract/prepare";


declare var tezbridge: any;

export class TezBridgeWallet implements WalletProvider {
  constructor(private context: Context, private contractProvider: ContractProvider, ) {
    if (typeof tezbridge === 'undefined') {
      throw new Error('tezbridge plugin could not be detected in your browser');
    }
  }

  async pkh() {
    return tezbridge.request({
      method: 'get_source',
    })
  }

  async originate(contract: OriginateParams): Promise<OriginationWalletOperation> {
    const op = await createOriginationOperation(contract)
    const { operation_id } = await tezbridge.request({
      method: 'inject_operations',
      operations: [
        {
          kind: 'origination',
          ...op,
        }
      ]
    })
    console.log(operation_id);
    return new OriginationWalletOperation(operation_id, this, this.context.clone())
  }

  async setDelegate(params: DelegateParams): Promise<WalletOperation> {
    const { operation_id } = await tezbridge.request({
      method: 'set_delegate',
      delegate: params.delegate
    })
    return new WalletOperation(operation_id, this.context.clone())
  }

  async registerDelegate(): Promise<WalletOperation> {
    const { operation_id } = await tezbridge.request({
      method: 'set_delegate',
    })
    return new WalletOperation(operation_id, this.context.clone())
  }

  async transfer(params: TransferParams): Promise<WalletOperation> {
    const op = await createTransferOperation(params)
    const { operation_id } = await tezbridge.request({
      method: 'inject_operations',
      operations: [
        {
          kind: OpKind.TRANSACTION,
          ...op,
        }
      ]
    })
    return new WalletOperation(operation_id, this.context.clone())
  }

  async at(address: string): Promise<Contract<WalletProvider>> {
    const script = await this.context.rpc.getScript(address);
    const entrypoints = await this.context.rpc.getEntrypoints(address);
    return new Contract(address, script, this, this.contractProvider, entrypoints);
  }
}

import { WalletProvider, WalletOperation, OriginationWalletOperation } from "./interface";
import { OriginateParams, DelegateParams, TransferParams } from "../operations/types";
import { Contract } from "../contract/contract";
import { ContractProvider } from "../contract";
import { Context } from "../context";

export class LegacyWallet implements WalletProvider {
  constructor(
    private context: Context,
    private contractProvider: ContractProvider,
  ) { }

  async pkh() {
    return this.context.signer.publicKeyHash()
  }

  async originate(contract: OriginateParams): Promise<OriginationWalletOperation> {
    const op = await this.contractProvider.originate(contract);
    return new OriginationWalletOperation(op.hash, this, this.context.clone())
  }

  async setDelegate(params: DelegateParams): Promise<WalletOperation> {
    const op = await this.contractProvider.setDelegate(params);
    return new WalletOperation(op.hash, this.context.clone())
  }

  async registerDelegate(params: DelegateParams): Promise<WalletOperation> {
    const op = await this.contractProvider.registerDelegate(params);
    return new WalletOperation(op.hash, this.context.clone())
  }

  async transfer(params: TransferParams): Promise<WalletOperation> {
    const op = await this.contractProvider.transfer(params);
    return new WalletOperation(op.hash, this.context.clone())
  }

  async at(address: string): Promise<Contract<WalletProvider>> {
    const script = await this.context.rpc.getScript(address);
    const entrypoints = await this.context.rpc.getEntrypoints(address);
    return new Contract(address, script, this, this.contractProvider, entrypoints);
  }
}

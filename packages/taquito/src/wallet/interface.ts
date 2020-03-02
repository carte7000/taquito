import { ContractSchema } from "../contract";
import { Contract } from "../contract/contract";
import { DelegateParams, OriginateParams, TransferParams } from "../operations/types";
import { Context } from "../context";
import { ReplaySubject, defer, timer, from } from "rxjs";
import { BlockResponse, OperationContentsAndResult, OpKind, OperationContentsAndResultMetadataOrigination, OperationContentsAndResultOrigination } from "@taquito/rpc";
import { first, tap, map, switchMap, mapTo, switchMapTo, filter, shareReplay } from "rxjs/operators";

// TODO: Change this to be specific to operation kind
export class WalletOperation {
  private _pollingConfig$ = new ReplaySubject<any>(1);
  protected _operationResult = new ReplaySubject<OperationContentsAndResult[]>(1)

  private _currentHeadPromise: Promise<BlockResponse> | undefined = undefined;

  // Caching the current head for one second
  private currentHead$ = defer(() => {
    if (!this._currentHeadPromise) {
      this._currentHeadPromise = this.context.rpc.getBlock();
      timer(1000)
        .pipe(first())
        .subscribe(() => {
          this._currentHeadPromise = undefined;
        });
    }
    return from(this._currentHeadPromise);
  });

  // Polling observable that emit until timeout is reached
  private polling$ = defer(() =>
    this._pollingConfig$.pipe(
      tap(({ timeout, interval }) => {
        if (timeout <= 0) {
          throw new Error('Timeout must be more than 0');
        }

        if (interval <= 0) {
          throw new Error('Interval must be more than 0');
        }
      }),
      map(config => ({
        ...config,
        timeoutAt: Math.ceil(config.timeout / config.interval) + 1,
        count: 0,
      })),
      switchMap(config => timer(0, config.interval * 1000).pipe(mapTo(config))),
      tap(config => {
        config.count++;
        if (config.count > config.timeoutAt) {
          throw new Error(`Confirmation polling timed out`);
        }
      })
    )
  );

  // Observable that emit once operation is seen in a block
  private confirmed$ = this.polling$.pipe(
    switchMapTo(this.currentHead$),
    map(head => {
      for (let i = 3; i >= 0; i--) {
        head.operations[i].forEach(op => {
          if (op.hash === this.hash) {
            this._foundAt = head.header.level;
            this._operationResult.next(op.contents as OperationContentsAndResult[])
          }
        });
      }

      if (head.header.level - this._foundAt >= 0) {
        return this._foundAt;
      }
    }),
    filter(x => x !== undefined),
    first(),
    shareReplay()
  );

  protected _foundAt = Number.POSITIVE_INFINITY;
  get includedInBlock() {
    return this._foundAt;
  }
  /**
   *
   * @param hash Operation hash
   * @param raw Raw operation that was injected
   * @param context Taquito context allowing access to rpc and signer
   */
  constructor(
    public readonly hash: string,
    protected readonly context: Context
  ) {
    this.confirmed$.pipe(first()).subscribe();
  }

  /**
   *
   * @param confirmations [0] Number of confirmation to wait for
   * @param interval [10] Polling interval
   * @param timeout [180] Timeout
   */
  confirmation(confirmations?: number, interval?: number, timeout?: number) {
    if (typeof confirmations !== 'undefined' && confirmations < 1) {
      throw new Error('Confirmation count must be at least 1');
    }

    const {
      defaultConfirmationCount,
      confirmationPollingIntervalSecond,
      confirmationPollingTimeoutSecond,
    } = this.context.config;
    this._pollingConfig$.next({
      interval: interval || confirmationPollingIntervalSecond,
      timeout: timeout || confirmationPollingTimeoutSecond,
    });

    const conf = confirmations !== undefined ? confirmations : defaultConfirmationCount;

    return new Promise<number>((resolve, reject) => {
      this.confirmed$
        .pipe(
          switchMap(() => this.polling$),
          switchMap(() => this.currentHead$),
          filter(head => head.header.level - this._foundAt >= conf - 1),
          first()
        )
        .subscribe(_ => {
          resolve(this._foundAt + (conf - 1));
        }, reject);
    });
  }
}

export class OriginationWalletOperation extends WalletOperation {

  constructor(
    public readonly hash: string,
    private readonly wallet: WalletProvider,
    protected readonly context: Context
  ) {
    super(hash, context)
  }

  public async contract() {
    await this.confirmation();
    return this._operationResult.pipe(switchMap(async (results) => {
      const op: OperationContentsAndResultOrigination = results.find((x) => x.kind === OpKind.ORIGINATION) as any;
      const address = (op.metadata.operation_result.originated_contracts || [])[0]
      return this.wallet.at(address)
    }), first()).toPromise()
  }
}

export interface WalletProvider {

  pkh(): Promise<string>;

  /**
   *
   * @description Originate a new contract according to the script in parameters. Will sign and inject an operation using the current context
   *
   * @returns An operation handle with the result from the rpc node
   *
   * @param OriginationOperation Originate operation parameter
   */
  originate(contract: OriginateParams): Promise<OriginationWalletOperation>;

  /**
   *
   * @description Set the delegate for a contract. Will sign and inject an operation using the current context
   *
   * @returns An operation handle with the result from the rpc node
   *
   * @param SetDelegate operation parameter
   */
  setDelegate(params: DelegateParams): Promise<WalletOperation>;

  /**
   *
   * @description Register the current address as delegate. Will sign and inject an operation using the current context
   *
   * @returns An operation handle with the result from the rpc node
   *
   * @param RegisterDelegate operation parameter
   */
  registerDelegate(params: DelegateParams): Promise<WalletOperation>;
  /**
   *
   * @description Transfer tz from current address to a specific address. Will sign and inject an operation using the current context
   *
   * @returns An operation handle with the result from the rpc node
   *
   * @param Transfer operation parameter
   */
  transfer(params: TransferParams): Promise<WalletOperation>;
  at(address: string, schema?: ContractSchema): Promise<Contract<WalletProvider>>;
}

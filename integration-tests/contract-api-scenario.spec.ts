import { CONFIGS } from "./config";
import { ligoSample } from "./data/ligo-simple-contract";
import { tokenCode, tokenInit } from "./data/tokens";
import { voteSample } from "./data/vote-contract";
import { depositContractCode, depositContractStorage } from "./data/deposit_contract";

import { tokenBigmapCode } from './data/token_bigmap'
import { collection_code } from "./data/collection_contract";

import { noAnnotCode, noAnnotInit } from "./data/token_without_annotation";
import { DEFAULT_FEE, DEFAULT_GAS_LIMIT, TezosToolkit, DEFAULT_STORAGE_LIMIT } from "@taquito/taquito";
import { booleanCode } from "./data/boolean_parameter";
import { failwithContractCode } from "./data/failwith"
import { badCode } from "./data/badCode";
import { InMemorySigner } from "@taquito/signer";
import { storageContract } from "./data/storage-contract";

CONFIGS.forEach(({ lib, rpc, setup, knownBaker }) => {
  const Tezos = lib;
  describe(`Test contract api using: ${rpc}`, () => {

    beforeEach(async (done) => {
      await setup()
      done()
    })
    it('Simple origination scenario', async (done) => {
      const op = await Tezos.contract.originate({
        balance: "1",
        code: `parameter string;
        storage string;
        code {CAR;
              PUSH string "Hello ";
              CONCAT;
              NIL operation; PAIR};
        `,
        init: `"test"`
      })
      await op.confirmation()
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      done();
    });

    it('Contract with bad code', async () => {
      expect(Tezos.contract.originate({
        balance: "1",
        code: badCode,
        init: { prim: "Unit" }
      })).rejects.toMatchObject({
        status: 400,
      })
    })

    it('Failwith contract', async (done) => {
      const op = await Tezos.contract.originate({
        balance: "1",
        code: failwithContractCode,
        storage: null
      })
      const contract = await op.contract()
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      expect(op.status === 'applied');

      try {
        await contract.methods.main(null).send()
      } catch (ex) {
        expect(ex.message).toMatch('test')
      }

      try {
        // Bypass estimation
        await contract.methods.main(null).send({ fee: 20000, gasLimit: 20000, storageLimit: 0 })
      } catch (ex) {
        expect(ex.message).toMatch('test')
      }
      done();
    });

    it('Simple set delegate', async (done) => {
      const delegate = knownBaker
      const op = await Tezos.contract.setDelegate({
        delegate,
        source: await Tezos.signer.publicKeyHash(),
        fee: DEFAULT_FEE.DELEGATION,
        gasLimit: DEFAULT_GAS_LIMIT.DELEGATION
      })
      await op.confirmation()
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)

      const account = await Tezos.rpc.getDelegate(await Tezos.signer.publicKeyHash())
      expect(account).toEqual(delegate)
      done();
    });

    it('Set delegate with automatic estimate', async (done) => {
      const delegate = knownBaker
      const op = await Tezos.contract.setDelegate({
        delegate,
        source: await Tezos.signer.publicKeyHash(),
      })
      await op.confirmation()
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)

      const account = await Tezos.rpc.getDelegate(await Tezos.signer.publicKeyHash())
      expect(account).toEqual(delegate)
      done();
    });

    it('Simple ligo origination scenario', async (done) => {
      const op = await Tezos.contract.originate({
        balance: "1",
        code: ligoSample,
        storage: 0,
      })
      await op.confirmation()
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      const contract = await op.contract();

      const storage: any = await contract.storage()
      expect(storage.toString()).toEqual("0")
      const opMethod = await contract.methods.main("2").send();

      await opMethod.confirmation();
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      const storage2: any = await contract.storage()
      expect(storage2.toString()).toEqual("2")
      done();
    });

    it('Token origination scenario', async (done) => {
      const op = await Tezos.contract.originate({
        balance: "1",
        code: tokenCode,
        init: tokenInit(await Tezos.signer.publicKeyHash()),
        fee: 150000,
        storageLimit: 10000,
        gasLimit: 400000,
      })
      await op.confirmation()
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      const contract = await op.contract();
      const opMethod = await contract.methods.mint(await Tezos.signer.publicKeyHash(), 100).send();

      await opMethod.confirmation();
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      done();
    });

    it('Bool parameter contract origination scenario', async (done) => {
      const op = await Tezos.contract.originate({
        balance: "1",
        code: booleanCode,
        storage: true,
        fee: 150000,
        storageLimit: 10000,
        gasLimit: 400000,
      })
      await op.confirmation()
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      const contract = await op.contract();

      expect(await contract.storage()).toBeTruthy();

      const opMethod = await contract.methods.setBool(false).send();

      await opMethod.confirmation();
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)

      expect(await contract.storage()).toBeFalsy();
      done();
    });

    it('Token origination scenario', async (done) => {
      const op = await Tezos.contract.originate({
        balance: "1",
        code: voteSample,
        storage: {
          mgr1: {
            addr: await Tezos.signer.publicKeyHash(),
            key: null,
          },
          mgr2: {
            addr: await Tezos.signer.publicKeyHash(),
            key: await Tezos.signer.publicKeyHash(),
          },
        }
      })
      await op.confirmation()
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      done();
    });

    it('Transfer and wait 2 confirmations', async (done) => {
      const op = await Tezos.contract.transfer({ to: 'tz1ZfrERcALBwmAqwonRXYVQBDT9BjNjBHJu', amount: 2 })
      await op.confirmation()
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      const [first, second] = await Promise.all([op.confirmation(), op.confirmation(2)])
      expect(second - first).toEqual(1)
      // Retrying another time should be instant
      const [first2, second2] = await Promise.all([op.confirmation(), op.confirmation(2)])
      expect(second2 - first2).toEqual(1)
      done();
    })

    it('Use big map abstraction for big maps', async (done) => {
      // Deploy a contract with a big map
      const op = await Tezos.contract.originate({
        balance: "1",
        code: tokenCode,
        init: tokenInit(`${await Tezos.signer.publicKeyHash()}`),
      })
      const contract = await op.contract()

      // Fetch the storage of the newly deployed contract
      const storage: any = await contract.storage();

      // First property is the big map abstract (The contract do not have annotations)
      const bigMap = storage['0'];

      // Fetch the key (current pkh that is running the test)
      const bigMapValue = await bigMap.get(await Tezos.signer.publicKeyHash())
      expect(bigMapValue['0'].toString()).toEqual("2")
      expect(bigMapValue['1']).toEqual({})
      done();
    })

    it('Test contract with unit as params', async (done) => {
      const op = await Tezos.contract.originate({
        balance: "1",
        code: depositContractCode,
        init: depositContractStorage
      })
      const contract = await op.contract()

      const operation = await contract.methods.deposit(null).send({ amount: 1, });
      await operation.confirmation();
      expect(operation.status).toEqual('applied')
      done();
    })

    it('Token with empty big map origination scenario', async (done) => {
      const op = await Tezos.contract.originate({
        balance: "1",
        code: tokenBigmapCode,
        storage: {
          owner: await Tezos.signer.publicKeyHash(),
          accounts: {},
          totalSupply: "0"
        }
      })
      await op.confirmation()
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      done();
    });

    it('Token with big map and with initial data', async (done) => {
      const addr = await Tezos.signer.publicKeyHash();

      const initialStorage = {
        owner: addr,
        accounts: {
          [addr]: {
            balance: "1",
            allowances: {
              [addr]: "1"
            }
          },
          "tz2Ch1abG7FNiibmV26Uzgdsnfni9XGrk5wD": {
            balance: "1",
            allowances: {
              [addr]: "1"
            }
          },
          "tz3YjfexGakCDeCseXFUpcXPSAN9xHxE9TH2": {
            balance: "2",
            allowances: {
              KT1CDEg2oY3VfMa1neB7hK5LoVMButvivKYv: "1",
              [addr]: "1"
            }
          },
          "tz1ccqAEwfPgeoipnXtjAv1iucrpQv3DFmmS": {
            balance: "1",
            allowances: {
              [addr]: "1"
            }
          },
          "KT1CDEg2oY3VfMa1neB7hK5LoVMButvivKYv": {
            balance: "1",
            allowances: {
              [addr]: "1"
            }
          }
        },
        totalSupply: "6"
      }

      const op = await Tezos.contract.originate({
        balance: "1",
        code: tokenBigmapCode,
        storage: initialStorage
      })
      await op.confirmation()
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      const contract = await op.contract()
      const storage: any = await contract.storage()
      expect((await storage.accounts.get(addr)).allowances[addr].toString()).toEqual(initialStorage.accounts[addr].allowances[addr])
      done();
    });

    it('Collection contract test', async (done) => {
      const addr = await Tezos.signer.publicKeyHash();

      const initialStorage = {
        set1: ['2', '1', '3'],
        list1: ['1'],
        map1: { "2": "1", "1": "1" }
      }

      const op = await Tezos.contract.originate({
        balance: "1",
        code: collection_code,
        storage: initialStorage
      })
      await op.confirmation()
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      const contract = await op.contract()
      let storage: any = await contract.storage()
      expect(storage['set1'].map((x: any) => x.toString())).toEqual(['1', '2', '3'])
      expect(storage['list1'].map((x: any) => x.toString())).toEqual(['1'])
      expect(storage['map1']['1'].toString()).toEqual('1')

      const setOp = await contract.methods['setSet'](['2']).send()
      await setOp.confirmation();

      const listOp = await contract.methods['setList'](['2']).send()
      await listOp.confirmation();

      const mapOp = await contract.methods['setMap']({ "2": "2" }).send()
      await mapOp.confirmation();

      done();
    });
    it('Storage contract', async (done) => {
      const op = await Tezos.contract.originate({
        balance: "1",
        code: storageContract,
        storage: {
          "map1": {
            "tz2Ch1abG7FNiibmV26Uzgdsnfni9XGrk5wD": 1,
            'KT1CDEg2oY3VfMa1neB7hK5LoVMButvivKYv': 2,
            "tz3YjfexGakCDeCseXFUpcXPSAN9xHxE9TH2": 2,
            "tz1ccqAEwfPgeoipnXtjAv1iucrpQv3DFmmS": 3,
          },
          "map2": {
            "2": 1,
            '3': 2,
            "1": 2,
            "4": 3,
          },
          "map3": {
            "2": 1,
            '3': 2,
            "1": 2,
            "4": 3,
          },
          "map4": {
            "zz": 1,
            'aa': 2,
            "ab": 2,
            "cc": 3,
          },
          "map5": {
            "aaaa": 1,
            "aa": 1,
            'ab': 2,
            "01": 2,
            "22": 3,
          },
          "map6": {
            "2": 1,
            '3': 2,
            "1": 2,
            "4": 3,
          },
          "map7": {
            "2018-04-23T10:26:00.996Z": 1,
            '2017-04-23T10:26:00.996Z': 2,
            "2019-04-23T10:26:00.996Z": 2,
            "2015-04-23T10:26:00.996Z": 3,
          },
        }
      })

      const contrct = await op.contract()
      console.log(contrct.address);
      expect(op.hash).toBeDefined();
      expect(op.includedInBlock).toBeLessThan(Number.POSITIVE_INFINITY)
      done();
    })
    it('Test contract with no annotations for methods', async (done) => {
      // Constants to replace annotations
      const ACCOUNTS = '0';
      const BALANCE = '0';
      const ALLOWANCES = '1';
      const TRANSFER = '0';
      const APPROVE = '2';

      // Actual tests

      const ACCOUNT1_ADDRESS = await Tezos.signer.publicKeyHash()
      const ACCOUNT2_ADDRESS = 'tz1ZfrERcALBwmAqwonRXYVQBDT9BjNjBHJu'

      // Originate a contract with a known state
      const op = await Tezos.contract.originate({
        balance: "1",
        code: noAnnotCode,
        init: noAnnotInit(await Tezos.signer.publicKeyHash())
      })
      const contract = await op.contract()

      // Make a transfer
      const operation = await contract.methods[TRANSFER](ACCOUNT1_ADDRESS, ACCOUNT2_ADDRESS, "1").send();
      await operation.confirmation();
      expect(operation.status).toEqual('applied')

      // Verify that the transfer was done as expected
      const storage = await contract.storage<any>()
      let account1 = await storage[ACCOUNTS].get(ACCOUNT1_ADDRESS)
      expect(account1[BALANCE].toString()).toEqual('16')

      const account2 = await storage[ACCOUNTS].get(ACCOUNT2_ADDRESS)
      expect(account2[BALANCE].toString()).toEqual('1')

      // Approve
      const operation2 = await contract.methods[APPROVE](ACCOUNT2_ADDRESS, "1").send();
      await operation2.confirmation();
      expect(operation2.status).toEqual('applied')

      // Verify that the allowance was done as expected
      account1 = await storage[ACCOUNTS].get(ACCOUNT1_ADDRESS)
      expect(account1[ALLOWANCES][ACCOUNT2_ADDRESS].toString()).toEqual('1')
      done();
    })

    it('Test emptying an unrevealed implicit account', async (done) => {
      const signer2 = new InMemorySigner("p2esk2TFqgNcoT4u99ut5doGTUFNwo9x4nNvkpM6YMLqXrt4SbFdQnqLM3hoAXLMB2uZYazj6LZGvcoYzk16H6Et", "test1234")
      const op = await Tezos.contract.transfer({ to: await signer2.publicKeyHash(), amount: 2 });
      await op.confirmation();
      const oldSigner = Tezos.signer;
      Tezos.setProvider({ signer: signer2 });

      // A transfer from an unrevealed account will require an additional fee of 0.00142tz (reveal operation)
      const manager = await Tezos.rpc.getManagerKey(await signer2.publicKeyHash())
      const requireReveal = !manager

      // Only need to include reveal fees if the account is not revealed
      const revealFee = requireReveal ? DEFAULT_FEE.REVEAL : 0;

      const estimate = await Tezos.estimate.transfer({ to: await oldSigner.publicKeyHash(), amount: 1 });

      // The max amount that can be sent now is the total balance minus the fees + reveal fees
      const balance = await Tezos.tz.getBalance(await signer2.publicKeyHash())
      const maxAmount = balance.minus(estimate.suggestedFeeMutez + revealFee).toNumber();
      const op3 = await Tezos.contract.transfer({ to: await oldSigner.publicKeyHash(), mutez: true, amount: maxAmount, fee: estimate.suggestedFeeMutez, gasLimit: estimate.gasLimit, storageLimit: 0 })
      await op3.confirmation();

      expect((await Tezos.tz.getBalance(await signer2.publicKeyHash())).toString()).toEqual("0")

      Tezos.setProvider({ signer: oldSigner });
      done();
    });

    it('Test emptying a revealed implicit account', async (done) => {
      const signer2 = new InMemorySigner("p2sk2obfVMEuPUnadAConLWk7Tf4Dt3n4svSgJwrgpamRqJXvaYcg1")
      const op = await Tezos.contract.transfer({ to: await signer2.publicKeyHash(), amount: 2 });
      await op.confirmation();
      const oldSigner = Tezos.signer;
      Tezos.setProvider({ signer: signer2 });

      // Sending token from the account we want to empty
      // This will do the reveal operation automatically
      const op2 = await Tezos.contract.transfer({ to: await oldSigner.publicKeyHash(), amount: 1 });
      await op2.confirmation();

      const estimate = await Tezos.estimate.transfer({ to: await oldSigner.publicKeyHash(), amount: 0.5 });

      // Emptying the account
      // The max amount that can be sent now is the total balance minus the fees (no need for reveal fees)
      const balance = await Tezos.tz.getBalance(await signer2.publicKeyHash())
      const maxAmount = balance.minus(estimate.suggestedFeeMutez).toNumber();
      const op3 = await Tezos.contract.transfer({ to: await oldSigner.publicKeyHash(), mutez: true, amount: maxAmount, fee: estimate.suggestedFeeMutez, gasLimit: estimate.gasLimit, storageLimit: 0 })
      await op3.confirmation();

      expect((await Tezos.tz.getBalance(await signer2.publicKeyHash())).toString()).toEqual("0")

      Tezos.setProvider({ signer: oldSigner });
      done();
    });
  });
})

import { assert } from 'chai'

import {
  VaultClawback,
  VaultCreate,
  VaultDelete,
  VaultDeposit,
  VaultSet,
  VaultWithdraw,
} from '../../../src'
import Vault from '../../../src/models/ledger/Vault'
import { hashVault } from '../../../src/utils/hashes'
import serverUrl from '../serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from '../setup'
import { testTransaction } from '../utils'

// how long before each test case times out
const TIMEOUT = 20000

describe('Vault', function () {
  let testContext: XrplIntegrationTestContext

  beforeEach(async () => {
    testContext = await setupClient(serverUrl)
  })
  afterEach(async () => teardownClient(testContext))

  it(
    'Lifecycle of a public XRP Vault ledger object',
    async () => {
      const owner = testContext.wallet.classicAddress

      // Step 1: Create a public XRP vault.
      const create: VaultCreate = {
        TransactionType: 'VaultCreate',
        Account: owner,
        Asset: { currency: 'XRP' },
        AssetsMaximum: '1000000000',
        WithdrawalPolicy: 1,
      }
      const createResponse = await testTransaction(
        testContext.client,
        create,
        testContext.wallet,
      )
      const createSeq = createResponse.result.tx_json.Sequence
      assert.typeOf(createSeq, 'number')

      // The client can predict the VaultID before reading the ledger.
      const predictedVaultId = hashVault(owner, createSeq as number)

      // Step 2: account_objects with the new `vault` type filter returns it.
      const accountObjects = await testContext.client.request({
        command: 'account_objects',
        account: owner,
        type: 'vault',
      })
      assert.lengthOf(
        accountObjects.result.account_objects,
        1,
        'Should be exactly one vault owned by the account',
      )
      const vault = accountObjects.result.account_objects[0] as Vault
      assert.equal(vault.LedgerEntryType, 'Vault')
      assert.equal(vault.index, predictedVaultId)
      assert.equal(vault.Owner, owner)
      assert.equal(vault.WithdrawalPolicy, 1)
      assert.equal(vault.Flags, 0)
      assert.deepEqual(vault.Asset, { currency: 'XRP' })

      // Step 3: vault_info resolves by vault_id and by owner+seq.
      const byId = await testContext.client.request({
        command: 'vault_info',
        vault_id: predictedVaultId,
      })
      assert.equal(byId.result.vault.index, predictedVaultId)
      assert.isDefined(
        byId.result.vault.shares,
        'vault_info should include the shares sub-object',
      )

      const byOwnerSeq = await testContext.client.request({
        command: 'vault_info',
        owner,
        seq: createSeq as number,
      })
      assert.equal(byOwnerSeq.result.vault.index, predictedVaultId)

      // Step 4: ledger_entry resolves via the `vault` selector (hex + object).
      const byHex = await testContext.client.request({
        command: 'ledger_entry',
        vault: predictedVaultId,
      })
      assert.equal(byHex.result.node?.index, predictedVaultId)

      const byObject = await testContext.client.request({
        command: 'ledger_entry',
        vault: { owner, seq: createSeq as number },
      })
      assert.equal(byObject.result.node?.index, predictedVaultId)

      // Step 5: Deposit XRP into the vault and observe AssetsTotal grow.
      const depositAmount = '1000000'
      const deposit: VaultDeposit = {
        TransactionType: 'VaultDeposit',
        Account: owner,
        VaultID: predictedVaultId,
        Amount: depositAmount,
      }
      await testTransaction(testContext.client, deposit, testContext.wallet)

      const afterDeposit = await testContext.client.request({
        command: 'vault_info',
        vault_id: predictedVaultId,
      })
      assert.equal(afterDeposit.result.vault.AssetsTotal, depositAmount)
      assert.equal(afterDeposit.result.vault.AssetsAvailable, depositAmount)

      // Step 6: VaultSet clears the AssetsMaximum cap (0 = no cap).
      const set: VaultSet = {
        TransactionType: 'VaultSet',
        Account: owner,
        VaultID: predictedVaultId,
        AssetsMaximum: '0',
      }
      await testTransaction(testContext.client, set, testContext.wallet)

      // Step 7: Withdraw the full position, emptying the vault.
      const withdraw: VaultWithdraw = {
        TransactionType: 'VaultWithdraw',
        Account: owner,
        VaultID: predictedVaultId,
        Amount: depositAmount,
      }
      await testTransaction(testContext.client, withdraw, testContext.wallet)

      const afterWithdraw = await testContext.client.request({
        command: 'vault_info',
        vault_id: predictedVaultId,
      })
      assert.equal(afterWithdraw.result.vault.AssetsTotal, '0')

      // Step 8: Delete the emptied vault.
      const del: VaultDelete = {
        TransactionType: 'VaultDelete',
        Account: owner,
        VaultID: predictedVaultId,
      }
      await testTransaction(testContext.client, del, testContext.wallet)

      const afterDelete = await testContext.client.request({
        command: 'account_objects',
        account: owner,
        type: 'vault',
      })
      assert.lengthOf(
        afterDelete.result.account_objects,
        0,
        'Vault should be removed from the ledger',
      )
    },
    TIMEOUT,
  )

  it(
    'rejects a VaultClawback against an XRP vault',
    async () => {
      // VaultClawback is only valid for IOU/MPT assets; clawing back from an
      // XRP vault is rejected at preflight as temMALFORMED. This still
      // exercises the transaction model and serialization end-to-end against
      // rippled.
      const owner = testContext.wallet.classicAddress

      const create: VaultCreate = {
        TransactionType: 'VaultCreate',
        Account: owner,
        Asset: { currency: 'XRP' },
      }
      const createResponse = await testTransaction(
        testContext.client,
        create,
        testContext.wallet,
      )
      const vaultId = hashVault(
        owner,
        createResponse.result.tx_json.Sequence as number,
      )

      const clawback: VaultClawback = {
        TransactionType: 'VaultClawback',
        Account: owner,
        VaultID: vaultId,
        Holder: owner,
      }
      await testTransaction(
        testContext.client,
        clawback,
        testContext.wallet,
        undefined,
        'temMALFORMED',
      )
    },
    TIMEOUT,
  )
})

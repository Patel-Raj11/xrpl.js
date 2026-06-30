/* eslint-disable max-statements -- the lifecycle test exercises many sequential vault operations */
import { assert } from 'chai'

import {
  VaultClawback,
  VaultCreate,
  VaultDelete,
  VaultDeposit,
  VaultSet,
  VaultWithdraw,
  Wallet,
} from '../../../src'
import Vault from '../../../src/models/ledger/Vault'
import {
  AccountSet,
  AccountSetAsfFlags,
  Payment,
  TrustSet,
} from '../../../src/models/transactions'
import { hashVault } from '../../../src/utils/hashes'
import serverUrl from '../serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from '../setup'
import { generateFundedWallet, testTransaction } from '../utils'

// how long before each test case times out
const TIMEOUT = 20000

const IOU_CURRENCY = 'USD'

/**
 * Stands up an IOU issuer and funds `holder` with a trustline and balance,
 * mirroring the IOU setup used elsewhere in the integration suite. Used to
 * exercise vault flows over an IOU asset (lifecycle, wrong-asset, clawback).
 *
 * @param context - The active integration test context.
 * @param accounts - The holder and issuer wallets.
 * @param accounts.holder - The wallet that receives a trustline and balance.
 * @param accounts.issuer - The wallet that issues the IOU.
 * @param options - Optional issuer configuration.
 * @param options.allowClawback - Set asfAllowTrustLineClawback on the issuer.
 * @param options.value - IOU amount to send the holder.
 */
async function setupIouIssuer(
  context: XrplIntegrationTestContext,
  accounts: { holder: Wallet; issuer: Wallet },
  options: { allowClawback?: boolean; value?: string } = {},
): Promise<void> {
  const { holder, issuer } = accounts
  const { allowClawback = false, value = '100000' } = options

  const defaultRipple: AccountSet = {
    TransactionType: 'AccountSet',
    Account: issuer.classicAddress,
    SetFlag: AccountSetAsfFlags.asfDefaultRipple,
  }
  await testTransaction(context.client, defaultRipple, issuer)

  if (allowClawback) {
    const enableClawback: AccountSet = {
      TransactionType: 'AccountSet',
      Account: issuer.classicAddress,
      SetFlag: AccountSetAsfFlags.asfAllowTrustLineClawback,
    }
    await testTransaction(context.client, enableClawback, issuer)
  }

  const trust: TrustSet = {
    TransactionType: 'TrustSet',
    Account: holder.classicAddress,
    LimitAmount: {
      currency: IOU_CURRENCY,
      issuer: issuer.classicAddress,
      value: '10000000',
    },
  }
  await testTransaction(context.client, trust, holder)

  const fund: Payment = {
    TransactionType: 'Payment',
    Account: issuer.classicAddress,
    Destination: holder.classicAddress,
    Amount: {
      currency: IOU_CURRENCY,
      issuer: issuer.classicAddress,
      value,
    },
  }
  await testTransaction(context.client, fund, issuer)
}

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

  it(
    'Lifecycle and response contract of an IOU Vault',
    async () => {
      const owner = testContext.wallet
      const issuer = await generateFundedWallet(testContext.client)
      await setupIouIssuer(testContext, { holder: owner, issuer })

      const asset = { currency: IOU_CURRENCY, issuer: issuer.classicAddress }

      // Capability: construct and submit a VaultCreate over an IOU asset.
      const create: VaultCreate = {
        TransactionType: 'VaultCreate',
        Account: owner.classicAddress,
        Asset: asset,
        AssetsMaximum: '1000',
        WithdrawalPolicy: 1,
      }
      const createResponse = await testTransaction(
        testContext.client,
        create,
        owner,
      )
      const vaultId = hashVault(
        owner.classicAddress,
        createResponse.result.tx_json.Sequence as number,
      )

      // Response-type contract: vault_info returns the full Vault entry plus
      // its share MPTokenIssuance sub-object.
      const info = await testContext.client.request({
        command: 'vault_info',
        vault_id: vaultId,
      })
      const { vault } = info.result
      assert.equal(vault.LedgerEntryType, 'Vault')
      assert.equal(vault.index, vaultId)
      assert.equal(vault.Owner, owner.classicAddress)
      assert.notEqual(
        vault.Account,
        owner.classicAddress,
        'a vault is held by a distinct pseudo-account',
      )
      assert.deepEqual(vault.Asset, asset)
      assert.equal(vault.WithdrawalPolicy, 1)
      assert.isDefined(vault.ShareMPTID)
      assert.isDefined(vault.AssetsTotal)
      assert.isDefined(vault.AssetsAvailable)
      assert.isDefined(vault.LossUnrealized)
      assert.typeOf(vault.Sequence, 'number')
      assert.isDefined(
        vault.shares,
        'vault_info includes the shares sub-object',
      )
      assert.isDefined(vault.shares.mpt_issuance_id)
      // The request omits a ledger, so rippled answers from the current (open)
      // ledger and returns `ledger_current_index` (not `ledger_index`).
      assert.typeOf(info.result.ledger_current_index, 'number')

      // Response-type contract: the pseudo-account AccountRoot designates the
      // vault via the new optional VaultID field.
      const pseudoAccount = await testContext.client.request({
        command: 'account_info',
        account: vault.Account,
      })
      assert.equal(pseudoAccount.result.account_data.VaultID, vaultId)

      // End-to-end: deposit IOU, observe balances grow, then withdraw + delete.
      const deposit: VaultDeposit = {
        TransactionType: 'VaultDeposit',
        Account: owner.classicAddress,
        VaultID: vaultId,
        Amount: {
          currency: IOU_CURRENCY,
          issuer: issuer.classicAddress,
          value: '100',
        },
      }
      await testTransaction(testContext.client, deposit, owner)

      const afterDeposit = await testContext.client.request({
        command: 'vault_info',
        vault_id: vaultId,
      })
      assert.equal(Number(afterDeposit.result.vault.AssetsTotal), 100)
      assert.equal(Number(afterDeposit.result.vault.AssetsAvailable), 100)

      const withdraw: VaultWithdraw = {
        TransactionType: 'VaultWithdraw',
        Account: owner.classicAddress,
        VaultID: vaultId,
        Amount: {
          currency: IOU_CURRENCY,
          issuer: issuer.classicAddress,
          value: '100',
        },
      }
      await testTransaction(testContext.client, withdraw, owner)

      const afterWithdraw = await testContext.client.request({
        command: 'vault_info',
        vault_id: vaultId,
      })
      assert.equal(Number(afterWithdraw.result.vault.AssetsTotal), 0)

      const del: VaultDelete = {
        TransactionType: 'VaultDelete',
        Account: owner.classicAddress,
        VaultID: vaultId,
      }
      await testTransaction(testContext.client, del, owner)
    },
    TIMEOUT,
  )

  it(
    'rejects deposits over AssetsMaximum or with the wrong asset',
    async () => {
      const owner = testContext.wallet
      const issuer = await generateFundedWallet(testContext.client)
      await setupIouIssuer(testContext, { holder: owner, issuer })

      // A capped XRP vault rejects a deposit beyond AssetsMaximum.
      const create: VaultCreate = {
        TransactionType: 'VaultCreate',
        Account: owner.classicAddress,
        Asset: { currency: 'XRP' },
        AssetsMaximum: '1000000',
        WithdrawalPolicy: 1,
      }
      const createResponse = await testTransaction(
        testContext.client,
        create,
        owner,
      )
      const vaultId = hashVault(
        owner.classicAddress,
        createResponse.result.tx_json.Sequence as number,
      )

      const overCap: VaultDeposit = {
        TransactionType: 'VaultDeposit',
        Account: owner.classicAddress,
        VaultID: vaultId,
        Amount: '2000000',
      }
      await testTransaction(
        testContext.client,
        overCap,
        owner,
        undefined,
        'tecLIMIT_EXCEEDED',
      )

      // Depositing an IOU into an XRP vault is the wrong asset.
      const wrongAsset: VaultDeposit = {
        TransactionType: 'VaultDeposit',
        Account: owner.classicAddress,
        VaultID: vaultId,
        Amount: {
          currency: IOU_CURRENCY,
          issuer: issuer.classicAddress,
          value: '10',
        },
      }
      await testTransaction(
        testContext.client,
        wrongAsset,
        owner,
        undefined,
        'tecWRONG_ASSET',
      )
    },
    TIMEOUT,
  )

  it(
    'allows the IOU issuer to claw back a holder vault position',
    async () => {
      // The issuer of a clawback-enabled IOU owns a vault; a holder deposits
      // and the issuer claws back, first partially then fully (Amount 0).
      const issuer = testContext.wallet
      const holder = await generateFundedWallet(testContext.client)
      await setupIouIssuer(
        testContext,
        { holder, issuer },
        { allowClawback: true, value: '1000' },
      )

      const asset = { currency: IOU_CURRENCY, issuer: issuer.classicAddress }

      const create: VaultCreate = {
        TransactionType: 'VaultCreate',
        Account: issuer.classicAddress,
        Asset: asset,
        WithdrawalPolicy: 1,
      }
      const createResponse = await testTransaction(
        testContext.client,
        create,
        issuer,
      )
      const vaultId = hashVault(
        issuer.classicAddress,
        createResponse.result.tx_json.Sequence as number,
      )

      const deposit: VaultDeposit = {
        TransactionType: 'VaultDeposit',
        Account: holder.classicAddress,
        VaultID: vaultId,
        Amount: {
          currency: IOU_CURRENCY,
          issuer: issuer.classicAddress,
          value: '500',
        },
      }
      await testTransaction(testContext.client, deposit, holder)

      // Partial clawback reduces the vault's total assets.
      const partial: VaultClawback = {
        TransactionType: 'VaultClawback',
        Account: issuer.classicAddress,
        VaultID: vaultId,
        Holder: holder.classicAddress,
        Amount: {
          currency: IOU_CURRENCY,
          issuer: issuer.classicAddress,
          value: '200',
        },
      }
      await testTransaction(testContext.client, partial, issuer)

      const afterPartial = await testContext.client.request({
        command: 'vault_info',
        vault_id: vaultId,
      })
      assert.isBelow(Number(afterPartial.result.vault.AssetsTotal), 500)

      // Amount 0 claws back the holder's entire remaining position.
      const full: VaultClawback = {
        TransactionType: 'VaultClawback',
        Account: issuer.classicAddress,
        VaultID: vaultId,
        Holder: holder.classicAddress,
        Amount: {
          currency: IOU_CURRENCY,
          issuer: issuer.classicAddress,
          value: '0',
        },
      }
      await testTransaction(testContext.client, full, issuer)

      const afterFull = await testContext.client.request({
        command: 'vault_info',
        vault_id: vaultId,
      })
      assert.equal(Number(afterFull.result.vault.AssetsTotal), 0)
    },
    TIMEOUT,
  )

  it(
    'response contract: vault_info envelope, Vault entry, and shares sub-object',
    async () => {
      // A dedicated response-contract test that pins the TYPE and OPTIONALITY
      // of every field vault_info returns. A fully-populated vault proves the
      // OPTIONAL/DEFAULT fields surface with the right type when present; a
      // minimal vault proves they are omitted (and that every REQUIRED field
      // is always present). This guards against drift between the SDK response
      // models and the rippled wire format.
      const VAULT_DATA = 'DEADBEEF' // arbitrary hex Vault metadata
      const SHARE_METADATA = 'CAFE' // arbitrary hex share-MPT metadata

      // ── A fully-populated public XRP vault ─────────────────────────────
      const fullOwner = testContext.wallet
      const fullCreate: VaultCreate = {
        TransactionType: 'VaultCreate',
        Account: fullOwner.classicAddress,
        Asset: { currency: 'XRP' },
        AssetsMaximum: '1000000',
        WithdrawalPolicy: 1,
        Data: VAULT_DATA,
        MPTokenMetadata: SHARE_METADATA,
      }
      const fullCreateResponse = await testTransaction(
        testContext.client,
        fullCreate,
        fullOwner,
      )
      const fullVaultId = hashVault(
        fullOwner.classicAddress,
        fullCreateResponse.result.tx_json.Sequence as number,
      )
      const fullInfo = await testContext.client.request({
        command: 'vault_info',
        vault_id: fullVaultId,
      })

      // Response envelope: the request omits a ledger, so rippled answers from
      // the current (open) ledger — ledger_current_index and validated are
      // set, while ledger_index and ledger_hash are absent.
      assert.typeOf(fullInfo.result.vault, 'object')
      assert.typeOf(fullInfo.result.ledger_current_index, 'number')
      assert.typeOf(fullInfo.result.validated, 'boolean')
      assert.isUndefined(fullInfo.result.ledger_index)
      assert.isUndefined(fullInfo.result.ledger_hash)

      const { vault } = fullInfo.result

      // Vault entry — REQUIRED fields, present with the documented type.
      assert.equal(vault.LedgerEntryType, 'Vault')
      assert.typeOf(vault.index, 'string')
      assert.typeOf(vault.PreviousTxnID, 'string')
      assert.typeOf(vault.PreviousTxnLgrSeq, 'number')
      assert.typeOf(vault.Flags, 'number')
      assert.typeOf(vault.Sequence, 'number')
      assert.typeOf(vault.OwnerNode, 'string')
      assert.typeOf(vault.Owner, 'string')
      assert.typeOf(vault.Account, 'string')
      assert.typeOf(vault.Asset, 'object')
      assert.deepEqual(vault.Asset, { currency: 'XRP' })
      assert.typeOf(vault.AssetsTotal, 'string')
      assert.typeOf(vault.AssetsAvailable, 'string')
      assert.typeOf(vault.LossUnrealized, 'string')
      assert.typeOf(vault.ShareMPTID, 'string')
      assert.typeOf(vault.WithdrawalPolicy, 'number')

      // Vault entry — OPTIONAL (Data) and DEFAULT (AssetsMaximum) fields are
      // present here because they were supplied at creation.
      assert.typeOf(vault.Data, 'string')
      assert.equal(vault.Data, VAULT_DATA)
      assert.typeOf(vault.AssetsMaximum, 'string')
      assert.equal(vault.AssetsMaximum, '1000000')

      // shares sub-object (an MPTokenIssuance): issued by the vault's
      // pseudo-account, and its id echoes the entry's ShareMPTID.
      const { shares } = vault
      assert.typeOf(shares, 'object')
      assert.equal(shares.LedgerEntryType, 'MPTokenIssuance')
      assert.typeOf(shares.Flags, 'number')
      assert.typeOf(shares.Issuer, 'string')
      assert.equal(shares.Issuer, vault.Account)
      assert.typeOf(shares.OutstandingAmount, 'string')
      assert.typeOf(shares.OwnerNode, 'string')
      assert.typeOf(shares.mpt_issuance_id, 'string')
      assert.equal(shares.mpt_issuance_id, vault.ShareMPTID)
      // OPTIONAL share metadata is present because it was supplied; a public
      // vault's share issuance carries no DomainID.
      assert.typeOf(shares.MPTokenMetadata, 'string')
      assert.equal(shares.MPTokenMetadata, SHARE_METADATA)
      assert.isUndefined(shares.DomainID)

      // ── A minimal public XRP vault (no optional inputs) ────────────────
      const minOwner = await generateFundedWallet(testContext.client)
      const minCreate: VaultCreate = {
        TransactionType: 'VaultCreate',
        Account: minOwner.classicAddress,
        Asset: { currency: 'XRP' },
      }
      const minCreateResponse = await testTransaction(
        testContext.client,
        minCreate,
        minOwner,
      )
      const minVaultId = hashVault(
        minOwner.classicAddress,
        minCreateResponse.result.tx_json.Sequence as number,
      )
      const minInfo = await testContext.client.request({
        command: 'vault_info',
        vault_id: minVaultId,
      })
      const minVault = minInfo.result.vault

      // REQUIRED fields are present even with no optional inputs, and
      // WithdrawalPolicy defaults to vaultStrategyFirstComeFirstServe (1).
      assert.equal(minVault.LedgerEntryType, 'Vault')
      assert.typeOf(minVault.AssetsTotal, 'string')
      assert.typeOf(minVault.AssetsAvailable, 'string')
      assert.typeOf(minVault.LossUnrealized, 'string')
      assert.typeOf(minVault.ShareMPTID, 'string')
      assert.equal(minVault.WithdrawalPolicy, 1)

      // OPTIONAL / DEFAULT fields are omitted when not supplied.
      assert.isUndefined(minVault.Data)
      assert.isUndefined(minVault.AssetsMaximum)
      assert.isUndefined(minVault.shares.MPTokenMetadata)
    },
    TIMEOUT,
  )
})

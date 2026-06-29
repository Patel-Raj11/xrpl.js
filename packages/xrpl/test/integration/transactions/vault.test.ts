import { stringToHex } from '@xrplf/isomorphic/utils'
import { assert } from 'chai'

import {
  AccountSet,
  AccountSetAsfFlags,
  AuthorizeCredential,
  Payment,
  PermissionedDomainSet,
  TrustSet,
  VaultCreate,
  VaultDelete,
  VaultDeposit,
  VaultSet,
  VaultWithdraw,
} from '../../../src'
import Vault, { VaultFlags } from '../../../src/models/ledger/Vault'
import { hashVault } from '../../../src/utils/hashes'
import serverUrl from '../serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from '../setup'
import { generateFundedWallet, testTransaction } from '../utils'

// how long before each test case times out
const TIMEOUT = 60000

/**
 * Verify a freshly created vault is discoverable through hashVault, the
 * ledger_entry `vault` selector (by ID and by owner/seq), and vault_info.
 *
 * @param testContext - The integration test context (client and wallet).
 * @param vault - The Vault ledger object returned from account_objects.
 */
async function verifyVaultLookups(
  testContext: XrplIntegrationTestContext,
  vault: Vault,
): Promise<void> {
  const { client, wallet } = testContext
  const vaultId = vault.index

  // The hashVault helper must reproduce the server-assigned object ID.
  assert.equal(hashVault(vault.Owner, vault.Sequence), vaultId)

  // Look the vault up through the ledger_entry `vault` selector, both by
  // object ID and by owner/seq.
  const byId = await client.request({
    command: 'ledger_entry',
    vault: vaultId,
  })
  assert.equal(byId.result.node?.index, vaultId)
  const byOwnerSeq = await client.request({
    command: 'ledger_entry',
    vault: { owner: wallet.classicAddress, seq: vault.Sequence },
  })
  assert.equal(byOwnerSeq.result.node?.index, vaultId)

  // Query vault_info and confirm the bundled share issuance.
  const info = await client.request({
    command: 'vault_info',
    vault_id: vaultId,
  })
  assert.equal(info.result.vault.index, vaultId)
  assert.equal(info.result.vault.shares.mpt_issuance_id, vault.ShareMPTID)
}

describe('Vault', function () {
  let testContext: XrplIntegrationTestContext

  beforeEach(async () => {
    testContext = await setupClient(serverUrl)
  })
  afterEach(async () => teardownClient(testContext))

  it(
    'lifecycle of a public XRP vault',
    async () => {
      const { client, wallet } = testContext

      // Step 1: create the vault.
      const create: VaultCreate = {
        TransactionType: 'VaultCreate',
        Account: wallet.classicAddress,
        Asset: { currency: 'XRP' },
        Data: stringToHex('vault metadata'),
      }
      await testTransaction(client, create, wallet)

      // Step 2: confirm the Vault object via account_objects.
      const accountObjects = await client.request({
        command: 'account_objects',
        account: wallet.classicAddress,
        type: 'vault',
      })
      assert.lengthOf(accountObjects.result.account_objects, 1)
      const vault = accountObjects.result.account_objects[0] as Vault
      assert.equal(vault.LedgerEntryType, 'Vault')
      assert.equal(vault.Owner, wallet.classicAddress)
      const vaultId = vault.index

      // Steps 3 & 4: confirm the vault is discoverable via hashVault, the
      // ledger_entry `vault` selector, and vault_info.
      await verifyVaultLookups(testContext, vault)

      // Step 5: deposit assets and confirm the totals grow.
      const deposit: VaultDeposit = {
        TransactionType: 'VaultDeposit',
        Account: wallet.classicAddress,
        VaultID: vaultId,
        Amount: '5000000',
      }
      await testTransaction(client, deposit, wallet)
      const afterDeposit = await client.request({
        command: 'vault_info',
        vault_id: vaultId,
      })
      assert.equal(afterDeposit.result.vault.AssetsTotal, '5000000')

      // Step 6: update the vault metadata with VaultSet.
      const set: VaultSet = {
        TransactionType: 'VaultSet',
        Account: wallet.classicAddress,
        VaultID: vaultId,
        Data: stringToHex('updated metadata'),
      }
      await testTransaction(client, set, wallet)

      // Step 7: withdraw everything, emptying the vault.
      const withdraw: VaultWithdraw = {
        TransactionType: 'VaultWithdraw',
        Account: wallet.classicAddress,
        VaultID: vaultId,
        Amount: '5000000',
      }
      await testTransaction(client, withdraw, wallet)
      const afterWithdraw = await client.request({
        command: 'vault_info',
        vault_id: vaultId,
      })
      assert.equal(afterWithdraw.result.vault.AssetsTotal, '0')

      // Step 8: delete the now-empty vault.
      const del: VaultDelete = {
        TransactionType: 'VaultDelete',
        Account: wallet.classicAddress,
        VaultID: vaultId,
      }
      await testTransaction(client, del, wallet)
      const afterDelete = await client.request({
        command: 'account_objects',
        account: wallet.classicAddress,
        type: 'vault',
      })
      assert.lengthOf(afterDelete.result.account_objects, 0)
    },
    TIMEOUT,
  )

  it(
    'lifecycle of an IOU-backed vault',
    async () => {
      const { client, wallet } = testContext
      const issuer = await generateFundedWallet(client)
      const asset = { currency: 'USD', issuer: issuer.classicAddress }

      // Allow the issuer to ripple and give the owner a USD balance.
      const defaultRipple: AccountSet = {
        TransactionType: 'AccountSet',
        Account: issuer.classicAddress,
        SetFlag: AccountSetAsfFlags.asfDefaultRipple,
      }
      await testTransaction(client, defaultRipple, issuer)

      const trustSet: TrustSet = {
        TransactionType: 'TrustSet',
        Account: wallet.classicAddress,
        LimitAmount: { ...asset, value: '1000000' },
      }
      await testTransaction(client, trustSet, wallet)

      const fundIou: Payment = {
        TransactionType: 'Payment',
        Account: issuer.classicAddress,
        Destination: wallet.classicAddress,
        Amount: { ...asset, value: '10000' },
      }
      await testTransaction(client, fundIou, issuer)

      // Create the IOU-backed vault and deposit into it.
      const create: VaultCreate = {
        TransactionType: 'VaultCreate',
        Account: wallet.classicAddress,
        Asset: asset,
      }
      await testTransaction(client, create, wallet)

      const accountObjects = await client.request({
        command: 'account_objects',
        account: wallet.classicAddress,
        type: 'vault',
      })
      const vaultId = (accountObjects.result.account_objects[0] as Vault).index

      const deposit: VaultDeposit = {
        TransactionType: 'VaultDeposit',
        Account: wallet.classicAddress,
        VaultID: vaultId,
        Amount: { ...asset, value: '1000' },
      }
      await testTransaction(client, deposit, wallet)

      const info = await client.request({
        command: 'vault_info',
        vault_id: vaultId,
      })
      assert.equal(info.result.vault.AssetsTotal, '1000')
      assert.deepEqual(info.result.vault.Asset, asset)

      // Withdraw and delete to complete the lifecycle.
      const withdraw: VaultWithdraw = {
        TransactionType: 'VaultWithdraw',
        Account: wallet.classicAddress,
        VaultID: vaultId,
        Amount: { ...asset, value: '1000' },
      }
      await testTransaction(client, withdraw, wallet)

      const del: VaultDelete = {
        TransactionType: 'VaultDelete',
        Account: wallet.classicAddress,
        VaultID: vaultId,
      }
      await testTransaction(client, del, wallet)
    },
    TIMEOUT,
  )

  it(
    'creates a private vault tied to a permissioned domain',
    async () => {
      const { client, wallet } = testContext

      // A permissioned domain is required to scope a private vault's shares.
      const credential: AuthorizeCredential = {
        Credential: {
          CredentialType: stringToHex('Passport'),
          Issuer: wallet.classicAddress,
        },
      }
      const pdSet: PermissionedDomainSet = {
        TransactionType: 'PermissionedDomainSet',
        Account: wallet.classicAddress,
        AcceptedCredentials: [credential],
      }
      await testTransaction(client, pdSet, wallet)

      const domains = await client.request({
        command: 'account_objects',
        account: wallet.classicAddress,
        type: 'permissioned_domain',
      })
      const domainId = domains.result.account_objects[0].index

      // Pass the flag in its developer-friendly interface form to exercise the
      // flag-to-number conversion path during autofill.
      const create: VaultCreate = {
        TransactionType: 'VaultCreate',
        Account: wallet.classicAddress,
        Asset: { currency: 'XRP' },
        Flags: { tfVaultPrivate: true },
        DomainID: domainId,
      }
      await testTransaction(client, create, wallet)

      const accountObjects = await client.request({
        command: 'account_objects',
        account: wallet.classicAddress,
        type: 'vault',
      })
      const vault = accountObjects.result.account_objects[0] as Vault
      // eslint-disable-next-line no-bitwise -- checking a single flag bit
      assert.isTrue((vault.Flags & VaultFlags.lsfVaultPrivate) !== 0)

      const del: VaultDelete = {
        TransactionType: 'VaultDelete',
        Account: wallet.classicAddress,
        VaultID: vault.index,
      }
      await testTransaction(client, del, wallet)
    },
    TIMEOUT,
  )
})

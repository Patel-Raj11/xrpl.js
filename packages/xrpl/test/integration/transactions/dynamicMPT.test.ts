import { stringToHex } from '@xrplf/isomorphic/src/utils'
import { assert } from 'chai'

import {
  LedgerEntry,
  MPTokenIssuanceCreate,
  MPTokenIssuanceCreateFlags,
  MPTokenIssuanceCreateMutableFlags,
  MPTokenIssuanceSet,
  MPTokenIssuanceSetMutableFlags,
  TransactionMetadata,
} from '../../../src'
import { isFlagEnabled } from '../../../src/models/utils'

type MPTokenIssuance = LedgerEntry.MPTokenIssuance
const MPTokenIssuanceMutableFlags = LedgerEntry.MPTokenIssuanceMutableFlags
import serverUrl from '../serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from '../setup'
import { testTransaction } from '../utils'

const TIMEOUT = 30000

/**
 * Issuer submits an MPTokenIssuanceCreate and returns the resulting
 * MPTokenIssuanceID (extracted from the transaction metadata).
 */
async function createIssuance(
  testContext: XrplIntegrationTestContext,
  overrides: Partial<MPTokenIssuanceCreate>,
): Promise<string> {
  const tx: MPTokenIssuanceCreate = {
    TransactionType: 'MPTokenIssuanceCreate',
    Account: testContext.wallet.classicAddress,
    ...overrides,
  }

  const submitRes = await testTransaction(
    testContext.client,
    tx,
    testContext.wallet,
  )

  const txHash = submitRes.result.tx_json.hash
  const txResponse = await testContext.client.request({
    command: 'tx',
    transaction: txHash,
  })
  const meta = txResponse.result
    .meta as TransactionMetadata<MPTokenIssuanceCreate>
  assert.isDefined(meta.mpt_issuance_id, 'meta should include mpt_issuance_id')
  return meta.mpt_issuance_id as string
}

/** Fetch the MPTokenIssuance ledger entry for an issuanceID. */
async function fetchIssuance(
  testContext: XrplIntegrationTestContext,
): Promise<MPTokenIssuance> {
  const resp = await testContext.client.request({
    command: 'account_objects',
    account: testContext.wallet.classicAddress,
    type: 'mpt_issuance',
  })
  assert.lengthOf(resp.result.account_objects, 1)
  return resp.result.account_objects[0] as unknown as MPTokenIssuance
}

describe('DynamicMPT (XLS-0094)', function () {
  let testContext: XrplIntegrationTestContext

  beforeEach(async () => {
    testContext = await setupClient(serverUrl)
  })
  afterEach(async () => teardownClient(testContext))

  // ============================================================
  // Capabilities
  // ============================================================

  it(
    'creates an MPTokenIssuance carrying MutableFlags',
    async () => {
      await createIssuance(testContext, {
        MutableFlags:
          MPTokenIssuanceCreateMutableFlags.tmfMPTCanMutateMetadata |
          MPTokenIssuanceCreateMutableFlags.tmfMPTCanEnableCanLock,
        MPTokenMetadata: stringToHex('initial metadata'),
      })

      const issuance = await fetchIssuance(testContext)
      assert.strictEqual(
        issuance.MutableFlags,
        MPTokenIssuanceMutableFlags.lsmfMPTCanMutateMetadata |
          MPTokenIssuanceMutableFlags.lsmfMPTCanEnableCanLock,
      )
    },
    TIMEOUT,
  )

  it(
    'creates an MPTokenIssuance with MutableFlags omitted (immutable default)',
    async () => {
      // No MutableFlags on create — the issuance is fully immutable.
      await createIssuance(testContext, {})

      const issuance = await fetchIssuance(testContext)
      // The ledger entry omits MutableFlags (or carries 0) when no mutability
      // was declared. We treat both as "no mutability declared".
      assert.isTrue(
        issuance.MutableFlags === undefined || issuance.MutableFlags === 0,
      )
    },
    TIMEOUT,
  )

  // ============================================================
  // End-to-end flow: mutable metadata lifecycle
  // ============================================================

  it(
    'mutable metadata lifecycle: create -> replace -> delete',
    async () => {
      const initialMetadata = stringToHex('initial metadata')
      const replacedMetadata = stringToHex('replaced metadata value')

      const mptID = await createIssuance(testContext, {
        MutableFlags: MPTokenIssuanceCreateMutableFlags.tmfMPTCanMutateMetadata,
        MPTokenMetadata: initialMetadata,
      })

      // Replace metadata.
      const replaceTx: MPTokenIssuanceSet = {
        TransactionType: 'MPTokenIssuanceSet',
        Account: testContext.wallet.classicAddress,
        MPTokenIssuanceID: mptID,
        MPTokenMetadata: replacedMetadata,
      }
      await testTransaction(testContext.client, replaceTx, testContext.wallet)

      let issuance = await fetchIssuance(testContext)
      assert.strictEqual(issuance.MPTokenMetadata, replacedMetadata)

      // Delete metadata using empty blob.
      const deleteTx: MPTokenIssuanceSet = {
        TransactionType: 'MPTokenIssuanceSet',
        Account: testContext.wallet.classicAddress,
        MPTokenIssuanceID: mptID,
        MPTokenMetadata: '',
      }
      await testTransaction(testContext.client, deleteTx, testContext.wallet)

      issuance = await fetchIssuance(testContext)
      assert.isUndefined(
        issuance.MPTokenMetadata,
        'MPTokenMetadata should be removed after empty-blob set',
      )
      // MutableFlags remains unchanged across the lifecycle.
      assert.strictEqual(
        issuance.MutableFlags,
        MPTokenIssuanceMutableFlags.lsmfMPTCanMutateMetadata,
      )
    },
    TIMEOUT,
  )

  // ============================================================
  // End-to-end flow: dormant-capability enable
  // ============================================================

  it(
    'dormant-capability enable lifecycle (CanLock)',
    async () => {
      const mptID = await createIssuance(testContext, {
        MutableFlags: MPTokenIssuanceCreateMutableFlags.tmfMPTCanEnableCanLock,
        // Note: NO tfMPTCanLock on Flags — capability is dormant.
      })

      let issuance = await fetchIssuance(testContext)
      // 0x00000002 == lsfMPTCanLock; must NOT be set before enabling.
      assert.isFalse(
        isFlagEnabled(issuance.Flags, 0x00000002),
        'lsfMPTCanLock should be dormant pre-enable',
      )

      const enableTx: MPTokenIssuanceSet = {
        TransactionType: 'MPTokenIssuanceSet',
        Account: testContext.wallet.classicAddress,
        MPTokenIssuanceID: mptID,
        MutableFlags: MPTokenIssuanceSetMutableFlags.tmfMPTSetCanLock,
      }
      await testTransaction(testContext.client, enableTx, testContext.wallet)

      issuance = await fetchIssuance(testContext)
      assert.isTrue(
        isFlagEnabled(issuance.Flags, 0x00000002),
        'lsfMPTCanLock should be set after enable',
      )
      // MutableFlags is unchanged.
      assert.strictEqual(
        issuance.MutableFlags,
        MPTokenIssuanceMutableFlags.lsmfMPTCanEnableCanLock,
      )
    },
    TIMEOUT,
  )

  // ============================================================
  // End-to-end flow: staged CanTransfer enable + TransferFee mutation
  // ============================================================

  it(
    'staged CanTransfer enable, then TransferFee mutation, then clear',
    async () => {
      const mptID = await createIssuance(testContext, {
        MutableFlags:
          MPTokenIssuanceCreateMutableFlags.tmfMPTCanEnableCanTransfer |
          MPTokenIssuanceCreateMutableFlags.tmfMPTCanMutateTransferFee,
        // No tfMPTCanTransfer on Flags initially.
      })

      // tx1: enable lsfMPTCanTransfer.
      const enableTx: MPTokenIssuanceSet = {
        TransactionType: 'MPTokenIssuanceSet',
        Account: testContext.wallet.classicAddress,
        MPTokenIssuanceID: mptID,
        MutableFlags: MPTokenIssuanceSetMutableFlags.tmfMPTSetCanTransfer,
      }
      await testTransaction(testContext.client, enableTx, testContext.wallet)

      // tx2: set non-zero TransferFee.
      const setFeeTx: MPTokenIssuanceSet = {
        TransactionType: 'MPTokenIssuanceSet',
        Account: testContext.wallet.classicAddress,
        MPTokenIssuanceID: mptID,
        TransferFee: 250,
      }
      await testTransaction(testContext.client, setFeeTx, testContext.wallet)

      let issuance = await fetchIssuance(testContext)
      assert.strictEqual(issuance.TransferFee, 250)
      // 0x00000020 == lsfMPTCanTransfer.
      assert.isTrue(isFlagEnabled(issuance.Flags, 0x00000020))

      // tx3: clear TransferFee.
      const clearFeeTx: MPTokenIssuanceSet = {
        TransactionType: 'MPTokenIssuanceSet',
        Account: testContext.wallet.classicAddress,
        MPTokenIssuanceID: mptID,
        TransferFee: 0,
      }
      await testTransaction(testContext.client, clearFeeTx, testContext.wallet)

      issuance = await fetchIssuance(testContext)
      assert.isUndefined(
        issuance.TransferFee,
        'TransferFee should be removed after zero-value set',
      )
    },
    TIMEOUT,
  )

  // ============================================================
  // End-to-end flow: mutate-permission gating
  // ============================================================

  it(
    'mutate-permission gating: rejects mutations without the matching mutable flag',
    async () => {
      // Create an issuance with NO MutableFlags (fully immutable).
      const mptID = await createIssuance(testContext, {})

      // Try to set new metadata — should fail with tecNO_PERMISSION since
      // lsmfMPTCanMutateMetadata was not declared at creation.
      const tryMetadata: MPTokenIssuanceSet = {
        TransactionType: 'MPTokenIssuanceSet',
        Account: testContext.wallet.classicAddress,
        MPTokenIssuanceID: mptID,
        MPTokenMetadata: stringToHex('attempted'),
      }
      await testTransaction(
        testContext.client,
        tryMetadata,
        testContext.wallet,
        undefined,
        'tecNO_PERMISSION',
      )

      // Try to enable a capability — should fail with tecNO_PERMISSION since
      // no lsmfMPTCanEnable<Cap> bit was declared.
      const tryEnable: MPTokenIssuanceSet = {
        TransactionType: 'MPTokenIssuanceSet',
        Account: testContext.wallet.classicAddress,
        MPTokenIssuanceID: mptID,
        MutableFlags: MPTokenIssuanceSetMutableFlags.tmfMPTSetCanLock,
      }
      await testTransaction(
        testContext.client,
        tryEnable,
        testContext.wallet,
        undefined,
        'tecNO_PERMISSION',
      )

      // Issuance state unchanged.
      const issuance = await fetchIssuance(testContext)
      assert.isTrue(
        issuance.MutableFlags === undefined || issuance.MutableFlags === 0,
      )
    },
    TIMEOUT,
  )

  // ============================================================
  // Response-type contract: MPTokenIssuance with MutableFlags
  // ============================================================

  it(
    'response-type contract: MPTokenIssuance MutableFlags is a number when present',
    async () => {
      await createIssuance(testContext, {
        MutableFlags:
          MPTokenIssuanceCreateMutableFlags.tmfMPTCanMutateTransferFee |
          MPTokenIssuanceCreateMutableFlags.tmfMPTCanEnableCanTransfer,
        Flags: MPTokenIssuanceCreateFlags.tfMPTCanLock,
      })

      const issuance = await fetchIssuance(testContext)
      assert.typeOf(issuance.MutableFlags, 'number')
      assert.strictEqual(
        issuance.MutableFlags,
        MPTokenIssuanceMutableFlags.lsmfMPTCanMutateTransferFee |
          MPTokenIssuanceMutableFlags.lsmfMPTCanEnableCanTransfer,
      )
    },
    TIMEOUT,
  )
})

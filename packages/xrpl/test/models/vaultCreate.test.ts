import { VaultCreateFlags } from '../../src'
import { validateVaultCreate } from '../../src/models/transactions/vaultCreate'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void => assertTxIsValid(tx, validateVaultCreate)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateVaultCreate, message)

/**
 * VaultCreate Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('VaultCreate', function () {
  let tx: any

  beforeEach(function () {
    tx = {
      TransactionType: 'VaultCreate',
      Account: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
      Asset: { currency: 'XRP' },
    }
  })

  it('verifies valid VaultCreate with an XRP asset', function () {
    assertValid(tx)
  })

  it('verifies valid VaultCreate with an IOU asset', function () {
    tx.Asset = {
      currency: 'USD',
      issuer: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
    }
    assertValid(tx)
  })

  it('verifies valid VaultCreate with an MPT asset', function () {
    tx.Asset = {
      mpt_issuance_id: '00002403C84A0A28E0190E208E982C352BBD5006600555CF',
    }
    assertValid(tx)
  })

  it('verifies valid VaultCreate with all optional fields', function () {
    tx.AssetsMaximum = '1000'
    tx.MPTokenMetadata = 'ABCD'
    tx.WithdrawalPolicy = 1
    tx.Data = 'ABCD'
    tx.Flags = VaultCreateFlags.tfVaultShareNonTransferable
    assertValid(tx)
  })

  it('throws w/ missing field Asset', function () {
    delete tx.Asset
    assertInvalid(tx, 'VaultCreate: missing field Asset')
  })

  it('throws w/ invalid field Asset', function () {
    tx.Asset = 1234
    assertInvalid(tx, 'VaultCreate: invalid field Asset')
  })

  it('throws w/ an invalid flag bit', function () {
    tx.Flags = 0x00000001
    assertInvalid(
      tx,
      'VaultCreate: invalid flags, only tfVaultPrivate and tfVaultShareNonTransferable are allowed',
    )
  })

  it('throws w/ a negative AssetsMaximum', function () {
    tx.AssetsMaximum = '-1'
    assertInvalid(tx, 'VaultCreate: AssetsMaximum must not be negative')
  })

  it('treats AssetsMaximum of 0 as no cap', function () {
    tx.AssetsMaximum = '0'
    assertValid(tx)
  })

  it('throws w/ a non-hex MPTokenMetadata', function () {
    tx.MPTokenMetadata = 'not-hex'
    assertInvalid(tx, 'VaultCreate: MPTokenMetadata must be a valid hex string')
  })

  it('throws w/ an MPTokenMetadata that is too long', function () {
    tx.MPTokenMetadata = 'AB'.repeat(1025)
    assertInvalid(
      tx,
      'VaultCreate: MPTokenMetadata length must be between 1 and 1024 bytes',
    )
  })

  it('throws w/ a non-hex Data', function () {
    tx.Data = 'not-hex'
    assertInvalid(tx, 'VaultCreate: Data must be a valid hex string')
  })

  it('throws w/ a Data field that is too long', function () {
    tx.Data = 'AB'.repeat(257)
    assertInvalid(
      tx,
      'VaultCreate: Data length must be between 1 and 256 bytes',
    )
  })

  it('throws w/ an unsupported WithdrawalPolicy', function () {
    tx.WithdrawalPolicy = 2
    assertInvalid(
      tx,
      'VaultCreate: WithdrawalPolicy must be vaultStrategyFirstComeFirstServe (1)',
    )
  })

  it('throws w/ a DomainID on a public vault', function () {
    tx.DomainID =
      'D88930B33C2B6831660BFD006D91FF100011AD4E67CBB78B460AF0A215103737'
    assertInvalid(
      tx,
      'VaultCreate: DomainID can only be set on a private vault (tfVaultPrivate)',
    )
  })

  it('throws w/ a zero DomainID on a private vault', function () {
    tx.Flags = VaultCreateFlags.tfVaultPrivate
    tx.DomainID =
      '0000000000000000000000000000000000000000000000000000000000000000'
    assertInvalid(tx, 'VaultCreate: DomainID must not be zero')
  })

  it('verifies a private vault with a DomainID (numeric flag)', function () {
    tx.Flags = VaultCreateFlags.tfVaultPrivate
    tx.DomainID =
      'D88930B33C2B6831660BFD006D91FF100011AD4E67CBB78B460AF0A215103737'
    assertValid(tx)
  })

  it('verifies a private vault with a DomainID (flag map)', function () {
    tx.Flags = { tfVaultPrivate: true }
    tx.DomainID =
      'D88930B33C2B6831660BFD006D91FF100011AD4E67CBB78B460AF0A215103737'
    assertValid(tx)
  })
})

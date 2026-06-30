import { VaultCreateFlags } from '../../src'
import {
  validateVaultCreate,
  VAULT_WITHDRAWAL_POLICY_FIRST_COME_FIRST_SERVE,
} from '../../src/models/transactions/vaultCreate'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void => assertTxIsValid(tx, validateVaultCreate)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateVaultCreate, message)

const ACCOUNT = 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm'
const DOMAIN_ID =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

/**
 * VaultCreate Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('VaultCreate', function () {
  it('verifies a minimal VaultCreate', function () {
    assertValid({
      TransactionType: 'VaultCreate',
      Account: ACCOUNT,
      Asset: { currency: 'XRP' },
    })
  })

  it('verifies a fully specified VaultCreate', function () {
    assertValid({
      TransactionType: 'VaultCreate',
      Account: ACCOUNT,
      Asset: { currency: 'USD', issuer: ACCOUNT },
      AssetsMaximum: '1000',
      MPTokenMetadata: '0123ABCD',
      WithdrawalPolicy: VAULT_WITHDRAWAL_POLICY_FIRST_COME_FIRST_SERVE,
      Data: 'DEADBEEF',
      Flags: VaultCreateFlags.tfVaultShareNonTransferable,
    })
  })

  it('verifies a private VaultCreate with a DomainID via flag interface', function () {
    assertValid({
      TransactionType: 'VaultCreate',
      Account: ACCOUNT,
      Asset: { currency: 'XRP' },
      DomainID: DOMAIN_ID,
      Flags: { tfVaultPrivate: true },
    })
  })

  it('throws when Asset is missing', function () {
    assertInvalid(
      {
        TransactionType: 'VaultCreate',
        Account: ACCOUNT,
      },
      'VaultCreate: missing field Asset',
    )
  })

  it('throws when Asset is malformed', function () {
    assertInvalid(
      {
        TransactionType: 'VaultCreate',
        Account: ACCOUNT,
        Asset: 'XRP',
      },
      'VaultCreate: invalid field Asset',
    )
  })

  it('throws on flag bits outside the vault flag range', function () {
    assertInvalid(
      {
        TransactionType: 'VaultCreate',
        Account: ACCOUNT,
        Asset: { currency: 'XRP' },
        Flags: 0x00040000,
      },
      'VaultCreate: invalid flags, only tfVaultPrivate and tfVaultShareNonTransferable are allowed',
    )
  })

  it('throws when AssetsMaximum is negative', function () {
    assertInvalid(
      {
        TransactionType: 'VaultCreate',
        Account: ACCOUNT,
        Asset: { currency: 'XRP' },
        AssetsMaximum: '-1',
      },
      'VaultCreate: AssetsMaximum must not be negative',
    )
  })

  it('throws when WithdrawalPolicy is not the supported strategy', function () {
    assertInvalid(
      {
        TransactionType: 'VaultCreate',
        Account: ACCOUNT,
        Asset: { currency: 'XRP' },
        WithdrawalPolicy: 2,
      },
      'VaultCreate: WithdrawalPolicy must be vaultStrategyFirstComeFirstServe (1)',
    )
  })

  it('throws when MPTokenMetadata is not hex', function () {
    assertInvalid(
      {
        TransactionType: 'VaultCreate',
        Account: ACCOUNT,
        Asset: { currency: 'XRP' },
        MPTokenMetadata: 'not-hex',
      },
      'VaultCreate: MPTokenMetadata must be a valid hex string',
    )
  })

  it('throws when MPTokenMetadata exceeds 1024 bytes', function () {
    assertInvalid(
      {
        TransactionType: 'VaultCreate',
        Account: ACCOUNT,
        Asset: { currency: 'XRP' },
        MPTokenMetadata: '00'.repeat(1025),
      },
      'VaultCreate: MPTokenMetadata length must be between 1 and 1024 bytes',
    )
  })

  it('throws when Data is not hex', function () {
    assertInvalid(
      {
        TransactionType: 'VaultCreate',
        Account: ACCOUNT,
        Asset: { currency: 'XRP' },
        Data: 'not-hex',
      },
      'VaultCreate: Data must be a valid hex string',
    )
  })

  it('throws when Data exceeds 256 bytes', function () {
    assertInvalid(
      {
        TransactionType: 'VaultCreate',
        Account: ACCOUNT,
        Asset: { currency: 'XRP' },
        Data: '00'.repeat(257),
      },
      'VaultCreate: Data length must be between 1 and 256 bytes',
    )
  })

  it('throws when DomainID is set on a public vault', function () {
    assertInvalid(
      {
        TransactionType: 'VaultCreate',
        Account: ACCOUNT,
        Asset: { currency: 'XRP' },
        DomainID: DOMAIN_ID,
      },
      'VaultCreate: DomainID can only be set on a private vault (tfVaultPrivate)',
    )
  })

  it('throws when DomainID is zero', function () {
    assertInvalid(
      {
        TransactionType: 'VaultCreate',
        Account: ACCOUNT,
        Asset: { currency: 'XRP' },
        DomainID: '0'.repeat(64),
        Flags: VaultCreateFlags.tfVaultPrivate,
      },
      'VaultCreate: DomainID must not be zero',
    )
  })
})

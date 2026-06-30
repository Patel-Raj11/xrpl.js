import { validateVaultSet } from '../../src/models/transactions/vaultSet'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void => assertTxIsValid(tx, validateVaultSet)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateVaultSet, message)

const ACCOUNT = 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm'
const VAULT_ID =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

/**
 * VaultSet Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('VaultSet', function () {
  it('verifies a VaultSet updating Data', function () {
    assertValid({
      TransactionType: 'VaultSet',
      Account: ACCOUNT,
      VaultID: VAULT_ID,
      Data: 'DEADBEEF',
    })
  })

  it('verifies a VaultSet updating AssetsMaximum and DomainID', function () {
    assertValid({
      TransactionType: 'VaultSet',
      Account: ACCOUNT,
      VaultID: VAULT_ID,
      AssetsMaximum: '0',
      DomainID: VAULT_ID,
    })
  })

  it('throws when VaultID is missing', function () {
    assertInvalid(
      {
        TransactionType: 'VaultSet',
        Account: ACCOUNT,
        Data: 'DEADBEEF',
      },
      'VaultSet: missing field VaultID',
    )
  })

  it('throws when no mutable field is provided', function () {
    assertInvalid(
      {
        TransactionType: 'VaultSet',
        Account: ACCOUNT,
        VaultID: VAULT_ID,
      },
      'VaultSet: must update at least one of AssetsMaximum, DomainID, or Data',
    )
  })

  it('throws when Data is not hex', function () {
    assertInvalid(
      {
        TransactionType: 'VaultSet',
        Account: ACCOUNT,
        VaultID: VAULT_ID,
        Data: 'not-hex',
      },
      'VaultSet: Data must be a valid hex string',
    )
  })

  it('throws when Data exceeds 256 bytes', function () {
    assertInvalid(
      {
        TransactionType: 'VaultSet',
        Account: ACCOUNT,
        VaultID: VAULT_ID,
        Data: '00'.repeat(257),
      },
      'VaultSet: Data length must be between 1 and 256 bytes',
    )
  })
})

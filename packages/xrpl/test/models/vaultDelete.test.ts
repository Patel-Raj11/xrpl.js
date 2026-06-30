import { validateVaultDelete } from '../../src/models/transactions/vaultDelete'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void => assertTxIsValid(tx, validateVaultDelete)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateVaultDelete, message)

const ACCOUNT = 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm'
const VAULT_ID =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

/**
 * VaultDelete Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('VaultDelete', function () {
  it('verifies a valid VaultDelete', function () {
    assertValid({
      TransactionType: 'VaultDelete',
      Account: ACCOUNT,
      VaultID: VAULT_ID,
    })
  })

  it('throws when VaultID is missing', function () {
    assertInvalid(
      {
        TransactionType: 'VaultDelete',
        Account: ACCOUNT,
      },
      'VaultDelete: missing field VaultID',
    )
  })

  it('throws when VaultID is malformed', function () {
    assertInvalid(
      {
        TransactionType: 'VaultDelete',
        Account: ACCOUNT,
        VaultID: 123,
      },
      'VaultDelete: invalid field VaultID',
    )
  })
})

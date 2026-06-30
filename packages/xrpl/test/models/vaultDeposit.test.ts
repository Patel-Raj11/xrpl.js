import { validateVaultDeposit } from '../../src/models/transactions/vaultDeposit'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void => assertTxIsValid(tx, validateVaultDeposit)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateVaultDeposit, message)

const ACCOUNT = 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm'
const VAULT_ID =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

/**
 * VaultDeposit Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('VaultDeposit', function () {
  it('verifies a VaultDeposit of XRP', function () {
    assertValid({
      TransactionType: 'VaultDeposit',
      Account: ACCOUNT,
      VaultID: VAULT_ID,
      Amount: '1000',
    })
  })

  it('verifies a VaultDeposit of an issued currency', function () {
    assertValid({
      TransactionType: 'VaultDeposit',
      Account: ACCOUNT,
      VaultID: VAULT_ID,
      Amount: { currency: 'USD', issuer: ACCOUNT, value: '10' },
    })
  })

  it('throws when VaultID is missing', function () {
    assertInvalid(
      {
        TransactionType: 'VaultDeposit',
        Account: ACCOUNT,
        Amount: '1000',
      },
      'VaultDeposit: missing field VaultID',
    )
  })

  it('throws when Amount is missing', function () {
    assertInvalid(
      {
        TransactionType: 'VaultDeposit',
        Account: ACCOUNT,
        VaultID: VAULT_ID,
      },
      'VaultDeposit: missing field Amount',
    )
  })

  it('throws when Amount is malformed', function () {
    assertInvalid(
      {
        TransactionType: 'VaultDeposit',
        Account: ACCOUNT,
        VaultID: VAULT_ID,
        Amount: 1000,
      },
      'VaultDeposit: invalid field Amount',
    )
  })
})

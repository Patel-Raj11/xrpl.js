import { validateVaultClawback } from '../../src/models/transactions/vaultClawback'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void =>
  assertTxIsValid(tx, validateVaultClawback)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateVaultClawback, message)

const ACCOUNT = 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm'
const HOLDER = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe'
const VAULT_ID =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

/**
 * VaultClawback Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('VaultClawback', function () {
  it('verifies a VaultClawback without an Amount (clawback all)', function () {
    assertValid({
      TransactionType: 'VaultClawback',
      Account: ACCOUNT,
      VaultID: VAULT_ID,
      Holder: HOLDER,
    })
  })

  it('verifies a VaultClawback for a specific Amount', function () {
    assertValid({
      TransactionType: 'VaultClawback',
      Account: ACCOUNT,
      VaultID: VAULT_ID,
      Holder: HOLDER,
      Amount: { currency: 'USD', issuer: ACCOUNT, value: '10' },
    })
  })

  it('throws when VaultID is missing', function () {
    assertInvalid(
      {
        TransactionType: 'VaultClawback',
        Account: ACCOUNT,
        Holder: HOLDER,
      },
      'VaultClawback: missing field VaultID',
    )
  })

  it('throws when Holder is missing', function () {
    assertInvalid(
      {
        TransactionType: 'VaultClawback',
        Account: ACCOUNT,
        VaultID: VAULT_ID,
      },
      'VaultClawback: missing field Holder',
    )
  })

  it('throws when Holder is malformed', function () {
    assertInvalid(
      {
        TransactionType: 'VaultClawback',
        Account: ACCOUNT,
        VaultID: VAULT_ID,
        Holder: 'not-an-account',
      },
      'VaultClawback: invalid field Holder',
    )
  })

  it('throws when Amount is malformed', function () {
    assertInvalid(
      {
        TransactionType: 'VaultClawback',
        Account: ACCOUNT,
        VaultID: VAULT_ID,
        Holder: HOLDER,
        Amount: 10,
      },
      'VaultClawback: invalid field Amount',
    )
  })
})

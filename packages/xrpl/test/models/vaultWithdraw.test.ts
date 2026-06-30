import { validateVaultWithdraw } from '../../src/models/transactions/vaultWithdraw'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void =>
  assertTxIsValid(tx, validateVaultWithdraw)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateVaultWithdraw, message)

const ACCOUNT = 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm'
const DESTINATION = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe'
const VAULT_ID =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

/**
 * VaultWithdraw Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('VaultWithdraw', function () {
  it('verifies a VaultWithdraw without a Destination', function () {
    assertValid({
      TransactionType: 'VaultWithdraw',
      Account: ACCOUNT,
      VaultID: VAULT_ID,
      Amount: '1000',
    })
  })

  it('verifies a VaultWithdraw directed to a Destination', function () {
    assertValid({
      TransactionType: 'VaultWithdraw',
      Account: ACCOUNT,
      VaultID: VAULT_ID,
      Amount: { currency: 'USD', issuer: ACCOUNT, value: '10' },
      Destination: DESTINATION,
    })
  })

  it('throws when VaultID is missing', function () {
    assertInvalid(
      {
        TransactionType: 'VaultWithdraw',
        Account: ACCOUNT,
        Amount: '1000',
      },
      'VaultWithdraw: missing field VaultID',
    )
  })

  it('throws when Amount is missing', function () {
    assertInvalid(
      {
        TransactionType: 'VaultWithdraw',
        Account: ACCOUNT,
        VaultID: VAULT_ID,
      },
      'VaultWithdraw: missing field Amount',
    )
  })

  it('throws when Destination is malformed', function () {
    assertInvalid(
      {
        TransactionType: 'VaultWithdraw',
        Account: ACCOUNT,
        VaultID: VAULT_ID,
        Amount: '1000',
        Destination: 123,
      },
      'VaultWithdraw: invalid field Destination',
    )
  })
})

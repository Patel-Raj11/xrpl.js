import { validateVaultClawback } from '../../src/models/transactions/vaultClawback'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void => assertTxIsValid(tx, validateVaultClawback)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateVaultClawback, message)

/**
 * VaultClawback Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('VaultClawback', function () {
  let tx: any

  beforeEach(function () {
    tx = {
      TransactionType: 'VaultClawback',
      Account: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
      VaultID:
        'D88930B33C2B6831660BFD006D91FF100011AD4E67CBB78B460AF0A215103737',
      Holder: 'rfkE1aSy9G8Upk4JssnwBxhEv5p4mn2KTy',
    }
  })

  it('verifies valid VaultClawback without an Amount', function () {
    assertValid(tx)
  })

  it('verifies valid VaultClawback with an IOU Amount', function () {
    tx.Amount = {
      currency: 'USD',
      issuer: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
      value: '1000',
    }
    assertValid(tx)
  })

  it('verifies valid VaultClawback with an MPT Amount', function () {
    tx.Amount = {
      mpt_issuance_id: '00002403C84A0A28E0190E208E982C352BBD5006600555CF',
      value: '1000',
    }
    assertValid(tx)
  })

  it('throws w/ missing field VaultID', function () {
    delete tx.VaultID
    assertInvalid(tx, 'VaultClawback: missing field VaultID')
  })

  it('throws w/ missing field Holder', function () {
    delete tx.Holder
    assertInvalid(tx, 'VaultClawback: missing field Holder')
  })

  it('throws w/ invalid field Holder', function () {
    tx.Holder = 1234
    assertInvalid(tx, 'VaultClawback: invalid field Holder')
  })

  it('throws w/ invalid field Amount', function () {
    tx.Amount = 1234
    assertInvalid(tx, 'VaultClawback: invalid field Amount')
  })
})

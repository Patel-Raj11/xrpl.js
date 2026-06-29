import { validateVaultWithdraw } from '../../src/models/transactions/vaultWithdraw'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void =>
  assertTxIsValid(tx, validateVaultWithdraw)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateVaultWithdraw, message)

/**
 * VaultWithdraw Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('VaultWithdraw', function () {
  let tx: any

  beforeEach(function () {
    tx = {
      TransactionType: 'VaultWithdraw',
      Account: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
      VaultID:
        'D88930B33C2B6831660BFD006D91FF100011AD4E67CBB78B460AF0A215103737',
      Amount: '1000',
    }
  })

  it('verifies valid VaultWithdraw denominated in the asset', function () {
    assertValid(tx)
  })

  it('verifies valid VaultWithdraw denominated in shares (MPT)', function () {
    tx.Amount = {
      mpt_issuance_id: '00002403C84A0A28E0190E208E982C352BBD5006600555CF',
      value: '1000',
    }
    assertValid(tx)
  })

  it('verifies valid VaultWithdraw with a Destination', function () {
    tx.Destination = 'rfkE1aSy9G8Upk4JssnwBxhEv5p4mn2KTy'
    assertValid(tx)
  })

  it('throws w/ missing field VaultID', function () {
    delete tx.VaultID
    assertInvalid(tx, 'VaultWithdraw: missing field VaultID')
  })

  it('throws w/ missing field Amount', function () {
    delete tx.Amount
    assertInvalid(tx, 'VaultWithdraw: missing field Amount')
  })

  it('throws w/ invalid field Destination', function () {
    tx.Destination = 1234
    assertInvalid(tx, 'VaultWithdraw: invalid field Destination')
  })
})

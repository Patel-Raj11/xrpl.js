import { validateVaultDeposit } from '../../src/models/transactions/vaultDeposit'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void => assertTxIsValid(tx, validateVaultDeposit)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateVaultDeposit, message)

/**
 * VaultDeposit Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('VaultDeposit', function () {
  let tx: any

  beforeEach(function () {
    tx = {
      TransactionType: 'VaultDeposit',
      Account: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
      VaultID:
        'D88930B33C2B6831660BFD006D91FF100011AD4E67CBB78B460AF0A215103737',
      Amount: '1000',
    }
  })

  it('verifies valid VaultDeposit with an XRP amount', function () {
    assertValid(tx)
  })

  it('verifies valid VaultDeposit with an IOU amount', function () {
    tx.Amount = {
      currency: 'USD',
      issuer: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
      value: '1000',
    }
    assertValid(tx)
  })

  it('verifies valid VaultDeposit with an MPT amount', function () {
    tx.Amount = {
      mpt_issuance_id: '00002403C84A0A28E0190E208E982C352BBD5006600555CF',
      value: '1000',
    }
    assertValid(tx)
  })

  it('throws w/ missing field VaultID', function () {
    delete tx.VaultID
    assertInvalid(tx, 'VaultDeposit: missing field VaultID')
  })

  it('throws w/ missing field Amount', function () {
    delete tx.Amount
    assertInvalid(tx, 'VaultDeposit: missing field Amount')
  })

  it('throws w/ invalid field Amount', function () {
    tx.Amount = 1234
    assertInvalid(tx, 'VaultDeposit: invalid field Amount')
  })
})

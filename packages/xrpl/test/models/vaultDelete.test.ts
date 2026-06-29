import { validateVaultDelete } from '../../src/models/transactions/vaultDelete'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void => assertTxIsValid(tx, validateVaultDelete)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateVaultDelete, message)

/**
 * VaultDelete Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('VaultDelete', function () {
  let tx: any

  beforeEach(function () {
    tx = {
      TransactionType: 'VaultDelete',
      Account: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
      VaultID:
        'D88930B33C2B6831660BFD006D91FF100011AD4E67CBB78B460AF0A215103737',
    }
  })

  it('verifies valid VaultDelete', function () {
    assertValid(tx)
  })

  it('throws w/ missing field VaultID', function () {
    delete tx.VaultID
    assertInvalid(tx, 'VaultDelete: missing field VaultID')
  })

  it('throws w/ invalid field VaultID', function () {
    tx.VaultID = 1234
    assertInvalid(tx, 'VaultDelete: invalid field VaultID')
  })
})

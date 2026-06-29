import { validateVaultSet } from '../../src/models/transactions/vaultSet'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void => assertTxIsValid(tx, validateVaultSet)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateVaultSet, message)

/**
 * VaultSet Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('VaultSet', function () {
  let tx: any

  beforeEach(function () {
    tx = {
      TransactionType: 'VaultSet',
      Account: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
      VaultID:
        'D88930B33C2B6831660BFD006D91FF100011AD4E67CBB78B460AF0A215103737',
      Data: 'ABCD',
    }
  })

  it('verifies valid VaultSet', function () {
    assertValid(tx)
  })

  it('throws w/ missing field VaultID', function () {
    delete tx.VaultID
    assertInvalid(tx, 'VaultSet: missing field VaultID')
  })

  it('throws w/ invalid field VaultID', function () {
    tx.VaultID = 1234
    assertInvalid(tx, 'VaultSet: invalid field VaultID')
  })

  it('throws when no mutable field is provided', function () {
    delete tx.Data
    assertInvalid(
      tx,
      'VaultSet: must update at least one of AssetsMaximum, DomainID, or Data',
    )
  })

  it('verifies VaultSet that only updates AssetsMaximum', function () {
    delete tx.Data
    tx.AssetsMaximum = '1000'
    assertValid(tx)
  })

  it('verifies VaultSet that only updates DomainID', function () {
    delete tx.Data
    tx.DomainID =
      'D88930B33C2B6831660BFD006D91FF100011AD4E67CBB78B460AF0A215103737'
    assertValid(tx)
  })

  it('throws w/ a non-hex Data', function () {
    tx.Data = 'not-hex'
    assertInvalid(tx, 'VaultSet: Data must be a valid hex string')
  })

  it('throws w/ a Data field that is too long', function () {
    tx.Data = 'AB'.repeat(257)
    assertInvalid(tx, 'VaultSet: Data length must be between 1 and 256 bytes')
  })
})

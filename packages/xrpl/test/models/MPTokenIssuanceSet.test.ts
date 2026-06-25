import { stringToHex } from '@xrplf/isomorphic/src/utils'

import {
  MPTokenIssuanceSetFlags,
  MPTokenIssuanceSetMutableFlags,
} from '../../src'
import { validateMPTokenIssuanceSet } from '../../src/models/transactions/MPTokenIssuanceSet'
import { MAX_MPT_META_BYTE_LENGTH } from '../../src/models/utils/mptokenMetadata'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void =>
  assertTxIsValid(tx, validateMPTokenIssuanceSet)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateMPTokenIssuanceSet, message)

const TOKEN_ID = '000004C463C52827307480341125DA0577DEFC38405B0E3E'

/**
 * MPTokenIssuanceSet Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('MPTokenIssuanceSet', function () {
  it(`verifies valid MPTokenIssuanceSet`, function () {
    let validMPTokenIssuanceSet = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      Flags: MPTokenIssuanceSetFlags.tfMPTLock,
    } as any

    assertValid(validMPTokenIssuanceSet)

    validMPTokenIssuanceSet = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      Holder: 'rajgkBmMxmz161r8bWYH7CQAFZP5bA9oSG',
      Flags: MPTokenIssuanceSetFlags.tfMPTLock,
    } as any

    assertValid(validMPTokenIssuanceSet)

    // It's fine to not specify any flag, it means only tx fee is deducted
    validMPTokenIssuanceSet = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      Holder: 'rajgkBmMxmz161r8bWYH7CQAFZP5bA9oSG',
    } as any

    assertValid(validMPTokenIssuanceSet)
  })

  it(`throws w/ missing MPTokenIssuanceID`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
    } as any

    assertInvalid(
      invalid,
      'MPTokenIssuanceSet: missing field MPTokenIssuanceID',
    )
  })

  it(`throws w/ conflicting flags`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
    } as any

    invalid.Flags =
      // eslint-disable-next-line no-bitwise -- not needed
      MPTokenIssuanceSetFlags.tfMPTLock | MPTokenIssuanceSetFlags.tfMPTUnlock

    assertInvalid(invalid, 'MPTokenIssuanceSet: flag conflict')

    invalid.Flags = { tfMPTLock: true, tfMPTUnlock: true }

    assertInvalid(invalid, 'MPTokenIssuanceSet: flag conflict')
  })

  it(`verifies valid mutate-mode MPTokenIssuanceSet`, function () {
    const validSetFlags = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      MutableFlags: MPTokenIssuanceSetMutableFlags.tmfMPTSetCanLock,
    } as any
    assertValid(validSetFlags)

    const validMetadata = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      MPTokenMetadata: stringToHex('updated metadata'),
    } as any
    assertValid(validMetadata)

    const clearMetadata = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      MPTokenMetadata: '',
    } as any
    assertValid(clearMetadata)

    const validTransferFee = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      TransferFee: 100,
    } as any
    assertValid(validTransferFee)

    const clearTransferFee = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      TransferFee: 0,
    } as any
    assertValid(clearTransferFee)

    const interfaceMutableFlags = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      MutableFlags: { tmfMPTSetCanEscrow: true },
    } as any
    assertValid(interfaceMutableFlags)
  })

  it(`throws w/ MutableFlags = 0`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      MutableFlags: 0,
    } as any
    assertInvalid(invalid, 'MPTokenIssuanceSet: invalid field MutableFlags')
  })

  it(`throws w/ MutableFlags containing out-of-mask bit`, function () {
    // 0x00010000 (tmfMPTCanMutateMetadata) is create-side, not valid on set
    const invalid = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      MutableFlags: 0x00010000,
    } as any
    assertInvalid(invalid, 'MPTokenIssuanceSet: invalid field MutableFlags')
  })

  it(`throws w/ Holder present in mutate mode`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      Holder: 'rajgkBmMxmz161r8bWYH7CQAFZP5bA9oSG',
      MutableFlags: MPTokenIssuanceSetMutableFlags.tmfMPTSetCanLock,
    } as any
    assertInvalid(
      invalid,
      'MPTokenIssuanceSet: Holder must be absent in mutate mode',
    )

    const invalidMetadata = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      Holder: 'rajgkBmMxmz161r8bWYH7CQAFZP5bA9oSG',
      MPTokenMetadata: stringToHex('m'),
    } as any
    assertInvalid(
      invalidMetadata,
      'MPTokenIssuanceSet: Holder must be absent in mutate mode',
    )

    const invalidFee = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      Holder: 'rajgkBmMxmz161r8bWYH7CQAFZP5bA9oSG',
      TransferFee: 100,
    } as any
    assertInvalid(
      invalidFee,
      'MPTokenIssuanceSet: Holder must be absent in mutate mode',
    )
  })

  it(`throws w/ tfMPTLock / tfMPTUnlock in mutate mode`, function () {
    const invalidLock = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      Flags: MPTokenIssuanceSetFlags.tfMPTLock,
      MutableFlags: MPTokenIssuanceSetMutableFlags.tmfMPTSetCanLock,
    } as any
    assertInvalid(
      invalidLock,
      'MPTokenIssuanceSet: mutate mode is mutually exclusive with lock/unlock mode',
    )

    const invalidUnlockInterface = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      Flags: { tfMPTUnlock: true },
      MPTokenMetadata: stringToHex('m'),
    } as any
    assertInvalid(
      invalidUnlockInterface,
      'MPTokenIssuanceSet: mutate mode is mutually exclusive with lock/unlock mode',
    )
  })

  it(`throws w/ MPTokenMetadata exceeding ${MAX_MPT_META_BYTE_LENGTH} bytes`, function () {
    const tooLong = 'AB'.repeat(MAX_MPT_META_BYTE_LENGTH + 1)
    const invalid = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      MPTokenMetadata: tooLong,
    } as any
    assertInvalid(
      invalid,
      `MPTokenIssuanceSet: MPTokenMetadata (hex format) must be no more than ${MAX_MPT_META_BYTE_LENGTH} bytes.`,
    )
  })

  it(`accepts MPTokenMetadata at the ${MAX_MPT_META_BYTE_LENGTH}-byte boundary`, function () {
    const atBound = 'AB'.repeat(MAX_MPT_META_BYTE_LENGTH)
    const valid = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      MPTokenMetadata: atBound,
    } as any
    assertValid(valid)
  })

  it(`throws w/ TransferFee out of range`, function () {
    const tooHigh = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      TransferFee: 50001,
    } as any
    assertInvalid(
      tooHigh,
      'MPTokenIssuanceSet: TransferFee must be between 0 and 50000',
    )

    const negative = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      TransferFee: -1,
    } as any
    assertInvalid(
      negative,
      'MPTokenIssuanceSet: TransferFee must be between 0 and 50000',
    )
  })

  it(`accepts TransferFee at the 50000 boundary`, function () {
    const atBound = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      TransferFee: 50000,
    } as any
    assertValid(atBound)
  })

  it(`throws when tmfMPTSetCanTransfer is paired with non-zero TransferFee`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      MutableFlags: MPTokenIssuanceSetMutableFlags.tmfMPTSetCanTransfer,
      TransferFee: 100,
    } as any
    assertInvalid(
      invalid,
      'MPTokenIssuanceSet: non-zero TransferFee cannot be combined with tmfMPTSetCanTransfer; enable the capability in a separate transaction first',
    )
  })

  it(`accepts tmfMPTSetCanTransfer paired with TransferFee = 0`, function () {
    const valid = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenIssuanceID: TOKEN_ID,
      MutableFlags: MPTokenIssuanceSetMutableFlags.tmfMPTSetCanTransfer,
      TransferFee: 0,
    } as any
    assertValid(valid)
  })
})

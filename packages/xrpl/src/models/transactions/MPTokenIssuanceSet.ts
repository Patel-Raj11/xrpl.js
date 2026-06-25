import { ValidationError } from '../../errors'
import { isHex, isFlagEnabled } from '../utils'
import { MAX_MPT_META_BYTE_LENGTH } from '../utils/mptokenMetadata'

import {
  BaseTransaction,
  isString,
  isNumber,
  validateBaseTransaction,
  validateRequiredField,
  Account,
  validateOptionalField,
  isAccount,
  GlobalFlagsInterface,
} from './common'

const MAX_TRANSFER_FEE = 50000

/**
 * Transaction Flags for an MPTokenIssuanceSet Transaction.
 *
 * @category Transaction Flags
 */
export enum MPTokenIssuanceSetFlags {
  /**
   * If set, indicates that issuer locks the MPT
   */
  tfMPTLock = 0x00000001,
  /**
   * If set, indicates that issuer unlocks the MPT
   */
  tfMPTUnlock = 0x00000002,
}

/**
 * Map of flags to boolean values representing {@link MPTokenIssuanceSet} transaction
 * flags.
 *
 * @category Transaction Flags
 */
export interface MPTokenIssuanceSetFlagsInterface extends GlobalFlagsInterface {
  tfMPTLock?: boolean
  tfMPTUnlock?: boolean
}

/**
 * MutableFlags for an MPTokenIssuanceSet transaction. Each bit set
 * enables (one-way) the matching lsfMPTCan* capability on the target
 * MPTokenIssuance. Capabilities cannot be disabled once enabled.
 *
 * @category Transaction Flags
 */
export enum MPTokenIssuanceSetMutableFlags {
  /**
   * Sets the lsfMPTCanLock flag. Enables the token to be locked both
   * individually and globally.
   */
  tmfMPTSetCanLock = 0x00000001,
  /**
   * Sets the lsfMPTRequireAuth flag. Requires individual holders to be
   * authorized.
   */
  tmfMPTSetRequireAuth = 0x00000002,
  /**
   * Sets the lsfMPTCanEscrow flag. Allows holders to place balances into
   * escrow.
   */
  tmfMPTSetCanEscrow = 0x00000004,
  /**
   * Sets the lsfMPTCanTrade flag. Allows holders to trade balances on the
   * XRPL DEX.
   */
  tmfMPTSetCanTrade = 0x00000008,
  /**
   * Sets the lsfMPTCanTransfer flag. Allows tokens to be transferred to
   * non-issuer accounts.
   */
  tmfMPTSetCanTransfer = 0x00000010,
  /**
   * Sets the lsfMPTCanClawback flag. Enables the issuer to claw back
   * tokens via Clawback or AMMClawback transactions.
   */
  tmfMPTSetCanClawback = 0x00000020,
}

/**
 * Map of MutableFlags to boolean values representing
 * {@link MPTokenIssuanceSet}'s MutableFlags field.
 *
 * @category Transaction Flags
 */
export interface MPTokenIssuanceSetMutableFlagsInterface {
  tmfMPTSetCanLock?: boolean
  tmfMPTSetRequireAuth?: boolean
  tmfMPTSetCanEscrow?: boolean
  tmfMPTSetCanTrade?: boolean
  tmfMPTSetCanTransfer?: boolean
  tmfMPTSetCanClawback?: boolean
}

// Mask of every valid bit on MPTokenIssuanceSet.MutableFlags.
const MPT_ISSUANCE_SET_MUTABLE_MASK =
  MPTokenIssuanceSetMutableFlags.tmfMPTSetCanLock |
  MPTokenIssuanceSetMutableFlags.tmfMPTSetRequireAuth |
  MPTokenIssuanceSetMutableFlags.tmfMPTSetCanEscrow |
  MPTokenIssuanceSetMutableFlags.tmfMPTSetCanTrade |
  MPTokenIssuanceSetMutableFlags.tmfMPTSetCanTransfer |
  MPTokenIssuanceSetMutableFlags.tmfMPTSetCanClawback

/**
 * The MPTokenIssuanceSet transaction is used to globally lock/unlock a MPTokenIssuance,
 * or lock/unlock an individual's MPToken. It also supports a "mutate mode" that
 * irreversibly enables previously-dormant capabilities and replaces the metadata
 * or transfer fee on the target issuance (gated by the issuance's MutableFlags).
 */
export interface MPTokenIssuanceSet extends BaseTransaction {
  TransactionType: 'MPTokenIssuanceSet'
  /**
   * Identifies the MPTokenIssuance
   */
  MPTokenIssuanceID: string
  /**
   * An optional XRPL Address of an individual token holder balance to lock/unlock.
   * If omitted, this transaction will apply to all any accounts holding MPTs.
   * Must be absent in mutate mode.
   */
  Holder?: Account
  /**
   * Sets the specified capability flags on the target MPTokenIssuance. Each
   * bit set must correspond to a capability declared enable-able at issuance
   * creation. Once enabled, a capability cannot be disabled.
   */
  MutableFlags?: number | MPTokenIssuanceSetMutableFlagsInterface
  /**
   * New metadata to replace the existing value. The transaction will be
   * rejected if lsmfMPTCanMutateMetadata was not set in MutableFlags on the
   * issuance. Setting an empty MPTokenMetadata removes the field.
   */
  MPTokenMetadata?: string
  /**
   * New transfer fee value. The transaction will be rejected if
   * lsmfMPTCanMutateTransferFee was not set in MutableFlags on the issuance.
   * Setting TransferFee to zero removes the field.
   */
  TransferFee?: number
  Flags?: number | MPTokenIssuanceSetFlagsInterface
}

function resolveMPTokenIssuanceSetMutableFlags(
  mutableFlags: number | MPTokenIssuanceSetMutableFlagsInterface,
): number {
  if (typeof mutableFlags === 'number') {
    return mutableFlags
  }
  return Object.keys(mutableFlags).reduce((acc, key) => {
    const bit =
      MPTokenIssuanceSetMutableFlags[
        key as keyof typeof MPTokenIssuanceSetMutableFlags
      ]
    if (bit == null || typeof bit !== 'number') {
      throw new ValidationError(
        `MPTokenIssuanceSet: invalid MutableFlags member ${key}`,
      )
    }
    // eslint-disable-next-line no-bitwise -- bitmask combine
    return mutableFlags[key as keyof MPTokenIssuanceSetMutableFlagsInterface]
      ? acc | bit
      : acc
  }, 0)
}

/* eslint-disable max-lines-per-function -- multi-mode validation */
/**
 * Verify the form and type of an MPTokenIssuanceSet at runtime.
 *
 * @param tx - An MPTokenIssuanceSet Transaction.
 * @throws When the MPTokenIssuanceSet is Malformed.
 */
export function validateMPTokenIssuanceSet(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)
  validateRequiredField(tx, 'MPTokenIssuanceID', isString)
  validateOptionalField(tx, 'Holder', isAccount)
  validateOptionalField(tx, 'MPTokenMetadata', isString)
  validateOptionalField(tx, 'TransferFee', isNumber)

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Not necessary
  const flags = (tx.Flags ?? 0) as number | MPTokenIssuanceSetFlagsInterface
  const isTfMPTLock =
    typeof flags === 'number'
      ? isFlagEnabled(flags, MPTokenIssuanceSetFlags.tfMPTLock)
      : (flags.tfMPTLock ?? false)

  const isTfMPTUnlock =
    typeof flags === 'number'
      ? isFlagEnabled(flags, MPTokenIssuanceSetFlags.tfMPTUnlock)
      : (flags.tfMPTUnlock ?? false)

  if (isTfMPTLock && isTfMPTUnlock) {
    throw new ValidationError('MPTokenIssuanceSet: flag conflict')
  }

  const isMutateMode =
    tx.MutableFlags != null ||
    tx.MPTokenMetadata != null ||
    tx.TransferFee != null

  let numericMutableFlags: number | undefined
  if (tx.MutableFlags != null) {
    if (
      typeof tx.MutableFlags !== 'number' &&
      (typeof tx.MutableFlags !== 'object' || Array.isArray(tx.MutableFlags))
    ) {
      throw new ValidationError(
        'MPTokenIssuanceSet: invalid field MutableFlags',
      )
    }
    numericMutableFlags = resolveMPTokenIssuanceSetMutableFlags(
      tx.MutableFlags as number | MPTokenIssuanceSetMutableFlagsInterface,
    )
    if (
      numericMutableFlags === 0 ||
      // eslint-disable-next-line no-bitwise -- bitmask compare
      (numericMutableFlags & ~MPT_ISSUANCE_SET_MUTABLE_MASK) !== 0
    ) {
      throw new ValidationError(
        'MPTokenIssuanceSet: invalid field MutableFlags',
      )
    }
  }

  if (isMutateMode) {
    if (tx.Holder != null) {
      throw new ValidationError(
        'MPTokenIssuanceSet: Holder must be absent in mutate mode',
      )
    }
    if (isTfMPTLock || isTfMPTUnlock) {
      throw new ValidationError(
        'MPTokenIssuanceSet: mutate mode is mutually exclusive with lock/unlock mode',
      )
    }
  }

  if (typeof tx.MPTokenMetadata === 'string' && tx.MPTokenMetadata.length > 0) {
    if (
      !isHex(tx.MPTokenMetadata) ||
      tx.MPTokenMetadata.length / 2 > MAX_MPT_META_BYTE_LENGTH
    ) {
      throw new ValidationError(
        `MPTokenIssuanceSet: MPTokenMetadata (hex format) must be no more than ${MAX_MPT_META_BYTE_LENGTH} bytes.`,
      )
    }
  }

  if (typeof tx.TransferFee === 'number') {
    if (tx.TransferFee < 0 || tx.TransferFee > MAX_TRANSFER_FEE) {
      throw new ValidationError(
        `MPTokenIssuanceSet: TransferFee must be between 0 and ${MAX_TRANSFER_FEE}`,
      )
    }
    if (
      tx.TransferFee > 0 &&
      numericMutableFlags != null &&
      // eslint-disable-next-line no-bitwise -- bitmask check
      (numericMutableFlags &
        MPTokenIssuanceSetMutableFlags.tmfMPTSetCanTransfer) !==
        0
    ) {
      throw new ValidationError(
        'MPTokenIssuanceSet: non-zero TransferFee cannot be combined with tmfMPTSetCanTransfer; enable the capability in a separate transaction first',
      )
    }
  }
}
/* eslint-enable max-lines-per-function */

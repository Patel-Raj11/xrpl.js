import { ValidationError } from '../../errors'
import { isHex, INTEGER_SANITY_CHECK, isFlagEnabled } from '../utils'
import {
  MAX_MPT_META_BYTE_LENGTH,
  MPT_META_WARNING_HEADER,
  validateMPTokenMetadata,
} from '../utils/mptokenMetadata'

import {
  BaseTransaction,
  GlobalFlagsInterface,
  validateBaseTransaction,
  validateOptionalField,
  isString,
  isNumber,
} from './common'
import type { TransactionMetadataBase } from './metadata'

// 2^63 - 1
const MAX_AMT = '9223372036854775807'
const MAX_TRANSFER_FEE = 50000

/**
 * Transaction Flags for an MPTokenIssuanceCreate Transaction.
 *
 * @category Transaction Flags
 */
export enum MPTokenIssuanceCreateFlags {
  /**
   * If set, indicates that the MPT can be locked both individually and globally.
   * If not set, the MPT cannot be locked in any way.
   */
  tfMPTCanLock = 0x00000002,
  /**
   * If set, indicates that individual holders must be authorized.
   * This enables issuers to limit who can hold their assets.
   */
  tfMPTRequireAuth = 0x00000004,
  /**
   * If set, indicates that individual holders can place their balances into an escrow.
   */
  tfMPTCanEscrow = 0x00000008,
  /**
   * If set, indicates that individual holders can trade their balances
   *  using the XRP Ledger DEX or AMM.
   */
  tfMPTCanTrade = 0x00000010,
  /**
   * If set, indicates that tokens may be transferred to other accounts
   *  that are not the issuer.
   */
  tfMPTCanTransfer = 0x00000020,
  /**
   * If set, indicates that the issuer may use the Clawback transaction
   * to clawback value from individual holders.
   */
  tfMPTCanClawback = 0x00000040,
}

/**
 * Map of flags to boolean values representing {@link MPTokenIssuanceCreate} transaction
 * flags.
 *
 * @category Transaction Flags
 */
// eslint-disable-next-line max-len -- Disable for interface declaration.
export interface MPTokenIssuanceCreateFlagsInterface extends GlobalFlagsInterface {
  tfMPTCanLock?: boolean
  tfMPTRequireAuth?: boolean
  tfMPTCanEscrow?: boolean
  tfMPTCanTrade?: boolean
  tfMPTCanTransfer?: boolean
  tfMPTCanClawback?: boolean
}

/**
 * MutableFlags for an MPTokenIssuanceCreate transaction. Bits set here
 * declare which capability flags and which fields on the resulting
 * MPTokenIssuance may be modified after creation via MPTokenIssuanceSet.
 *
 * @category Transaction Flags
 */
export enum MPTokenIssuanceCreateMutableFlags {
  /**
   * Declares lsfMPTCanLock as enable-able post-creation; the issuer
   * may later set lsfMPTCanLock on the issuance via MPTokenIssuanceSet's
   * tmfMPTSetCanLock.
   */
  tmfMPTCanEnableCanLock = 0x00000002,
  /**
   * Declares lsfMPTRequireAuth as enable-able post-creation; the issuer
   * may later set lsfMPTRequireAuth on the issuance via MPTokenIssuanceSet's
   * tmfMPTSetRequireAuth.
   */
  tmfMPTCanEnableRequireAuth = 0x00000004,
  /**
   * Declares lsfMPTCanEscrow as enable-able post-creation; the issuer
   * may later set lsfMPTCanEscrow on the issuance via MPTokenIssuanceSet's
   * tmfMPTSetCanEscrow.
   */
  tmfMPTCanEnableCanEscrow = 0x00000008,
  /**
   * Declares lsfMPTCanTrade as enable-able post-creation; the issuer
   * may later set lsfMPTCanTrade on the issuance via MPTokenIssuanceSet's
   * tmfMPTSetCanTrade.
   */
  tmfMPTCanEnableCanTrade = 0x00000010,
  /**
   * Declares lsfMPTCanTransfer as enable-able post-creation; the issuer
   * may later set lsfMPTCanTransfer on the issuance via MPTokenIssuanceSet's
   * tmfMPTSetCanTransfer.
   */
  tmfMPTCanEnableCanTransfer = 0x00000020,
  /**
   * Declares lsfMPTCanClawback as enable-able post-creation; the issuer
   * may later set lsfMPTCanClawback on the issuance via MPTokenIssuanceSet's
   * tmfMPTSetCanClawback.
   */
  tmfMPTCanEnableCanClawback = 0x00000040,
  /**
   * Allows field MPTokenMetadata to be modified.
   */
  tmfMPTCanMutateMetadata = 0x00010000,
  /**
   * Allows field TransferFee to be modified.
   */
  tmfMPTCanMutateTransferFee = 0x00020000,
}

/**
 * Map of MutableFlags to boolean values representing
 * {@link MPTokenIssuanceCreate}'s MutableFlags field.
 *
 * @category Transaction Flags
 */
export interface MPTokenIssuanceCreateMutableFlagsInterface {
  tmfMPTCanEnableCanLock?: boolean
  tmfMPTCanEnableRequireAuth?: boolean
  tmfMPTCanEnableCanEscrow?: boolean
  tmfMPTCanEnableCanTrade?: boolean
  tmfMPTCanEnableCanTransfer?: boolean
  tmfMPTCanEnableCanClawback?: boolean
  tmfMPTCanMutateMetadata?: boolean
  tmfMPTCanMutateTransferFee?: boolean
}

// Mask of every valid bit on MPTokenIssuanceCreate.MutableFlags.
const MPT_ISSUANCE_CREATE_MUTABLE_MASK =
  MPTokenIssuanceCreateMutableFlags.tmfMPTCanEnableCanLock |
  MPTokenIssuanceCreateMutableFlags.tmfMPTCanEnableRequireAuth |
  MPTokenIssuanceCreateMutableFlags.tmfMPTCanEnableCanEscrow |
  MPTokenIssuanceCreateMutableFlags.tmfMPTCanEnableCanTrade |
  MPTokenIssuanceCreateMutableFlags.tmfMPTCanEnableCanTransfer |
  MPTokenIssuanceCreateMutableFlags.tmfMPTCanEnableCanClawback |
  MPTokenIssuanceCreateMutableFlags.tmfMPTCanMutateMetadata |
  MPTokenIssuanceCreateMutableFlags.tmfMPTCanMutateTransferFee

/**
 * The MPTokenIssuanceCreate transaction creates a MPTokenIssuance object
 * and adds it to the relevant directory node of the creator account.
 * This transaction is the only opportunity an issuer has to specify any token fields
 * that are defined as immutable (e.g., MPT Flags). If the transaction is successful,
 * the newly created token will be owned by the account (the creator account) which
 * executed the transaction.
 */
export interface MPTokenIssuanceCreate extends BaseTransaction {
  TransactionType: 'MPTokenIssuanceCreate'
  /**
   * An asset scale is the difference, in orders of magnitude, between a standard unit and
   * a corresponding fractional unit. More formally, the asset scale is a non-negative integer
   * (0, 1, 2, …) such that one standard unit equals 10^(-scale) of a corresponding
   * fractional unit. If the fractional unit equals the standard unit, then the asset scale is 0.
   * Note that this value is optional, and will default to 0 if not supplied.
   */
  AssetScale?: number
  /**
   * Specifies the maximum asset amount of this token that should ever be issued.
   * It is a non-negative integer string that can store a range of up to 63 bits. If not set, the max
   * amount will default to the largest unsigned 63-bit integer (0x7FFFFFFFFFFFFFFF or 9223372036854775807)
   *
   * Example:
   * ```
   * MaximumAmount: '9223372036854775807'
   * ```
   */
  MaximumAmount?: string
  /**
   * Specifies the fee to charged by the issuer for secondary sales of the Token,
   * if such sales are allowed. Valid values for this field are between 0 and 50,000 inclusive,
   * allowing transfer rates of between 0.000% and 50.000% in increments of 0.001.
   * The field must NOT be present if the `tfMPTCanTransfer` flag is not set.
   */
  TransferFee?: number

  /**
   * Should follow {@link https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0089-multi-purpose-token-metadata-schema | XLS-89} standard.
   * Use {@link encodeMPTokenMetadata} utility function to convert to convert {@link MPTokenMetadata} to a blob.
   * Use {@link decodeMPTokenMetadata} utility function to convert from a blob to {@link MPTokenMetadata}.
   *
   * While adherence to the XLS-89d format is not mandatory, non-compliant metadata
   * may not be discoverable by ecosystem tools such as explorers and indexers.
   */
  MPTokenMetadata?: string

  Flags?: number | MPTokenIssuanceCreateFlagsInterface

  /**
   * Indicate specific fields or flags mutable. Bits must lie within the
   * MPTokenIssuanceCreate.MutableFlags mask; if present, must be non-zero.
   */
  MutableFlags?: number | MPTokenIssuanceCreateMutableFlagsInterface
}

export interface MPTokenIssuanceCreateMetadata extends TransactionMetadataBase {
  mpt_issuance_id?: string
}

function resolveMPTokenIssuanceCreateMutableFlags(
  mutableFlags: number | MPTokenIssuanceCreateMutableFlagsInterface,
): number {
  if (typeof mutableFlags === 'number') {
    return mutableFlags
  }
  return Object.keys(mutableFlags).reduce((acc, key) => {
    const bit =
      MPTokenIssuanceCreateMutableFlags[
        key as keyof typeof MPTokenIssuanceCreateMutableFlags
      ]
    if (bit == null || typeof bit !== 'number') {
      throw new ValidationError(
        `MPTokenIssuanceCreate: invalid MutableFlags member ${key}`,
      )
    }
    // eslint-disable-next-line no-bitwise -- bitmask combine
    return mutableFlags[key as keyof MPTokenIssuanceCreateMutableFlagsInterface]
      ? acc | bit
      : acc
  }, 0)
}

/* eslint-disable max-lines-per-function -- Not needed to reduce function */
/**
 * Verify the form and type of an MPTokenIssuanceCreate at runtime.
 *
 * @param tx - An MPTokenIssuanceCreate Transaction.
 * @throws When the MPTokenIssuanceCreate is Malformed.
 */
export function validateMPTokenIssuanceCreate(
  tx: Record<string, unknown>,
): void {
  validateBaseTransaction(tx)
  validateOptionalField(tx, 'MaximumAmount', isString)
  validateOptionalField(tx, 'MPTokenMetadata', isString)
  validateOptionalField(tx, 'TransferFee', isNumber)
  validateOptionalField(tx, 'AssetScale', isNumber)

  if (
    typeof tx.MPTokenMetadata === 'string' &&
    (!isHex(tx.MPTokenMetadata) ||
      tx.MPTokenMetadata.length / 2 > MAX_MPT_META_BYTE_LENGTH)
  ) {
    throw new ValidationError(
      `MPTokenIssuanceCreate: MPTokenMetadata (hex format) must be non-empty and no more than ${MAX_MPT_META_BYTE_LENGTH} bytes.`,
    )
  }

  if (typeof tx.MaximumAmount === 'string') {
    if (!INTEGER_SANITY_CHECK.exec(tx.MaximumAmount)) {
      throw new ValidationError('MPTokenIssuanceCreate: Invalid MaximumAmount')
    } else if (
      BigInt(tx.MaximumAmount) > BigInt(MAX_AMT) ||
      BigInt(tx.MaximumAmount) < BigInt(`0`)
    ) {
      throw new ValidationError(
        'MPTokenIssuanceCreate: MaximumAmount out of range',
      )
    }
  }

  if (typeof tx.TransferFee === 'number') {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Not necessary
    const flags = (tx.Flags ?? 0) as
      | number
      | MPTokenIssuanceCreateFlagsInterface
    const isTfMPTCanTransfer =
      typeof flags === 'number'
        ? isFlagEnabled(flags, MPTokenIssuanceCreateFlags.tfMPTCanTransfer)
        : (flags.tfMPTCanTransfer ?? false)

    if (tx.TransferFee < 0 || tx.TransferFee > MAX_TRANSFER_FEE) {
      throw new ValidationError(
        `MPTokenIssuanceCreate: TransferFee must be between 0 and ${MAX_TRANSFER_FEE}`,
      )
    }

    if (tx.TransferFee && !isTfMPTCanTransfer) {
      throw new ValidationError(
        'MPTokenIssuanceCreate: TransferFee cannot be provided without enabling tfMPTCanTransfer flag',
      )
    }
  }

  if (tx.MutableFlags != null) {
    if (
      typeof tx.MutableFlags !== 'number' &&
      (typeof tx.MutableFlags !== 'object' || Array.isArray(tx.MutableFlags))
    ) {
      throw new ValidationError(
        'MPTokenIssuanceCreate: invalid field MutableFlags',
      )
    }
    const numericMutableFlags = resolveMPTokenIssuanceCreateMutableFlags(
      tx.MutableFlags as number | MPTokenIssuanceCreateMutableFlagsInterface,
    )
    if (
      numericMutableFlags === 0 ||
      // eslint-disable-next-line no-bitwise -- bitmask compare
      (numericMutableFlags & ~MPT_ISSUANCE_CREATE_MUTABLE_MASK) !== 0
    ) {
      throw new ValidationError(
        'MPTokenIssuanceCreate: invalid field MutableFlags',
      )
    }
  }

  if (tx.MPTokenMetadata != null) {
    const validationMessages = validateMPTokenMetadata(tx.MPTokenMetadata)

    if (validationMessages.length > 0) {
      const message = [
        MPT_META_WARNING_HEADER,
        ...validationMessages.map((msg) => `- ${msg}`),
      ].join('\n')

      // eslint-disable-next-line no-console -- Required here.
      console.warn(message)
    }
  }
}
/* eslint-enable max-lines-per-function */

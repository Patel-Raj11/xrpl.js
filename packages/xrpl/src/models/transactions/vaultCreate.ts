/* eslint-disable no-bitwise -- flag masks require bitwise operations */
import { ValidationError } from '../../errors'
import { Currency } from '../common'
import { hasFlag, isHex } from '../utils'

import {
  BaseTransaction,
  GlobalFlags,
  GlobalFlagsInterface,
  isIssue,
  isNumber,
  isString,
  isXRPLNumber,
  validateBaseTransaction,
  validateOptionalField,
  validateRequiredField,
  VAULT_DATA_MAX_BYTE_LENGTH,
} from './common'

/** Maximum byte length of the share MPT's metadata on VaultCreate. */
const MAX_MPTOKEN_METADATA_BYTE_LENGTH = 1024

/** The only supported withdrawal policy: vaultStrategyFirstComeFirstServe. */
export const VAULT_WITHDRAWAL_POLICY_FIRST_COME_FIRST_SERVE = 1

const TF_FULLY_CANONICAL_SIG = 0x80000000

/**
 * Transaction Flags for a VaultCreate Transaction.
 *
 * @category Transaction Flags
 */
export enum VaultCreateFlags {
  /**
   * Indicates that the vault is private. It can only be set during Vault creation.
   */
  tfVaultPrivate = 0x00010000,
  /**
   * Indicates the vault share is non-transferable. It can only be set during Vault creation.
   */
  tfVaultShareNonTransferable = 0x00020000,
}

/**
 * Map of flags to boolean values representing {@link VaultCreate} transaction
 * flags.
 *
 * @category Transaction Flags
 */
export interface VaultCreateFlagsInterface extends GlobalFlagsInterface {
  tfVaultPrivate?: boolean
  tfVaultShareNonTransferable?: boolean
}

const VAULT_CREATE_VALID_FLAGS =
  TF_FULLY_CANONICAL_SIG |
  GlobalFlags.tfInnerBatchTxn |
  VaultCreateFlags.tfVaultPrivate |
  VaultCreateFlags.tfVaultShareNonTransferable

/**
 * The VaultCreate transaction creates a new Vault object.
 *
 * @category Transaction Models
 */
export interface VaultCreate extends BaseTransaction {
  TransactionType: 'VaultCreate'
  /** The asset (XRP, IOU or MPT) of the Vault. */
  Asset: Currency
  /** The maximum asset amount that can be held in a vault. */
  AssetsMaximum?: number | string
  /**
   * Arbitrary metadata about the share MPT, in hex format, limited to 1024 bytes.
   */
  MPTokenMetadata?: string
  /** The PermissionedDomain object ID associated with the shares of this Vault. */
  DomainID?: string
  /** Indicates the withdrawal strategy used by the Vault. */
  WithdrawalPolicy?: number
  /** Arbitrary Vault metadata, limited to 256 bytes. */
  Data?: string
  Flags?: number | VaultCreateFlagsInterface
}

/**
 * Verify the form and type of a VaultCreate at runtime.
 *
 * @param tx - A VaultCreate Transaction.
 * @throws When the VaultCreate is malformed.
 */
// eslint-disable-next-line max-lines-per-function -- single transaction validator
export function validateVaultCreate(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)

  validateRequiredField(tx, 'Asset', isIssue)
  validateOptionalField(tx, 'AssetsMaximum', isXRPLNumber)
  validateOptionalField(tx, 'MPTokenMetadata', isString)
  validateOptionalField(tx, 'DomainID', isString)
  validateOptionalField(tx, 'WithdrawalPolicy', isNumber)
  validateOptionalField(tx, 'Data', isString)

  if (typeof tx.Flags === 'number' && (tx.Flags & ~VAULT_CREATE_VALID_FLAGS) !== 0) {
    throw new ValidationError(
      'VaultCreate: invalid flags, only tfVaultPrivate and tfVaultShareNonTransferable are allowed',
    )
  }

  if (tx.AssetsMaximum !== undefined && Number(tx.AssetsMaximum) < 0) {
    throw new ValidationError('VaultCreate: AssetsMaximum must not be negative')
  }

  if (typeof tx.MPTokenMetadata === 'string') {
    if (!isHex(tx.MPTokenMetadata)) {
      throw new ValidationError(
        'VaultCreate: MPTokenMetadata must be a valid hex string',
      )
    }
    const byteLength = tx.MPTokenMetadata.length / 2
    if (byteLength < 1 || byteLength > MAX_MPTOKEN_METADATA_BYTE_LENGTH) {
      throw new ValidationError(
        `VaultCreate: MPTokenMetadata length must be between 1 and ${MAX_MPTOKEN_METADATA_BYTE_LENGTH} bytes`,
      )
    }
  }

  if (typeof tx.Data === 'string') {
    if (!isHex(tx.Data)) {
      throw new ValidationError('VaultCreate: Data must be a valid hex string')
    }
    const byteLength = tx.Data.length / 2
    if (byteLength < 1 || byteLength > VAULT_DATA_MAX_BYTE_LENGTH) {
      throw new ValidationError(
        `VaultCreate: Data length must be between 1 and ${VAULT_DATA_MAX_BYTE_LENGTH} bytes`,
      )
    }
  }

  if (
    tx.WithdrawalPolicy !== undefined &&
    tx.WithdrawalPolicy !== VAULT_WITHDRAWAL_POLICY_FIRST_COME_FIRST_SERVE
  ) {
    throw new ValidationError(
      'VaultCreate: WithdrawalPolicy must be vaultStrategyFirstComeFirstServe (1)',
    )
  }

  if (typeof tx.DomainID === 'string') {
    if (!hasFlag(tx, VaultCreateFlags.tfVaultPrivate, 'tfVaultPrivate')) {
      throw new ValidationError(
        'VaultCreate: DomainID can only be set on a private vault (tfVaultPrivate)',
      )
    }
    if (/^0+$/u.test(tx.DomainID)) {
      throw new ValidationError('VaultCreate: DomainID must not be zero')
    }
  }
}

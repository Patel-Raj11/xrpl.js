import { ValidationError } from '../../errors'
import { isHex } from '../utils'

import {
  BaseTransaction,
  isString,
  isXRPLNumber,
  validateBaseTransaction,
  validateOptionalField,
  validateRequiredField,
  VAULT_DATA_MAX_BYTE_LENGTH,
} from './common'

/**
 * The VaultSet updates an existing Vault ledger object.
 *
 * @category Transaction Models
 */
export interface VaultSet extends BaseTransaction {
  TransactionType: 'VaultSet'
  /** The ID of the Vault to be modified. Must be included when updating the Vault. */
  VaultID: string
  /**
   * The maximum asset amount that can be held in a vault. The value
   * cannot be lower than the current AssetsTotal unless the value is 0.
   */
  AssetsMaximum?: number | string
  /** The PermissionedDomain object ID associated with the shares of this Vault. */
  DomainID?: string
  /** Arbitrary Vault metadata, limited to 256 bytes. */
  Data?: string
}

/**
 * Verify the form and type of a VaultSet at runtime.
 *
 * @param tx - A VaultSet Transaction.
 * @throws When the VaultSet is malformed.
 */
export function validateVaultSet(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)

  validateRequiredField(tx, 'VaultID', isString)
  validateOptionalField(tx, 'AssetsMaximum', isXRPLNumber)
  validateOptionalField(tx, 'DomainID', isString)
  validateOptionalField(tx, 'Data', isString)

  if (
    tx.AssetsMaximum === undefined &&
    tx.DomainID === undefined &&
    tx.Data === undefined
  ) {
    throw new ValidationError(
      'VaultSet: must update at least one of AssetsMaximum, DomainID, or Data',
    )
  }

  if (typeof tx.Data === 'string') {
    if (!isHex(tx.Data)) {
      throw new ValidationError('VaultSet: Data must be a valid hex string')
    }
    const byteLength = tx.Data.length / 2
    if (byteLength < 1 || byteLength > VAULT_DATA_MAX_BYTE_LENGTH) {
      throw new ValidationError(
        `VaultSet: Data length must be between 1 and ${VAULT_DATA_MAX_BYTE_LENGTH} bytes`,
      )
    }
  }
}

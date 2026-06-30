import {
  BaseTransaction,
  isString,
  validateBaseTransaction,
  validateRequiredField,
} from './common'

/**
 * Deletes an existing Vault object.
 *
 * @category Transaction Models
 */
export interface VaultDelete extends BaseTransaction {
  TransactionType: 'VaultDelete'
  /** The ID of the vault to be deleted. */
  VaultID: string
}

/**
 * Verify the form and type of a VaultDelete at runtime.
 *
 * @param tx - A VaultDelete Transaction.
 * @throws When the VaultDelete is malformed.
 */
export function validateVaultDelete(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)
  validateRequiredField(tx, 'VaultID', isString)
}

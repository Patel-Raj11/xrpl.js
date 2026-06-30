import { Amount, MPTAmount } from '../common'

import {
  BaseTransaction,
  isAmount,
  isString,
  validateBaseTransaction,
  validateRequiredField,
} from './common'

/**
 * Deposits a specified number of assets into the Vault in exchange for shares.
 *
 * @category Transaction Models
 */
export interface VaultDeposit extends BaseTransaction {
  TransactionType: 'VaultDeposit'
  /** The ID of the vault to which the assets are deposited. */
  VaultID: string
  /** Asset amount to deposit. */
  Amount: Amount | MPTAmount
}

/**
 * Verify the form and type of a VaultDeposit at runtime.
 *
 * @param tx - A VaultDeposit Transaction.
 * @throws When the VaultDeposit is malformed.
 */
export function validateVaultDeposit(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)
  validateRequiredField(tx, 'VaultID', isString)
  validateRequiredField(tx, 'Amount', isAmount)
}

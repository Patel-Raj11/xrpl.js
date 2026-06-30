import { Amount, MPTAmount } from '../common'

import {
  Account,
  BaseTransaction,
  isAccount,
  isAmount,
  isString,
  validateBaseTransaction,
  validateOptionalField,
  validateRequiredField,
} from './common'

/**
 * Allows the issuer of an IOU or MPT to claw back funds from the vault.
 *
 * @category Transaction Models
 */
export interface VaultClawback extends BaseTransaction {
  TransactionType: 'VaultClawback'
  /** The ID of the vault from which assets are withdrawn. */
  VaultID: string
  /** The account ID from which to clawback the assets. */
  Holder: Account
  /**
   * The asset amount to clawback. When Amount is 0 clawback all funds, up to
   * the total shares the Holder owns.
   */
  Amount?: Amount | MPTAmount
}

/**
 * Verify the form and type of a VaultClawback at runtime.
 *
 * @param tx - A VaultClawback Transaction.
 * @throws When the VaultClawback is malformed.
 */
export function validateVaultClawback(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)
  validateRequiredField(tx, 'VaultID', isString)
  validateRequiredField(tx, 'Holder', isAccount)
  validateOptionalField(tx, 'Amount', isAmount)
}

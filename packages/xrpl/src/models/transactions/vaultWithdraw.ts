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
 * The VaultWithdraw transaction withdraws assets in exchange for the vault's shares.
 *
 * @category Transaction Models
 */
export interface VaultWithdraw extends BaseTransaction {
  TransactionType: 'VaultWithdraw'
  /** The ID of the vault from which assets are withdrawn. */
  VaultID: string
  /** The exact amount of Vault asset to withdraw. */
  Amount: Amount | MPTAmount
  /** An account to receive the assets. It must be able to receive the asset. */
  Destination?: Account
}

/**
 * Verify the form and type of a VaultWithdraw at runtime.
 *
 * @param tx - A VaultWithdraw Transaction.
 * @throws When the VaultWithdraw is malformed.
 */
export function validateVaultWithdraw(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)

  validateRequiredField(tx, 'VaultID', isString)
  validateRequiredField(tx, 'Amount', isAmount)
  validateOptionalField(tx, 'Destination', isAccount)
}

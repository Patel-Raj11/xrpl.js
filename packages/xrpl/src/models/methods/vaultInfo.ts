import { MPTokenIssuance, Vault } from '../ledger'

import { BaseRequest, BaseResponse, LookupByLedgerRequest } from './baseMethod'

/**
 * The `vault_info` method returns a Vault ledger entry together with its
 * associated share issuance. The vault is identified either by its object ID
 * (vault_id), or by the owner/seq pair (the Vault Owner's address and the
 * VaultCreate sequence). Returns a {@link VaultInfoResponse}.
 *
 * @category Requests
 */
export interface VaultInfoRequest extends BaseRequest, LookupByLedgerRequest {
  command: 'vault_info'
  /**
   * Hex object ID of the Vault to return. Mutually exclusive with owner/seq.
   */
  vault_id?: string
  /**
   * Base58 address of the Vault Owner. Provide together with seq as an
   * alternative to vault_id.
   */
  owner?: string
  /**
   * Sequence number of the VaultCreate transaction that created the vault.
   * Provide together with owner.
   */
  seq?: number
}

/**
 * Response expected from a {@link VaultInfoRequest}.
 *
 * @category Responses
 */
export interface VaultInfoResponse extends BaseResponse {
  result: {
    /**
     * The Vault ledger entry, together with its associated share
     * MPTokenIssuance ledger entry.
     */
    vault: Vault & {
      /**
       * The share MPTokenIssuance ledger entry associated with this vault.
       */
      shares: MPTokenIssuance & {
        /**
         * The ID of the share MPTokenIssuance object; always equal to
         * vault.ShareMPTID.
         */
        mpt_issuance_id?: string
      }
    }
    /** Ledger index from which the result was read. */
    ledger_index: number
    /** Hash of the ledger from which the result was read. */
    ledger_hash?: string
    /** True if the result came from a validated ledger. */
    validated?: boolean
  }
}

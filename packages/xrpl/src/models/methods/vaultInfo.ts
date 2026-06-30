import { MPTokenIssuance, Vault } from '../ledger'

import { BaseRequest, BaseResponse, LookupByLedgerRequest } from './baseMethod'

/**
 * This RPC retrieves the Vault ledger entry and the IDs associated with it.
 * Expects a response in the form of a {@link VaultInfoResponse}.
 *
 * @category Requests
 */
export interface VaultInfoRequest extends BaseRequest, LookupByLedgerRequest {
  command: 'vault_info'
  /**
   * Hex object ID of the Vault to look up. Provide either vault_id, or owner
   * together with seq.
   */
  vault_id?: string
  /**
   * Address of the Vault Owner. Use together with seq to identify the Vault
   * when vault_id is not provided.
   */
  owner?: string
  /**
   * Sequence number of the VaultCreate transaction that created the Vault. Use
   * together with owner.
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
    /** Root object representing the vault. */
    vault: Vault & {
      /** Object containing details about issued shares. */
      shares: MPTokenIssuance & {
        mpt_issuance_id?: string
      }
    }
    /** The identifying hash of the ledger version used to generate this response. */
    ledger_hash?: string
    /**
     * The ledger index of the closed ledger version used to generate this
     * response. Present when a closed/validated ledger was queried.
     */
    ledger_index?: number
    /**
     * The ledger index of the current in-progress ledger version used to
     * generate this response. Present when the current (open) ledger was
     * queried — the default when no ledger is specified.
     */
    ledger_current_index?: number
    /** True if this data is from a validated ledger version. */
    validated?: boolean
  }
}

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
    ledger_index: number
    ledger_hash?: string
    validated?: boolean
  }
}

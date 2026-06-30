import { BaseLedgerEntry, HasPreviousTxnID } from './BaseLedgerEntry'

export interface MPTokenIssuance extends BaseLedgerEntry, HasPreviousTxnID {
  LedgerEntryType: 'MPTokenIssuance'
  Flags: number
  Issuer: string
  AssetScale?: number
  MaximumAmount?: string
  OutstandingAmount: string
  TransferFee?: number
  MPTokenMetadata?: string
  OwnerNode?: string
  /**
   * The PermissionedDomain whose credentials gate which accounts may hold this
   * issuance's tokens. Set on a vault's share issuance when the vault is
   * private.
   */
  DomainID?: string
}

import { BaseLedgerEntry, HasPreviousTxnID } from './BaseLedgerEntry'

/**
 * MutableFlags on an MPTokenIssuance. Bits set here declare which
 * capabilities and which fields on this issuance may be modified
 * post-creation via MPTokenIssuanceSet.
 *
 * @category Ledger Entries
 */
export enum MPTokenIssuanceMutableFlags {
  /**
   * When set, the issuer may later enable lsfMPTCanLock on this
   * MPTokenIssuance via MPTokenIssuanceSet. The capability cannot be
   * disabled once enabled.
   */
  lsmfMPTCanEnableCanLock = 0x00000002,
  /**
   * When set, the issuer may later enable lsfMPTRequireAuth on this
   * MPTokenIssuance via MPTokenIssuanceSet. The capability cannot be
   * disabled once enabled.
   */
  lsmfMPTCanEnableRequireAuth = 0x00000004,
  /**
   * When set, the issuer may later enable lsfMPTCanEscrow on this
   * MPTokenIssuance via MPTokenIssuanceSet. The capability cannot be
   * disabled once enabled.
   */
  lsmfMPTCanEnableCanEscrow = 0x00000008,
  /**
   * When set, the issuer may later enable lsfMPTCanTrade on this
   * MPTokenIssuance via MPTokenIssuanceSet. The capability cannot be
   * disabled once enabled.
   */
  lsmfMPTCanEnableCanTrade = 0x00000010,
  /**
   * When set, the issuer may later enable lsfMPTCanTransfer on this
   * MPTokenIssuance via MPTokenIssuanceSet. The capability cannot be
   * disabled once enabled.
   */
  lsmfMPTCanEnableCanTransfer = 0x00000020,
  /**
   * When set, the issuer may later enable lsfMPTCanClawback on this
   * MPTokenIssuance via MPTokenIssuanceSet. The capability cannot be
   * disabled once enabled.
   */
  lsmfMPTCanEnableCanClawback = 0x00000040,
  /**
   * Allows field MPTokenMetadata to be modified.
   */
  lsmfMPTCanMutateMetadata = 0x00010000,
  /**
   * Allows field TransferFee to be modified.
   */
  lsmfMPTCanMutateTransferFee = 0x00020000,
}

export interface MPTokenIssuance extends BaseLedgerEntry, HasPreviousTxnID {
  LedgerEntryType: 'MPTokenIssuance'
  /**
   * A set of flags indicating properties or other options
   * associated with this MPTokenIssuance object.
   */
  Flags: number
  /**
   * The address of the account that controls both the issuance
   * amounts and characteristics of a particular fungible token.
   */
  Issuer: string
  /**
   * A 32-bit unsigned integer that is used to ensure issuances
   * from a given sender may only ever exist once, even if an
   * issuance is later deleted. Whenever a new issuance is
   * created, this value must match the account's current
   * Sequence number.
   */
  Sequence: number
  /**
   * An asset scale is a non-negative integer (0, 1, 2, ...)
   * such that one MPT unit equals 10^(-scale) of a
   * corresponding standard unit.
   */
  AssetScale?: number
  /**
   * An unsigned 64-bit number that specifies the maximum number
   * of MPTs that can be distributed to non-issuing accounts
   * (i.e., minted). The default and maximum value is
   * 0x7FFFFFFFFFFFFFFF.
   */
  MaximumAmount?: string
  /**
   * An unsigned 64-bit number that specifies the sum of all
   * token amounts that have been minted to all token holders.
   * This value is increased whenever an issuer pays MPTs to a
   * non-issuer account, and decreased whenever a non-issuer
   * pays MPTs into the issuing account.
   */
  OutstandingAmount: string
  /**
   * This value specifies the fee, in tenths of a basis point,
   * charged by the issuer for secondary sales of the token, if
   * such sales are allowed at all. Valid values for this field
   * are between 0 and 50,000 inclusive. A value of 1 is
   * equivalent to 1/10 of a basis point or 0.001%, allowing
   * transfer rates between 0% and 50%. A TransferFee of 50,000
   * corresponds to 50%.
   */
  TransferFee?: number
  /**
   * Arbitrary metadata about this issuance, in hex format.
   * The limit for this field is 1024 bytes.
   */
  MPTokenMetadata?: string
  /**
   * Identifies the page in the owner's directory where this
   * item is referenced.
   */
  OwnerNode: string
  /**
   * The total amount of this MPT that is currently locked
   * across all holders via Escrow or PaymentChannel.
   */
  LockedAmount?: string
  /**
   * The PermissionedDomain object ID that gates who may hold
   * this MPT.
   */
  DomainID?: string
  /**
   * Hash256 pointing to the vault pseudo-account's holding for
   * the underlying asset. Present for IOU and MPT-backed
   * vaults. Absent for XRP-backed vaults.
   */
  ReferenceHolding?: string
  /**
   * Bitmask declaring which capability flags (lsfMPTCan*) and which
   * fields (MPTokenMetadata, TransferFee) may be modified after
   * creation. See {@link MPTokenIssuanceMutableFlags} for the bit
   * layout. Absent or 0 means the issuance is fully immutable.
   */
  MutableFlags?: number
}

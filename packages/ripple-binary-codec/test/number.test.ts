import { encode, decode } from '../src'
import { BinaryParser } from '../src/binary'
import { STNumber } from '../src/types/number'

describe('STNumber', function () {
  it('serializes to 12 bytes', function () {
    expect(STNumber.from('1').toBytes().length).toBe(12)
    expect(STNumber.from('0').toBytes().length).toBe(12)
    expect(STNumber.from('-123456.789').toBytes().length).toBe(12)
  })

  it('renders values in canonical string form', function () {
    const cases: Array<[string, string]> = [
      ['0', '0'],
      ['1', '1'],
      ['1000', '1000'],
      ['1000000', '1000000'],
      ['1.5', '1.5'],
      ['-1', '-1'],
      ['-2.25', '-2.25'],
      ['-0.5', '-0.5'],
      ['0.0001', '0.0001'],
      ['123456.789', '123456.789'],
      ['3.141592653589793', '3.141592653589793'],
      // Large magnitudes render in scientific notation.
      ['1000000000000000', '1e15'],
      ['1e15', '1e15'],
      // Mantissa wider than a signed 64-bit integer drops its last digit.
      ['9999999999999999999', '9999999999999999990'],
    ]
    cases.forEach(([input, expected]) => {
      expect(STNumber.from(input).toJSON()).toBe(expected)
    })
  })

  it('can be constructed from number and bigint', function () {
    expect(STNumber.from(1.5).toJSON()).toBe('1.5')
    expect(STNumber.from(1000).toJSON()).toBe('1000')
    expect(STNumber.from(BigInt('1000000000000000')).toJSON()).toBe('1e15')
  })

  it('returns the same object when constructed from an STNumber', function () {
    const number = STNumber.from('42')
    expect(STNumber.from(number)).toBe(number)
  })

  it('round-trips through a BinaryParser', function () {
    const values = [
      '0',
      '1',
      '1000',
      '1.5',
      '-2.25',
      '123456.789',
      '1000000000000000',
      '9999999999999999990',
      '0.0001',
      '-0.5',
      '3.141592653589793',
    ]
    values.forEach((value) => {
      const number = STNumber.from(value)
      const parsed = STNumber.fromParser(new BinaryParser(number.toHex()))
      expect(parsed.toJSON()).toBe(number.toJSON())
    })
  })

  it('serializes zero as mantissa 0 with the minimum exponent', function () {
    expect(STNumber.from('0').toHex()).toBe('0000000000000000FFFF8000')
    expect(STNumber.from('0').toJSON()).toBe('0')
  })

  it('throws when constructed from an invalid string', function () {
    expect(() => STNumber.from('not-a-number')).toThrow()
  })

  it('throws when constructed from an invalid type', function () {
    // @ts-expect-error -- intentionally passing an invalid type
    expect(() => STNumber.from({})).toThrow(
      'Invalid type to construct a Number',
    )
  })
})

describe('Vault ledger entry round-trip', function () {
  const baseVault = {
    LedgerEntryType: 'Vault',
    Flags: 0,
    Sequence: 6,
    OwnerNode: '0000000000000000',
    Owner: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    Account: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
    AssetsTotal: '1000',
    AssetsAvailable: '1000',
    AssetsMaximum: '0',
    LossUnrealized: '0',
    ShareMPTID: '00002403C84A0A28E0190E208E982C352BBD5006600555CF',
    WithdrawalPolicy: 1,
    PreviousTxnID:
      '0000000000000000000000000000000000000000000000000000000000000000',
    PreviousTxnLgrSeq: 0,
  }

  it('encodes and decodes a Vault holding XRP', function () {
    const vault = { ...baseVault, Asset: { currency: 'XRP' } }
    expect(decode(encode(vault))).toEqual(vault)
  })

  it('encodes and decodes a Vault holding an issued currency with fractional Number fields', function () {
    const vault = {
      ...baseVault,
      Asset: { currency: 'USD', issuer: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh' },
      AssetsTotal: '1.5',
      AssetsAvailable: '1.25',
      LossUnrealized: '0.25',
    }
    expect(decode(encode(vault))).toEqual(vault)
  })

  it('encodes a Vault holding an MPT', function () {
    // The shared `Issue` field type cannot auto-detect an MPT asset when
    // decoding a bare field (it needs an explicit 24-byte hint), so this case
    // only asserts the encode direction. The Number fields are still exercised
    // end-to-end by the XRP and issued-currency round-trips above.
    const mptIssuanceId = '00002403C84A0A28E0190E208E982C352BBD5006600555CF'
    const vault = {
      ...baseVault,
      Asset: { mpt_issuance_id: mptIssuanceId },
    }
    const encoded = encode(vault)
    expect(encoded).toContain(mptIssuanceId)
    expect(encode(vault)).toBe(encoded)
  })
})

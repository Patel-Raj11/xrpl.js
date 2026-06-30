import { coreTypes } from '../src/types'
import { STNumber } from '../src/types/st-number'

const { Number: CoreNumber } = coreTypes

describe('STNumber', () => {
  it('is registered in coreTypes as `Number`', () => {
    expect(CoreNumber).toBe(STNumber)
  })

  // Known-answer encodings grounded in rippled's STNumber wire format:
  // int64 mantissa (big-endian) followed by int32 exponent (big-endian),
  // where the canonical zero is mantissa 0 with exponent INT_MIN (0x80000000),
  // and non-zero values normalize the mantissa into the Small scale
  // [10^15, 10^16 - 1]. These hex values are verified byte-for-byte against
  // rippled's serialization of the same Number.
  const knownEncodings: Array<[string, string]> = [
    ['0', '000000000000000080000000'],
    // 10^15 mantissa, exponent -15
    ['1', '00038D7EA4C68000FFFFFFF1'],
    // 10^15 mantissa, exponent -9
    ['1000000', '00038D7EA4C68000FFFFFFF7'],
  ]

  knownEncodings.forEach(([value, hex]) => {
    it(`serializes ${value} to the expected 12-byte hex`, () => {
      expect(STNumber.from(value).toHex()).toBe(hex)
    })
  })

  knownEncodings.forEach(([value, hex]) => {
    it(`deserializes the hex for ${value} back to its canonical string`, () => {
      expect(STNumber.fromParser(makeParser(hex)).toJSON()).toBe(value)
    })
  })

  const roundTripValues = [
    '0',
    '1',
    '7',
    '100',
    '1000000',
    '9999999999999999',
    '100000000000000000',
    '0.5',
    '1.25',
    '-1',
    '-1000000',
  ]

  roundTripValues.forEach((value) => {
    it(`round-trips ${value} through serialize -> parse`, () => {
      const hex = STNumber.from(value).toHex()
      const json = STNumber.fromParser(makeParser(hex)).toJSON()
      // Re-serializing the decoded JSON must reproduce the same bytes.
      expect(STNumber.from(json).toHex()).toBe(hex)
    })
  })

  it('encodes the default-constructed value as canonical zero', () => {
    expect(new STNumber().toHex()).toBe('000000000000000080000000')
    expect(new STNumber().toJSON()).toBe('0')
  })

  it('treats numeric and bigint inputs the same as their string form', () => {
    expect(STNumber.from(1000000).toHex()).toBe(
      STNumber.from('1000000').toHex(),
    )
    expect(STNumber.from(BigInt('1000000')).toHex()).toBe(
      STNumber.from('1000000').toHex(),
    )
  })

  it('rejects unsupported input types', () => {
    // @ts-expect-error -- intentionally passing an invalid type
    expect(() => STNumber.from({})).toThrow()
  })
})

function makeParser(
  hex: string,
): import('../src/serdes/binary-parser').BinaryParser {
  const { BinaryParser } = require('../src/serdes/binary-parser')
  return new BinaryParser(hex)
}

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
  // and non-zero values normalize the mantissa into [10^18, 10^19 - 1].
  const knownEncodings: Array<[string, string]> = [
    ['0', '000000000000000080000000'],
    // 10^18 mantissa, exponent -18
    ['1', '0DE0B6B3A7640000FFFFFFEE'],
    // 10^18 mantissa, exponent -12
    ['1000000', '0DE0B6B3A7640000FFFFFFF4'],
  ]

  it.each(knownEncodings)(
    'serializes %s to the expected 12-byte hex',
    (value, hex) => {
      expect(STNumber.from(value).toHex()).toBe(hex)
    },
  )

  it.each(knownEncodings)(
    'deserializes the hex for %s back to its canonical string',
    (value, hex) => {
      expect(STNumber.fromParser(makeParser(hex)).toJSON()).toBe(value)
    },
  )

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

  it.each(roundTripValues)(
    'round-trips %s through serialize -> parse',
    (value) => {
      const hex = STNumber.from(value).toHex()
      const json = STNumber.fromParser(makeParser(hex)).toJSON()
      // Re-serializing the decoded JSON must reproduce the same bytes.
      expect(STNumber.from(json).toHex()).toBe(hex)
    },
  )

  it('encodes the default-constructed value as canonical zero', () => {
    expect(new STNumber().toHex()).toBe('000000000000000080000000')
    expect(new STNumber().toJSON()).toBe('0')
  })

  it('treats numeric and bigint inputs the same as their string form', () => {
    expect(STNumber.from(1000000).toHex()).toBe(STNumber.from('1000000').toHex())
    expect(STNumber.from(BigInt('1000000')).toHex()).toBe(
      STNumber.from('1000000').toHex(),
    )
  })

  it('rejects unsupported input types', () => {
    // @ts-expect-error -- intentionally passing an invalid type
    expect(() => STNumber.from({})).toThrow()
  })
})

function makeParser(hex: string): import('../src/serdes/binary-parser').BinaryParser {
  // eslint-disable-next-line @typescript-eslint/no-var-requires -- test helper
  const { BinaryParser } = require('../src/serdes/binary-parser')
  return new BinaryParser(hex)
}

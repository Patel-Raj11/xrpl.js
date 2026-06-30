import { BinaryParser } from '../serdes/binary-parser'

import { SerializedType } from './serialized-type'

/**
 * STNumber (type code 9) wire format: a signed 64-bit mantissa followed by a
 * signed 32-bit exponent, both big-endian (12 bytes total). The value is
 * `mantissa * 10^exponent`. This mirrors rippled's `STNumber::add` /
 * `STNumber(SerialIter&)`.
 */
const WIDTH = 12

const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)
const FIVE = BigInt(5)
const TEN = BigInt(10)

// Normalized mantissa range for the "Small" scale that rippled uses for the
// STNumber wire format (rippled's MantissaRange::MantissaScale::Small):
// [10^15, 10^16 - 1], with mantissaLog 15. rippled's "Large" scale
// ([10^18, 10^19 - 1]) is only used for internal arithmetic precision;
// serialized STNumber values are always normalized to the Small scale.
// See rippled basics/Number.{h,cpp}.
const MIN_MANTISSA = BigInt('1000000000000000')
const MAX_MANTISSA = BigInt('9999999999999999')
const MIN_EXPONENT = -32768
const MAX_EXPONENT = 32768
// rippled encodes canonical zero as mantissa 0 with this exponent: a
// default-constructed Number has exponent_ = std::numeric_limits<int>::lowest().
const ZERO_EXPONENT = -2147483648
// rippled Number::mantissaLog() for the serialized (Small) scale.
const RANGE_LOG = 15

const NUMBER_REGEX =
  /^(?<sign>[-+]?)(?<int>\d+)(?:\.(?<fraction>\d+))?(?:[eE](?<exp>[-+]?\d+))?$/u

interface NumberParts {
  negative: boolean
  mantissa: bigint
  exponent: number
}

/**
 * Parse a decimal/scientific string into its sign, integer mantissa, and
 * exponent, following rippled's `partsFromString`.
 *
 * @param value - The number as a string (integer, decimal, or scientific).
 * @returns The parsed sign, mantissa, and exponent.
 * @throws Error if the string is not a valid Number.
 */
function partsFromString(value: string): NumberParts {
  const groups = NUMBER_REGEX.exec(value.trim())?.groups
  if (groups == null) {
    throw new Error(`${value} is not a valid Number`)
  }
  const negative = groups.sign === '-'
  const fraction = groups.fraction ?? ''
  const expPart = groups.exp === undefined ? 0 : Number(groups.exp)
  const mantissa = BigInt(groups.int + fraction)
  const exponent = expPart - fraction.length
  return { negative, mantissa, exponent }
}

/**
 * Drop the least-significant digit of `mantissa`, rounding half-to-even
 * (rippled's default ToNearest rounding mode).
 *
 * @param mantissa - The mantissa to shorten by one digit.
 * @returns The rounded quotient.
 */
function roundDropDigit(mantissa: bigint): bigint {
  const remainder = mantissa % TEN
  const quotient = mantissa / TEN
  const roundUp =
    remainder > FIVE || (remainder === FIVE && quotient % TWO === ONE)
  return roundUp ? quotient + ONE : quotient
}

/**
 * Normalize a value to rippled's serialized "Small" mantissa range
 * [10^15, 10^16 - 1], or `{ mantissa: 0 }` for zero / underflow.
 *
 * @param parts - The sign, mantissa, and exponent to normalize.
 * @returns The normalized sign, mantissa, and exponent.
 * @throws Error if the value overflows the representable range.
 */
function normalizeToInternal(parts: NumberParts): NumberParts {
  let mantissa = parts.mantissa
  let exponent = parts.exponent
  const { negative } = parts
  if (mantissa === ZERO) {
    return { mantissa: ZERO, exponent: 0, negative: false }
  }
  while (mantissa < MIN_MANTISSA && exponent > MIN_EXPONENT) {
    mantissa *= TEN
    exponent -= 1
  }
  while (mantissa > MAX_MANTISSA) {
    if (exponent >= MAX_EXPONENT) {
      throw new Error('Number overflow during normalization')
    }
    mantissa = roundDropDigit(mantissa)
    exponent += 1
  }
  if (exponent < MIN_EXPONENT || mantissa < MIN_MANTISSA) {
    return { mantissa: ZERO, exponent: 0, negative: false }
  }
  return { mantissa, exponent, negative }
}

/**
 * Render a value in scientific notation, trimming trailing zeros from the
 * mantissa (rippled's `to_string` for out-of-window exponents).
 *
 * @param sign - The leading sign ('' or '-').
 * @param mantissa - The unsigned mantissa.
 * @param exponent - The exponent.
 * @returns The scientific-notation string.
 */
function toScientific(
  sign: string,
  mantissa: bigint,
  exponent: number,
): string {
  let m = mantissa
  let e = exponent
  while (m % TEN === ZERO && e < MAX_EXPONENT) {
    m /= TEN
    e += 1
  }
  return `${sign}${m.toString()}e${e.toString()}`
}

/**
 * Render an internal normalized (mantissa, exponent) pair to rippled's
 * canonical `to_string` form.
 *
 * @param mantissa - The unsigned normalized mantissa.
 * @param exponent - The normalized exponent.
 * @param negative - Whether the value is negative.
 * @returns The canonical string representation.
 */
function internalToString(
  mantissa: bigint,
  exponent: number,
  negative: boolean,
): string {
  if (mantissa === ZERO) {
    return '0'
  }
  const sign = negative ? '-' : ''
  // Scientific notation for exponents that fall outside the decimal window.
  if (
    exponent !== 0 &&
    (exponent < -(RANGE_LOG + 10) || exponent > -(RANGE_LOG - 10))
  ) {
    return toScientific(sign, mantissa, exponent)
  }
  const digits = mantissa.toString()
  const pointPos = digits.length + exponent
  let intPart: string
  let fracPart: string
  if (pointPos <= 0) {
    intPart = '0'
    fracPart = '0'.repeat(-pointPos) + digits
  } else if (pointPos >= digits.length) {
    intPart = digits + '0'.repeat(pointPos - digits.length)
    fracPart = ''
  } else {
    intPart = digits.slice(0, pointPos)
    fracPart = digits.slice(pointPos)
  }
  intPart = intPart.replace(/^0+(?=\d)/u, '')
  fracPart = fracPart.replace(/0+$/u, '')
  return fracPart.length > 0
    ? `${sign}${intPart}.${fracPart}`
    : `${sign}${intPart}`
}

/**
 * Class for serializing and deserializing the STNumber (Number) type.
 */
class STNumber extends SerializedType {
  constructor(bytes?: Uint8Array) {
    super(bytes ?? STNumber.encode(ZERO, ZERO_EXPONENT))
  }

  /**
   * Encode a signed mantissa and exponent into the 12-byte wire format.
   *
   * @param mantissa - The signed 64-bit mantissa.
   * @param exponent - The signed 32-bit exponent.
   * @returns The 12-byte big-endian representation.
   */
  static encode(mantissa: bigint, exponent: number): Uint8Array {
    const bytes = new Uint8Array(WIDTH)
    const view = new DataView(bytes.buffer)
    view.setBigInt64(0, mantissa, false)
    view.setInt32(8, exponent, false)
    return bytes
  }

  /**
   * Construct a Number from a string, number, bigint, or Number object.
   *
   * @param value - The value to construct a Number from.
   * @returns A Number object.
   * @throws Error if the value is not a supported type.
   */
  static from<T extends STNumber | string | number | bigint>(
    value: T,
  ): STNumber {
    if (value instanceof STNumber) {
      return value
    }
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'bigint'
    ) {
      throw new Error('Invalid type to construct a Number')
    }
    const parts = partsFromString(value.toString())
    const normalized = normalizeToInternal(parts)
    if (normalized.mantissa === ZERO) {
      // rippled serializes the default Number as mantissa 0 with the lowest int.
      return new STNumber(STNumber.encode(ZERO, ZERO_EXPONENT))
    }
    // The Small-scale mantissa (<= 10^16 - 1) always fits in a signed 64-bit
    // integer, so it can be serialized directly.
    const signed = normalized.negative
      ? -normalized.mantissa
      : normalized.mantissa
    return new STNumber(STNumber.encode(signed, normalized.exponent))
  }

  /**
   * Read a Number from a BinaryParser.
   *
   * @param parser - BinaryParser to read the Number from.
   * @returns A Number object.
   */
  static fromParser(parser: BinaryParser): STNumber {
    return new STNumber(parser.read(WIDTH))
  }

  /**
   * Get the JSON representation of this Number.
   *
   * @returns The canonical string representation of the value.
   */
  toJSON(): string {
    const view = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset,
      this.bytes.byteLength,
    )
    const mantissa = view.getBigInt64(0, false)
    const exponent = view.getInt32(8, false)
    if (mantissa === ZERO) {
      return '0'
    }
    const negative = mantissa < ZERO
    const normalized = normalizeToInternal({
      negative,
      mantissa: negative ? -mantissa : mantissa,
      exponent,
    })
    return internalToString(
      normalized.mantissa,
      normalized.exponent,
      normalized.negative,
    )
  }
}

export { STNumber }

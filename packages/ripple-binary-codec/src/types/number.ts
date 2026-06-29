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

// Normalized mantissa range for the "large" scale used by SingleAssetVault /
// LendingProtocol (rippled `MantissaRange`): [10^18, 10^19 - 1].
const MIN_MANTISSA = BigInt('1000000000000000000')
const MAX_MANTISSA = BigInt('9999999999999999999')
// Largest magnitude representable in a signed 64-bit mantissa (2^63 - 1).
const MAX_REP = BigInt('9223372036854775807')
const MIN_EXPONENT = -32768
const MAX_EXPONENT = 32768

// rippled `Number::mantissaLog()` for the large scale.
const RANGE_LOG = 18

const NUMBER_REGEX =
  /^(?<sign>[-+]?)(?<int>\d+)(?:\.(?<fraction>\d+))?(?:[eE](?<exp>[-+]?\d+))?$/u

interface NumberParts {
  negative: boolean
  // Unsigned integer mantissa: value = (negative ? -1 : 1) * mantissa * 10^exponent.
  mantissa: bigint
  exponent: number
}

/**
 * Parse a decimal/scientific string into its sign, integer mantissa, and
 * exponent, following rippled's `partsFromString`.
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
 */
function roundDropDigit(mantissa: bigint): bigint {
  const remainder = mantissa % TEN
  const quotient = mantissa / TEN
  const roundUp =
    remainder > FIVE || (remainder === FIVE && quotient % TWO === ONE)
  return roundUp ? quotient + ONE : quotient
}

/**
 * Normalize a value to rippled's internal "large" mantissa range
 * [10^18, 10^19 - 1]. Returns the normalized (mantissa, exponent) where the
 * mantissa is the unsigned integer in range, or `{ mantissa: 0 }` for zero.
 */
function normalizeToInternal(parts: NumberParts): {
  mantissa: bigint
  exponent: number
  negative: boolean
} {
  let mantissa = parts.mantissa
  let exponent = parts.exponent
  let { negative } = parts

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

  intPart = intPart.replace(/^0+(?=\d)/, '')
  fracPart = fracPart.replace(/0+$/, '')

  return fracPart.length > 0
    ? `${sign}${intPart}.${fracPart}`
    : `${sign}${intPart}`
}

/**
 * Class for serializing and deserializing the STNumber (Number) type.
 */
class STNumber extends SerializedType {
  static readonly ZERO_NUMBER: STNumber = new STNumber(
    STNumber.encode(ZERO, MIN_EXPONENT),
  )

  constructor(bytes?: Uint8Array) {
    super(bytes ?? STNumber.ZERO_NUMBER.bytes)
  }

  private static encode(mantissa: bigint, exponent: number): Uint8Array {
    const bytes = new Uint8Array(WIDTH)
    const view = new DataView(bytes.buffer)
    view.setBigInt64(0, mantissa, false)
    view.setInt32(8, exponent, false)
    return bytes
  }

  /**
   * Construct a Number from a string, number, bigint, or Number object.
   *
   * @param value The value to construct a Number from.
   * @returns A Number object.
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
      // rippled serializes the default Number as mantissa 0 with the minimum
      // exponent.
      return new STNumber(STNumber.encode(ZERO, MIN_EXPONENT))
    }

    let mantissa = normalized.mantissa
    let exponent = normalized.exponent

    // External view: the wire mantissa must fit in a signed 64-bit integer, so
    // drop a trailing digit when the internal mantissa exceeds 2^63 - 1.
    if (mantissa > MAX_REP) {
      mantissa /= TEN
      exponent += 1
    }

    const signed = normalized.negative ? -mantissa : mantissa
    return new STNumber(STNumber.encode(signed, exponent))
  }

  /**
   * Read a Number from a BinaryParser.
   *
   * @param parser BinaryParser to read the Number from.
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

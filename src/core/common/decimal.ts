import { Decimal } from 'decimal.js';

// Configure Decimal.js precision for scientific rigor
Decimal.set({
  precision: 34, // IEEE 754 decimal128 standard
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 34,
});

export type DecimalValue = Decimal | string | number;

/**
 * Ensures a value is converted to a precise Decimal object.
 * Native JavaScript binary floating-point calculations must never
 * be used for critical scientific results per ADR-002.
 */
export function toDecimal(value: DecimalValue): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value);
}

/**
 * Exact decimal addition: a + b
 */
export function decimalAdd(a: DecimalValue, b: DecimalValue): Decimal {
  return toDecimal(a).plus(toDecimal(b));
}

/**
 * Exact decimal subtraction: a - b
 */
export function decimalSubtract(a: DecimalValue, b: DecimalValue): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

/**
 * Exact decimal multiplication: a * b
 */
export function decimalMultiply(a: DecimalValue, b: DecimalValue): Decimal {
  return toDecimal(a).times(toDecimal(b));
}

/**
 * Exact decimal division: a / b
 */
export function decimalDivide(a: DecimalValue, b: DecimalValue): Decimal {
  const divisor = toDecimal(b);
  if (divisor.isZero()) {
    throw new Error('Division by zero is not permitted in scientific calculations');
  }
  return toDecimal(a).dividedBy(divisor);
}

/**
 * Compares two decimal values for exact equality.
 */
export function decimalEquals(a: DecimalValue, b: DecimalValue): boolean {
  return toDecimal(a).equals(toDecimal(b));
}

export { Decimal };

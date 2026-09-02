import { describe, it, expect } from 'vitest';
import {
  toDecimal,
  decimalAdd,
  decimalSubtract,
  decimalMultiply,
  decimalDivide,
  decimalEquals,
} from '@/core/common/decimal';

describe('Scientific Decimal Precision Utility (ADR-002)', () => {
  it('should eliminate standard JavaScript binary floating-point drift', () => {
    // In native JS: 0.1 + 0.2 === 0.30000000000000004 (FAIL!)
    const jsNativeResult = 0.1 + 0.2;
    expect(jsNativeResult).not.toBe(0.3);

    // In LabOS Decimal: exact 0.3
    const scientificResult = decimalAdd('0.1', '0.2');
    expect(scientificResult.toString()).toBe('0.3');
    expect(decimalEquals(scientificResult, '0.3')).toBe(true);
  });

  it('should accurately subtract exact decimal quantities', () => {
    const result = decimalSubtract('1.000000005', '0.000000003');
    expect(result.toString()).toBe('1.000000002');
  });

  it('should accurately multiply scientific values without precision loss', () => {
    const result = decimalMultiply('12345.6789', '0.0001');
    expect(result.toString()).toBe('1.23456789');
  });

  it('should accurately divide decimal values to high precision', () => {
    const result = decimalDivide('1', '3');
    expect(result.toString().startsWith('0.33333333333333333333')).toBe(true);
  });

  it('should throw an explicit error on division by zero', () => {
    expect(() => decimalDivide('10.5', '0')).toThrowError(/Division by zero/);
  });

  it('should correctly evaluate decimal equality across string and Decimal inputs', () => {
    const d1 = toDecimal('42.0000000');
    expect(decimalEquals(d1, '42')).toBe(true);
    expect(decimalEquals(d1, 42)).toBe(true);
  });
});

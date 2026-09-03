import { describe, it, expect } from 'vitest';
import { canonicalJson } from '../../src/platform/audit/canonical-json';

describe('canonicalJson', () => {
  it('sorts object keys lexicographically', () => {
    const obj1 = { z: 1, a: 2, m: 3 };
    const obj2 = { a: 2, m: 3, z: 1 };
    expect(canonicalJson(obj1)).toBe('{"a":2,"m":3,"z":1}');
    expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
  });

  it('recursively sorts nested objects', () => {
    const nested1 = {
      user: { name: 'Alice', age: 30 },
      action: 'UPDATE',
    };
    const nested2 = {
      action: 'UPDATE',
      user: { age: 30, name: 'Alice' },
    };
    expect(canonicalJson(nested1)).toBe(
      '{"action":"UPDATE","user":{"age":30,"name":"Alice"}}',
    );
    expect(canonicalJson(nested1)).toBe(canonicalJson(nested2));
  });

  it('preserves array element ordering while canonically formatting inner elements', () => {
    const arr = [{ b: 1, a: 2 }, { d: 4, c: 3 }];
    expect(canonicalJson(arr)).toBe('[{"a":2,"b":1},{"c":3,"d":4}]');
  });

  it('handles null and primitive values', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson('hello')).toBe('"hello"');
    expect(canonicalJson(123.45)).toBe('123.45');
    expect(canonicalJson(true)).toBe('true');
  });
});

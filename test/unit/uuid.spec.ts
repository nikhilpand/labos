import { describe, it, expect } from 'vitest';
import { generateUuidV7, isValidUuid } from '@/core/common/uuid';

describe('UUIDv7 Utility (ADR-003)', () => {
  it('should generate valid UUIDv7 identifiers', () => {
    const id = generateUuidV7();
    expect(typeof id).toBe('string');
    expect(isValidUuid(id)).toBe(true);
    // UUIDv7 has version digit '7' at character 14 (8-4-4-4-12 format)
    expect(id.charAt(14)).toBe('7');
  });

  it('should generate time-ordered identifiers', async () => {
    const id1 = generateUuidV7();
    // Tiny delay to ensure subsequent millisecond tick
    await new Promise((resolve) => setTimeout(resolve, 5));
    const id2 = generateUuidV7();

    expect(id1 < id2).toBe(true);
  });

  it('should correctly reject malformed UUIDs', () => {
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('12345')).toBe(false);
    expect(isValidUuid('')).toBe(false);
  });
});

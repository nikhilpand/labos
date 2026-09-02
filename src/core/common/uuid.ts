import { uuidv7 } from 'uuidv7';

/**
 * Generates a time-ordered UUIDv7 string.
 * Per ADR-003, all primary domain entities must use UUIDv7
 * for stable, collision-free, index-friendly identification.
 */
export function generateUuidV7(): string {
  return uuidv7();
}

/**
 * Validates whether a given string is a valid UUID format (v4 or v7).
 */
export function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

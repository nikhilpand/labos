/**
 * Serializes an object or primitive into a canonical, deterministic JSON string.
 * Recursively sorts all object keys in lexicographical order.
 * Ensures consistent, reproducible SHA-256 cryptographic hashing per ADR-005.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalJson(item));
    return `[${items.join(',')}]`;
  }

  // Object: sort keys lexicographically
  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const pairs = sortedKeys
    .filter((k) => record[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`);

  return `{${pairs.join(',')}}`;
}

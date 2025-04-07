// src/hashGenerator.ts
import crypto from 'crypto';

/**
 * Generates a SHA256 hash for the given string.
 * @param data - The contract code as a string.
 * @returns The SHA256 hash in hexadecimal format.
 */
export function generateHash(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

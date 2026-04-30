// Server-only field-level encryption helpers using Postgres pgcrypto.
// Pattern: same shape as earns-assets — pgp_sym_encrypt(plain, MOS2_SECRET_KEY).
//
// Why pgcrypto > app-layer (libsodium): keys never leave server env,
// SQL ad-hoc decrypt available cho audit, và DB dump không lộ plaintext.
//
// LOSING MOS2_SECRET_KEY = LOSING DATA. Backup mandatory in 2+ places.
// Memory: reference_earns_secret_key.md mô tả pattern earns-assets.

import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

function getKey(): string {
  const k = process.env.MOS2_SECRET_KEY;
  if (!k || k.length < 32) {
    throw new Error('MOS2_SECRET_KEY chưa set hoặc quá ngắn (cần ≥ 32 char base64).');
  }
  return k;
}

export function cryptoEnabled(): boolean {
  return Boolean(process.env.MOS2_SECRET_KEY && process.env.MOS2_SECRET_KEY.length >= 32);
}

// Encrypt plaintext → base64 ciphertext (pgp_sym_encrypt → base64 wrapper).
// Returns null if input empty.
export async function encryptValue(plaintext: string): Promise<string | null> {
  if (!plaintext) return null;
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not set');
  const key = getKey();
  const rows = await db.execute(
    sql`SELECT encode(pgp_sym_encrypt(${plaintext}, ${key}), 'base64') AS enc`,
  );
  // drizzle returns array of objects; first row.enc
  const first = (rows as unknown as Array<{ enc: string }>)[0];
  return first?.enc ?? null;
}

// Decrypt base64 ciphertext → plaintext. Returns empty string if input is empty/null.
export async function decryptValue(ciphertext: string | null | undefined): Promise<string> {
  if (!ciphertext) return '';
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not set');
  const key = getKey();
  const rows = await db.execute(
    sql`SELECT pgp_sym_decrypt(decode(${ciphertext}, 'base64'), ${key}) AS plain`,
  );
  const first = (rows as unknown as Array<{ plain: string }>)[0];
  return first?.plain ?? '';
}

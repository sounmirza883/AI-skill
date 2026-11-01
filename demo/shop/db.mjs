import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const argon = promisify(crypto.argon2);
// OWASP minimum for Argon2id: 19 MiB memory, 2 iterations, 1 lane.
const P = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };

export function openDb(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS products(
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
      price_cents INTEGER NOT NULL CHECK(price_cents > 0), stock INTEGER NOT NULL CHECK(stock >= 0));
    CREATE TABLE IF NOT EXISTS cart_items(
      user_id INTEGER NOT NULL REFERENCES users(id), product_id TEXT NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL CHECK(qty BETWEEN 1 AND 20), PRIMARY KEY(user_id, product_id));
    CREATE TABLE IF NOT EXISTS orders(
      id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), idempotency_key TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','paid','failed')), total_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL, UNIQUE(user_id, idempotency_key));
    CREATE INDEX IF NOT EXISTS orders_user_created ON orders(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS order_items(
      order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL, name TEXT NOT NULL,
      unit_cents INTEGER NOT NULL, qty INTEGER NOT NULL, PRIMARY KEY(order_id, product_id));
    CREATE TABLE IF NOT EXISTS payments(
      order_id TEXT PRIMARY KEY REFERENCES orders(id), amount_cents INTEGER NOT NULL, ref TEXT NOT NULL);
  `);
  return db;
}

// Stored as argon2id$memory$passes$salt$tag so parameters can be raised later and old hashes still verify.
export async function hashPassword(pw) {
  const nonce = crypto.randomBytes(16);
  const tag = await argon('argon2id', { message: pw, nonce, ...P });
  return ['argon2id', P.memory, P.passes, nonce.toString('base64'), tag.toString('base64')].join('$');
}

export async function verifyPassword(pw, stored) {
  const [alg, memory, passes, salt, tag] = stored.split('$');
  if (alg !== 'argon2id') return false;
  const expected = Buffer.from(tag, 'base64');
  const got = await argon('argon2id', {
    message: pw, nonce: Buffer.from(salt, 'base64'), ...P, memory: Number(memory), passes: Number(passes), tagLength: expected.length,
  });
  return crypto.timingSafeEqual(got, expected);
}

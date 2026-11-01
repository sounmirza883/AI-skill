// Resets the database to known test data. Usage: DB_PATH=./shop.db node seed.mjs
// Test accounts only: alice@example.test / bob@example.test (passwords below are for local demos, never for real users).
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { openDb, hashPassword } from './db.mjs';

export const TEST_USERS = [
  { email: 'alice@example.test', name: 'Alice', password: 'alice-demo-password-1' },
  { email: 'bob@example.test', name: 'Bob', password: 'bob-demo-password-1' },
];
const PRODUCTS = [
  ['mug', 'Ceramic mug', 'Hand-glazed, holds 350 ml.', 1200, 50],
  ['tee', 'Cotton tee', 'Heavyweight organic cotton.', 2500, 50],
  ['cap', 'Canvas cap', 'Adjustable, washed canvas.', 1800, 50],
  ['bottle', 'Steel bottle', 'Keeps drinks cold for 24 h.', 2200, 50],
  ['notebook', 'Dot-grid notebook', '120 pages, lay-flat binding.', 900, 50],
  ['poster', 'Art poster', 'A2, matte archival paper.', 1500, 50],
  ['limited-print', 'Limited print (1 left)', 'Signed print. Only one exists.', 9900, 1],
];

export async function seed(dbPath) {
  const db = openDb(dbPath);
  for (const t of ['payments', 'order_items', 'orders', 'cart_items', 'sessions', 'products', 'users']) db.exec(`DELETE FROM ${t}`);
  const addUser = db.prepare('INSERT INTO users(email, name, password_hash) VALUES (?, ?, ?)');
  for (const u of TEST_USERS) addUser.run(u.email, u.name, await hashPassword(u.password));
  const addProduct = db.prepare('INSERT INTO products(id, name, description, price_cents, stock) VALUES (?, ?, ?, ?, ?)');
  for (const p of PRODUCTS) addProduct.run(...p);
  db.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.env.DB_PATH || join(fileURLToPath(new URL('.', import.meta.url)), 'shop.db');
  await seed(path);
  console.log(`Seeded ${path}: ${TEST_USERS.length} users, ${PRODUCTS.length} products`);
}

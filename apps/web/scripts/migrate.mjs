// Applies SQL files in migrations/ in filename order, tracking what has run
// in a _migrations table. Usage: DATABASE_URL=... node scripts/migrate.mjs
//
// Note: the Neon HTTP driver executes one statement per call, so files are
// split on statement-terminating semicolons. Keep migrations to plain
// statements (no function bodies containing semicolons).
import { neon } from '@neondatabase/serverless';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

function splitStatements(text) {
  return text
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.split('\n').every((line) => line.trim().startsWith('--')));
}

await sql`CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const applied = new Set((await sql`SELECT name FROM _migrations`).map((r) => r.name));
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

for (const file of files) {
  if (applied.has(file)) continue;
  console.log(`Applying ${file}…`);
  const text = await readFile(path.join(dir, file), 'utf8');
  for (const statement of splitStatements(text)) {
    await sql.query(statement);
  }
  await sql`INSERT INTO _migrations (name) VALUES (${file})`;
}

console.log('Migrations up to date.');

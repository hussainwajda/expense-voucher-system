import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';

type Queryable = Pick<pg.Client | pg.PoolClient, 'query'>;

// Arbitrary constant: serialises concurrent migration runs.
const MIGRATION_LOCK_ID = 727_001;

/**
 * Minimal forward-only migration runner. Applies every `*.sql` file in `dir`
 * (sorted by name) that isn't recorded in `schema_migrations`, each in its own transaction.
 */
export async function runMigrations(db: Queryable, dir: string, log: (msg: string) => void = console.log) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  await db.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const { rows } = await db.query<{ version: string }>('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version));

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      try {
        await db.query('BEGIN');
        await db.query(sql);
        await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await db.query('COMMIT');
      } catch (err) {
        await db.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`, { cause: err });
      }
      log(`  applied ${file}`);
      count++;
    }
    log(count === 0 ? 'Database schema is up to date.' : `Applied ${count} migration(s).`);
  } finally {
    await db.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
  }
}

/** Drops everything in the public schema. Used by `db:reset` and the test suite. */
export async function resetSchema(db: Queryable) {
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

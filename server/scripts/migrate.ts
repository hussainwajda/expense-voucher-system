/**
 * Apply pending SQL migrations from db/migrations.
 *   npm run db:migrate            apply anything new
 *   npm run db:migrate -- --reset drop everything first (development only!)
 */
import pg from 'pg';
import { resetSchema, runMigrations } from '../src/db/migrator.js';
import { MIGRATIONS_DIR } from '../src/paths.js';
import { requireDatabaseUrl } from './lib/script-env.js';

const client = new pg.Client({ connectionString: requireDatabaseUrl() });

try {
  await client.connect();
  if (process.argv.includes('--reset')) {
    if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset the database in production.');
    console.log('Dropping all tables...');
    await resetSchema(client);
  }
  await runMigrations(client, MIGRATIONS_DIR);
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}

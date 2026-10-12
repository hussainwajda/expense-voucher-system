/**
 * Load demo data (departments, categories, users, vouchers in every status).
 *   npm run db:seed             only if the database has no users yet
 *   npm run db:seed -- --force  wipe existing data and reseed
 */
import pg from 'pg';
import { clearData, hasUsers, seedDemoData } from './lib/seed-data.js';
import { requireDatabaseUrl, scriptEnv } from './lib/script-env.js';

const client = new pg.Client({ connectionString: requireDatabaseUrl() });
const force = process.argv.includes('--force');

try {
  await client.connect();
  if (await hasUsers(client)) {
    if (!force) {
      console.log('Database already has users; skipping seed. Use `npm run db:seed -- --force` to wipe and reseed.');
      process.exit(0);
    }
    if (process.env.NODE_ENV === 'production') throw new Error('Refusing to wipe data in production.');
  }
  await client.query('BEGIN');
  await clearData(client, scriptEnv.uploadDir);
  await seedDemoData(client, scriptEnv);
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}

/**
 * Zero-install PostgreSQL for local development.
 *
 * Starts a real PostgreSQL server from the `embedded-postgres` npm package (no Docker,
 * no Homebrew), keeps its data in server/.pgdata, applies migrations and seeds demo
 * data on first run. Leave it running in its own terminal; Ctrl+C stops it.
 */
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { runMigrations } from '../src/db/migrator.js';
import { MIGRATIONS_DIR, SERVER_ROOT } from '../src/paths.js';
import { hasUsers, seedDemoData } from './lib/seed-data.js';
import { scriptEnv } from './lib/script-env.js';

const DATABASE = 'evms';
const dataDir = path.join(SERVER_ROOT, '.pgdata');
const port = scriptEnv.localPgPort;

const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  port,
  user: 'postgres',
  password: 'postgres',
  persistent: true,
  onLog: () => {},
  onError: (err) => console.error(String(err).trim()),
});

if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
  console.log('Initialising a new PostgreSQL data directory in server/.pgdata ...');
  await postgres.initialise();
}

try {
  await postgres.start();
} catch (err) {
  console.error(`Could not start PostgreSQL on port ${port}. Is another instance already running? (${(err as Error).message})`);
  process.exit(1);
}

try {
  await postgres.createDatabase(DATABASE);
} catch (err) {
  if (!/already exists/i.test(String((err as Error).message))) throw err;
}

const client = postgres.getPgClient(DATABASE, 'localhost');
await client.connect();
await runMigrations(client, MIGRATIONS_DIR);
if (!(await hasUsers(client))) {
  console.log('Empty database, loading demo data...');
  await client.query('BEGIN');
  await seedDemoData(client, scriptEnv);
  await client.query('COMMIT');
}
await client.end();

console.log(`\nPostgreSQL is running: postgresql://postgres:postgres@localhost:${port}/${DATABASE}`);
console.log('Leave this terminal open and start the app in another one (npm run dev). Ctrl+C to stop.\n');

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  console.log('\nStopping PostgreSQL...');
  await postgres.stop().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30); // keep the process alive

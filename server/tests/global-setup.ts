import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { resetSchema, runMigrations } from '../src/db/migrator.js';
import { MIGRATIONS_DIR } from '../src/paths.js';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    uploadDir: string;
  }
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/**
 * By default the suite runs against a temporary embedded PostgreSQL that is thrown away afterwards.
 * Set TEST_DATABASE_URL to use an existing (disposable!) database instead: its schema is dropped and recreated.
 */
export default async function setup(project: TestProject) {
  let databaseUrl = process.env.TEST_DATABASE_URL;
  let stopDatabase = async () => {};

  if (!databaseUrl) {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evms-test-pg-'));
    const port = await findFreePort();
    const instance = new EmbeddedPostgres({
      databaseDir: dataDir,
      port,
      user: 'postgres',
      password: 'postgres',
      persistent: false,
      onLog: () => {},
    });
    await instance.initialise();
    await instance.start();
    await instance.createDatabase('evms_test');
    databaseUrl = `postgresql://postgres:postgres@localhost:${port}/evms_test`;
    stopDatabase = async () => {
      await instance.stop();
      await fs.rm(dataDir, { recursive: true, force: true });
    };
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await resetSchema(client);
  await runMigrations(client, MIGRATIONS_DIR, () => {});
  await client.end();

  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evms-test-uploads-'));
  project.provide('databaseUrl', databaseUrl);
  project.provide('uploadDir', uploadDir);

  return async () => {
    await stopDatabase();
    await fs.rm(uploadDir, { recursive: true, force: true });
  };
}

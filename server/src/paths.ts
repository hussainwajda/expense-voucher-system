import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Walk up from this file until we find the server's package.json (works from src/ and dist/src/). */
function findServerRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Could not locate the server package root');
    dir = parent;
  }
  return dir;
}

export const SERVER_ROOT = findServerRoot();
export const MIGRATIONS_DIR = path.join(SERVER_ROOT, 'db', 'migrations');
export const CLIENT_DIST_DIR = path.resolve(SERVER_ROOT, '..', 'client', 'dist');

/** Resolve a configured path relative to the server root (absolute paths pass through). */
export function resolveFromServerRoot(p: string): string {
  return path.resolve(SERVER_ROOT, p);
}

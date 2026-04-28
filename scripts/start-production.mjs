#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const candidates = [
  join(root, 'server.js'),
  join(root, '.next', 'standalone', 'server.js'),
];

let started = false;
for (const file of candidates) {
  if (existsSync(file)) {
    await import(pathToFileURL(file).href);
    started = true;
    break;
  }
}

if (!started) {
  console.warn(
    '[START_FALLBACK] Standalone server not found. Falling back to `next start`; verify that `npm run build` completed in the deploy environment.'
  );

  const nextBin = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  const result = spawnSync(process.execPath, [nextBin, 'start'], {
    stdio: 'inherit',
    env: process.env,
  });

  process.exit(result.status ?? 1);
}

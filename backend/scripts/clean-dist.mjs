#!/usr/bin/env node

import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(backendRoot, 'dist');

if (dirname(distRoot) !== backendRoot) {
  throw new Error('Refusing to clean an unexpected build path');
}

rmSync(distRoot, { recursive: true, force: true });

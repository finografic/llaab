import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOADED_FLAG = 'LLAAB_MONOREPO_ENV_LOADED';

function parseEnvLine(line: string): { key: string; value: string } | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return undefined;
  }

  const separator = trimmed.indexOf('=');
  if (separator <= 0) {
    return undefined;
  }

  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function findMonorepoEnvPath(): string | undefined {
  const candidates = new Set<string>([process.cwd()]);

  if (typeof import.meta.url === 'string') {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let depth = 0; depth < 8; depth++) {
      candidates.add(dir);
      const parent = dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }

  for (const start of candidates) {
    let dir = start;
    for (let depth = 0; depth < 8; depth++) {
      const envPath = resolve(dir, '.env');
      if (existsSync(envPath)) {
        return envPath;
      }
      const parent = dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }

  return undefined;
}

/** Load repo-root `.env` into `process.env` when not already injected by the host process. */
export function loadMonorepoEnv(): void {
  if (process.env[LOADED_FLAG] === '1') {
    return;
  }

  const envPath = findMonorepoEnvPath();
  if (!envPath) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    const current = process.env[parsed.key];
    if (current === undefined || current.trim() === '') {
      process.env[parsed.key] = parsed.value;
    }
  }

  process.env[LOADED_FLAG] = '1';
}

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const runtimeDir = path.join(packageDir, '.icons-server-runtime');

const links = [
  ['icons.config.json', path.join(packageDir, 'icons.config.json')],
  ['icons.generated.ts', path.join(packageDir, 'icons.generated.ts')],
];

fs.mkdirSync(runtimeDir, { recursive: true });

for (const [linkName, targetPath] of links) {
  const linkPath = path.join(runtimeDir, linkName);
  fs.rmSync(linkPath, { force: true });
  fs.symlinkSync(targetPath, linkPath);
}

const binPath = path.join(packageDir, 'node_modules', '.bin', 'icons-server');
const child = spawn(binPath, {
  cwd: runtimeDir,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const generatedPath = path.join(packageDir, 'icons.generated.ts');
const syncScriptPath = path.join(scriptDir, 'sync-generated-index.mjs');

function runSync() {
  const child = spawn(process.execPath, [syncScriptPath], {
    cwd: packageDir,
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[icons] sync-generated-index exited with code ${code ?? 'unknown'}`);
    }
  });
}

runSync();

let syncTimer = null;

fs.watch(packageDir, (_eventType, filename) => {
  if (filename !== 'icons.generated.ts') return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    runSync();
  }, 120);
});

console.log('[icons] watching icons.generated.ts for export sync');

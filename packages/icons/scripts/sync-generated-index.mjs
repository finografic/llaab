import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const generatedPath = path.join(packageDir, 'icons.generated.ts');
const indexPath = path.join(packageDir, 'index.ts');

function extractIconNames(source) {
  const match = source.match(/const ICONS = \{([\s\S]*?)\} as const;/);
  if (!match) {
    throw new Error('Could not find ICONS registry in icons.generated.ts');
  }

  return match[1]
    .split('\n')
    .map((line) => line.match(/^\s*([A-Za-z0-9_]+):/u)?.[1] ?? null)
    .filter(Boolean);
}

function buildIndexFile(iconNames) {
  const exportLines = iconNames.map((iconName) => `  ${iconName},`).join('\n');

  return `/**
 * index.ts
 *
 * !! GENERATED FILE — synchronized from icons.generated.ts.
 * !! To update: run pnpm --filter @llaab/icons sync:exports
 */

import { icons } from './icons.generated';

export * from './icons.generated';

export const {
${exportLines}
} = icons;
`;
}

function syncGeneratedIndex() {
  const generatedSource = fs.readFileSync(generatedPath, 'utf8');
  const iconNames = extractIconNames(generatedSource);
  const nextIndex = buildIndexFile(iconNames);

  if (fs.existsSync(indexPath)) {
    const currentIndex = fs.readFileSync(indexPath, 'utf8');
    if (currentIndex === nextIndex) {
      return false;
    }
  }

  fs.writeFileSync(indexPath, nextIndex, 'utf8');
  return true;
}

const updated = syncGeneratedIndex();
if (updated) {
  console.log('[icons] synced index.ts from icons.generated.ts');
}

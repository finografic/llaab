/**
 * Npm dependency tree resolution — adapted from npmx.dev's dependency-resolver.
 * Resolves for linux-x64-glibc as a representative install platform.
 */
import { maxSatisfying } from 'semver';

import { mapWithConcurrency } from './map-with-concurrency.js';

const NPM_REGISTRY = 'https://registry.npmjs.org';
const PACKUMENT_FETCH_CONCURRENCY = 20;

const TARGET_PLATFORM = {
  os: 'linux',
  cpu: 'x64',
  libc: 'glibc',
} as const;

interface PackumentVersion {
  name?: string;
  version?: string;
  deprecated?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  os?: string[];
  cpu?: string[];
  libc?: string[];
  dist?: {
    tarball?: string;
    unpackedSize?: number;
  };
}

interface Packument {
  'name': string;
  'versions': Record<string, PackumentVersion>;
  'dist-tags'?: Record<string, string>;
}

export interface ResolvedPackage {
  name: string;
  version: string;
  size: number;
  optional: boolean;
}

function encodePackageName(name: string): string {
  return name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : name;
}

async function fetchPackument(name: string): Promise<Packument | null> {
  try {
    const res = await fetch(`${NPM_REGISTRY}/${encodePackageName(name)}`);
    if (!res.ok) return null;
    return (await res.json()) as Packument;
  } catch {
    return null;
  }
}

function matchesPlatform(version: PackumentVersion): boolean {
  if (version.os && Array.isArray(version.os) && version.os.length > 0) {
    const osMatch = version.os.some((os) => {
      if (os.startsWith('!')) return os.slice(1) !== TARGET_PLATFORM.os;
      return os === TARGET_PLATFORM.os;
    });
    if (!osMatch) return false;
  }

  if (version.cpu && Array.isArray(version.cpu) && version.cpu.length > 0) {
    const cpuMatch = version.cpu.some((cpu) => {
      if (cpu.startsWith('!')) return cpu.slice(1) !== TARGET_PLATFORM.cpu;
      return cpu === TARGET_PLATFORM.cpu;
    });
    if (!cpuMatch) return false;
  }

  if (version.libc && Array.isArray(version.libc) && version.libc.length > 0) {
    const libcMatch = version.libc.some((l) => {
      if (l.startsWith('!')) return l.slice(1) !== TARGET_PLATFORM.libc;
      return l === TARGET_PLATFORM.libc;
    });
    if (!libcMatch) return false;
  }

  return true;
}

function resolveVersion(range: string, versions: string[]): string | null {
  if (versions.includes(range)) return range;

  if (range.startsWith('npm:')) {
    const atIndex = range.lastIndexOf('@');
    if (atIndex > 4) return resolveVersion(range.slice(atIndex + 1), versions);
    return null;
  }

  if (
    range.startsWith('http://') ||
    range.startsWith('https://') ||
    range.startsWith('git://') ||
    range.startsWith('git+') ||
    range.startsWith('file:') ||
    range.includes('/')
  ) {
    return null;
  }

  return maxSatisfying(versions, range);
}

/** Resolve the install dependency tree (BFS, platform-filtered). */
export async function resolveDependencyTree(
  rootName: string,
  rootVersion: string,
): Promise<Map<string, ResolvedPackage>> {
  const resolved = new Map<string, ResolvedPackage>();
  const seen = new Set<string>();

  let currentLevel = new Map<string, { range: string; optional: boolean }>([
    [rootName, { range: rootVersion, optional: false }],
  ]);

  while (currentLevel.size > 0) {
    const nextLevel = new Map<string, { range: string; optional: boolean }>();

    for (const name of currentLevel.keys()) {
      seen.add(name);
    }

    const entries = [...currentLevel.entries()];
    await mapWithConcurrency(
      entries,
      async ([name, { range, optional }]) => {
        const packument = await fetchPackument(name);
        if (!packument) return;

        const versions = Object.keys(packument.versions);
        const version = resolveVersion(range, versions);
        if (!version) return;

        const versionData = packument.versions[version];
        if (!versionData) return;
        if (!matchesPlatform(versionData)) return;

        const size = versionData.dist?.unpackedSize ?? 0;
        const key = `${name}@${version}`;
        if (!resolved.has(key)) {
          resolved.set(key, { name, version, size, optional });
        }

        if (versionData.dependencies) {
          for (const [depName, depRange] of Object.entries(versionData.dependencies)) {
            if (!seen.has(depName) && !nextLevel.has(depName)) {
              nextLevel.set(depName, { range: depRange, optional: false });
            }
          }
        }

        if (versionData.optionalDependencies) {
          for (const [depName, depRange] of Object.entries(versionData.optionalDependencies)) {
            if (!seen.has(depName) && !nextLevel.has(depName)) {
              nextLevel.set(depName, { range: depRange, optional: true });
            }
          }
        }
      },
      PACKUMENT_FETCH_CONCURRENCY,
    );

    currentLevel = nextLevel;
  }

  return resolved;
}

export async function resolveLatestVersion(name: string): Promise<string | undefined> {
  const packument = await fetchPackument(name);
  if (!packument) return undefined;
  return packument['dist-tags']?.latest;
}

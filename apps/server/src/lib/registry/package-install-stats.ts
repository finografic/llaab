/**
 * Package install size + vulnerability count — adapted from npmx.dev.
 * Tree walk once; OSV batch for vuln IDs only (sidebar needs a count).
 */
import { resolveDependencyTree, resolveLatestVersion } from './dependency-tree.js';

const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch';
/** OSV querybatch practical chunk size. */
const OSV_BATCH_CHUNK = 100;

export interface PackageInstallStats {
  package: string;
  version: string;
  /** Unpacked size of the package itself (bytes). */
  selfSize: number;
  /** Total install size including dependencies (bytes). */
  totalSize: number;
  dependencyCount: number;
  /** Vulnerability count across the resolved install tree. */
  vulnCount: number;
}

interface OsvBatchResult {
  vulns?: Array<{ id: string }>;
}

async function countVulnsInTree(packages: Array<{ name: string; version: string }>): Promise<number> {
  if (packages.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < packages.length; i += OSV_BATCH_CHUNK) {
    const chunk = packages.slice(i, i + OSV_BATCH_CHUNK);
    try {
      const res = await fetch(OSV_BATCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: chunk.map((pkg) => ({
            package: { name: pkg.name, ecosystem: 'npm' },
            version: pkg.version,
          })),
        }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: OsvBatchResult[] };
      for (const result of data.results ?? []) {
        total += result.vulns?.length ?? 0;
      }
    } catch {
      // Best-effort — sidebar can show size without vulns.
    }
  }
  return total;
}

/** Compute install size + tree vuln count for a package version (or latest). */
export async function fetchPackageInstallStats(
  packageName: string,
  requestedVersion?: string,
): Promise<PackageInstallStats> {
  const version = requestedVersion ?? (await resolveLatestVersion(packageName));
  if (!version) {
    throw new Error(`No version found for ${packageName}`);
  }

  const resolved = await resolveDependencyTree(packageName, version);
  const selfKey = `${packageName}@${version}`;
  const selfEntry = resolved.get(selfKey);
  const selfSize = selfEntry?.size ?? 0;

  let totalSize = 0;
  let dependencyCount = 0;
  const packages: Array<{ name: string; version: string }> = [];

  for (const [key, dep] of resolved) {
    totalSize += dep.size;
    packages.push({ name: dep.name, version: dep.version });
    if (key !== selfKey) dependencyCount++;
  }

  const vulnCount = await countVulnsInTree(packages);

  return {
    package: packageName,
    version,
    selfSize,
    totalSize,
    dependencyCount,
    vulnCount,
  };
}

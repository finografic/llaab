/**
 * Socket.dev package scores — requires SOCKET_API_TOKEN (org API token).
 *
 * @see https://docs.socket.dev/reference/getscorebynpmpackage
 */
import type { PackageSocketScoresResponse } from '@llaab/schemas';

const SOCKET_API = 'https://api.socket.dev/v0';

interface SocketMetric {
  score?: number;
}

interface SocketPackageScore {
  supplyChainRisk?: SocketMetric;
  vulnerability?: SocketMetric;
  quality?: SocketMetric;
  maintenance?: SocketMetric;
  license?: SocketMetric;
}

function toPercent(score: number | undefined): number {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 0;
  return Math.round(Math.min(1, Math.max(0, score)) * 100);
}

function encodeNpmPathSegment(name: string): string {
  // Scoped: @scope/name → @scope%2Fname (Socket path segment)
  return name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
}

function socketAuthHeader(token: string): string {
  return `Basic ${Buffer.from(`${token}:`, 'utf8').toString('base64')}`;
}

export function isSocketConfigured(): boolean {
  return Boolean(process.env.SOCKET_API_TOKEN?.trim());
}

/** Fetch Socket category scores for an npm package version. */
export async function fetchPackageSocketScores(
  packageName: string,
  version: string,
): Promise<PackageSocketScoresResponse> {
  const token = process.env.SOCKET_API_TOKEN?.trim();
  if (!token) {
    return { configured: false };
  }

  const url = `${SOCKET_API}/npm/${encodeNpmPathSegment(packageName)}/${encodeURIComponent(version)}/score`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: socketAuthHeader(token),
    },
  });

  if (!res.ok) {
    throw new Error(`Socket API error: ${res.status}`);
  }

  const data = (await res.json()) as SocketPackageScore;

  return {
    configured: true,
    package: packageName,
    version,
    scores: {
      supplyChain: toPercent(data.supplyChainRisk?.score),
      vulnerability: toPercent(data.vulnerability?.score),
      quality: toPercent(data.quality?.score),
      maintenance: toPercent(data.maintenance?.score),
      license: toPercent(data.license?.score),
    },
  };
}

/**
 * Npm Registry API types — lifted from npmx.dev/shared/types/npm-registry.ts
 * and extended with LLAAB-native PinnedLibrary type.
 */

export interface NpmPerson {
  name?: string;
  email?: string;
  url?: string;
  username?: string;
}

export interface NpmSearchTrustedPublisher {
  id: string;
  oidcConfigId?: string;
}

export interface NpmSearchPublisher extends NpmPerson {
  trustedPublisher?: NpmSearchTrustedPublisher;
  actor?: {
    name: string;
    type: 'user' | 'team';
    email?: string;
  };
}

export interface NpmSearchPackage {
  name: string;
  scope?: string;
  version: string;
  description?: string;
  keywords?: string[];
  date: string;
  links: {
    npm?: string;
    homepage?: string;
    repository?: string;
    bugs?: string;
  };
  author?: NpmPerson;
  publisher?: NpmSearchPublisher;
  maintainers?: NpmPerson[];
  license?: string;
}

export interface NpmSearchResult {
  package: NpmSearchPackage;
  searchScore?: number;
  downloads?: {
    weekly?: number;
    monthly?: number;
  };
  dependents?: string;
  updated?: string;
  flags?: {
    unstable?: boolean;
    insecure?: number;
  };
}

export interface NpmSearchResponse {
  objects: NpmSearchResult[];
  total: number;
  time: string;
}

export interface NpmDownloadCount {
  downloads: number;
  start: string;
  end: string;
  package: string;
}

/**
 * Lightweight package metadata — slim payload for cards and the detail page.
 * Shape mirrors npmx.dev's /api/registry/package-meta response.
 */
export interface PackageMetaResponse {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  license?: string;
  date: string;
  links: {
    npm: string;
    homepage?: string;
    repository?: string;
    bugs?: string;
  };
  author?: NpmPerson;
  maintainers?: NpmPerson[];
  weeklyDownloads?: number;
}

/** Full package detail — rendered readme HTML + extra metadata, returned by /api/registry/npm/package/:name */
export interface PackageDetailResponse extends PackageMetaResponse {
  readmeHtml: string | null;
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  hasTypes: boolean;
  isEsm: boolean;
}

/** A pinned npm package stored in the local pins file. */
export interface PinnedLibrary {
  name: string;
  pinnedAt: string;
  meta: PackageMetaResponse;
}

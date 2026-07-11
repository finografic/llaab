/**
 * GitHub repository registry types — mirror of npm-registry shapes for
 * Registry → Repositories list/detail/pins.
 */

export interface GithubRepoSearchItem {
  fullName: string;
  name: string;
  owner: string;
  description?: string;
  topics?: string[];
  language?: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  license?: string;
  updatedAt: string;
  pushedAt?: string;
  htmlUrl: string;
  homepage?: string | null;
  archived?: boolean;
  fork?: boolean;
}

export interface GithubRepoSearchResponse {
  total: number;
  incomplete: boolean;
  items: GithubRepoSearchItem[];
}

/** Lightweight meta snapshot stored with a pinned repository. */
export interface RepoMetaResponse {
  fullName: string;
  name: string;
  owner: string;
  description?: string;
  topics?: string[];
  language?: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  license?: string;
  updatedAt: string;
  pushedAt?: string;
  htmlUrl: string;
  homepage?: string | null;
  defaultBranch?: string;
}

export interface RepoLanguageShare {
  name: string;
  bytes: number;
  /** 0–100 percentage of total language bytes. */
  percent: number;
}

/** Full repository detail — rendered readme + sidebar metadata. */
export interface RepoDetailResponse extends RepoMetaResponse {
  readmeHtml: string | null;
  languages: RepoLanguageShare[];
  latestVersion?: string;
  watchers: number;
  sizeKb: number;
  createdAt: string;
  isPrivate: boolean;
  isArchived: boolean;
  isFork: boolean;
  isTemplate: boolean;
}

export interface RegistryResourceProjectionStatus {
  id?: string;
  status: 'linked' | 'missing' | 'needs_sync';
}

export interface PinnedRepository {
  fullName: string;
  pinnedAt: string;
  meta: RepoMetaResponse;
  resource?: RegistryResourceProjectionStatus;
}

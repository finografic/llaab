import { createNode, listNodes, writeNode } from '@llaab/core';
import { toNodeId } from '@llaab/schemas';
import type {
  LabNode,
  PackageRegistryResourceProjectionStatus,
  PinnedLibrary,
  PinnedRepository,
  RepoRegistryResourceProjectionStatus,
  ResourceNode,
} from '@llaab/schemas';

export interface RegistryResourceProjection {
  id: string;
  created: boolean;
}

export interface RegistryResourceProjectionIndex {
  packages: Map<string, PackageRegistryResourceProjectionStatus>;
  repos: Map<string, RepoRegistryResourceProjectionStatus>;
}

export async function readRegistryResourceProjectionIndex(): Promise<RegistryResourceProjectionIndex> {
  const resources = await listNodes({ type: 'resource' });
  const packages = new Map<string, PackageRegistryResourceProjectionStatus>();
  const repos = new Map<string, RepoRegistryResourceProjectionStatus>();

  for (const resource of resources) {
    if (!isResourceNode(resource)) continue;

    for (const tag of resource.tags) {
      if (tag.startsWith('package:')) {
        packages.set(tag.slice('package:'.length), { id: resource.id, status: 'linked' });
      }
      if (tag.startsWith('repo:')) {
        repos.set(tag.slice('repo:'.length), { id: resource.id, status: 'linked' });
      }
    }
  }

  return { packages, repos };
}

export function packageProjectionStatus(
  index: RegistryResourceProjectionIndex,
  name: string,
): PackageRegistryResourceProjectionStatus {
  return index.packages.get(name) ?? { status: 'missing' };
}

export function repoProjectionStatus(
  index: RegistryResourceProjectionIndex,
  fullName: string,
): RepoRegistryResourceProjectionStatus {
  return index.repos.get(fullName) ?? { status: 'missing' };
}

export async function projectPinnedLibraryResource(pin: PinnedLibrary): Promise<RegistryResourceProjection> {
  const id = `registry-package-${toNodeId(pin.name)}`;
  const identityTag = `package:${pin.name}`;
  const tags = uniqueTags([
    'registry',
    'registry:pin',
    'registry:package',
    'ecosystem:npm',
    identityTag,
    ...tagValues('keyword', pin.meta.keywords),
  ]);
  const body = buildPinnedLibraryBody(pin);

  return upsertResourceNode({
    id,
    title: `Package: ${pin.name}`,
    body,
    tags,
    url: pin.meta.links.npm,
    resource_type: 'library',
    description: pin.meta.description,
    identityTag,
  });
}

export async function projectPinnedRepositoryResource(
  pin: PinnedRepository,
): Promise<RegistryResourceProjection> {
  const id = `registry-repo-${toNodeId(pin.fullName)}`;
  const identityTag = `repo:${pin.fullName}`;
  const tags = uniqueTags([
    'registry',
    'registry:pin',
    'registry:repo',
    identityTag,
    pin.meta.language ? `language:${toNodeId(pin.meta.language)}` : undefined,
    ...tagValues('topic', pin.meta.topics),
  ]);
  const body = buildPinnedRepositoryBody(pin);

  return upsertResourceNode({
    id,
    title: `Repository: ${pin.fullName}`,
    body,
    tags,
    url: pin.meta.htmlUrl,
    resource_type: 'repo',
    description: pin.meta.description,
    identityTag,
  });
}

async function upsertResourceNode(input: {
  id: string;
  title: string;
  body: string;
  tags: string[];
  url: string;
  resource_type: ResourceNode['resource_type'];
  description?: string;
  identityTag: string;
}): Promise<RegistryResourceProjection> {
  const existing = await findResourceProjection(input.id, input.identityTag);

  if (!existing) {
    const created = await createNode({
      type: 'resource',
      id: input.id,
      title: input.title,
      body: input.body,
      tags: input.tags,
      extra: {
        url: input.url,
        resource_type: input.resource_type,
        description: input.description,
      },
    });

    return { id: created.id, created: true };
  }

  await writeNode({
    ...existing,
    title: input.title,
    body: input.body,
    tags: mergeProjectedTags(existing.tags, input.tags),
    url: input.url,
    resource_type: input.resource_type,
    description: input.description,
  });

  return { id: existing.id, created: false };
}

async function findResourceProjection(id: string, identityTag: string): Promise<ResourceNode | undefined> {
  const nodes = await listNodes({ type: 'resource' });
  return nodes.find((node): node is ResourceNode => {
    if (!isResourceNode(node)) return false;
    if (node.id === id) return true;
    return node.tags.includes(identityTag);
  });
}

function isResourceNode(node: LabNode): node is ResourceNode {
  return node.type === 'resource';
}

function buildPinnedLibraryBody(pin: PinnedLibrary): string {
  return [
    `Registry package pin for \`${pin.name}\`.`,
    '',
    pin.meta.description ?? '',
    '',
    '## Registry',
    '',
    `- Package: \`${pin.name}\``,
    `- Version: \`${pin.meta.version}\``,
    `- npm: ${pin.meta.links.npm}`,
    pin.meta.links.repository ? `- Repository: ${pin.meta.links.repository}` : undefined,
    pin.meta.links.homepage ? `- Homepage: ${pin.meta.links.homepage}` : undefined,
    pin.meta.license ? `- License: ${pin.meta.license}` : undefined,
    pin.meta.weeklyDownloads != null
      ? `- Weekly downloads: ${pin.meta.weeklyDownloads.toLocaleString('en-US')}`
      : undefined,
    pin.meta.typesStatus ? `- TypeScript types: ${pin.meta.typesStatus}` : undefined,
    `- Pinned at: ${pin.pinnedAt}`,
    '',
    '## Pin Rationale',
    '',
    'Curated registry pin. Add rationale or topic notes here.',
    '',
    '```json registry-pin',
    JSON.stringify(
      {
        kind: 'npm_package',
        pin: {
          name: pin.name,
          pinned_at: pin.pinnedAt,
        },
        meta: {
          version: pin.meta.version,
          description: pin.meta.description,
          keywords: pin.meta.keywords ?? [],
          license: pin.meta.license,
          author: pin.meta.author,
          maintainers: pin.meta.maintainers ?? [],
          links: pin.meta.links,
          weekly_downloads: pin.meta.weeklyDownloads,
          types_status: pin.meta.typesStatus,
        },
      },
      null,
      2,
    ),
    '```',
    '',
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

function buildPinnedRepositoryBody(pin: PinnedRepository): string {
  return [
    `Registry repository pin for \`${pin.fullName}\`.`,
    '',
    pin.meta.description ?? '',
    '',
    '## Registry',
    '',
    `- Repository: \`${pin.fullName}\``,
    `- GitHub: ${pin.meta.htmlUrl}`,
    pin.meta.homepage ? `- Homepage: ${pin.meta.homepage}` : undefined,
    pin.meta.language ? `- Primary language: ${pin.meta.language}` : undefined,
    pin.meta.license ? `- License: ${pin.meta.license}` : undefined,
    `- Stars: ${pin.meta.stars.toLocaleString('en-US')}`,
    `- Forks: ${pin.meta.forks.toLocaleString('en-US')}`,
    `- Open issues: ${pin.meta.openIssues.toLocaleString('en-US')}`,
    `- Updated: ${pin.meta.updatedAt}`,
    pin.meta.pushedAt ? `- Pushed: ${pin.meta.pushedAt}` : undefined,
    `- Pinned at: ${pin.pinnedAt}`,
    '',
    '## Pin Rationale',
    '',
    'Curated registry pin. Add rationale or topic notes here.',
    '',
    '```json registry-pin',
    JSON.stringify(
      {
        kind: 'github_repo',
        pin: {
          full_name: pin.fullName,
          pinned_at: pin.pinnedAt,
        },
        meta: {
          full_name: pin.meta.fullName,
          owner: pin.meta.owner,
          name: pin.meta.name,
          description: pin.meta.description,
          topics: pin.meta.topics ?? [],
          language: pin.meta.language,
          stars: pin.meta.stars,
          forks: pin.meta.forks,
          open_issues: pin.meta.openIssues,
          license: pin.meta.license,
          html_url: pin.meta.htmlUrl,
          homepage: pin.meta.homepage,
          updated_at: pin.meta.updatedAt,
          pushed_at: pin.meta.pushedAt,
          default_branch: pin.meta.defaultBranch,
        },
      },
      null,
      2,
    ),
    '```',
    '',
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

function tagValues(prefix: string, values: string[] | undefined): string[] {
  return (values ?? []).map((value) => `${prefix}:${toNodeId(value)}`).filter((tag) => tag !== `${prefix}:`);
}

function mergeProjectedTags(existingTags: string[], projectedTags: string[]): string[] {
  const preservedTags = existingTags.filter((tag) => !isProjectedRegistryTag(tag));
  return uniqueTags([...preservedTags, ...projectedTags]);
}

function isProjectedRegistryTag(tag: string): boolean {
  return (
    tag === 'registry' ||
    tag === 'registry:pin' ||
    tag === 'registry:package' ||
    tag === 'registry:repo' ||
    tag === 'ecosystem:npm' ||
    tag.startsWith('package:') ||
    tag.startsWith('repo:') ||
    tag.startsWith('language:') ||
    tag.startsWith('topic:') ||
    tag.startsWith('keyword:')
  );
}

function uniqueTags(tags: Array<string | undefined>): string[] {
  return [...new Set(tags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0))];
}

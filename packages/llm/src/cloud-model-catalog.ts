import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  openCodeFetchConfiguredModels,
  openCodeGetConfiguredModelNames,
} from './providers/opencode-catalog.js';

export type CloudCatalogSource = 'cache' | 'api' | 'config';

export type CloudModelProvider = 'opencode' | 'anthropic';

export interface CloudCatalogModel {
  name: string;
  provider: CloudModelProvider;
  owned_by?: string;
  created?: number;
}

export interface CloudProviderCatalog {
  source: CloudCatalogSource;
  fetchedAt: string;
  models: CloudCatalogModel[];
}

export interface CloudModelCatalogFile {
  opencode?: CloudProviderCatalog;
  anthropic?: CloudProviderCatalog;
}

export type ModelAvailability = 'local' | 'cloud' | 'catalog' | 'on-request';

export interface ResolvedCloudProviderCatalog {
  models: CloudCatalogModel[];
  availability: ModelAvailability;
  source: CloudCatalogSource;
  fetchedAt?: string;
  fromCache: boolean;
  error?: string;
}

const CATALOG_PATH = resolve(process.cwd(), 'configs/cloud-model-catalog.json');
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function getCacheTtlMs(): number {
  const configured = Number(process.env['LLAAB_CLOUD_MODEL_CACHE_TTL_MS']);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MS;
}

function readCatalogFile(): CloudModelCatalogFile {
  if (!existsSync(CATALOG_PATH)) return {};

  try {
    return JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as CloudModelCatalogFile;
  } catch {
    return {};
  }
}

function writeCatalogFile(catalog: CloudModelCatalogFile): void {
  mkdirSync(dirname(CATALOG_PATH), { recursive: true });
  writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
}

function isFresh(entry: CloudProviderCatalog | undefined, ttlMs: number): boolean {
  if (!entry?.fetchedAt) return false;
  const fetchedAt = Date.parse(entry.fetchedAt);
  if (Number.isNaN(fetchedAt)) return false;
  return Date.now() - fetchedAt < ttlMs;
}

function availabilityForSource(source: CloudCatalogSource, hasApiKey: boolean): ModelAvailability {
  if (source === 'api') return 'cloud';
  if (source === 'config') return hasApiKey ? 'catalog' : 'on-request';
  return hasApiKey ? 'catalog' : 'on-request';
}

function configFallbackOpenCodeModels(): CloudCatalogModel[] {
  return openCodeGetConfiguredModelNames().map((name) => ({
    name,
    provider: 'opencode' as const,
    owned_by: 'opencode',
  }));
}

async function refreshOpenCodeCatalog(hasApiKey: boolean): Promise<CloudProviderCatalog> {
  const fetchedAt = new Date().toISOString();

  if (hasApiKey) {
    try {
      const models = (await openCodeFetchConfiguredModels()).map((model) => ({
        name: model.name,
        provider: 'opencode' as const,
        owned_by: model.owned_by,
        created: model.created,
      }));
      return {
        source: 'api',
        fetchedAt,
        models,
      };
    } catch {
      // fall through to configured model names
    }
  }

  return {
    source: 'config',
    fetchedAt,
    models: configFallbackOpenCodeModels(),
  };
}

function buildAnthropicCatalog(modelName: string): CloudProviderCatalog {
  return {
    source: 'config',
    fetchedAt: new Date().toISOString(),
    models: [
      {
        name: modelName,
        provider: 'anthropic',
        owned_by: 'anthropic',
      },
    ],
  };
}

export async function resolveOpenCodeCatalog(): Promise<ResolvedCloudProviderCatalog> {
  const hasApiKey = Boolean(process.env['OPENCODE_API_KEY']);
  const ttlMs = getCacheTtlMs();
  const catalog = readCatalogFile();
  const cached = catalog.opencode;

  if (cached && isFresh(cached, ttlMs)) {
    return {
      models: cached.models,
      availability: availabilityForSource(cached.source, hasApiKey),
      source: 'cache',
      fetchedAt: cached.fetchedAt,
      fromCache: true,
    };
  }

  try {
    const refreshed = await refreshOpenCodeCatalog(hasApiKey);
    writeCatalogFile({ ...catalog, opencode: refreshed });

    return {
      models: refreshed.models,
      availability: availabilityForSource(refreshed.source, hasApiKey),
      source: refreshed.source,
      fetchedAt: refreshed.fetchedAt,
      fromCache: false,
      error:
        refreshed.source === 'config' && hasApiKey
          ? 'OpenCode catalog — live /models refresh failed'
          : undefined,
    };
  } catch (err) {
    if (cached) {
      return {
        models: cached.models,
        availability: availabilityForSource(cached.source, hasApiKey),
        source: 'cache',
        fetchedAt: cached.fetchedAt,
        fromCache: true,
        error: err instanceof Error ? err.message : 'OpenCode catalog refresh failed',
      };
    }

    const fallback = configFallbackOpenCodeModels();
    return {
      models: fallback,
      availability: hasApiKey ? 'catalog' : 'on-request',
      source: 'config',
      fromCache: false,
      error: hasApiKey ? 'OpenCode unavailable' : 'OpenCode — set OPENCODE_API_KEY',
    };
  }
}

export function resolveAnthropicCatalog(remoteModelName: string): ResolvedCloudProviderCatalog {
  const hasApiKey = Boolean(process.env['ANTHROPIC_API_KEY']);
  const ttlMs = getCacheTtlMs();
  const catalog = readCatalogFile();
  const cached = catalog.anthropic;

  if (cached && isFresh(cached, ttlMs) && cached.models.some((model) => model.name === remoteModelName)) {
    return {
      models: cached.models,
      availability: hasApiKey ? 'cloud' : 'on-request',
      source: 'cache',
      fetchedAt: cached.fetchedAt,
      fromCache: true,
    };
  }

  const refreshed = buildAnthropicCatalog(remoteModelName);
  writeCatalogFile({ ...catalog, anthropic: refreshed });

  return {
    models: refreshed.models,
    availability: hasApiKey ? 'cloud' : 'on-request',
    source: 'config',
    fetchedAt: refreshed.fetchedAt,
    fromCache: false,
  };
}

export interface RemoteModelDetail {
  name: string;
  provider: CloudModelProvider;
  owned_by?: string;
  created?: number;
  availability: ModelAvailability;
}

export function cloudCatalogModelToRemoteDetail(
  model: CloudCatalogModel,
  availability: ModelAvailability,
): RemoteModelDetail {
  return {
    name: model.name,
    provider: model.provider,
    owned_by: model.owned_by,
    created: model.created,
    availability,
  };
}

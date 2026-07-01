import type { OpenCodeModelInfo } from './opencode.js';

interface OpenAiModel {
  created?: number;
  id: string;
  owned_by?: string;
}

interface OpenAiModelsResponse {
  data?: OpenAiModel[];
}

const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1';
const DEFAULT_MODELS = ['qwen3.7-plus', 'mimo-v2.5', 'glm-5.2'];

function getBaseUrl() {
  return (process.env['OPENCODE_BASE_URL'] ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

function getApiKey() {
  return process.env['OPENCODE_API_KEY'];
}

/** Model ids from env — no network. */
export function openCodeGetConfiguredModelNames(): string[] {
  const configuredModels = process.env['OPENCODE_MODELS']
    ?.split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  const configuredModel = process.env['OPENCODE_MODEL'];
  const models = configuredModels?.length
    ? configuredModels
    : configuredModel
      ? [configuredModel, ...DEFAULT_MODELS]
      : DEFAULT_MODELS;

  return [...new Set(models)];
}

/** GET /models only — metadata listing, no chat tokens. */
export async function openCodeFetchConfiguredModels(): Promise<OpenCodeModelInfo[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('OPENCODE_API_KEY is not configured');
  }

  const models = openCodeGetConfiguredModelNames();
  const response = await fetch(`${getBaseUrl()}/models`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      body
        ? `OpenCode /models failed: ${response.status} ${body}`
        : `OpenCode /models failed: ${response.status}`,
    );
  }

  const payload = (await response.json()) as OpenAiModelsResponse;
  const apiDetails = new Map(
    (payload.data ?? []).map((model) => [
      model.id,
      {
        created: model.created,
        name: model.id,
        owned_by: model.owned_by,
        provider: 'opencode' as const,
      },
    ]),
  );

  return models.map(
    (model) =>
      apiDetails.get(model) ?? {
        name: model,
        provider: 'opencode' as const,
        owned_by: 'opencode',
      },
  );
}

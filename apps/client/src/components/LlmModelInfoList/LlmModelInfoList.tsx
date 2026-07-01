import { cn } from '@llaab/ui/lib/utils';
import {
  AiModelInfo,
  AiModelInfoCapabilities,
  AiModelInfoHeader,
  AiModelInfoPricing,
} from 'components/ui/elements/ai-model-info';
import type { ModelAvailabilityKind, ModelCapability } from 'components/ui/elements/ai-model-info';

import gridStyles from 'styles/llm-card-grid.module.css';

export interface OllamaModelDetails {
  domain?: string;
  families?: string[];
  family?: string;
  format?: string;
  parameter_size?: string;
  parent_model?: string;
  quantization_level?: string;
}

export interface OllamaModelInfo {
  created?: number;
  digest?: string;
  details?: OllamaModelDetails;
  modified_at?: Date | string;
  name: string;
  owned_by?: string;
  provider?: 'ollama' | 'lmstudio' | 'opencode' | 'anthropic';
  size?: number;
  capabilities?: string[];
  contextLength?: number;
  availability?: ModelAvailabilityKind;
}

export interface LlmModelInfoListProps {
  models: OllamaModelInfo[];
}

interface ModelInfoData {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  capabilities: ModelCapability[];
  availability?: ModelAvailabilityKind;
}

function formatBytes(bytes?: number) {
  if (bytes == null) return undefined;
  const gib = bytes / 1024 ** 3;
  if (gib >= 1) return `${gib.toFixed(gib >= 10 ? 0 : 1)}GB`;
  return `${(bytes / 1024 ** 2).toFixed(0)}MB`;
}

function formatDate(value?: Date | string) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function inferContextWindow(model: OllamaModelInfo) {
  if (model.contextLength) return model.contextLength;

  const normalized = model.name.toLowerCase();

  if (normalized.includes('26b') || normalized.includes('31b') || normalized.includes('12b')) return 256000;
  if (normalized.includes('gemma4')) return 128000;
  if (normalized.includes('gpt-oss')) return 128000;
  if (normalized.includes('llama3.2')) return 128000;
  if (normalized.includes('llama3.1')) return 128000;
  if (normalized.includes('llama3')) return 8192;

  return 8192;
}

/** Maps Ollama's native `show` capability flags onto our display capabilities. */
const OLLAMA_CAPABILITY_MAP: Record<string, ModelCapability> = {
  reasoning: 'reasoning',
  vision: 'vision',
  tools: 'tools',
  thinking: 'reasoning',
  audio: 'audio',
};

function mapOllamaCapabilities(capabilities?: string[]): ModelCapability[] {
  if (!capabilities) return [];
  return capabilities
    .map((capability) => OLLAMA_CAPABILITY_MAP[capability])
    .filter((capability): capability is ModelCapability => capability !== undefined);
}

function inferCapabilities(model: OllamaModelInfo): ModelCapability[] {
  const normalized = model.name.toLowerCase();
  const capabilities: ModelCapability[] = ['streaming', 'json', ...mapOllamaCapabilities(model.capabilities)];

  if (normalized.includes('gemma4') || normalized.includes('gemma-4')) {
    capabilities.push('vision', 'tools', 'reasoning');
    if (
      model.provider !== 'lmstudio' &&
      (normalized.includes('e2b') || normalized.includes('e4b') || normalized.includes('12b'))
    ) {
      capabilities.push('audio');
    }
  }

  if (normalized.includes('gpt-oss')) {
    capabilities.push('tools', 'functions');
  }

  if (model.provider === 'opencode' || model.provider === 'anthropic') {
    capabilities.push('tools', 'reasoning');
    if (normalized.includes('glm') || normalized.includes('qwen') || normalized.includes('claude')) {
      capabilities.push('vision');
    }
  }

  return [...new Set(capabilities)];
}

function inferCloudContextWindow(model: OllamaModelInfo) {
  if (model.contextLength) return model.contextLength;

  const normalized = model.name.toLowerCase();
  if (normalized.includes('claude')) return 200000;
  if (normalized.includes('glm-5')) return 128000;
  if (normalized.includes('qwen3.7')) return 128000;
  if (normalized.includes('mimo')) return 128000;

  return 0;
}

function toModelInfo(model: OllamaModelInfo): ModelInfoData {
  const isCloud =
    model.availability === 'cloud' || model.availability === 'catalog' || model.availability === 'on-request';

  return {
    id: model.name,
    name: model.name,
    provider: model.provider ?? 'ollama',
    contextWindow: isCloud ? inferCloudContextWindow(model) : inferContextWindow(model),
    capabilities: inferCapabilities(model),
    availability:
      model.availability ??
      (model.provider === 'ollama' || model.provider === 'lmstudio' ? 'local' : undefined),
  };
}

function DetailPill({ label, value }: { label: string; value?: string }) {
  if (!value) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-foreground">{value}</span>
    </span>
  );
}

function LlmModelFacts({ model }: { model: OllamaModelInfo }) {
  const { details, digest, modified_at: modifiedAt, owned_by: ownedBy } = model;
  const shortDigest = digest?.slice(0, 12);
  const modified = formatDate(modifiedAt);
  const isCloud = model.provider === 'opencode' || model.provider === 'anthropic';

  if (isCloud && !details && !digest && !modified) {
    return (
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <DetailPill label="owner" value={ownedBy ?? model.provider} />
          {model.availability === 'catalog' ? (
            <DetailPill label="note" value="configured list — live status not probed" />
          ) : null}
          {model.availability === 'on-request' ? (
            <DetailPill label="note" value="provider API key not configured" />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex flex-wrap gap-1.5">
        <DetailPill label="params" value={details?.parameter_size} />
        <DetailPill label="arch" value={details?.family} />
        <DetailPill label="domain" value={details?.domain} />
        <DetailPill label="format" value={details?.format} />
        <DetailPill label="quant" value={details?.quantization_level} />
        <DetailPill label="size" value={formatBytes(model.size)} />
        <DetailPill label="owner" value={model.owned_by} />
      </div>
      {(shortDigest || modified) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          {shortDigest ? <span className="font-mono">{shortDigest}</span> : <span />}
          {modified ? <span>{modified}</span> : null}
        </div>
      )}
    </div>
  );
}

export function LlmModelInfoList({ models }: LlmModelInfoListProps) {
  return (
    <div className={gridStyles.cardGrid}>
      {models.map((model) => {
        const modelInfo = toModelInfo(model);

        return (
          <AiModelInfo
            key={model.name}
            model={modelInfo}
            showPricing={false}
            className={cn(gridStyles.cardGridItem, 'overflow-hidden')}
          >
            <AiModelInfoHeader />
            <LlmModelFacts model={model} />
            <AiModelInfoCapabilities />
            <AiModelInfoPricing />
          </AiModelInfo>
        );
      })}
    </div>
  );
}

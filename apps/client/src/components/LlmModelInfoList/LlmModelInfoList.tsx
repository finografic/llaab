import { cn } from '@llaab/ui/lib/utils';
import {
  AiModelInfo,
  AiModelInfoCapabilities,
  AiModelInfoHeader,
  AiModelInfoMeta,
  AiModelInfoPricing,
} from 'components/ui/elements/ai-model-info';
import type { ModelCapability } from 'components/ui/elements/ai-model-info';

export interface OllamaModelDetails {
  families?: string[];
  family?: string;
  format?: string;
  parameter_size?: string;
  parent_model?: string;
  quantization_level?: string;
}

export interface OllamaModelInfo {
  digest?: string;
  details?: OllamaModelDetails;
  modified_at?: Date | string;
  name: string;
  size?: number;
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

function inferContextWindow(modelName: string) {
  const normalized = modelName.toLowerCase();

  if (normalized.includes('26b') || normalized.includes('31b') || normalized.includes('12b')) return 256000;
  if (normalized.includes('gemma4')) return 128000;
  if (normalized.includes('gpt-oss')) return 128000;
  if (normalized.includes('llama3.2')) return 128000;
  if (normalized.includes('llama3.1')) return 128000;
  if (normalized.includes('llama3')) return 8192;

  return 8192;
}

function inferCapabilities(modelName: string): ModelCapability[] {
  const normalized = modelName.toLowerCase();
  const capabilities: ModelCapability[] = ['streaming', 'json'];

  if (normalized.includes('gemma4')) {
    capabilities.push('vision', 'tools', 'reasoning');
    if (normalized.includes('e2b') || normalized.includes('e4b') || normalized.includes('12b')) {
      capabilities.push('audio');
    }
  }

  if (normalized.includes('gpt-oss')) {
    capabilities.push('tools', 'functions');
  }

  return [...new Set(capabilities)];
}

function toModelInfo(model: OllamaModelInfo): ModelInfoData {
  return {
    id: model.name,
    name: model.name,
    provider: 'ollama',
    contextWindow: inferContextWindow(model.name),
    capabilities: inferCapabilities(model.name),
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
  const { details, digest, modified_at: modifiedAt } = model;
  const shortDigest = digest?.slice(0, 12);
  const modified = formatDate(modifiedAt);

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex flex-wrap gap-1.5">
        <DetailPill label="params" value={details?.parameter_size} />
        <DetailPill label="arch" value={details?.family} />
        <DetailPill label="format" value={details?.format} />
        <DetailPill label="quant" value={details?.quantization_level} />
        <DetailPill label="size" value={formatBytes(model.size)} />
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
    <div className="grid gap-3">
      {models.map((model) => {
        const modelInfo = toModelInfo(model);

        return (
          <AiModelInfo
            key={model.name}
            model={modelInfo}
            showPricing={false}
            className={cn('overflow-hidden')}
          >
            <AiModelInfoHeader />
            <LlmModelFacts model={model} />
            <AiModelInfoCapabilities />
            <AiModelInfoPricing />
            <AiModelInfoMeta />
          </AiModelInfo>
        );
      })}
    </div>
  );
}

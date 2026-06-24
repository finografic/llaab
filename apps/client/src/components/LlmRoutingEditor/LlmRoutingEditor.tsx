import { cn } from '@llaab/ui/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from 'components/ui/select';
import { QUERY_KEYS } from 'queries/llm';
import { useEffect, useMemo, useState } from 'react';

import { api } from 'lib/api';

type TaskType =
  | 'route'
  | 'format'
  | 'extract'
  | 'consolidate'
  | 'code'
  | 'reason'
  | 'reason-plus'
  | 'vision'
  | 'speech';
type ModelTier = 'local-small' | 'local-mid' | 'local-strong' | 'remote';
type LlmProvider = 'ollama' | 'anthropic' | 'lmstudio';

interface RoutingEntry {
  tier: ModelTier;
  model: string;
  provider: LlmProvider;
}

export interface LlmRoutingEditorProps {
  routing: Record<TaskType, RoutingEntry>;
  installedModelOptions: Array<{ model: string; provider: LlmProvider }>;
  remoteModels: string[];
}

const TASK_LABELS: Record<TaskType, string> = {
  'route': 'Route',
  'format': 'Format',
  'extract': 'Extract',
  'consolidate': 'Consolidation',
  'code': 'Code',
  'reason': 'Reason',
  'reason-plus': 'Reason+',
  'vision': 'Vision',
  'speech': 'Speech',
};

const TIER_LABELS: Record<ModelTier, string> = {
  'local-small': 'Local — small',
  'local-mid': 'Local — mid',
  'local-strong': 'Local — strong',
  'remote': 'Remote',
};

const TASK_ORDER: TaskType[] = [
  'route',
  'format',
  'extract',
  'consolidate',
  'code',
  'reason',
  'reason-plus',
  'vision',
  'speech',
];

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function inferLocalTier(currentTier: ModelTier) {
  return currentTier === 'remote' ? 'local-strong' : currentTier;
}

function isInstalled(
  entry: { model: string; provider: LlmProvider },
  installedModelOptions: Array<{ model: string; provider: LlmProvider }>,
) {
  return installedModelOptions.some(
    (installed) =>
      installed.provider === entry.provider &&
      (installed.model === entry.model || installed.model.startsWith(`${entry.model}:`)),
  );
}

function providerLabel(provider: LlmProvider) {
  if (provider === 'lmstudio') return 'LM Studio';
  if (provider === 'anthropic') return 'Anthropic';
  return 'Ollama';
}

function ModelOptionLabel({ model, provider }: { model: string; provider: LlmProvider }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 font-mono">
      <span className="shrink-0 text-muted-foreground">({providerLabel(provider)})</span>
      <span className="truncate">{model}</span>
    </span>
  );
}

export function LlmRoutingEditor({ routing, installedModelOptions, remoteModels }: LlmRoutingEditorProps) {
  const queryClient = useQueryClient();
  const [currentRouting, setCurrentRouting] = useState(routing);
  const [savingTask, setSavingTask] = useState<TaskType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentRouting(routing);
  }, [routing]);
  const localModelOptions = useMemo(
    () =>
      [
        ...installedModelOptions.filter((entry) => entry.provider !== 'anthropic'),
        ...Object.values(currentRouting)
          .filter((entry) => entry.provider !== 'anthropic')
          .map((entry) => ({ model: entry.model, provider: entry.provider })),
      ].filter(
        (entry, index, entries) =>
          entries.findIndex(
            (candidate) => candidate.model === entry.model && candidate.provider === entry.provider,
          ) === index,
      ),
    [currentRouting, installedModelOptions],
  );
  const remoteModelOptions = useMemo(
    () =>
      unique([
        ...Object.values(currentRouting)
          .filter((entry) => entry.provider === 'anthropic')
          .map((entry) => entry.model),
        ...remoteModels,
      ]),
    [currentRouting, remoteModels],
  );

  async function updateRoute(task: TaskType, value: string) {
    const [provider, ...modelParts] = value.split(':');
    const model = modelParts.join(':');
    const previous = currentRouting[task];
    const nextProvider: LlmProvider =
      provider === 'anthropic' || provider === 'lmstudio' ? provider : 'ollama';
    const nextEntry: RoutingEntry = {
      model,
      provider: nextProvider,
      tier: nextProvider === 'anthropic' ? 'remote' : inferLocalTier(previous.tier),
    };

    setCurrentRouting((existing) => ({ ...existing, [task]: nextEntry }));
    setSavingTask(task);
    setError(null);

    try {
      const response = await api.llm.routing.$patch({ json: { task, ...nextEntry } });

      if (!response.ok) {
        setCurrentRouting((existing) => ({ ...existing, [task]: previous }));
        setError(`Could not save ${TASK_LABELS[task]} routing.`);
        setSavingTask(null);
        return;
      }

      const body = await response.json();
      const nextRouting = body.routing as Record<TaskType, RoutingEntry>;
      setCurrentRouting(nextRouting);
      queryClient.setQueryData<{ routing: Record<TaskType, RoutingEntry> }>(
        QUERY_KEYS.llm.status(),
        (existing) => (existing ? { ...existing, routing: nextRouting } : existing),
      );
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.llm.status() });
    } catch {
      setCurrentRouting((existing) => ({ ...existing, [task]: previous }));
      setError(`Could not save ${TASK_LABELS[task]} routing.`);
    } finally {
      setSavingTask(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {TASK_ORDER.map((task) => {
        const entry = currentRouting[task];
        const installed = entry.provider === 'anthropic' || isInstalled(entry, installedModelOptions);
        const value = `${entry.provider}:${entry.model}`;

        return (
          <div
            key={task}
            className="grid grid-cols-[280px_116px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2"
          >
            <span className="font-medium text-foreground">{TASK_LABELS[task]}</span>
            <span className="text-[length:var(--text-md)] text-muted-foreground">
              {TIER_LABELS[entry.tier]}
            </span>
            <Select
              value={value}
              disabled={savingTask === task}
              onValueChange={(next) => updateRoute(task, next)}
            >
              <SelectTrigger className="h-8 w-full justify-between rounded-md border-[var(--border-subtle)] bg-background/30 font-mono text-[length:var(--text-md)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  <SelectLabel>Installed local models</SelectLabel>
                  {localModelOptions.map(({ model, provider }) => (
                    <SelectItem key={`${provider}:${model}`} value={`${provider}:${model}`}>
                      <ModelOptionLabel model={model} provider={provider} />
                    </SelectItem>
                  ))}
                </SelectGroup>
                {remoteModelOptions.length > 0 ? (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Remote</SelectLabel>
                      {remoteModelOptions.map((model) => (
                        <SelectItem key={`anthropic:${model}`} value={`anthropic:${model}`}>
                          <ModelOptionLabel model={model} provider="anthropic" />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                ) : null}
              </SelectContent>
            </Select>
            <span
              className={cn(
                'size-1.5 rounded-full',
                installed ? 'bg-[var(--success-text)]' : 'bg-[var(--warning-text)]',
                savingTask === task && 'animate-pulse',
              )}
              title={installed ? 'Available' : 'Not installed'}
            />
          </div>
        );
      })}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

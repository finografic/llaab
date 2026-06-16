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
type LlmProvider = 'ollama' | 'anthropic';

interface RoutingEntry {
  tier: ModelTier;
  model: string;
  provider: LlmProvider;
}

export interface LlmRoutingEditorProps {
  routing: Record<TaskType, RoutingEntry>;
  installedModels: string[];
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

function isInstalled(model: string, installedModels: string[]) {
  return installedModels.some((installed) => installed === model || installed.startsWith(`${model}:`));
}

export function LlmRoutingEditor({ routing, installedModels, remoteModels }: LlmRoutingEditorProps) {
  const queryClient = useQueryClient();
  const [currentRouting, setCurrentRouting] = useState(routing);
  const [savingTask, setSavingTask] = useState<TaskType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentRouting(routing);
  }, [routing]);
  const localModels = useMemo(
    () =>
      unique([
        ...installedModels,
        ...Object.values(currentRouting)
          .filter((entry) => entry.provider === 'ollama')
          .map((entry) => entry.model),
      ]),
    [currentRouting, installedModels],
  );
  const selectableRemoteModels = useMemo(
    () =>
      unique([
        ...remoteModels,
        ...Object.values(currentRouting)
          .filter((entry) => entry.provider === 'anthropic')
          .map((entry) => entry.model),
      ]),
    [currentRouting, remoteModels],
  );

  async function updateRoute(task: TaskType, value: string) {
    const [provider, ...modelParts] = value.split(':');
    const model = modelParts.join(':');
    const previous = currentRouting[task];
    const nextProvider = provider === 'anthropic' ? 'anthropic' : 'ollama';
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
        const installed = entry.provider === 'anthropic' || isInstalled(entry.model, installedModels);
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
                  <SelectLabel>Installed Ollama</SelectLabel>
                  {localModels.map((model) => (
                    <SelectItem key={`ollama:${model}`} value={`ollama:${model}`}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {selectableRemoteModels.length > 0 ? (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Remote</SelectLabel>
                      {selectableRemoteModels.map((model) => (
                        <SelectItem key={`anthropic:${model}`} value={`anthropic:${model}`}>
                          {model}
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

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

import styles from './LlmRoutingEditor.module.css';

import gridStyles from 'styles/llm-card-grid.module.css';

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
type LlmProvider = 'ollama' | 'anthropic' | 'lmstudio' | 'opencode';

interface RoutingEntry {
  tier: ModelTier;
  model: string;
  provider: LlmProvider;
}

export interface LlmRoutingEditorProps {
  routing: Record<TaskType, RoutingEntry>;
  availableProviders: LlmProvider[];
  installedModelOptions: Array<{ model: string; provider: LlmProvider }>;
  remoteModelOptions: Array<{ model: string; provider: LlmProvider }>;
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
  if (provider === 'opencode') return 'OpenCode';
  return 'Ollama';
}

function ModelOptionLabel({ model, provider }: { model: string; provider: LlmProvider }) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1 font-mono">
      <span className={styles.providerLabel}>{providerLabel(provider)}:</span>
      <span className="truncate">{model}</span>
    </span>
  );
}

function isRemoteProvider(provider: LlmProvider) {
  return provider === 'anthropic' || provider === 'opencode';
}

export function LlmRoutingEditor({
  routing,
  availableProviders,
  installedModelOptions,
  remoteModelOptions: providedRemoteModelOptions,
}: LlmRoutingEditorProps) {
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
        ...installedModelOptions.filter((entry) => !isRemoteProvider(entry.provider)),
        ...Object.values(currentRouting)
          .filter((entry) => !isRemoteProvider(entry.provider))
          .map((entry) => ({ model: entry.model, provider: entry.provider })),
      ].filter(
        (entry, index, entries) =>
          entries.findIndex(
            (candidate) => candidate.model === entry.model && candidate.provider === entry.provider,
          ) === index,
      ),
    [currentRouting, installedModelOptions],
  );
  const selectableRemoteModelOptions = useMemo(
    () =>
      [
        ...providedRemoteModelOptions,
        ...Object.values(currentRouting)
          .filter((entry) => isRemoteProvider(entry.provider))
          .map((entry) => ({ model: entry.model, provider: entry.provider })),
      ].filter(
        (entry, index, entries) =>
          entries.findIndex(
            (candidate) => candidate.model === entry.model && candidate.provider === entry.provider,
          ) === index,
      ),
    [currentRouting, providedRemoteModelOptions],
  );

  async function updateRoute(task: TaskType, value: string) {
    const [provider, ...modelParts] = value.split(':');
    const model = modelParts.join(':');
    const previous = currentRouting[task];
    const nextProvider: LlmProvider =
      provider === 'anthropic' || provider === 'lmstudio' || provider === 'opencode' ? provider : 'ollama';
    const nextEntry: RoutingEntry = {
      model,
      provider: nextProvider,
      tier: isRemoteProvider(nextProvider) ? 'remote' : inferLocalTier(previous.tier),
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
    <div className={gridStyles.cardGrid}>
      {TASK_ORDER.map((task) => {
        const entry = currentRouting[task];
        const available = isRemoteProvider(entry.provider)
          ? availableProviders.includes(entry.provider)
          : isInstalled(entry, installedModelOptions);
        const value = `${entry.provider}:${entry.model}`;

        return (
          <div key={task} className={cn(gridStyles.cardGridItem, styles.routingCard)}>
            <div className={styles.routingCardHeader}>
              <span className={styles.routingTaskLabel}>{TASK_LABELS[task]}</span>
              <span
                className={cn(
                  styles.statusDot,
                  available ? styles.statusDotAvailable : styles.statusDotUnavailable,
                  savingTask === task && styles.statusDotSaving,
                )}
                title={available ? 'Available' : 'Unavailable'}
              />
            </div>
            <div className={styles.routingRow}>
              <span className={styles.routingTier}>{TIER_LABELS[entry.tier]}</span>
              <div className={styles.routingSelect}>
                <Select
                  value={value}
                  disabled={savingTask === task}
                  onValueChange={(next) => updateRoute(task, next)}
                >
                  <SelectTrigger className={styles.selectTrigger}>
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
                    {selectableRemoteModelOptions.length > 0 ? (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>Remote</SelectLabel>
                          {selectableRemoteModelOptions.map(({ model, provider }) => (
                            <SelectItem key={`${provider}:${model}`} value={`${provider}:${model}`}>
                              <ModelOptionLabel model={model} provider={provider} />
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );
      })}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { LlmModelInfoList } from 'components/LlmModelInfoList/LlmModelInfoList';
import { LlmRoutingEditor } from 'components/LlmRoutingEditor/LlmRoutingEditor';
import { PageHero } from 'components/PageHero/PageHero';
import { Spinner } from 'components/ui/spinner';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { QUERY_KEYS } from 'queries/llm';
import { useMemo } from 'react';
import type { OllamaModelInfo } from 'components/LlmModelInfoList/LlmModelInfoList';

import { apiGet } from 'lib/api-client';
import { usePageTitle } from 'lib/use-page-title';

import styles from './llm.module.css';

interface RoutingEntry {
  tier: 'local-small' | 'local-mid' | 'local-strong' | 'remote';
  model: string;
  provider: 'ollama' | 'anthropic' | 'lmstudio' | 'opencode';
}

type LlmProvider = RoutingEntry['provider'];

interface LlmStatusResponse {
  availableProviders: LlmProvider[];
  routing: Record<
    | 'route'
    | 'format'
    | 'extract'
    | 'consolidate'
    | 'wiki-compile'
    | 'wiki-discover'
    | 'wiki-link'
    | 'code'
    | 'reason'
    | 'reason-plus'
    | 'vision'
    | 'speech',
    RoutingEntry
  >;
  modelMap: Record<string, string>;
  installedModelDetails: OllamaModelInfo[];
  remoteModelDetails?: OllamaModelInfo[];
  installedModelOptions: Array<{ model: string; provider: LlmProvider }>;
  installedModels: string[];
  lmStudioError?: string;
  ollamaError?: string;
  openCodeError?: string;
  remoteModelOptions: Array<{ model: string; provider: LlmProvider }>;
  cloudCatalog?: {
    opencode?: { source: string; fetchedAt?: string; fromCache: boolean };
    anthropic?: { source: string; fetchedAt?: string; fromCache: boolean };
  };
}

export function LlmPage() {
  usePageTitle('LLM Status');

  const {
    data: status,
    error,
    isPending,
  } = useQuery({
    queryKey: QUERY_KEYS.llm.status(),
    queryFn: () => apiGet<LlmStatusResponse>('/api/llm/status'),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const fetchError = error instanceof Error ? error.message : error ? 'Failed to reach server' : null;
  const remoteModelOptions = status?.remoteModelOptions ?? [];

  const allModelDetails = useMemo(() => {
    if (!status) return [];
    return [...(status.installedModelDetails ?? []), ...(status.remoteModelDetails ?? [])];
  }, [status]);

  const localCount = status?.installedModelDetails.length ?? 0;
  const cloudCount = status?.remoteModelDetails?.length ?? 0;

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Models"
          title="Status"
          description="Active model routing, installed local models, and configured cloud providers."
          meta={
            isPending ? (
              <span className={styles.heroLoading}>
                <Spinner className="size-4" aria-hidden />
                Loading model status…
              </span>
            ) : null
          }
        />
      }
    >
      <div className={styles.llmPage}>
        {fetchError ? (
          <div className={`${styles.alert} ${styles.alertError}`}>
            <span className={styles.alertLabel}>Server unreachable</span>
            <span className={styles.alertMsg}>{fetchError}</span>
          </div>
        ) : null}

        {status ? (
          <div className={styles.llmSections}>
            <section className={styles.llmSection}>
              <h2 className={styles.llmSectionHeading}>Task routing</h2>
              <LlmRoutingEditor
                routing={status.routing}
                availableProviders={status.availableProviders}
                installedModelOptions={status.installedModelOptions}
                remoteModelOptions={remoteModelOptions}
              />
            </section>

            <section className={styles.llmSection}>
              <h2 className={styles.llmSectionHeading}>
                Models
                {status.ollamaError && status.lmStudioError && cloudCount === 0 ? (
                  <span className={`${styles.llmSectionBadge} ${styles.llmSectionBadgeErr}`}>offline</span>
                ) : (
                  <span className={`${styles.llmSectionBadge} ${styles.llmSectionBadgeOk}`}>
                    {localCount} local · {cloudCount} cloud
                  </span>
                )}
              </h2>

              {status.ollamaError ? <p className={styles.llmEmpty}>{status.ollamaError}</p> : null}
              {status.lmStudioError ? <p className={styles.llmEmpty}>{status.lmStudioError}</p> : null}
              {status.openCodeError ? <p className={styles.llmEmpty}>{status.openCodeError}</p> : null}
              {status.cloudCatalog?.opencode?.fromCache ? (
                <p className={styles.llmEmpty}>
                  Cloud catalog served from configs/cloud-model-catalog.json
                  {status.cloudCatalog.opencode.fetchedAt
                    ? ` (updated ${new Date(status.cloudCatalog.opencode.fetchedAt).toLocaleString()})`
                    : ''}
                  .
                </p>
              ) : null}

              {allModelDetails.length === 0 ? (
                <p className={styles.llmEmpty}>
                  No models found — are Ollama or LM Studio running, or cloud keys configured?
                </p>
              ) : (
                <LlmModelInfoList models={allModelDetails} />
              )}
            </section>

            <section className={`${styles.llmSection} ${styles.llmSectionMuted}`}>
              <h2 className={styles.llmSectionHeading}>Env overrides</h2>
              <dl className={styles.envGrid}>
                <dt>LLAAB_LOCAL_SMALL_MODEL</dt>
                <dd>local-small tier default</dd>
                <dt>LLAAB_LOCAL_MID_MODEL</dt>
                <dd>local-mid tier default</dd>
                <dt>LLAAB_REMOTE_MODEL</dt>
                <dd>remote tier default</dd>
                <dt>OPENCODE_BASE_URL</dt>
                <dd>OpenCode OpenAI-compatible endpoint</dd>
                <dt>OPENCODE_MODEL</dt>
                <dd>OpenCode default model</dd>
              </dl>
            </section>
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
}

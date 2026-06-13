import { useQuery } from '@tanstack/react-query';
import { LlmModelInfoList } from 'components/LlmModelInfoList/LlmModelInfoList';
import { LlmRoutingEditor } from 'components/LlmRoutingEditor/LlmRoutingEditor';
import { PageHero } from 'components/PageHero/PageHero';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { QUERY_KEYS } from 'queries/llm';

import { apiGet } from 'lib/api-client';
import { usePageTitle } from 'lib/use-page-title';

import styles from './llm.module.css';

interface RoutingEntry {
  tier: 'local-small' | 'local-mid' | 'local-strong' | 'remote';
  model: string;
  provider: 'ollama' | 'anthropic';
}

interface LlmStatusResponse {
  routing: Record<
    'route' | 'format' | 'extract' | 'consolidate' | 'code' | 'reason' | 'reason-plus' | 'vision' | 'speech',
    RoutingEntry
  >;
  modelMap: Record<string, string>;
  installedModelDetails: Array<{
    digest?: string;
    details?: {
      families?: string[];
      family?: string;
      format?: string;
      parameter_size?: string;
      parent_model?: string;
      quantization_level?: string;
    };
    modified_at?: Date | string;
    name: string;
    size?: number;
  }>;
  installedModels: string[];
  ollamaError?: string;
}

export function LlmPage() {
  usePageTitle('LLM Status');

  const { data: status, error } = useQuery({
    queryKey: QUERY_KEYS.llm.status(),
    queryFn: () => apiGet<LlmStatusResponse>('/api/llm/status'),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const fetchError = error instanceof Error ? error.message : error ? 'Failed to reach server' : null;

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Models"
          title="Status"
          description="Active model routing and installed Ollama models."
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
                installedModels={status.installedModels}
                remoteModels={[status.modelMap.remote].filter(Boolean)}
              />
            </section>

            <section className={styles.llmSection}>
              <h2 className={styles.llmSectionHeading}>
                Installed Ollama models
                {status.ollamaError ? (
                  <span className={`${styles.llmSectionBadge} ${styles.llmSectionBadgeErr}`}>offline</span>
                ) : (
                  <span className={`${styles.llmSectionBadge} ${styles.llmSectionBadgeOk}`}>
                    {status.installedModels.length} models
                  </span>
                )}
              </h2>

              {status.ollamaError ? <p className={styles.llmEmpty}>{status.ollamaError}</p> : null}

              {!status.ollamaError && status.installedModels.length === 0 ? (
                <p className={styles.llmEmpty}>No models found — is Ollama running?</p>
              ) : null}

              {status.installedModelDetails.length > 0 ? (
                <LlmModelInfoList models={status.installedModelDetails} />
              ) : null}
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
              </dl>
            </section>
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
}

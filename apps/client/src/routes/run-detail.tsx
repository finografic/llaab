import { JsonData } from 'components/JsonData/JsonData';
import { ModelMetaCard } from 'components/ModelMetaCard';
import { PageHero } from 'components/PageHero/PageHero';
import { PageDetail } from 'layouts/PageDetail/PageDetail';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { useVaultNode } from 'queries/vault';
import { Navigate, useParams } from 'react-router-dom';
import type { RunNode } from '@llaab/schemas';
import type { JsonDataLinkRule } from 'components/JsonData/JsonData';

import { usePageTitle } from 'lib/use-page-title';
import { formatDetailDate, formatDurationMs } from 'utils/format-date.utils';

import styles from './run-detail.module.css';

const RUN_JSON_LINK_RULES = [
  { key: 'id', href: '/vault/transcripts/:value', when: { key: 'type', equals: 'transcript' } },
  { key: 'id', href: '/vault/sources/:value', when: { key: 'type', equals: 'source' } },
  { key: 'id', href: '/vault/nodes/:value' },
  { key: 'sourceId', href: '/vault/sources/:value' },
  { parentKey: 'producedNodeIds', href: '/vault/nodes/:value' },
] satisfies JsonDataLinkRule[];

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: node, isLoading } = useVaultNode(id);
  const run: RunNode | undefined = node?.type === 'run' ? (node) : undefined;

  usePageTitle(run?.title ?? 'Run');

  if (!id) return <Navigate to="/vault/runs" replace />;
  if (!isLoading && !run) return <Navigate to="/vault/runs" replace />;
  if (!run) {
    return (
      <PageLayout hero={<PageHero eyebrow="Execute" title="Loading…" />}>
        <p className="text-muted-foreground text-sm">Loading run…</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Execute"
          title={run.title}
          meta={
            <>
              <span className={`badge badge--${run.run_status}`}>{run.run_status}</span>
              <span className="meta-sep">·</span>
              <span className="meta-text">{formatDetailDate(run.started_at ?? run.created_at)}</span>
              {run.duration_ms != null ? (
                <>
                  <span className="meta-sep">·</span>
                  <span className="meta-text">{formatDurationMs(run.duration_ms)}</span>
                </>
              ) : null}
              {run.model_used ? (
                <>
                  <span className="meta-sep">·</span>
                  <span className="meta-text meta-mono">{run.model_used}</span>
                </>
              ) : null}
            </>
          }
        />
      }
    >
      <PageDetail gap="lg">
        {run.llm ? (
          <ModelMetaCard
            title="Run model"
            meta={{
              model: run.llm.model,
              provider: run.llm.provider,
              durationMs: run.llm.duration_ms,
              promptTokens: run.llm.prompt_tokens,
              completionTokens: run.llm.completion_tokens,
            }}
          />
        ) : null}

        {(run.input_summary ?? run.output_summary) ? (
          <section className="section">
            <h2 className="section__heading">Summary</h2>
            <dl className="summary-grid">
              {run.input_summary ? (
                <>
                  <dt>Input</dt>
                  <dd>
                    <JsonData value={run.input_summary} linkRules={RUN_JSON_LINK_RULES} />
                  </dd>
                </>
              ) : null}
              {run.output_summary ? (
                <>
                  <dt>Output</dt>
                  <dd>
                    <JsonData value={run.output_summary} linkRules={RUN_JSON_LINK_RULES} />
                  </dd>
                </>
              ) : null}
              {run.produced_node_ids.length > 0 ? (
                <>
                  <dt>Produced</dt>
                  <dd>
                    <ul className={styles.producedList}>
                      {run.produced_node_ids.map((nid) => (
                        <li key={nid} className={styles.producedId}>
                          {nid}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </>
              ) : null}
            </dl>
          </section>
        ) : null}

        {run.stages.length > 0 ? (
          <section className="section">
            <h2 className="section__heading">Stages</h2>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-[var(--bg-subtle)]">
                    <th className="w-10 px-4 py-2 text-center font-medium uppercase tracking-[0.04em] text-muted-foreground whitespace-nowrap">
                      #
                    </th>
                    <th className="px-4 py-2 text-left font-medium uppercase tracking-[0.04em] text-muted-foreground whitespace-nowrap">
                      Stage
                    </th>
                    <th className="px-4 py-2 text-left font-medium uppercase tracking-[0.04em] text-muted-foreground whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left font-medium uppercase tracking-[0.04em] text-muted-foreground whitespace-nowrap">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {run.stages.map((stage, i) => (
                    <tr key={`${stage.name}-${i}`} className="border-b border-border-subtle last:border-0">
                      <td className="w-10 px-4 py-3 text-center font-mono text-muted-foreground align-middle">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground align-middle">{stage.name}</td>
                      <td className="px-4 py-3 align-middle">
                        <span className={`badge badge--stage-${stage.status}`}>{stage.status}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] align-middle">
                        {stage.error ? <span className={styles.stageError}>{stage.error}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {run.decisions.length > 0 ? (
          <section className="section">
            <h2 className="section__heading">Decisions</h2>
            <ul className={styles.decisionList}>
              {run.decisions.map((d, index) => (
                <li key={`${d.type}-${index}`} className={styles.decisionItem}>
                  <span className={`badge badge--decision-${d.type}`}>{d.type}</span>
                  <span className={styles.decisionReason}>{d.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {run.error ? (
          <section className="section">
            <h2 className="section__heading section__heading--error">Error</h2>
            <pre className="error-pre">{run.error}</pre>
          </section>
        ) : null}

        {run.body ? (
          <section className="section">
            <h2 className="section__heading">Notes</h2>
            <pre className="body-pre">{run.body}</pre>
          </section>
        ) : null}
      </PageDetail>
    </PageLayout>
  );
}

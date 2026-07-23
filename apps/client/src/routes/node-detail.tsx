import { ModelMetaCard } from 'components/ModelMetaCard/ModelMetaCard';
import { PageHero } from 'components/PageHero/PageHero';
import { TagList } from 'components/TagList/TagList';
import { PageDetail } from 'layouts/PageDetail/PageDetail';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { useVaultNode } from 'queries/vault';
import { Link, Navigate, useParams } from 'react-router-dom';

import { isInboxCaptureNode } from 'lib/inbox-capture.utils';
import { usePageTitle } from 'lib/use-page-title';
import { formatDetailDate } from 'utils/format-date.utils';

import styles from './node-detail.module.css';

export function NodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: node, isLoading } = useVaultNode(id);

  usePageTitle(node?.title ?? 'Node');

  if (!id) return <Navigate to="/vault/nodes" replace />;
  if (!isLoading && !node) return <Navigate to="/vault/nodes" replace />;
  if (!node) {
    return (
      <PageLayout hero={<PageHero eyebrow="Vault" title="Loading…" />}>
        <p className="text-muted-foreground text-sm">Loading node…</p>
      </PageLayout>
    );
  }

  const idea = node.type === 'idea' ? node : null;
  const skill = node.type === 'skill' ? node : null;
  const prompt = node.type === 'prompt' ? node : null;
  const instruction = node.type === 'instruction' ? node : null;
  const resource = node.type === 'resource' ? node : null;

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Vault"
          title={node.title}
          meta={
            <>
              <span className={`badge badge--${node.type}`}>{node.type}</span>
              <span className={`badge badge--status badge--${node.status}`}>{node.status}</span>
              <span className="meta-sep">·</span>
              <span className="meta-text">{formatDetailDate(node.created_at)}</span>
              {node.updated_at && node.updated_at !== node.created_at ? (
                <>
                  <span className="meta-sep">·</span>
                  <span className="meta-text">updated {formatDetailDate(node.updated_at)}</span>
                </>
              ) : null}
              {isInboxCaptureNode(node) ? (
                <>
                  <span className="meta-sep">·</span>
                  <Link to={`/vault/inbox/${node.id}`} className="meta-link">
                    Open inbox capture
                  </Link>
                </>
              ) : null}
            </>
          }
        />
      }
    >
      <PageDetail variant="narrow">
        <TagList tags={node.tags} />

        {idea ? (
          <ModelMetaCard
            title="Extraction model"
            meta={{
              model: idea.llm_model,
              provider: idea.llm_provider,
              durationMs: idea.llm_duration_ms,
              promptTokens: idea.llm_prompt_tokens,
              completionTokens: idea.llm_completion_tokens,
            }}
          />
        ) : null}

        {node.body ? (
          <section className="section">
            <h2 className="section__heading">Body</h2>
            <pre className="body-pre">{node.body}</pre>
          </section>
        ) : null}

        {idea ? (
          <section className="section">
            <h2 className="section__heading">Details</h2>
            <dl className="meta-grid">
              <dt>Origin</dt>
              <dd>
                <span className={`badge badge--origin-${idea.origin}`}>{idea.origin}</span>
              </dd>
              {idea.source_id ? (
                <>
                  <dt>Source</dt>
                  <dd>
                    <Link to={`/vault/nodes/${idea.source_id}`} className="meta-link">
                      {idea.source_id}
                    </Link>
                  </dd>
                </>
              ) : null}
            </dl>
          </section>
        ) : null}

        {resource ? (
          <section className="section">
            <h2 className="section__heading">Details</h2>
            <dl className="meta-grid">
              <dt>Type</dt>
              <dd>
                <span className="badge badge--resource-type">{resource.resource_type}</span>
              </dd>
              {resource.url ? (
                <>
                  <dt>URL</dt>
                  <dd>
                    <a
                      href={resource.url}
                      className="meta-link meta-mono"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {resource.url}
                    </a>
                  </dd>
                </>
              ) : null}
              {resource.description ? (
                <>
                  <dt>Description</dt>
                  <dd className="meta-text">{resource.description}</dd>
                </>
              ) : null}
              {resource.source_id ? (
                <>
                  <dt>Source</dt>
                  <dd>
                    <Link to={`/vault/nodes/${resource.source_id}`} className="meta-link">
                      {resource.source_id}
                    </Link>
                  </dd>
                </>
              ) : null}
            </dl>
          </section>
        ) : null}

        {skill ? (
          <section className="section">
            <h2 className="section__heading">Details</h2>
            <dl className="meta-grid">
              {skill.version ? (
                <>
                  <dt>Version</dt>
                  <dd className="meta-mono">{skill.version}</dd>
                </>
              ) : null}
              <dt>Generation</dt>
              <dd className="meta-mono">{skill.generation}</dd>
              {skill.inputs.length > 0 ? (
                <>
                  <dt>Inputs</dt>
                  <dd>
                    <ul className={styles.chipList}>
                      {skill.inputs.map((s) => (
                        <li key={s} className={styles.chip}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </>
              ) : null}
              {skill.outputs.length > 0 ? (
                <>
                  <dt>Outputs</dt>
                  <dd>
                    <ul className={styles.chipList}>
                      {skill.outputs.map((s) => (
                        <li key={s} className={styles.chip}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </>
              ) : null}
              {skill.tools.length > 0 ? (
                <>
                  <dt>Tools</dt>
                  <dd>
                    <ul className={styles.chipList}>
                      {skill.tools.map((s) => (
                        <li key={s} className={styles.chip}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </>
              ) : null}
              {skill.source_id ? (
                <>
                  <dt>Source</dt>
                  <dd>
                    <Link to={`/vault/nodes/${skill.source_id}`} className="meta-link">
                      {skill.source_id}
                    </Link>
                  </dd>
                </>
              ) : null}
              {skill.parent_skill_id ? (
                <>
                  <dt>Parent skill</dt>
                  <dd>
                    <Link to={`/vault/nodes/${skill.parent_skill_id}`} className="meta-link">
                      {skill.parent_skill_id}
                    </Link>
                  </dd>
                </>
              ) : null}
              {skill.derived_from_ids.length > 0 ? (
                <>
                  <dt>Derived from</dt>
                  <dd>
                    <ul className={styles.chipList}>
                      {skill.derived_from_ids.map((sid) => (
                        <li key={sid} className={styles.chip}>
                          <Link to={`/vault/nodes/${sid}`} className="meta-link">
                            {sid}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </>
              ) : null}
            </dl>
          </section>
        ) : null}

        {prompt && (prompt.variables.length > 0 || prompt.model_hint || prompt.output_schema) ? (
          <section className="section">
            <h2 className="section__heading">Details</h2>
            <dl className="meta-grid">
              {prompt.model_hint ? (
                <>
                  <dt>Model hint</dt>
                  <dd className="meta-mono">{prompt.model_hint}</dd>
                </>
              ) : null}
              {prompt.variables.length > 0 ? (
                <>
                  <dt>Variables</dt>
                  <dd>
                    <ul className={styles.chipList}>
                      {prompt.variables.map((v) => (
                        <li key={v} className={`${styles.chip} ${styles.chipVar}`}>{`{{${v}}}`}</li>
                      ))}
                    </ul>
                  </dd>
                </>
              ) : null}
              {prompt.output_schema ? (
                <>
                  <dt>Output schema</dt>
                  <dd className="meta-mono">{prompt.output_schema}</dd>
                </>
              ) : null}
            </dl>
          </section>
        ) : null}

        {instruction?.scope ? (
          <section className="section">
            <h2 className="section__heading">Details</h2>
            <dl className="meta-grid">
              <dt>Scope</dt>
              <dd className="meta-text">{instruction.scope}</dd>
            </dl>
          </section>
        ) : null}

        {node.related.length > 0 ? (
          <section className="section">
            <h2 className="section__heading">Related</h2>
            <ul className={styles.relatedList}>
              {node.related.map((rel) => (
                <li key={rel}>
                  <Link to={`/vault/nodes/${rel}`} className="meta-link meta-mono">
                    {rel}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PageDetail>
    </PageLayout>
  );
}

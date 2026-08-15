import { scoreConsolidationQuality } from '@llaab/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { DeleteExtractedIdeaAction } from 'components/DeleteExtractedIdeaAction/DeleteExtractedIdeaAction';
import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { ExtractionRunsSelector, SourceBodySection } from 'components/KnowledgeSourceDetail';
import { CONSOLIDATION_SKILL_ID } from 'components/RunPipelineCard/RunPipelineCard';
import { SplitTagList } from 'components/TagList/TagList';
import { Button } from 'components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'components/ui/collapsible';
import { Col, Row } from 'components/ui/grid';
import { WikiDraftComposer } from 'components/WikiDraftComposer';
import { SparklesIcon } from 'lucide-react';
import { useConsolidateResourceIdeas } from 'queries/resources';
import { QUERY_KEYS as RUN_KEYS, useRunMonitor } from 'queries/runs';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type {
  CanonicalIdeaNode,
  ConsolidationQualityCanonical,
  IdeaNode,
  ResourceNode,
} from '@llaab/schemas';
import type { KnowledgeSourceExtractionRun } from 'components/KnowledgeSourceDetail';

import { heartbeatStore } from 'lib/heartbeat';

import { fmtDetailDate, fmtListDateNumeric, splitTags } from '../TranscriptsSplitView/transcript-split.utils';
import styles from './ArticleDetail.module.css';

interface ArticleDetailProps {
  resource: ResourceNode;
  extractedIdeas: IdeaNode[];
  canonicalIdeas: CanonicalIdeaNode[];
  extractionRuns: ArticleExtractionRun[];
}

export interface ArticleExtractionRun extends KnowledgeSourceExtractionRun {
  ideas: IdeaNode[];
}

const EXTRACT_RESOURCE_SKILL_ID = 'extract-resource-ideas';

function parseExtractRunResourceId(inputSummary: string | undefined): string | undefined {
  if (!inputSummary) return undefined;
  try {
    const parsed = JSON.parse(inputSummary) as { resource?: { id?: unknown }; resourceId?: unknown };
    if (typeof parsed.resourceId === 'string') return parsed.resourceId;
    return typeof parsed.resource?.id === 'string' ? parsed.resource.id : undefined;
  } catch {
    return undefined;
  }
}

function parseConsolidateRunResourceId(inputSummary: string | undefined): string | undefined {
  if (!inputSummary) return undefined;
  try {
    const parsed = JSON.parse(inputSummary) as { sourceNodeId?: unknown; transcriptId?: unknown };
    if (typeof parsed.sourceNodeId === 'string') return parsed.sourceNodeId;
    return typeof parsed.transcriptId === 'string' ? parsed.transcriptId : undefined;
  } catch {
    return undefined;
  }
}

export function ArticleDetail({
  resource,
  extractedIdeas,
  canonicalIdeas,
  extractionRuns,
}: ArticleDetailProps) {
  const [extractStatus, setExtractStatus] = useState('');
  const [extractStatusClass, setExtractStatusClass] = useState('text-[11px]');
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState(() => extractionRuns[0]?.id ?? 'article');
  const [extractedIdeasOpen, setExtractedIdeasOpen] = useState(() => canonicalIdeas.length === 0);
  const queryClient = useQueryClient();
  const consolidateMutation = useConsolidateResourceIdeas();
  const [consolidateStartedAtMs, setConsolidateStartedAtMs] = useState<number | null>(null);

  const selectedRun = useMemo(
    () => extractionRuns.find((run) => run.id === selectedRunId) ?? extractionRuns[0],
    [extractionRuns, selectedRunId],
  );
  const visibleIdeas = selectedRun?.ideas ?? extractedIdeas;
  const visibleIdeaCount = selectedRun?.ideaIds.length ?? resource.extracted_idea_ids.length;
  const hasCanonicalIdeas = canonicalIdeas.length > 0;

  useEffect(() => {
    setExtractedIdeasOpen(!hasCanonicalIdeas);
  }, [hasCanonicalIdeas, resource.id]);

  const selectedMeta = selectedRun ?? {
    model: resource.llm_model,
    provider: resource.llm_provider,
    durationMs: resource.llm_duration_ms,
    promptTokens: resource.llm_prompt_tokens,
    completionTokens: resource.llm_completion_tokens,
  };
  const hasModelMeta = Boolean(
    selectedMeta.model ||
    selectedMeta.provider ||
    selectedMeta.durationMs != null ||
    selectedMeta.promptTokens != null ||
    selectedMeta.completionTokens != null,
  );

  const { data: monitorData } = useRunMonitor();
  const activeConsolidateRun = useMemo(
    () =>
      monitorData?.active.find(
        (run) =>
          run.skill_id === CONSOLIDATION_SKILL_ID &&
          parseConsolidateRunResourceId(run.input_summary) === resource.id,
      ),
    [monitorData, resource.id],
  );
  const activeExtractRun = useMemo(
    () =>
      monitorData?.active.find(
        (run) =>
          run.skill_id === EXTRACT_RESOURCE_SKILL_ID &&
          parseExtractRunResourceId(run.input_summary) === resource.id,
      ),
    [monitorData, resource.id],
  );
  const isConsolidating = consolidateMutation.isPending || activeConsolidateRun != null;
  const isExtractingActive = isExtracting || activeExtractRun != null;
  const displayExtractStatus = activeExtractRun ? 'Extracting ideas...' : extractStatus;
  const displayExtractStatusClass = activeExtractRun ? 'text-[11px] text-accent' : extractStatusClass;
  const canConsolidate = extractionRuns.some((run) => run.ideaIds.length > 0);

  const coveredCandidateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const idea of canonicalIdeas) {
      for (const candidateId of idea.source_candidate_idea_ids) ids.add(candidateId);
    }
    return ids;
  }, [canonicalIdeas]);

  const qualityScore = useMemo(() => {
    if (canonicalIdeas.length === 0) return null;
    if (resource.canonical_coverage?.quality_score != null) return resource.canonical_coverage.quality_score;

    const candidates = extractedIdeas.map((idea) => {
      const { domain: ideaDomains, generated: ideaTags } = splitTags(idea.tags);
      return {
        id: idea.id,
        title: idea.title,
        body: idea.body || undefined,
        domains: ideaDomains,
        tags: ideaTags,
      };
    });
    const canonicalForScore: ConsolidationQualityCanonical[] = canonicalIdeas.map((idea) => ({
      title: idea.title,
      body: idea.body ?? '',
      tags: idea.tags,
      keyClaims: idea.key_claims,
      sourceCandidateIdeaIds: idea.source_candidate_idea_ids,
    }));

    return scoreConsolidationQuality(candidates, canonicalForScore, coveredCandidateIds);
  }, [canonicalIdeas, coveredCandidateIds, extractedIdeas, resource.canonical_coverage?.quality_score]);

  async function handleReExtract() {
    setIsExtracting(true);
    setExtractStatus('');
    setExtractStatusClass('text-[11px]');

    try {
      const response = await fetch(`/api/vault/resources/${resource.id}/extract`, { method: 'POST' });
      const json = (await response.json()) as { success: boolean; ideaIds?: string[]; error?: string };
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });

      if (json.success) {
        setExtractStatus(`✓ ${json.ideaIds?.length ?? 0} ideas extracted — reloading…`);
        setExtractStatusClass('text-[11px] text-emerald-600 dark:text-emerald-400');
        setTimeout(() => location.reload(), 1200);
      } else {
        setExtractStatus(json.error ?? 'Extraction failed');
        setExtractStatusClass('text-[11px] text-destructive');
        setIsExtracting(false);
      }
    } catch {
      setExtractStatus('Network error');
      setExtractStatusClass('text-[11px] text-destructive');
      setIsExtracting(false);
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
    }
  }

  function handleConsolidate() {
    const startedAt = heartbeatStore.getState().now;
    setConsolidateStartedAtMs(startedAt);

    consolidateMutation.mutate(
      { resourceId: resource.id },
      {
        onSuccess: (data) => {
          if (data.success && data.canonicalIdeaIds.length > 0) {
            setExtractedIdeasOpen(false);
          }
          void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('resource') });
        },
        onSettled: () => {
          setConsolidateStartedAtMs(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Consolidation failed.');
        },
      },
    );
  }

  return (
    <div className="page-detail flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Vault</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{resource.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="badge badge--article">article</span>
          {resource.author ? <span className="meta-text">{resource.author}</span> : null}
          {resource.author ? <span className="meta-sep">·</span> : null}
          <span className="meta-text">{fmtDetailDate(resource.created_at)}</span>
        </div>
      </header>

      {resource.tags.length > 0 ? (
        <SplitTagList
          tags={resource.tags}
          domainClassName="tag-row tag-row--domain"
          generatedClassName="tag-row tag-row--topic"
        />
      ) : null}

      <section className="section">
        <h2 className="section__heading">Source</h2>
        <dl className="meta-grid">
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
          {resource.source_id ? (
            <>
              <dt>Source node</dt>
              <dd>
                <Link to={`/vault/sources/${resource.source_id}`} className="meta-link">
                  {resource.source_id}
                </Link>
              </dd>
            </>
          ) : null}
          {resource.site_name ? (
            <>
              <dt>Site</dt>
              <dd>{resource.site_name}</dd>
            </>
          ) : null}
          {resource.source_published_at ? (
            <>
              <dt>Published</dt>
              <dd>{fmtDetailDate(resource.source_published_at)}</dd>
            </>
          ) : null}
          {resource.fetched_at ? (
            <>
              <dt>Fetched</dt>
              <dd>{fmtDetailDate(resource.fetched_at)}</dd>
            </>
          ) : null}
          {resource.content_hash || resource.content_truncated != null ? (
            <>
              <dt>Stats</dt>
              <dd>
                <span className={styles.statRow}>
                  {resource.content_hash ? <span className={styles.stat}>content hashed</span> : null}
                  {resource.content_truncated ? <span className={styles.stat}>truncated</span> : null}
                </span>
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <ExtractionRunsSelector
        runs={extractionRuns}
        selectedRunId={selectedRun?.id ?? selectedRunId}
        inputIdPrefix="article-run"
        onSelectedRunIdChange={setSelectedRunId}
        formatRunTitle={(run) => (run.startedAt ? fmtListDateNumeric(run.startedAt) : 'Run')}
      />

      {hasModelMeta ? (
        <ExtractionModelCard
          variant="full"
          model={selectedMeta.model}
          provider={selectedMeta.provider}
          durationMs={selectedMeta.durationMs}
          promptTokens={selectedMeta.promptTokens}
          completionTokens={selectedMeta.completionTokens}
        />
      ) : null}

      {resource.description ? (
        <section className="section">
          <h2 className="section__heading">Summary</h2>
          <p className="summary-text">{resource.description}</p>
        </section>
      ) : null}

      <section className="section">
        <h2 className={`section__heading ${styles.canonicalIdeasHeading}`}>
          <span className={styles.canonicalIdeasHeadingMain}>
            Canonical ideas
            {canonicalIdeas.length > 0 ? (
              <span className="section__count">{canonicalIdeas.length}</span>
            ) : null}
            {qualityScore != null ? (
              <strong className={styles.qualityScore} title="Consolidation quality score">
                {qualityScore}% quality
              </strong>
            ) : null}
          </span>
          <div className={styles.consolidateActions}>
            {canConsolidate ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={styles.consolidateButton}
                disabled={isConsolidating || consolidateStartedAtMs != null}
                title="Create canonical ideas from all extraction runs."
                onClick={handleConsolidate}
              >
                <SparklesIcon aria-hidden="true" />
                {isConsolidating ? 'Consolidating…' : 'Consolidate Canonical Ideas'}
              </Button>
            ) : null}
          </div>
        </h2>
        <WikiDraftComposer sourceId={resource.id} sourceType="resource" canonicalIdeas={canonicalIdeas} />
        {canonicalIdeas.length === 0 ? (
          <p className={styles.emptyNote}>No canonical ideas consolidated yet.</p>
        ) : (
          <ul className={styles.ideaList}>
            {canonicalIdeas.map((idea) => (
              <li key={idea.id} className={styles.canonicalIdeaItem}>
                <Link to={`/vault/nodes/${idea.id}`} className={styles.ideaLink}>
                  <Row className="w-full" justify="space-between">
                    <Col xs={10}>
                      <p className={styles.ideaTitle}>{idea.title}</p>
                    </Col>
                    <Col xs={2} className={styles.canonicalIdeaDate}>
                      {fmtListDateNumeric(idea.created_at)}
                    </Col>
                  </Row>
                  {idea.body ? <p className={styles.canonicalIdeaBody}>{idea.body}</p> : null}
                  {idea.key_claims.length > 0 ? (
                    <ul className={styles.keyClaimsList}>
                      {idea.key_claims.map((claim) => (
                        <li key={claim}>{claim}</li>
                      ))}
                    </ul>
                  ) : null}
                  {idea.coverage_notes ? <p className={styles.coverageNotes}>{idea.coverage_notes}</p> : null}
                  <Row justify="space-between" className={styles.canonicalIdeaMetaRow}>
                    <Col xs="content" className={styles.canonicalIdeaMeta}>
                      {idea.confidence ? `${idea.confidence} confidence` : 'canonical'}
                      {' · '}
                      {idea.source_candidate_idea_ids.length} source
                      {idea.source_candidate_idea_ids.length === 1 ? '' : 's'}
                    </Col>
                  </Row>
                  <SplitTagList
                    tags={idea.tags}
                    size="sm"
                    domainClassName={`${styles.ideaTags} idea-tags--domain`}
                    generatedClassName={`${styles.ideaTags} idea-tags--topic`}
                    as="span"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <Collapsible open={extractedIdeasOpen} onOpenChange={setExtractedIdeasOpen}>
          <div className={styles.extractedIdeasHeader}>
            <CollapsibleTrigger className={styles.extractedIdeasTrigger}>
              <span className={styles.extractedIdeasHeadingLabel}>
                Extracted ideas
                {visibleIdeaCount > 0 ? <span className="section__count">{visibleIdeaCount}</span> : null}
              </span>
            </CollapsibleTrigger>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto shrink-0 cursor-pointer rounded-sm border-border-subtle px-2.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-50"
              disabled={isExtractingActive}
              onClick={() => void handleReExtract()}
            >
              {isExtractingActive ? 'Extracting...' : visibleIdeaCount > 0 ? 'Re-extract' : 'Extract now'}
            </Button>
            {displayExtractStatus ? (
              <span
                className={`normal-case text-[11px] font-normal tracking-normal ${displayExtractStatusClass}`}
              >
                {displayExtractStatus}
              </span>
            ) : null}
          </div>
          <CollapsibleContent className={styles.extractedIdeasContent}>
            {visibleIdeaCount === 0 ? <p className={styles.emptyNote}>No ideas extracted yet.</p> : null}
            {visibleIdeaCount > 0 && visibleIdeas.length > 0 ? (
              <ul className={styles.ideaList}>
                {visibleIdeas.map((idea) => (
                  <li key={idea.id} className={styles.ideaItem}>
                    <Row className={styles.ideaRow} align="flex-start" wrap="nowrap" nogutter>
                      <Col className={styles.ideaMain}>
                        <Link to={`/vault/nodes/${idea.id}`} className={styles.ideaLink}>
                          <p className={styles.ideaTitle}>{idea.title}</p>
                          <SplitTagList
                            tags={idea.tags}
                            size="sm"
                            domainClassName={`${styles.ideaTags} idea-tags--domain`}
                            generatedClassName={`${styles.ideaTags} idea-tags--topic`}
                            as="span"
                          />
                        </Link>
                      </Col>
                      <Col xs="content" className={styles.ideaActions}>
                        <DeleteExtractedIdeaAction idea={idea} />
                      </Col>
                    </Row>
                  </li>
                ))}
              </ul>
            ) : null}
            {visibleIdeaCount > 0 && visibleIdeas.length === 0 ? (
              <p className={styles.emptyNote}>Ideas listed by ID but nodes not found in vault.</p>
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      </section>

      <SourceBodySection sourceId={resource.id} title="Article" body={resource.body} />
    </div>
  );
}

import { BrushCleaningIcon, TimerIcon } from '@llaab/icons';
import { scoreConsolidationQuality } from '@llaab/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { CONSOLIDATION_SKILL_ID } from 'components/RunPipelineCard/RunPipelineCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'components/ui/alert-dialog';
import { Button } from 'components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'components/ui/collapsible';
import { Col, Row } from 'components/ui/grid';
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group';
import { HashIcon, SparklesIcon } from 'lucide-react';
import { QUERY_KEYS as RUN_KEYS, useRunMonitor } from 'queries/runs';
import {
  useCleanCanonicalIdeaArtifacts,
  useConsolidateCanonicalIdeas,
  usePromoteCanonicalIdea,
} from 'queries/transcripts';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type {
  CanonicalIdeaNode,
  ConsolidationQualityCanonical,
  IdeaNode,
  TranscriptNode,
} from '@llaab/schemas';

import { heartbeatStore, useElapsedMs } from 'lib/heartbeat';
import { parseConsolidateRunTranscriptId } from 'utils/canonical-idea-conflict.utils';
import { formatDurationMs } from 'utils/format-date.utils';

import { fmtDetailDate, fmtListDateNumeric, splitTags } from '../transcript-split.utils';
import styles from './TranscriptDetail.module.css';

export interface TranscriptDetailProps {
  transcript: TranscriptNode;
  extractedIdeas: IdeaNode[];
  canonicalIdeas?: CanonicalIdeaNode[];
  extractionRuns?: TranscriptExtractionRun[];
}

export interface TranscriptExtractionRun {
  id: string;
  title: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  ideaIds: string[];
  ideas: IdeaNode[];
}

const EMPTY_EXTRACTION_RUNS: TranscriptExtractionRun[] = [];
const EMPTY_CANONICAL_IDEAS: CanonicalIdeaNode[] = [];

function fmtRunDate(value?: string) {
  if (!value) return 'Run';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hasExtractionMeta(run: TranscriptExtractionRun) {
  return Boolean(
    run.model ||
    run.provider ||
    run.durationMs != null ||
    run.promptTokens != null ||
    run.completionTokens != null,
  );
}

function formatTokenCount(value: number) {
  return value.toLocaleString();
}

export function TranscriptDetail({
  transcript,
  extractedIdeas,
  canonicalIdeas = EMPTY_CANONICAL_IDEAS,
  extractionRuns = EMPTY_EXTRACTION_RUNS,
}: TranscriptDetailProps) {
  const [extractStatus, setExtractStatus] = useState('');
  const [extractStatusClass, setExtractStatusClass] = useState('text-[11px]');
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState(() => extractionRuns[0]?.id ?? 'transcript');
  const queryClient = useQueryClient();
  const consolidateMutation = useConsolidateCanonicalIdeas();
  const cleanArtifactsMutation = useCleanCanonicalIdeaArtifacts();
  const [showCleanConfirm, setShowCleanConfirm] = useState(false);
  const promoteMutation = usePromoteCanonicalIdea();
  const { mutate: promoteMutate, isPending: isPromotePending, variables: promoteVariables } = promoteMutation;

  const { domain, generated } = splitTags(transcript.tags);
  const selectedRun = useMemo(
    () => extractionRuns.find((run) => run.id === selectedRunId) ?? extractionRuns[0],
    [extractionRuns, selectedRunId],
  );
  const visibleIdeas = selectedRun?.ideas ?? extractedIdeas;
  const visibleIdeaCount = selectedRun?.ideaIds.length ?? transcript.extracted_idea_ids.length;
  const hasCanonicalIdeas = canonicalIdeas.length > 0;
  const ideaTitleById = useMemo(() => {
    const entries = new Map<string, string>();
    for (const idea of extractedIdeas) entries.set(idea.id, idea.title);
    for (const run of extractionRuns) {
      for (const idea of run.ideas) entries.set(idea.id, idea.title);
    }
    return entries;
  }, [extractedIdeas, extractionRuns]);
  const candidateSourceById = useMemo(() => {
    const entries = new Map<
      string,
      { runId: string; model?: string; provider?: string; startedAt?: string }
    >();
    for (const run of extractionRuns) {
      for (const candidateId of run.ideaIds) {
        entries.set(candidateId, {
          runId: run.id,
          model: run.model,
          provider: run.provider,
          startedAt: run.startedAt,
        });
      }
    }
    return entries;
  }, [extractionRuns]);
  const coveredCandidateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const idea of canonicalIdeas) {
      for (const candidateId of idea.source_candidate_idea_ids) ids.add(candidateId);
    }
    return ids;
  }, [canonicalIdeas]);
  const uncoveredCandidateIds = useMemo(
    () => [...ideaTitleById.keys()].filter((candidateId) => !coveredCandidateIds.has(candidateId)),
    [coveredCandidateIds, ideaTitleById],
  );
  const selectedMeta = selectedRun ?? {
    model: transcript.llm_model,
    provider: transcript.llm_provider,
    durationMs: transcript.llm_duration_ms,
    promptTokens: transcript.llm_prompt_tokens,
    completionTokens: transcript.llm_completion_tokens,
  };
  const hasModelMeta = Boolean(
    selectedMeta.model ||
    selectedMeta.provider ||
    selectedMeta.durationMs != null ||
    selectedMeta.promptTokens != null ||
    selectedMeta.completionTokens != null,
  );
  const canConsolidate = extractionRuns.some((run) => run.ideaIds.length > 0);
  const [consolidateStartedAtMs, setConsolidateStartedAtMs] = useState<number | null>(null);
  const [consolidateDurationMs, setConsolidateDurationMs] = useState<number | null>(null);

  // The mutation's own isPending is local component state, lost when this component remounts
  // (e.g. navigating to another transcript and back — see TranscriptsSplitView's `key`). Cross-
  // check the durable Activity Monitor data too, so an in-flight consolidation for *this*
  // transcript still shows its clock/disabled state after a remount, using the run's own
  // started_at instead of a local timestamp.
  const { data: monitorData } = useRunMonitor();
  const activeConsolidateRun = useMemo(
    () =>
      monitorData?.active.find(
        (run) =>
          run.skill_id === CONSOLIDATION_SKILL_ID &&
          parseConsolidateRunTranscriptId(run.input_summary) === transcript.id,
      ),
    [monitorData, transcript.id],
  );
  const isConsolidating = consolidateMutation.isPending || activeConsolidateRun != null;
  const remoteConsolidateStartedAtMs = activeConsolidateRun?.started_at
    ? Date.parse(activeConsolidateRun.started_at)
    : null;
  const consolidateClockStartedAt = consolidateMutation.isPending
    ? consolidateStartedAtMs
    : remoteConsolidateStartedAtMs;
  const liveConsolidateDurationMs = useElapsedMs(isConsolidating ? consolidateClockStartedAt : null);
  const displayConsolidateDurationMs = isConsolidating ? liveConsolidateDurationMs : consolidateDurationMs;
  const showConsolidateClock = isConsolidating || consolidateDurationMs != null;
  const mutationTokenCount =
    consolidateMutation.data?.llmMeta?.promptTokens != null ||
    consolidateMutation.data?.llmMeta?.completionTokens != null
      ? (consolidateMutation.data.llmMeta.promptTokens ?? 0) +
        (consolidateMutation.data.llmMeta.completionTokens ?? 0)
      : undefined;
  const persistedConsolidateTokenCount =
    canonicalIdeas[0]?.llm_prompt_tokens != null || canonicalIdeas[0]?.llm_completion_tokens != null
      ? (canonicalIdeas[0]?.llm_prompt_tokens ?? 0) + (canonicalIdeas[0]?.llm_completion_tokens ?? 0)
      : undefined;
  const displayConsolidateTokenCount = isConsolidating
    ? activeConsolidateRun?.progress_tokens
    : (mutationTokenCount ?? persistedConsolidateTokenCount);
  const showApproximateTokenCount = isConsolidating && displayConsolidateTokenCount != null;
  const coverageAudit = consolidateMutation.data?.coverageAudit;
  const qualityValidation = consolidateMutation.data?.qualityValidation;
  const persistedCoverage = transcript.canonical_coverage;
  const coverageWarningText = coverageAudit?.warning ?? persistedCoverage?.warning;
  const nonQualityCoverageWarning = coverageWarningText?.includes('Consolidation quality check:')
    ? coverageWarningText.split('Consolidation quality check:')[0]?.trim() || undefined
    : coverageWarningText;
  const persistedQualityWarning = persistedCoverage?.warning?.includes('Consolidation quality check:')
    ? persistedCoverage.warning
    : undefined;
  const qualityIssues =
    qualityValidation?.issues ??
    (persistedQualityWarning
      ? [
          {
            code: 'persisted',
            message: persistedQualityWarning.replace(/^Consolidation quality check:\s*/, ''),
          },
        ]
      : []);
  const showQualityWarning =
    (qualityValidation != null && !qualityValidation.passed) || Boolean(persistedQualityWarning);
  const qualityScore = useMemo(() => {
    if (canonicalIdeas.length === 0) return null;
    if (qualityValidation?.score != null) return qualityValidation.score;
    if (persistedCoverage?.quality_score != null) return persistedCoverage.quality_score;

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
  }, [
    canonicalIdeas,
    coveredCandidateIds,
    extractedIdeas,
    persistedCoverage?.quality_score,
    qualityValidation?.score,
  ]);
  const persistedMissed = useMemo(
    () =>
      persistedCoverage?.missed_candidate_idea_ids.map((item) => ({
        candidateId: item.id,
        reason: item.reason ?? '',
      })) ?? [],
    [persistedCoverage],
  );
  const coverageCounts = useMemo(() => {
    if (!coverageAudit && canonicalIdeas.length === 0) return null;
    const covered = coverageAudit
      ? coverageAudit.coverage.filter((item) => item.status === 'covered').length
      : (persistedCoverage?.covered_candidate_idea_ids.length ?? coveredCandidateIds.size);
    const omitted = coverageAudit
      ? coverageAudit.coverage.filter((item) => item.status === 'omitted').length
      : (persistedCoverage?.omitted_candidate_idea_ids.length ?? 0);
    const missed = coverageAudit
      ? coverageAudit.missed.length
      : (persistedCoverage?.missed_candidate_idea_ids.length ?? uncoveredCandidateIds.length);
    const total = coverageAudit
      ? coverageAudit.coverage.length
      : (persistedCoverage?.candidate_idea_ids.length ?? ideaTitleById.size);
    return {
      covered,
      omitted,
      missed,
      total,
      source: coverageAudit ? 'audit' : persistedCoverage ? 'saved-audit' : 'saved',
    };
  }, [
    canonicalIdeas.length,
    coverageAudit,
    coveredCandidateIds.size,
    ideaTitleById.size,
    persistedCoverage,
    uncoveredCandidateIds.length,
  ]);

  async function handleReExtract() {
    setIsExtracting(true);
    setExtractStatus('');
    setExtractStatusClass('text-[11px]');

    try {
      const res = await fetch(`/api/vault/transcripts/${transcript.id}/extract`, { method: 'POST' });
      const json = (await res.json()) as { success: boolean; ideaIds?: string[]; error?: string };

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
    }
  }

  function handleConsolidate(autoRetry?: boolean) {
    const startedAt = heartbeatStore.getState().now;
    setConsolidateStartedAtMs(startedAt);

    consolidateMutation.mutate(
      { transcriptId: transcript.id, autoRetry },
      {
        onSuccess: (data) => {
          // The global CanonicalIdeaConflictWatcher (mounted in AppLayout) owns the
          // replace/keep-existing prompt so it works regardless of which page triggered
          // consolidation or whether the user has since navigated away. Invalidating here just
          // lets it react immediately instead of waiting for its next poll-driven refresh.
          if (data.conflict) {
            void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.list() });
            void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('transcript') });
          }
        },
        onSettled: () => {
          setConsolidateDurationMs(heartbeatStore.getState().now - startedAt);
          setConsolidateStartedAtMs(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Consolidation failed.');
        },
      },
    );
  }

  function handleCleanArtifacts() {
    cleanArtifactsMutation.mutate(transcript.id, {
      onSuccess: (data) => {
        toast.success(
          `Cleaned ${data.deletedCanonicalIdeaCount} canonical idea file${
            data.deletedCanonicalIdeaCount === 1 ? '' : 's'
          } and ${data.deletedRunCount} run${data.deletedRunCount === 1 ? '' : 's'}.`,
        );
        setShowCleanConfirm(false);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to clean canonical idea artifacts.');
      },
    });
  }

  function handlePromote(candidateId: string) {
    promoteMutate(
      { transcriptId: transcript.id, candidateId },
      {
        onSuccess: (data) => {
          toast.success(`Promoted "${data.canonicalIdea.title}" to a canonical idea.`);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to promote idea.');
        },
      },
    );
  }

  function renderPromoteButton(candidateId: string) {
    const pending = isPromotePending && promoteVariables?.candidateId === candidateId;
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={styles.promoteButton}
        disabled={isPromotePending}
        onClick={() => handlePromote(candidateId)}
      >
        {pending ? 'Promoting…' : 'Promote to canonical'}
      </Button>
    );
  }

  function renderCandidateSource(candidateId: string) {
    const source = candidateSourceById.get(candidateId);
    if (!source || (!source.model && !source.provider)) return null;
    const label = [source.provider, source.model].filter(Boolean).join(' · ');
    return (
      <span className={styles.missedIdeaSource}>
        {label}
        {source.startedAt ? ` · ${fmtRunDate(source.startedAt)}` : ''}
      </span>
    );
  }

  return (
    <div className="page-detail flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Vault</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{transcript.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className={`badge badge--${transcript.source_type}`}>{transcript.source_type}</span>
          {transcript.author ? <span className="meta-text">{transcript.author}</span> : null}
          <span className="meta-sep">·</span>
          <span className="meta-text">{fmtDetailDate(transcript.created_at)}</span>
        </div>
      </header>

      {transcript.tags.length > 0 ? (
        <div className="tags">
          {domain.length > 0 ? (
            <div className="tag-row tag-row--domain">
              {domain.map((tag) => (
                <span key={tag} className="tag" data-tag={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {generated.length > 0 ? (
            <div className="tag-row tag-row--topic">
              {generated.map((tag) => (
                <span key={tag} className="tag" data-tag={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="section">
        <h2 className="section__heading">Source</h2>
        <dl className="meta-grid">
          <dt>URL</dt>
          <dd>
            <a
              href={transcript.source_url}
              className="meta-link meta-mono"
              target="_blank"
              rel="noopener noreferrer"
            >
              {transcript.source_url}
            </a>
          </dd>
          {transcript.source_item_id ? (
            <>
              <dt>Item ID</dt>
              <dd className="meta-mono">{transcript.source_item_id}</dd>
            </>
          ) : null}
          {transcript.source_id ? (
            <>
              <dt>Source node</dt>
              <dd>
                <Link to={`/vault/sources/${transcript.source_id}`} className="meta-link">
                  {transcript.source_id}
                </Link>
              </dd>
            </>
          ) : null}
          {transcript.raw_length != null ||
          transcript.clean_length != null ||
          transcript.structured_paragraphs != null ? (
            <>
              <dt>Stats</dt>
              <dd>
                <span className={styles.statRow}>
                  {transcript.raw_length != null ? (
                    <span className={styles.stat}>{transcript.raw_length.toLocaleString()} raw chars</span>
                  ) : null}
                  {transcript.clean_length != null ? (
                    <span className={styles.stat}>
                      {transcript.clean_length.toLocaleString()} clean chars
                    </span>
                  ) : null}
                  {transcript.structured_paragraphs != null ? (
                    <span className={styles.stat}>{transcript.structured_paragraphs} §</span>
                  ) : null}
                </span>
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      {extractionRuns.length > 1 ? (
        <section className="section">
          <h2 className="section__heading">
            Extraction runs
            <span className="section__count">{extractionRuns.length}</span>
          </h2>
          <RadioGroup
            value={selectedRun?.id ?? selectedRunId}
            onValueChange={setSelectedRunId}
            className={styles.runSelector}
          >
            {extractionRuns.map((run) => {
              const inputId = `transcript-run-${run.id}`;
              return (
                <label key={run.id} htmlFor={inputId} className={styles.runOption}>
                  <Row justify="flex-start" align="center">
                    <Col xs={1} className="flex justify-center">
                      <RadioGroupItem id={inputId} value={run.id} className={styles.runOptionRadio} />
                    </Col>
                    <Col xs={11}>
                      <span className={styles.runOptionBody}>
                        <span className={styles.runOptionHeader}>
                          <span className={styles.runOptionTitle}>
                            {run.startedAt ? fmtListDateNumeric(run.startedAt) : 'Run'}
                          </span>
                          <span className={styles.runOptionCount}>{run.ideaIds.length} ideas</span>
                        </span>
                        {hasExtractionMeta(run) ? (
                          <ExtractionModelCard
                            variant="compact-bar"
                            model={run.model}
                            provider={run.provider}
                            promptTokens={run.promptTokens}
                            completionTokens={run.completionTokens}
                            durationMs={run.durationMs}
                            showTotalTokens={false}
                          />
                        ) : null}
                      </span>
                    </Col>
                  </Row>
                </label>
              );
            })}
          </RadioGroup>
        </section>
      ) : null}

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

      {transcript.summary ? (
        <section className="section">
          <h2 className="section__heading">Summary</h2>
          <p className="summary-text">{transcript.summary}</p>
        </section>
      ) : null}

      <section className="section">
        <h2 className={`section__heading ${styles.canonicalIdeasHeading}`}>
          <span className={styles.canonicalIdeasHeadingMain}>
            Canonical ideas
            {canonicalIdeas.length > 0 ? (
              <span className="section__count">{canonicalIdeas.length}</span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={styles.cleanCanonicalIdeasButton}
              disabled={cleanArtifactsMutation.isPending}
              title="Delete all canonical idea files and consolidation runs for this transcript."
              onClick={() => setShowCleanConfirm(true)}
            >
              <BrushCleaningIcon aria-hidden="true" />
            </Button>
            {qualityScore != null ? (
              <strong className={styles.qualityScore} title="Consolidation quality score">
                {qualityScore}% quality
              </strong>
            ) : null}
          </span>
          <div className={styles.consolidateActions}>
            {canConsolidate ? (
              <>
                {showConsolidateClock && displayConsolidateDurationMs != null ? (
                  <span
                    className={styles.consolidateStats}
                    aria-live={isConsolidating ? 'polite' : undefined}
                  >
                    {displayConsolidateTokenCount != null ? (
                      <span
                        className={styles.consolidateTokenCount}
                        title={
                          showApproximateTokenCount
                            ? 'Approximate generated tokens'
                            : 'Last consolidation total tokens'
                        }
                      >
                        <HashIcon size={16} aria-hidden />
                        <span className={styles.consolidateTokenValue}>
                          {showApproximateTokenCount ? '~ ' : ''}
                          {formatTokenCount(displayConsolidateTokenCount)}
                        </span>
                      </span>
                    ) : null}
                    <span
                      className={styles.consolidateClock}
                      title={isConsolidating ? 'Consolidation in progress' : 'Last consolidation duration'}
                    >
                      <TimerIcon size={16} aria-hidden />
                      <span className={styles.consolidateClockTime}>
                        {formatDurationMs(displayConsolidateDurationMs)}
                      </span>
                    </span>
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={styles.consolidateButton}
                  disabled={isConsolidating}
                  title="Create canonical ideas from all extraction runs."
                  onClick={() => handleConsolidate()}
                >
                  <SparklesIcon aria-hidden="true" />
                  {isConsolidating ? 'Consolidating…' : 'Consolidate Canonical Ideas'}
                </Button>
              </>
            ) : null}
          </div>
        </h2>
        {coverageCounts ? (
          <div className={styles.coverageSummary}>
            <span>{coverageCounts.covered} covered</span>
            {coverageCounts.source === 'audit' ? <span>{coverageCounts.omitted} omitted</span> : null}
            <span>
              {coverageCounts.missed} {coverageCounts.source === 'audit' ? 'missed' : 'uncovered'}
            </span>
            <span>
              {coverageCounts.total} candidates {coverageCounts.source === 'saved' ? 'linked' : 'audited'}
            </span>
          </div>
        ) : null}
        {nonQualityCoverageWarning ? (
          <p className={styles.coverageWarning}>Coverage audit warning: {nonQualityCoverageWarning}</p>
        ) : null}
        {showQualityWarning ? (
          <div className={styles.qualityWarning}>
            <p className={styles.qualityWarningLead}>This consolidation looks incomplete.</p>
            {qualityIssues.length > 0 ? (
              <ul className={styles.qualityWarningList}>
                {qualityIssues.map((issue) => (
                  <li key={issue.code}>{issue.message}</li>
                ))}
              </ul>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={styles.qualityRegenerateButton}
              disabled={isConsolidating}
              onClick={() => handleConsolidate(false)}
            >
              {isConsolidating ? 'Regenerating…' : 'Regenerate'}
            </Button>
          </div>
        ) : null}
        {coverageAudit && coverageAudit.missed.length > 0 ? (
          <details className={styles.missedIdeasPanel}>
            <summary>Possible missed ideas</summary>
            <ul className={styles.missedIdeasList}>
              {coverageAudit.missed.map((item) => (
                <li key={item.candidateId} className={styles.missedIdeaItem}>
                  <span className={styles.missedIdeaTitle}>
                    {ideaTitleById.get(item.candidateId) ?? item.candidateId}
                  </span>
                  {renderCandidateSource(item.candidateId)}
                  {item.reason ? <span className={styles.missedIdeaReason}>{item.reason}</span> : null}
                  {renderPromoteButton(item.candidateId)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {!coverageAudit && persistedMissed.length > 0 ? (
          <details className={styles.missedIdeasPanel}>
            <summary>Possible missed ideas</summary>
            <ul className={styles.missedIdeasList}>
              {persistedMissed.map((item) => (
                <li key={item.candidateId} className={styles.missedIdeaItem}>
                  <span className={styles.missedIdeaTitle}>
                    {ideaTitleById.get(item.candidateId) ?? item.candidateId}
                  </span>
                  {renderCandidateSource(item.candidateId)}
                  {item.reason ? <span className={styles.missedIdeaReason}>{item.reason}</span> : null}
                  {renderPromoteButton(item.candidateId)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {!coverageAudit && !persistedCoverage && uncoveredCandidateIds.length > 0 ? (
          <details className={styles.missedIdeasPanel}>
            <summary>Uncovered candidate ideas</summary>
            <ul className={styles.missedIdeasList}>
              {uncoveredCandidateIds.map((candidateId) => (
                <li key={candidateId} className={styles.missedIdeaItem}>
                  <span className={styles.missedIdeaTitle}>
                    {ideaTitleById.get(candidateId) ?? candidateId}
                  </span>
                  {renderCandidateSource(candidateId)}
                  <span className={styles.missedIdeaReason}>
                    No saved canonical idea currently references this candidate.
                  </span>
                  {renderPromoteButton(candidateId)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {canonicalIdeas.length === 0 ? (
          <p className={styles.emptyNote}>No canonical ideas consolidated yet.</p>
        ) : (
          <ul className={styles.ideaList}>
            {canonicalIdeas.map((idea) => {
              const ideaTags = splitTags(idea.tags);
              return (
                <li key={idea.id} className={styles.canonicalIdeaItem}>
                  <Link to={`/vault/nodes/${idea.id}`} className={styles.ideaLink}>
                    <span className={styles.canonicalIdeaHeader}>
                      <p className={styles.ideaTitle}>{idea.title}</p>
                      <span className={styles.canonicalIdeaMeta}>
                        {idea.confidence ? `${idea.confidence} confidence` : 'canonical'}
                        {' · '}
                        {idea.source_candidate_idea_ids.length} source
                        {idea.source_candidate_idea_ids.length === 1 ? '' : 's'}
                      </span>
                    </span>
                    {idea.body ? <p className={styles.canonicalIdeaBody}>{idea.body}</p> : null}
                    {idea.key_claims.length > 0 ? (
                      <ul className={styles.keyClaimsList}>
                        {idea.key_claims.map((claim) => (
                          <li key={claim}>{claim}</li>
                        ))}
                      </ul>
                    ) : null}
                    {idea.coverage_notes ? (
                      <p className={styles.coverageNotes}>{idea.coverage_notes}</p>
                    ) : null}
                    <div className="tags">
                      {ideaTags.domain.length > 0 ? (
                        <span className={`${styles.ideaTags} idea-tags--domain`}>
                          {ideaTags.domain.map((tag) => (
                            <span key={tag} className="tag tag--sm" data-tag={tag}>
                              {tag}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {ideaTags.generated.length > 0 ? (
                        <span className={`${styles.ideaTags} idea-tags--topic`}>
                          {ideaTags.generated.map((tag) => (
                            <span key={tag} className="tag tag--sm" data-tag={tag}>
                              {tag}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="section">
        <Collapsible key={transcript.id} defaultOpen={!hasCanonicalIdeas}>
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
              disabled={isExtracting}
              onClick={handleReExtract}
            >
              {isExtracting ? 'Extracting...' : visibleIdeaCount > 0 ? 'Re-extract' : 'Extract now'}
            </Button>
            {extractStatus ? (
              <span className={`normal-case text-[11px] font-normal tracking-normal ${extractStatusClass}`}>
                {extractStatus}
              </span>
            ) : null}
          </div>

          <CollapsibleContent className={styles.extractedIdeasContent}>
            {visibleIdeaCount === 0 ? <p className={styles.emptyNote}>No ideas extracted yet.</p> : null}
            {visibleIdeaCount > 0 && visibleIdeas.length > 0 ? (
              <ul className={styles.ideaList}>
                {visibleIdeas.map((idea) => {
                  const ideaTags = splitTags(idea.tags);
                  return (
                    <li key={idea.id} className={styles.ideaItem}>
                      <Link to={`/vault/nodes/${idea.id}`} className={styles.ideaLink}>
                        <p className={styles.ideaTitle}>{idea.title}</p>
                        <div className="tags">
                          {ideaTags.domain.length > 0 ? (
                            <span className={`${styles.ideaTags} idea-tags--domain`}>
                              {ideaTags.domain.map((tag) => (
                                <span key={tag} className="tag tag--sm" data-tag={tag}>
                                  {tag}
                                </span>
                              ))}
                            </span>
                          ) : null}
                          {ideaTags.generated.length > 0 ? (
                            <span className={`${styles.ideaTags} idea-tags--topic`}>
                              {ideaTags.generated.map((tag) => (
                                <span key={tag} className="tag tag--sm" data-tag={tag}>
                                  {tag}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {visibleIdeaCount > 0 && visibleIdeas.length === 0 ? (
              <p className={styles.emptyNote}>Ideas listed in IDs but nodes not found in vault.</p>
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      </section>

      {transcript.body ? (
        <section className="section">
          <h2 className="section__heading">Transcript</h2>
          <pre className={`body-pre ${styles.bodyPre}`}>{transcript.body}</pre>
        </section>
      ) : null}

      <AlertDialog open={showCleanConfirm} onOpenChange={setShowCleanConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clean canonical idea artifacts?</AlertDialogTitle>
            <AlertDialogDescription>
              Deletes every canonical idea file and consolidation run for "{transcript.title}" — including any
              not currently shown above — and clears its consolidation status. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleanArtifactsMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={cleanArtifactsMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                handleCleanArtifacts();
              }}
            >
              {cleanArtifactsMutation.isPending ? 'Cleaning…' : 'Clean'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

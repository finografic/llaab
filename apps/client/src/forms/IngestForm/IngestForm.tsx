import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from 'components/ui/alert';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import { fetchNodeTags, useVaultTagsByUsage } from 'queries/nodes';
import { QUERY_KEYS, useRunMonitor } from 'queries/runs';
import {
  fetchExistingIdeas,
  useDiscardTranscript,
  useExtractTranscript,
  useIngestYoutube,
} from 'queries/transcripts';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type {
  ExtractionPhase,
  FormValues,
  QueuedIngestItem,
  TranscriptData,
  TranscriptPhase,
} from './ingest-form.types';
import type { RunMonitorItem } from '@llaab/schemas';
import type { ExtractTranscriptResult } from 'queries/transcripts';

import { INGEST_FORM_RESET_EVENT } from 'lib/ingest-form-events';

import { KNOWN_TAGS, normalizeTag } from 'constants/taxonomy.constants';

import { TagInputField } from '../TagInputField';
import { IngestPipeline } from './components/IngestPipeline';
import { IngestQueueList } from './components/IngestQueueList';
import { classifyUrl, extractDroppedUrl, isHttpUrl } from './ingest-form.utils';

export interface IngestFormProps {
  submitOnDrop?: boolean;
}

const INGEST_YOUTUBE_SKILL_ID = 'ingest-youtube';

/**
 * Shared throttle between queued ingest items — applied before an automatic retry and between
 * finishing one queued item and starting the next, so the pipeline doesn't hammer the
 * extraction LLM/YouTube fetch back-to-back.
 */
const QUEUE_GLOBAL_TIMEOUT_MS = 2000;

/** Extraction already has a saved transcript to retry against — one auto-retry is enough. */
const EXTRACTION_MAX_RETRIES = 1;

/**
 * Transcript fetch hits YouTube directly, which is more prone to transient failures (rate
 * limiting, network blips) than a local extraction retry — a separate, larger retry budget.
 */
const TRANSCRIPT_FETCH_MAX_RETRIES = 3;

const EXTRACTION_SUCCEEDED_ENOUGH = new Set<ExtractionPhase>(['success', 'existing', 'extractable']);

function parseRunInputSummary(value?: string): { url?: string } | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'string') return parseRunInputSummary(parsed);
    if (parsed && typeof parsed === 'object') return parsed as { url?: string };
  } catch {
    return null;
  }

  return null;
}

function getRunInputUrl(run: RunMonitorItem): string | null {
  return parseRunInputSummary(run.raw_input_summary)?.url ?? null;
}

export function IngestForm({ submitOnDrop = true }: IngestFormProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [lockedTags, setLockedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [dropMessage, setDropMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [transcriptPhase, setTranscriptPhase] = useState<TranscriptPhase>('idle');
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptStartedAt, setTranscriptStartedAt] = useState<number | null>(null);
  const [transcriptElapsedSecs, setTranscriptElapsedSecs] = useState<number | null>(null);
  const [extractionPhase, setExtractionPhase] = useState<ExtractionPhase>('idle');
  const [extractionIdeas, setExtractionIdeas] = useState<Array<{ id: string; title: string }>>([]);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionStartedAt, setExtractionStartedAt] = useState<number | null>(null);
  const [extractionElapsedSecs, setExtractionElapsedSecs] = useState<number | null>(null);

  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [totalElapsedSecs, setTotalElapsedSecs] = useState<number | null>(null);

  const [queue, setQueue] = useState<QueuedIngestItem[]>([]);
  const queueModeActiveRef = useRef(false);
  const extractionRetryCountRef = useRef(0);
  const transcriptFetchRetryCountRef = useRef(0);
  /**
   * The `{ url, tags }` of whatever item is currently processing — retries resubmit this, not
   * the live form fields, since those may already hold a draft for a *later* item.
   */
  const currentItemRef = useRef<{ url: string; tags: string[] } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormValues>({ defaultValues: { url: '' } });

  const queryClient = useQueryClient();
  const ingestYoutube = useIngestYoutube();
  const extractTranscript = useExtractTranscript();
  const discardTranscript = useDiscardTranscript();
  const { data: vaultTagsByUsage = [] } = useVaultTagsByUsage();
  const { data: monitorData } = useRunMonitor();

  const urlValue = watch('url');
  const sourceKind = useMemo(() => classifyUrl(urlValue.trim()), [urlValue]);
  const activeIngestRun = useMemo(() => {
    const activeRuns = monitorData?.active.filter((run) => run.skill_id === INGEST_YOUTUBE_SKILL_ID) ?? [];
    if (activeRuns.length === 0) return null;

    const currentUrl = urlValue.trim();
    if (currentUrl) {
      const urlMatchedRun = activeRuns.find((run) => getRunInputUrl(run) === currentUrl);
      if (urlMatchedRun) return urlMatchedRun;
    }

    return activeRuns[0] ?? null;
  }, [monitorData?.active, urlValue]);
  const durableBusy = busy || activeIngestRun != null;
  // A youtube URL is always submittable — while busy, submitting queues it instead of running it.
  const canSubmit = sourceKind === 'youtube';
  const buttonLabel = durableBusy
    ? sourceKind === 'youtube'
      ? 'Add to Queue'
      : 'Processing…'
    : sourceKind === 'youtube'
      ? 'Ingest YouTube'
      : 'Ingest';

  const dropzoneDesc = useMemo(() => {
    if (sourceKind === 'youtube') {
      return durableBusy
        ? 'YouTube video URL detected.\nA video is already processing — this will be added to the queue.'
        : 'YouTube video URL detected.\nClick Ingest YouTube to fetch the transcript.';
    }
    if (sourceKind === 'webpage') {
      return 'Website or online reference detected. Drop recognition works; this source type is not yet wired for ingestion.';
    }
    return 'The form classifies the source asset and adapts the ingest action.';
  }, [sourceKind, durableBusy]);

  useEffect(() => {
    const preventWindowDropNavigation = (event: DragEvent) => {
      if (event.target instanceof Element && event.target.closest('.ingest-form')) return;
      event.preventDefault();
    };

    window.addEventListener('dragover', preventWindowDropNavigation);
    window.addEventListener('drop', preventWindowDropNavigation);

    return () => {
      window.removeEventListener('dragover', preventWindowDropNavigation);
      window.removeEventListener('drop', preventWindowDropNavigation);
    };
  }, []);

  /**
   * `preserveDraft` skips clearing the URL field and tag draft — used when the form resets
   * itself automatically between queued items, since the live fields may already hold what the
   * user is typing/dropping for a *later* item, not the one that just finished.
   */
  const resetCurrentItem = useCallback(
    (options?: { preserveDraft?: boolean }) => {
      if (!options?.preserveDraft) {
        setValue('url', '');
        setTags([]);
        setTagInput('');
      }
      setLockedTags([]);
      setBusy(false);
      setTranscriptPhase('idle');
      setTranscriptData(null);
      setTranscriptError(null);
      setTranscriptStartedAt(null);
      setTranscriptElapsedSecs(null);
      setExtractionPhase('idle');
      setExtractionIdeas([]);
      setExtractionError(null);
      setExtractionStartedAt(null);
      setExtractionElapsedSecs(null);
      setRunStartedAt(null);
      setTotalElapsedSecs(null);
      setApiError(null);
      setDropMessage(null);
    },
    [setValue],
  );

  const resetForm = useCallback(() => resetCurrentItem(), [resetCurrentItem]);

  useEffect(() => {
    // Vault Clean wiped the underlying nodes — any queued items are no longer valid either.
    const handleReset = () => {
      resetForm();
      setQueue([]);
    };
    window.addEventListener(INGEST_FORM_RESET_EVENT, handleReset);
    return () => window.removeEventListener(INGEST_FORM_RESET_EVENT, handleReset);
  }, [resetForm]);

  const applyExtractResult = async (result: ExtractTranscriptResult, transcriptId: string) => {
    setExtractionError(null);

    if (result.phase === 'success') {
      setExtractionPhase('success');
      setExtractionIdeas(result.ideas ?? []);
      const nodeTags = await fetchNodeTags(transcriptId);
      setLockedTags(nodeTags);
      return;
    }

    if (result.phase === 'existing') {
      setExtractionPhase('existing');
      setExtractionIdeas(result.ideas ?? []);
      const nodeTags = await fetchNodeTags(transcriptId);
      setLockedTags(nodeTags);
      return;
    }

    if (result.phase === 'extractable') {
      setExtractionPhase('extractable');
      const nodeTags = await fetchNodeTags(transcriptId);
      setLockedTags(nodeTags);
      return;
    }

    setExtractionPhase('failed');
    setExtractionError(result.error ?? 'Unknown error.');
  };

  const runIngest = useCallback(
    async (trimmedUrl: string, allTags: string[]) => {
      currentItemRef.current = { url: trimmedUrl, tags: allTags };
      const now = Date.now();
      setTranscriptPhase('processing');
      setTranscriptData(null);
      setTranscriptError(null);
      setTranscriptStartedAt(now);
      setTranscriptElapsedSecs(null);
      setExtractionPhase('waiting');
      setExtractionIdeas([]);
      setExtractionError(null);
      setExtractionStartedAt(null);
      setExtractionElapsedSecs(null);
      setApiError(null);
      setDropMessage(null);
      setLockedTags([]);
      setRunStartedAt(now);
      setTotalElapsedSecs(null);
      setBusy(true);

      // The skill persists the run node once the request lands server-side, so the monitor can show
      // it as "running" almost immediately — but an invalidate fired in the same tick as the request
      // can race ahead of that write and refetch an empty "active" list, which then backs the
      // monitor's poll interval off to idle for the rest of the run. Refresh now and again shortly
      // after to make sure we catch the run once it's persisted.
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.runs.monitor() });
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.runs.monitor() });
      }, 1000);

      let json: Awaited<ReturnType<typeof ingestYoutube.mutateAsync>>;

      try {
        json = await ingestYoutube.mutateAsync({ url: trimmedUrl, tags: allTags });
      } catch (error) {
        setTranscriptPhase('failed');
        setTranscriptError(error instanceof Error ? error.message : 'Ingestion failed.');
        setTranscriptElapsedSecs(Math.floor((Date.now() - now) / 1000));
        setExtractionPhase('waiting');
        setTotalElapsedSecs(Math.floor((Date.now() - now) / 1000));
        setBusy(false);
        return;
      }

      if (!json.success || !json.result) {
        setTranscriptPhase('failed');
        setTranscriptError(json.error ?? 'Ingestion failed.');
        setTranscriptElapsedSecs(Math.floor((Date.now() - now) / 1000));
        setExtractionPhase('waiting');
        setTotalElapsedSecs(Math.floor((Date.now() - now) / 1000));
        setBusy(false);
        return;
      }

      const transcriptId = json.result.id;
      const filename = json.result.path.split('/').pop() ?? json.result.path;
      const reused = json.result.reused ?? false;

      setTranscriptData({ id: transcriptId, filename });
      setTranscriptPhase(reused ? 'reused' : 'saved');
      setTranscriptElapsedSecs(Math.floor((Date.now() - now) / 1000));

      const extractionStart = Date.now();
      setExtractionStartedAt(extractionStart);

      try {
        if (json.extraction) {
          const ideas = await fetchExistingIdeas(transcriptId);
          setExtractionPhase(ideas.length > 0 ? 'success' : 'extractable');
          setExtractionIdeas(ideas);
          const nodeTags = await fetchNodeTags(transcriptId);
          setLockedTags(nodeTags);
        } else if (json.extractionError) {
          if (json.extractionError.includes('already exists')) {
            const ideas = await fetchExistingIdeas(transcriptId);
            setExtractionPhase(ideas.length > 0 ? 'existing' : 'extractable');
            setExtractionIdeas(ideas);
          } else {
            setExtractionPhase('failed');
            setExtractionError(json.extractionError);
          }
          const nodeTags = await fetchNodeTags(transcriptId);
          setLockedTags(nodeTags);
        } else {
          setExtractionPhase('extractable');
          if (reused) {
            const nodeTags = await fetchNodeTags(transcriptId);
            setLockedTags(nodeTags);
          }
        }
      } catch (error) {
        setExtractionPhase('failed');
        setExtractionError(error instanceof Error ? error.message : 'Could not load extraction results.');
      }

      setExtractionElapsedSecs(Math.floor((Date.now() - extractionStart) / 1000));
      setTotalElapsedSecs(Math.floor((Date.now() - now) / 1000));
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.runs.monitor() });
    },
    [ingestYoutube, queryClient],
  );

  const enqueueUrl = useCallback((url: string, itemTags: string[]) => {
    queueModeActiveRef.current = true;
    setQueue((prev) => [...prev, { id: crypto.randomUUID(), url, tags: itemTags }]);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Retry counters belong to one item's lifetime, not to runIngest's call count — only a
  // genuinely new item (first submit, or the next one dequeued) resets them.
  const startNewItem = useCallback(
    (url: string, itemTags: string[]) => {
      extractionRetryCountRef.current = 0;
      transcriptFetchRetryCountRef.current = 0;
      void runIngest(url, itemTags);
    },
    [runIngest],
  );

  const onSubmit = ({ url }: FormValues) => {
    const trimmedUrl = url.trim();
    const detectedSourceKind = classifyUrl(trimmedUrl);

    if (detectedSourceKind !== 'youtube') {
      setApiError(
        detectedSourceKind === 'webpage'
          ? 'Article/docs URL detected. Drop recognition works, but the backend is still YouTube-only right now.'
          : 'Must be a valid URL.',
      );
      return;
    }

    const pendingTag = tagInput.trim() ? normalizeTag(tagInput) : null;
    const allTags = pendingTag ? [...new Set([...tags, pendingTag])] : tags;

    if (durableBusy) {
      enqueueUrl(trimmedUrl, allTags);
      setValue('url', '', { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      setTags([]);
      setTagInput('');
      setApiError(null);
      return;
    }

    setTags([]);
    setTagInput('');
    startNewItem(trimmedUrl, allTags);
  };

  const onRetryIngest = () => {
    const { current } = currentItemRef;
    if (current) void runIngest(current.url, current.tags);
  };

  const onRetryExtract = useCallback(async () => {
    if (!transcriptData) return;
    setBusy(true);
    setExtractionPhase('pending');
    setExtractionError(null);
    setExtractionElapsedSecs(null);
    setTotalElapsedSecs(null);
    const started = runStartedAt ?? Date.now();
    const extractionStart = Date.now();
    setExtractionStartedAt(extractionStart);
    await applyExtractResult(await extractTranscript.mutateAsync(transcriptData.id), transcriptData.id);
    setExtractionElapsedSecs(Math.floor((Date.now() - extractionStart) / 1000));
    setTotalElapsedSecs(Math.floor((Date.now() - started) / 1000));
    setBusy(false);
  }, [extractTranscript, runStartedAt, transcriptData]);

  // Auto-retry a failed extraction (after the global queue throttle), up to EXTRACTION_MAX_RETRIES,
  // when the queue has ever been engaged this session — outside queue mode, extraction failures
  // still wait for a manual Retry click.
  useEffect(() => {
    if (durableBusy) return;
    if (extractionPhase !== 'failed') return;
    if (!queueModeActiveRef.current) return;
    if (extractionRetryCountRef.current >= EXTRACTION_MAX_RETRIES) return;

    // Increment when the retry actually fires, not when it's scheduled — the skip-to-next effect
    // below reads this same counter in the same render, so incrementing early would make it see
    // the retry as already used up one attempt before it really ran.
    const timer = setTimeout(() => {
      extractionRetryCountRef.current += 1;
      void onRetryExtract();
    }, QUEUE_GLOBAL_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [durableBusy, extractionPhase, onRetryExtract]);

  // Auto-retry a failed transcript fetch (after the global queue throttle), up to
  // TRANSCRIPT_FETCH_MAX_RETRIES, when the queue has ever been engaged this session.
  useEffect(() => {
    if (durableBusy) return;
    if (transcriptPhase !== 'failed') return;
    if (!queueModeActiveRef.current) return;
    if (transcriptFetchRetryCountRef.current >= TRANSCRIPT_FETCH_MAX_RETRIES) return;

    const timer = setTimeout(() => {
      transcriptFetchRetryCountRef.current += 1;
      const { current } = currentItemRef;
      if (current) void runIngest(current.url, current.tags);
    }, QUEUE_GLOBAL_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [durableBusy, transcriptPhase, runIngest]);

  // Move on without waiting for the user when there's a next item queued and this one is done —
  // either because it succeeded (or came back extractable/existing — not a failure), or because
  // its retry budget is exhausted and it's still failing. The transcript/extraction RunNode for
  // every attempt (including failed ones) already shows up in Activity Monitor / the runs table
  // regardless of how this resolves.
  useEffect(() => {
    if (durableBusy) return;
    if (queue.length === 0) return;

    const transcriptFetchExhausted =
      transcriptPhase === 'failed' && transcriptFetchRetryCountRef.current >= TRANSCRIPT_FETCH_MAX_RETRIES;

    const transcriptDone = transcriptPhase === 'saved' || transcriptPhase === 'reused';
    const extractionSucceededEnough = transcriptDone && EXTRACTION_SUCCEEDED_ENOUGH.has(extractionPhase);
    const extractionFailedExhausted =
      transcriptDone &&
      extractionPhase === 'failed' &&
      extractionRetryCountRef.current >= EXTRACTION_MAX_RETRIES;

    if (!transcriptFetchExhausted && !extractionSucceededEnough && !extractionFailedExhausted) return;

    resetCurrentItem({ preserveDraft: true });
  }, [durableBusy, queue.length, transcriptPhase, extractionPhase, resetCurrentItem]);

  // Start the next queued item once the form is genuinely idle, throttled by the same global
  // timeout so queued items don't fire back-to-back.
  useEffect(() => {
    if (durableBusy) return;
    if (transcriptPhase !== 'idle') return;
    if (queue.length === 0) return;

    const timer = setTimeout(() => {
      setQueue((prev) => {
        if (prev.length === 0) return prev;
        const [head, ...rest] = prev;
        startNewItem(head.url, head.tags);
        return rest;
      });
    }, QUEUE_GLOBAL_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [durableBusy, transcriptPhase, queue.length, startNewItem]);

  const onKeep = () => resetForm();

  const onDiscard = async () => {
    if (!transcriptData) {
      resetForm();
      return;
    }
    try {
      await discardTranscript.mutateAsync(transcriptData.id);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Network error — could not delete nodes.');
      return;
    }
    resetForm();
  };

  const onRetry = () => {
    const { current } = currentItemRef;
    onDiscard().then(() => {
      if (current) startNewItem(current.url, current.tags);
    });
  };

  const suggestionPool = [...KNOWN_TAGS, ...vaultTagsByUsage.filter((tag) => !KNOWN_TAGS.includes(tag))];

  const suggestions = suggestionPool.filter((tag) => {
    if (tags.includes(tag) || lockedTags.includes(tag)) return false;
    if (!tagInput) return KNOWN_TAGS.includes(tag);
    const normalized = normalizeTag(tagInput);
    return tag.includes(normalized) || tag.includes(tagInput.toLowerCase());
  });

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDropActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDropActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDropActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDropActive(false);

    const droppedUrl = extractDroppedUrl(event.dataTransfer);
    if (!droppedUrl) {
      setDropMessage('Could not read a URL from that drop.');
      return;
    }

    setValue('url', droppedUrl, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setApiError(null);

    const droppedSourceKind = classifyUrl(droppedUrl);

    if (droppedSourceKind === 'youtube') {
      if (submitOnDrop) {
        handleSubmit(onSubmit)();
      } else {
        setDropMessage('YouTube URL detected. Ready to ingest.');
      }
      return;
    }

    if (droppedSourceKind === 'webpage') {
      setDropMessage(
        'Web article/docs URL detected. UI recognition works; backend ingest for this source type is not wired yet.',
      );
      return;
    }

    setDropMessage('Dropped content did not resolve to a supported URL.');
  };

  const pipelineVisible = transcriptPhase !== 'idle' || activeIngestRun != null;

  return (
    <div
      className={`ingest-form${isDropActive ? ' ingest-form--drop-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="ingest-dropzone__eyebrow">Drop anywhere in this card</div>
      <div className="ingest-dropzone__title">
        Drop a browser URL or page link to populate the source field
      </div>
      <div className="ingest-dropzone__desc">{dropzoneDesc}</div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="ingest-form__stack">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="url">Source URL</Label>
            <div className="flex gap-2 items-start">
              <Input
                id="url"
                type="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://www.youtube.com/watch?v=…"
                {...register('url', {
                  required: 'URL is required.',
                  validate: { validUrl: (value) => isHttpUrl(value) || 'Must be a valid URL.' },
                })}
              />
              <Button type="submit" disabled={!canSubmit} className="shrink-0">
                {buttonLabel}
              </Button>
            </div>

            {errors.url ? <p className="text-sm text-destructive">{errors.url.message}</p> : null}
            {!errors.url && sourceKind === 'youtube' ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Detected YouTube URL. This can be ingested now.
              </p>
            ) : null}
            {!errors.url && sourceKind === 'webpage' ? (
              <p className="text-sm text-muted-foreground">
                Detected website/online reference. Recognition works, but this ingestion path is not wired
                yet.
              </p>
            ) : null}
            {!errors.url && sourceKind === 'unknown' && urlValue.trim().length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Paste or drop a valid URL to classify the source asset.
              </p>
            ) : null}
          </div>

          <TagInputField
            label="Tags (optional)"
            description="Domain tags — e.g. d:llm, d:automation. Type a name to see suggestions."
            placeholder="d:llm"
            value={tags}
            lockedTags={lockedTags}
            inputValue={tagInput}
            suggestions={suggestions}
            onChange={setTags}
            onInputValueChange={setTagInput}
            normalizeTag={normalizeTag}
            validateTag={(value) => value.startsWith('d:') && value.length > 2}
          />
        </div>
      </form>

      {apiError ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      ) : null}

      {dropMessage ? (
        <Alert
          className={
            sourceKind === 'youtube' ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' : ''
          }
        >
          <AlertDescription>{dropMessage}</AlertDescription>
        </Alert>
      ) : null}

      {pipelineVisible ? (
        <IngestPipeline
          transcriptPhase={transcriptPhase}
          transcriptData={transcriptData}
          transcriptError={transcriptError}
          transcriptStartedAt={transcriptStartedAt}
          transcriptElapsedSecs={transcriptElapsedSecs}
          extractionPhase={extractionPhase}
          extractionIdeas={extractionIdeas}
          extractionError={extractionError}
          extractionStartedAt={extractionStartedAt}
          extractionElapsedSecs={extractionElapsedSecs}
          busy={busy}
          runStartedAt={runStartedAt}
          totalElapsedSecs={totalElapsedSecs}
          activeRun={activeIngestRun}
          onKeep={onKeep}
          onDiscard={onDiscard}
          onRetry={onRetry}
          onRetryIngest={onRetryIngest}
          onRetryExtract={onRetryExtract}
        />
      ) : null}

      <IngestQueueList items={queue} onRemove={removeFromQueue} />
    </div>
  );
}

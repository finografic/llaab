import { CheckIcon, CountdownTimerIcon, XIcon } from '@llaab/icons';
import { Alert, AlertDescription, AlertTitle } from 'components/ui/alert';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import { Spinner } from 'components/ui/spinner';
import { RotateCcwIcon } from 'lucide-react';
import { fetchNodeTags, useVaultTagsByUsage } from 'queries/nodes';
import { useDiscardTranscript, useExtractTranscript, useIngestYoutube } from 'queries/transcripts';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { ExtractionPhase, FormValues, TranscriptData, TranscriptPhase } from './ingest-form.types';
import type { ExtractTranscriptResult } from 'queries/transcripts';

import { INGEST_FORM_RESET_EVENT } from 'lib/ingest-form-events';

import { KNOWN_TAGS, normalizeTag } from 'constants/taxonomy.constants';

import { TagInputField } from '../TagInputField';
import { IdeaList } from './components/IdeaList';
import { PipelineCard } from './components/PipelineCard';
import { RetryButton } from './components/RetryButton';
import { RunSummaryCard } from './components/RunSummaryCard';
import { classifyUrl, extractDroppedUrl, isHttpUrl } from './ingest-form.utils';

export interface IngestFormProps {
  submitOnDrop?: boolean;
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

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormValues>({ defaultValues: { url: '' } });

  const ingestYoutube = useIngestYoutube();
  const extractTranscript = useExtractTranscript();
  const discardTranscript = useDiscardTranscript();
  const { data: vaultTagsByUsage = [] } = useVaultTagsByUsage();

  const urlValue = watch('url');
  const sourceKind = useMemo(() => classifyUrl(urlValue.trim()), [urlValue]);
  const canSubmit = sourceKind === 'youtube' && !busy;
  const buttonLabel = busy ? 'Processing…' : sourceKind === 'youtube' ? 'Ingest YouTube' : 'Ingest';

  const dropzoneDesc = useMemo(() => {
    if (sourceKind === 'youtube') {
      return 'YouTube video URL detected.\nClick Ingest YouTube to fetch the transcript.';
    }
    if (sourceKind === 'webpage') {
      return 'Website or online reference detected. Drop recognition works; this source type is not yet wired for ingestion.';
    }
    return 'The form classifies the source asset and adapts the ingest action.';
  }, [sourceKind]);

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

  const resetForm = useCallback(() => {
    setValue('url', '');
    setTags([]);
    setLockedTags([]);
    setTagInput('');
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
  }, [setValue]);

  useEffect(() => {
    const handleReset = () => resetForm();
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

  const onSubmit = async ({ url }: FormValues) => {
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

    const pendingTag = tagInput.trim() ? normalizeTag(tagInput) : null;
    const allTags = pendingTag ? [...new Set([...tags, pendingTag])] : tags;

    let transcriptId: string;

    try {
      const json = await ingestYoutube.mutateAsync({ url: trimmedUrl, tags: allTags, skipExtraction: true });

      if (!json.success || !json.result) {
        setTranscriptPhase('failed');
        setTranscriptError(json.error ?? 'Ingestion failed.');
        setTranscriptElapsedSecs(Math.floor((Date.now() - now) / 1000));
        setExtractionPhase('waiting');
        setTotalElapsedSecs(Math.floor((Date.now() - now) / 1000));
        setBusy(false);
        return;
      }

      transcriptId = json.result.id;
      const filename = json.result.path.split('/').pop() ?? json.result.path;
      const reused = json.result.reused ?? false;

      setTranscriptData({ id: transcriptId, filename });
      setTranscriptPhase(reused ? 'reused' : 'saved');
      setTranscriptElapsedSecs(Math.floor((Date.now() - now) / 1000));
      setTags([]);
      setTagInput('');

      if (reused) {
        const nodeTags = await fetchNodeTags(transcriptId);
        setLockedTags(nodeTags);
      }
    } catch (error) {
      setTranscriptPhase('failed');
      setTranscriptError(error instanceof Error ? error.message : 'Ingestion failed.');
      setTranscriptElapsedSecs(Math.floor((Date.now() - now) / 1000));
      setExtractionPhase('waiting');
      setTotalElapsedSecs(Math.floor((Date.now() - now) / 1000));
      setBusy(false);
      return;
    }

    const extractionStart = Date.now();
    setExtractionPhase('pending');
    setExtractionStartedAt(extractionStart);
    await applyExtractResult(await extractTranscript.mutateAsync(transcriptId), transcriptId);
    setExtractionElapsedSecs(Math.floor((Date.now() - extractionStart) / 1000));
    setTotalElapsedSecs(Math.floor((Date.now() - now) / 1000));
    setBusy(false);
  };

  const onRetryIngest = () => {
    handleSubmit(onSubmit)();
  };

  const onRetryExtract = async () => {
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
  };

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
    const currentUrl = urlValue;
    onDiscard().then(() => {
      setValue('url', currentUrl, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      handleSubmit(onSubmit)();
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

  const pipelineVisible = transcriptPhase !== 'idle';

  const transcriptCardPhase =
    transcriptPhase === 'saved'
      ? 'success'
      : transcriptPhase === 'failed' || transcriptPhase === 'reused'
        ? 'warning'
        : transcriptPhase === 'processing'
          ? 'active'
          : 'neutral';

  const transcriptCardLabel =
    transcriptPhase === 'saved'
      ? 'Transcript saved'
      : transcriptPhase === 'reused'
        ? 'Transcript already saved'
        : transcriptPhase === 'failed'
          ? 'Transcript failed'
          : 'Transcript processing';

  const transcriptStatusSlot =
    transcriptPhase === 'processing' ? (
      <Spinner className="size-4" aria-hidden />
    ) : transcriptPhase === 'failed' ? (
      <RetryButton onClick={onRetryIngest} disabled={busy} />
    ) : (
      <CheckIcon className="pipeline-icon" aria-hidden />
    );

  const extractionCardPhase =
    extractionPhase === 'success' || extractionPhase === 'existing'
      ? 'success'
      : extractionPhase === 'failed'
        ? 'warning'
        : extractionPhase === 'pending'
          ? 'active'
          : 'neutral';

  const extractionCardLabel =
    extractionPhase === 'pending'
      ? 'Extraction processing'
      : extractionPhase === 'success' || extractionPhase === 'existing'
        ? 'Ideas extracted'
        : extractionPhase === 'extractable'
          ? 'No ideas extracted yet'
          : extractionPhase === 'failed'
            ? 'Extraction failed'
            : 'Extraction pending';

  const extractionStatusSlot =
    extractionPhase === 'pending' ? (
      <Spinner className="size-4" aria-hidden />
    ) : extractionPhase === 'success' || extractionPhase === 'existing' ? (
      <CheckIcon className="pipeline-icon" aria-hidden />
    ) : extractionPhase === 'failed' ? (
      <XIcon className="pipeline-icon" aria-hidden />
    ) : extractionPhase === 'extractable' ? (
      <RetryButton onClick={onRetryExtract} disabled={busy} />
    ) : (
      <CountdownTimerIcon className="pipeline-icon pipeline-icon--waiting" aria-hidden />
    );

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
                disabled={busy}
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
            disabled={busy}
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
        <div className="pipeline">
          <RunSummaryCard
            transcriptPhase={transcriptPhase}
            extractionPhase={extractionPhase}
            busy={busy}
            runStartedAt={runStartedAt}
            totalElapsedSecs={totalElapsedSecs}
            nodeCount={(transcriptData ? 1 : 0) + extractionIdeas.length}
            onKeep={onKeep}
            onDiscard={onDiscard}
            onRetry={onRetry}
          />

          <PipelineCard
            phase={transcriptCardPhase}
            label={transcriptCardLabel}
            statusSlot={transcriptStatusSlot}
            startedAt={transcriptStartedAt}
            finalElapsedSecs={transcriptElapsedSecs}
            nodeCount={transcriptData ? 1 : null}
          >
            {transcriptData ? (
              <ul className="pipeline-card__item-list">
                <li>
                  <a href={`/vault/transcripts/${transcriptData.id}`} className="pipeline-card__link">
                    {transcriptData.filename}
                  </a>
                </li>
              </ul>
            ) : null}
            {transcriptPhase === 'failed' && transcriptError ? (
              <span className="pipeline-card__text">{transcriptError}</span>
            ) : null}
          </PipelineCard>

          <PipelineCard
            phase={extractionCardPhase}
            label={extractionCardLabel}
            statusSlot={extractionStatusSlot}
            startedAt={extractionStartedAt}
            finalElapsedSecs={extractionElapsedSecs}
            nodeCount={extractionIdeas.length}
          >
            {(extractionPhase === 'success' || extractionPhase === 'existing') &&
            extractionIdeas.length > 0 ? (
              <IdeaList ideas={extractionIdeas} />
            ) : null}
            {extractionPhase === 'failed' ? (
              <div className="pipeline-card__failure">
                {extractionError ? <span className="pipeline-card__text">{extractionError}</span> : null}
                <button
                  type="button"
                  className="pipeline-action-btn pipeline-action-btn--retry"
                  onClick={onRetryExtract}
                  disabled={busy}
                  aria-label="Retry — re-run extraction against the saved transcript"
                >
                  <RotateCcwIcon size={14} aria-hidden />
                  <span>Retry</span>
                </button>
              </div>
            ) : null}
          </PipelineCard>
        </div>
      ) : null}
    </div>
  );
}

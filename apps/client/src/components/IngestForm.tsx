import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { TagInputField } from '@/components/TagInputField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { formatElapsed, useElapsedSeconds } from '@/lib/heartbeat';

const KNOWN_DOMAINS = ['llm', 'automation', 'ingest', 'schema', 'infra', 'integration', 'ui', 'meta'];
const KNOWN_TAGS = KNOWN_DOMAINS.map((domain) => `d:${domain}`);

function normalizeTag(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.startsWith('d:')) return trimmed;
  if (KNOWN_DOMAINS.includes(trimmed)) return `d:${trimmed}`;
  return trimmed;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isYouTubeUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false;
  const { hostname } = new URL(value);
  return hostname.replace(/^www\./, '').toLowerCase() === 'youtube.com' || hostname === 'youtu.be';
}

function classifyUrl(value: string): SourceKind {
  if (!isHttpUrl(value)) return 'unknown';
  return isYouTubeUrl(value) ? 'youtube' : 'webpage';
}

function extractDroppedUrl(dataTransfer: DataTransfer): string | null {
  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    const firstUri = uriList
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith('#'));
    if (firstUri) return firstUri;
  }

  const plainText = dataTransfer.getData('text/plain').trim();
  if (plainText && isHttpUrl(plainText)) return plainText;

  const downloadUrl = dataTransfer.getData('DownloadURL');
  if (downloadUrl) {
    const maybeUrl = downloadUrl.split(':').at(-1)?.trim() ?? '';
    if (isHttpUrl(maybeUrl)) return maybeUrl;
  }

  return null;
}

interface FormValues {
  url: string;
}

type SourceKind = 'youtube' | 'webpage' | 'unknown';
type TranscriptPhase = 'idle' | 'processing' | 'saved' | 'reused' | 'failed';
type ExtractionPhase = 'idle' | 'waiting' | 'pending' | 'success' | 'existing' | 'extractable' | 'failed';

interface TranscriptData {
  id: string;
  filename: string;
}

function CheckIcon() {
  return (
    <svg className="pipeline-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <polyline
        points="2,9 6,13 14,3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WaitingIcon() {
  return (
    <svg className="pipeline-icon pipeline-icon--waiting" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5 2h6M5 14h6M6 2v3.5l-2 2.5 2 2.5V14M10 2v3.5l2 2.5-2 2.5V14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RetryButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      className="pipeline-retry-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label="Retry"
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2.5 8a5.5 5.5 0 1 0 1.1-3.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <polyline
          points="0.5,3 3.5,6 6,3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function PipelineCard({
  phase,
  label,
  statusSlot,
  startedAt,
  children,
}: {
  phase: 'success' | 'warning' | 'neutral' | 'active';
  label: string;
  statusSlot: React.ReactNode;
  startedAt?: number | null;
  children?: React.ReactNode;
}) {
  const elapsed = useElapsedSeconds(phase === 'active' ? (startedAt ?? null) : null);
  const bodyChildren = React.Children.toArray(children);
  const hasBody = bodyChildren.length > 0;

  return (
    <div className={`pipeline-card pipeline-card--${phase}`}>
      <div className="pipeline-card__main">
        <div className="pipeline-card__row">
          <span className="pipeline-card__label">{label}</span>
          <div className="pipeline-card__meta">
            {phase === 'active' && startedAt != null ? (
              <span className="pipeline-card__elapsed">{formatElapsed(elapsed)}</span>
            ) : null}
            <div className="pipeline-card__status">{statusSlot}</div>
          </div>
        </div>
        {hasBody ? <div className="pipeline-card__body">{bodyChildren}</div> : null}
      </div>
    </div>
  );
}

function StatusCard({
  phase,
  label,
  children,
}: {
  phase: 'success' | 'warning' | 'pending' | 'neutral';
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`status-card status-card--${phase}`}>
      <span className="status-card__label">{label}</span>
      <div className="status-card__body">{children}</div>
    </div>
  );
}

function IdeaList({ ideas }: { ideas: Array<{ id: string; title: string }> }) {
  if (ideas.length === 0) return null;

  return (
    <ul className="pipeline-card__item-list">
      {ideas.map((idea) => (
        <li key={idea.id}>
          <a href={`/vault/nodes/${idea.id}`} className="pipeline-card__link">
            {idea.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

async function fetchExistingIdeas(transcriptId: string): Promise<Array<{ id: string; title: string }>> {
  const res = await api.vault.transcripts[':id'].ideas.$get({ param: { id: transcriptId } });
  const json = (await res.json()) as { ideas?: Array<{ id: string; title: string }> };
  return json.ideas ?? [];
}

async function runExtract(transcriptId: string): Promise<{
  phase: 'success' | 'existing' | 'extractable' | 'failed';
  ideas?: Array<{ id: string; title: string }>;
  error?: string;
}> {
  try {
    const res = await api.vault.transcripts[':id'].extract.$post({ param: { id: transcriptId } });
    const json = (await res.json()) as {
      success: boolean;
      ideas?: Array<{ id: string; title: string }>;
      error?: string;
    };

    if (json.success) return { phase: 'success', ideas: json.ideas ?? [] };
    if (json.error?.includes('already exists')) {
      const ideas = await fetchExistingIdeas(transcriptId);
      return ideas.length > 0 ? { phase: 'existing', ideas } : { phase: 'extractable' };
    }

    return { phase: 'failed', error: json.error };
  } catch {
    return { phase: 'failed', error: 'Network error during extraction.' };
  }
}

interface IngestFormProps {
  submitOnDrop?: boolean;
}

export function IngestForm({ submitOnDrop = true }: IngestFormProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [dropMessage, setDropMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [transcriptPhase, setTranscriptPhase] = useState<TranscriptPhase>('idle');
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptStartedAt, setTranscriptStartedAt] = useState<number | null>(null);
  const [extractionPhase, setExtractionPhase] = useState<ExtractionPhase>('idle');
  const [extractionIdeas, setExtractionIdeas] = useState<Array<{ id: string; title: string }>>([]);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionStartedAt, setExtractionStartedAt] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormValues>({ defaultValues: { url: '' } });

  const urlValue = watch('url');
  const sourceKind = useMemo(() => classifyUrl(urlValue.trim()), [urlValue]);
  const canSubmit = sourceKind === 'youtube' && !busy;
  const buttonLabel = busy ? 'Processing...' : sourceKind === 'youtube' ? 'Ingest YouTube' : 'Ingest';

  const dropzoneDesc = useMemo(() => {
    if (sourceKind === 'youtube') {
      return 'YouTube video URL detected. Click Ingest YouTube to fetch the transcript.';
    }
    if (sourceKind === 'webpage') {
      return 'Website or online reference detected. Drop recognition works; this source type is not yet wired for ingestion.';
    }
    return 'Address-bar drags and in-page links should both work. The form classifies the source asset and adapts the ingest action.';
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

  const applyExtractResult = (result: Awaited<ReturnType<typeof runExtract>>) => {
    setExtractionError(null);

    if (result.phase === 'success') {
      setExtractionPhase('success');
      setExtractionIdeas(result.ideas ?? []);
      return;
    }

    if (result.phase === 'existing') {
      setExtractionPhase('existing');
      setExtractionIdeas(result.ideas ?? []);
      return;
    }

    if (result.phase === 'extractable') {
      setExtractionPhase('extractable');
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

    setTranscriptPhase('processing');
    setTranscriptData(null);
    setTranscriptError(null);
    setTranscriptStartedAt(Date.now());
    setExtractionPhase('waiting');
    setExtractionIdeas([]);
    setExtractionError(null);
    setExtractionStartedAt(null);
    setApiError(null);
    setDropMessage(null);
    setBusy(true);

    const pendingTag = tagInput.trim() ? normalizeTag(tagInput) : null;
    const allTags = pendingTag ? [...new Set([...tags, pendingTag])] : tags;

    let transcriptId: string;

    try {
      const res = await api.ingest.youtube.$post({
        json: { url: trimmedUrl, tags: allTags, skipExtraction: true },
      });
      const json = await res.json();

      if (!json.success) {
        setTranscriptPhase('failed');
        setTranscriptError((json as { error?: string }).error ?? 'Ingestion failed.');
        setExtractionPhase('waiting');
        setBusy(false);
        return;
      }

      const data = json as { result: { id: string; path: string; reused?: boolean } };
      transcriptId = data.result.id;
      const filename = data.result.path.split('/').pop() ?? data.result.path;
      const reused = data.result.reused ?? false;

      setTranscriptData({ id: transcriptId, filename });
      setTranscriptPhase(reused ? 'reused' : 'saved');
      setTags([]);
      setTagInput('');

      if (reused) {
        setExtractionPhase('pending');
        const ideas = await fetchExistingIdeas(transcriptId);

        if (ideas.length > 0) {
          setExtractionPhase('existing');
          setExtractionIdeas(ideas);
        } else {
          setExtractionPhase('extractable');
        }

        setBusy(false);
        return;
      }
    } catch (error) {
      setTranscriptPhase('failed');
      setTranscriptError(error instanceof Error ? error.message : 'Ingestion failed.');
      setExtractionPhase('waiting');
      setBusy(false);
      return;
    }

    setExtractionPhase('pending');
    setExtractionStartedAt(Date.now());
    applyExtractResult(await runExtract(transcriptId));
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
    applyExtractResult(await runExtract(transcriptData.id));
    setBusy(false);
  };

  const suggestions = KNOWN_TAGS.filter((tag) => {
    if (tags.includes(tag)) return false;
    if (!tagInput) return true;
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
      <CheckIcon />
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
      <CheckIcon />
    ) : extractionPhase === 'failed' || extractionPhase === 'extractable' ? (
      <RetryButton onClick={onRetryExtract} disabled={busy} />
    ) : (
      <WaitingIcon />
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
          <div className="field">
            <label htmlFor="url">Source URL</label>
            <div className="input-row">
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

            {errors.url ? <span className="field-error">{errors.url.message}</span> : null}
            {!errors.url && sourceKind === 'youtube' ? (
              <span className="field-hint field-hint--success">
                Detected YouTube URL. This can be ingested now.
              </span>
            ) : null}
            {!errors.url && sourceKind === 'webpage' ? (
              <span className="field-hint">
                Detected website/online reference. Recognition works, but this ingestion path is not wired
                yet.
              </span>
            ) : null}
            {!errors.url && sourceKind === 'unknown' && urlValue.trim().length > 0 ? (
              <span className="field-hint">Paste or drop a valid URL to classify the source asset.</span>
            ) : null}
          </div>

          <TagInputField
            label="Tags (optional)"
            description="Domain tags — e.g. d:llm, d:automation. Type a name to see suggestions."
            placeholder="d:llm"
            value={tags}
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
        <StatusCard phase="warning" label="Error">
          <span className="status-card__text">{apiError}</span>
        </StatusCard>
      ) : null}

      {dropMessage ? (
        <StatusCard phase={sourceKind === 'youtube' ? 'success' : 'neutral'} label="Drop result">
          <span className="status-card__text">{dropMessage}</span>
        </StatusCard>
      ) : null}

      {pipelineVisible ? (
        <div className="pipeline">
          <PipelineCard
            phase={transcriptCardPhase}
            label={transcriptCardLabel}
            statusSlot={transcriptStatusSlot}
            startedAt={transcriptStartedAt}
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
          >
            {(extractionPhase === 'success' || extractionPhase === 'existing') &&
            extractionIdeas.length > 0 ? (
              <IdeaList ideas={extractionIdeas} />
            ) : null}
            {extractionPhase === 'failed' && extractionError ? (
              <span className="pipeline-card__text">{extractionError}</span>
            ) : null}
          </PipelineCard>
        </div>
      ) : null}
    </div>
  );
}

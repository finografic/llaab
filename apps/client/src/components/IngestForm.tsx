import { Button } from '@finografic/design-system/components';
import { TagsInputDS } from '@finografic/design-system/forms';
import { Flex } from '@styled-system/jsx';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { api } from '../lib/api';

// ── Tag helpers ───────────────────────────────────────────────────────────────

const KNOWN_DOMAINS = ['llm', 'automation', 'ingest', 'schema', 'infra', 'integration', 'ui', 'meta'];
const KNOWN_TAGS = KNOWN_DOMAINS.map((d) => `d:${d}`);

function normalizeTag(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.startsWith('d:')) return trimmed;
  if (KNOWN_DOMAINS.includes(trimmed)) return `d:${trimmed}`;
  return trimmed;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormValues {
  url: string;
}

type ExtractionPhase = 'idle' | 'pending' | 'success' | 'failed';

interface TranscriptCard {
  id: string;
  filename: string;
  reused: boolean;
}

interface ExtractionCard {
  phase: ExtractionPhase;
  ideaCount?: number;
  error?: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusCard({
  phase,
  label,
  children,
}: {
  phase: 'success' | 'warning' | 'pending';
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

// ── Component ─────────────────────────────────────────────────────────────────

export function IngestForm() {
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [transcript, setTranscript] = useState<TranscriptCard | null>(null);
  const [extraction, setExtraction] = useState<ExtractionCard>({ phase: 'idle' });
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>();

  const onSubmit = async ({ url }: FormValues) => {
    setTranscript(null);
    setExtraction({ phase: 'idle' });
    setApiError(null);
    setBusy(true);

    const pendingTag = tagInput.trim() ? normalizeTag(tagInput) : null;
    const allTags = pendingTag ? [...new Set([...tags, pendingTag])] : tags;

    // ── Step 1: ingest ────────────────────────────────────────────────────────
    let transcriptId: string;
    try {
      const res = await api.ingest.youtube.$post({
        json: { url, tags: allTags, skipExtraction: true },
      });
      const json = await res.json();
      if (!json.success) {
        setApiError((json as { error?: string }).error ?? 'Ingestion failed.');
        setBusy(false);
        return;
      }
      const data = json as {
        result: { id: string; path: string; reused?: boolean };
      };
      transcriptId = data.result.id;
      const filename = data.result.path.split('/').pop() ?? data.result.path;
      setTranscript({ id: transcriptId, filename, reused: data.result.reused ?? false });
      setTags([]);
      setTagInput('');
      reset();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Ingestion failed.');
      setBusy(false);
      return;
    }

    // ── Step 2: extract ───────────────────────────────────────────────────────
    setExtraction({ phase: 'pending' });
    try {
      const res = await api.vault.transcripts[':id'].extract.$post({
        param: { id: transcriptId },
      });
      const json = (await res.json()) as { success: boolean; ideaIds?: string[]; error?: string };
      if (json.success) {
        setExtraction({ phase: 'success', ideaCount: json.ideaIds?.length ?? 0 });
      } else {
        setExtraction({ phase: 'failed', error: json.error });
      }
    } catch {
      setExtraction({ phase: 'failed', error: 'Network error during extraction.' });
    }

    setBusy(false);
  };

  const suggestions = KNOWN_TAGS.filter((t) => {
    if (tags.includes(t)) return false;
    if (!tagInput) return true;
    const normalized = normalizeTag(tagInput);
    return t.includes(normalized) || t.includes(tagInput.toLowerCase());
  });

  return (
    <div className="ingest-form">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Flex align="between" direction="column" gap={4}>
          <div className="field">
            <label htmlFor="url">YouTube URL</label>
            <div className="input-row">
              <input
                id="url"
                type="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://www.youtube.com/watch?v=…"
                disabled={busy}
                {...register('url', {
                  required: 'URL is required.',
                  pattern: {
                    value: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/,
                    message: 'Must be a YouTube URL.',
                  },
                })}
              />
              <Button type="submit" palette="primary" variant="solid" loading={busy} disabled={busy}>
                {busy ? 'Processing…' : 'Ingest'}
              </Button>
            </div>
            {errors.url && <span className="field-error">{errors.url.message}</span>}
          </div>

          <TagsInputDS
            size="sm"
            label="Tags (optional)"
            description="Domain tags — e.g. d:llm, d:automation. Type a name to see suggestions."
            placeholder="d:llm"
            value={tags}
            onChange={setTags}
            onInputValueChange={setTagInput}
            disabled={busy}
            validate={({ inputValue }) => {
              const norm = normalizeTag(inputValue);
              return norm.startsWith('d:') && norm.length > 2;
            }}
          />

          {tagInput && suggestions.length > 0 && (
            <div className="tag-suggestions">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="tag-suggestion"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setTags((prev) => [...new Set([...prev, s])]);
                    setTagInput('');
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </Flex>
      </form>

      {apiError && (
        <StatusCard phase="warning" label="Error">
          <span className="status-card__text">{apiError}</span>
        </StatusCard>
      )}

      {transcript && (
        <StatusCard phase="success" label={transcript.reused ? 'Already saved' : 'Transcript saved'}>
          <span className="status-card__id">{transcript.id}</span>
          <span className="status-card__path">{transcript.filename}</span>
        </StatusCard>
      )}

      {extraction.phase !== 'idle' && (
        <StatusCard
          phase={
            extraction.phase === 'success' ? 'success' : extraction.phase === 'failed' ? 'warning' : 'pending'
          }
          label={
            extraction.phase === 'pending'
              ? 'Extracting ideas…'
              : extraction.phase === 'success'
                ? `${extraction.ideaCount ?? 0} ideas extracted`
                : 'Extraction failed'
          }
        >
          {extraction.phase === 'pending' && (
            <span className="status-card__text status-card__text--muted">
              Running LLM extraction — this may take a moment.
            </span>
          )}
          {extraction.phase === 'success' && (
            <span className="status-card__text">Knowledge nodes written to vault.</span>
          )}
          {extraction.phase === 'failed' && (
            <span className="status-card__text">
              {extraction.error ? extraction.error : 'Transcript is saved — retry from the transcript page.'}
            </span>
          )}
        </StatusCard>
      )}
    </div>
  );
}

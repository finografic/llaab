import { Button } from '@finografic/design-system/components';
import { TagsInputDS } from '@finografic/design-system/forms';
import { Row, Col } from '@finografic/design-system/grid';
import { Flex } from '@styled-system/jsx';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

import { api } from 'lib/api';

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

type ExtractionPhase = 'idle' | 'pending' | 'success' | 'existing' | 'extractable' | 'failed';

interface TranscriptCard {
  id: string;
  filename: string;
  reused: boolean;
}

interface ExtractionCard {
  phase: ExtractionPhase;
  ideas?: Array<{ id: string; title: string }>;
  error?: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
    <ul className="status-card__idea-list">
      {ideas.map((idea) => (
        <li key={idea.id}>
          <a href={`/vault/nodes/${idea.id}`} className="status-card__link">
            {idea.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

async function fetchExistingIdeas(transcriptId: string): Promise<Array<{ id: string; title: string }>> {
  const res = await api.vault.transcripts[':id'].ideas.$get({ param: { id: transcriptId } });
  const json = (await res.json()) as { ideas?: Array<{ id: string; title: string }> };
  return json.ideas ?? [];
}

async function runExtract(
  transcriptId: string,
): Promise<{ phase: ExtractionPhase; ideas?: Array<{ id: string; title: string }>; error?: string }> {
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
      const reused = data.result.reused ?? false;
      setTranscript({ id: transcriptId, filename, reused });
      setTags([]);
      setTagInput('');
      reset();

      if (reused) {
        setExtraction({ phase: 'pending' });
        const ideas = await fetchExistingIdeas(transcriptId);
        setExtraction(ideas.length > 0 ? { phase: 'existing', ideas } : { phase: 'extractable' });
        setBusy(false);
        return;
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Ingestion failed.');
      setBusy(false);
      return;
    }

    // ── Step 2: extract ───────────────────────────────────────────────────────
    setExtraction({ phase: 'pending' });
    setExtraction(await runExtract(transcriptId));
    setBusy(false);
  };

  const onRetryExtract = async () => {
    if (!transcript) return;
    setBusy(true);
    setExtraction({ phase: 'pending' });
    setExtraction(await runExtract(transcript.id));
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
        <Row>
          <Col>
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
          </Col>
        </Row>
      </form>

      {apiError && (
        <StatusCard phase="warning" label="Error">
          <span className="status-card__text">{apiError}</span>
        </StatusCard>
      )}

      {transcript?.reused && (
        <StatusCard phase="warning" label="Transcript already saved">
          <a href={`/vault/transcripts/${transcript.id}`} className="status-card__link status-card__path">
            {transcript.filename}
          </a>
        </StatusCard>
      )}

      {transcript && !transcript.reused && (
        <StatusCard phase="success" label="Transcript saved">
          <span className="status-card__id">{transcript.id}</span>
          <a href={`/vault/transcripts/${transcript.id}`} className="status-card__link status-card__path">
            {transcript.filename}
          </a>
        </StatusCard>
      )}

      {extraction.phase === 'pending' && (
        <StatusCard phase="pending" label="Extracting ideas…">
          <span className="status-card__text status-card__text--muted">
            Running LLM extraction — this may take a moment.
          </span>
        </StatusCard>
      )}

      {extraction.phase === 'success' && (
        <StatusCard phase="success" label={`${extraction.ideas?.length ?? 0} ideas extracted`}>
          <IdeaList ideas={extraction.ideas ?? []} />
        </StatusCard>
      )}

      {extraction.phase === 'existing' && (
        <StatusCard phase="neutral" label="Ideas already extracted">
          <IdeaList ideas={extraction.ideas ?? []} />
        </StatusCard>
      )}

      {extraction.phase === 'extractable' && (
        <StatusCard phase="neutral" label="No ideas extracted yet">
          <button type="button" className="status-card__retry-btn" disabled={busy} onClick={onRetryExtract}>
            Extract ideas
          </button>
        </StatusCard>
      )}

      {extraction.phase === 'failed' && (
        <StatusCard phase="warning" label="Extraction failed">
          <span className="status-card__text">{extraction.error ?? 'Unknown error.'}</span>
          <button
            type="button"
            className="status-card__retry-btn status-card__retry-btn--warning"
            disabled={busy}
            onClick={onRetryExtract}
          >
            Retry extraction
          </button>
        </StatusCard>
      )}
    </div>
  );
}

import { TagsInputDS } from '@finografic/design-system/forms';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { api } from '../lib/api';

// ── Tag helpers ───────────────────────────────────────────────────────────────

const KNOWN_DOMAINS = ['llm', 'automation', 'ingest', 'schema', 'infra', 'integration', 'ui', 'meta'];
const KNOWN_TAGS = KNOWN_DOMAINS.map((d) => `d:${d}`);

/** Auto-prefix bare domain names: "llm" → "d:llm". Pass-through anything else as-is. */
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

interface IngestResult {
  id: string;
  path: string;
  type: 'transcript' | 'resource';
  reused?: boolean;
}

interface ApiResponse {
  success: boolean;
  result?: IngestResult;
  error?: string;
}

const YOUTUBE_URL_PATTERN = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;

// ── Component ─────────────────────────────────────────────────────────────────

export function IngestForm() {
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [result, setResult] = useState<IngestResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>();

  const onSubmit = async ({ url }: FormValues) => {
    setResult(null);
    setApiError(null);

    // Normalize any pending tag in the input field before submitting
    const pendingTag = tagInput.trim() ? normalizeTag(tagInput) : null;
    const allTags = pendingTag ? [...new Set([...tags, pendingTag])] : tags;

    let json: ApiResponse;
    try {
      const res = await api.ingest.youtube.$post({ json: { url, tags: allTags } });
      json = (await res.json()) as ApiResponse;
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Ingestion failed.');
      return;
    }

    if (!json.success) {
      setApiError(json.error ?? 'Ingestion failed.');
      return;
    }

    setResult(json.result ?? null);
    setTags([]);
    setTagInput('');
    reset();
  };

  const filename = result?.path.split('/').pop();

  // Suggestions: known tags not already added, filtered by current input
  const suggestions = KNOWN_TAGS.filter((t) => {
    if (tags.includes(t)) return false;
    if (!tagInput) return true;
    const normalized = normalizeTag(tagInput);
    return t.includes(normalized) || t.includes(tagInput.toLowerCase());
  });

  return (
    <div className="ingest-form">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="field">
          <label htmlFor="url">YouTube URL</label>
          <div className="input-row">
            <input
              id="url"
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://www.youtube.com/watch?v=…"
              disabled={isSubmitting}
              {...register('url', {
                required: 'URL is required.',
                pattern: {
                  value: YOUTUBE_URL_PATTERN,
                  message: 'Must be a YouTube URL.',
                },
              })}
            />
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Ingesting…' : 'Ingest'}
            </button>
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
          disabled={isSubmitting}
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
                  // mousedown fires before input blur — prevent blur before click registers
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
      </form>

      {result && (
        <div className="status status--success">
          <span className="status__label">Saved</span>
          <span className="status__id">{result.id}</span>
          {filename && <span className="status__path">{filename}</span>}
        </div>
      )}

      {apiError && (
        <div className="status status--error">
          <span className="status__label">Error</span>
          <span className="status__message">{apiError}</span>
        </div>
      )}
    </div>
  );
}

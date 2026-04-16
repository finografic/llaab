import { TagsInputDS } from '@finografic/design-system/forms';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { rpc } from '../lib/rpc';

// ── Tag helpers (same as IngestForm) ─────────────────────────────────────────

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
  title: string;
  body: string;
}

interface CreateResult {
  id: string;
  path: string;
  type: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateIdeaPanel() {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [result, setResult] = useState<CreateResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>();

  const onSubmit = async ({ title, body }: FormValues) => {
    setResult(null);
    setApiError(null);

    const pendingTag = tagInput.trim() ? normalizeTag(tagInput) : null;
    const allTags = pendingTag ? [...new Set([...tags, pendingTag])] : tags;

    try {
      const res = await rpc.api.vault.nodes.$post({
        json: {
          type: 'idea',
          title,
          body: body || undefined,
          tags: allTags.length ? allTags : undefined,
        },
      });
      const json = await res.json();
      if ('error' in json) throw new Error(json.error);
      setResult(json);
      reset();
      setTags([]);
      setTagInput('');
      // Reload the page after a short delay so the new node appears in the list
      setTimeout(() => globalThis.location.reload(), 1200);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to create idea.');
    }
  };

  const suggestions = KNOWN_TAGS.filter((t) => {
    if (tags.includes(t)) return false;
    if (!tagInput) return true;
    const normalized = normalizeTag(tagInput);
    return t.includes(normalized) || t.includes(tagInput.toLowerCase());
  });

  if (!open) {
    return (
      <button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
        + New Idea
      </button>
    );
  }

  return (
    <div className="create-idea-panel card">
      <div className="create-idea-panel__header">
        <h2 className="create-idea-panel__title">New Idea</h2>
        <button
          className="create-idea-panel__close"
          aria-label="Close"
          onClick={() => {
            setOpen(false);
            setResult(null);
            setApiError(null);
            reset();
            setTags([]);
            setTagInput('');
          }}
        >
          ✕
        </button>
      </div>

      {result
? (
        <div className="status status--success">
          <span className="status__label">Created</span>
          <span className="status__id">{result.id}</span>
          <span className="status__message">Reloading…</span>
        </div>
      )
: (
        <form className="create-idea-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field">
            <label htmlFor="idea-title">Title</label>
            <input
              id="idea-title"
              type="text"
              autoFocus
              disabled={isSubmitting}
              placeholder="A one-line description of the idea"
              {...register('title', { required: 'Title is required.' })}
            />
            {errors.title && <span className="field-error">{errors.title.message}</span>}
          </div>

          <div className="field">
            <label htmlFor="idea-body">Notes (optional)</label>
            <textarea
              id="idea-body"
              rows={4}
              disabled={isSubmitting}
              placeholder="Expand on the idea — context, links, questions…"
              {...register('body')}
            />
          </div>

          <TagsInputDS
            size="sm"
            label="Tags (optional)"
            description="Domain tags — e.g. d:llm, d:automation."
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

          <div className="create-idea-form__actions">
            <button type="submit" className="btn btn--primary btn--sm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save idea'}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>

          {apiError && (
            <div className="status status--error">
              <span className="status__label">Error</span>
              <span className="status__message">{apiError}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

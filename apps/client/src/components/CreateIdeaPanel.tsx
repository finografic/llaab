import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { TagInputField } from '@/components/TagInputField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';

const KNOWN_DOMAINS = ['llm', 'automation', 'ingest', 'schema', 'infra', 'integration', 'ui', 'meta'];
const KNOWN_TAGS = KNOWN_DOMAINS.map((domain) => `d:${domain}`);

function normalizeTag(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.startsWith('d:')) return trimmed;
  if (KNOWN_DOMAINS.includes(trimmed)) return `d:${trimmed}`;
  return trimmed;
}

interface FormValues {
  title: string;
  body: string;
}

interface CreateResult {
  id: string;
  path: string;
  type: string;
}

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
      const res = await api.vault.nodes.$post({
        json: {
          type: 'idea',
          title,
          body: body || undefined,
          tags: allTags.length > 0 ? allTags : undefined,
        },
      });
      const json = await res.json();
      if ('error' in json) throw new Error(json.error);

      setResult(json);
      reset();
      setTags([]);
      setTagInput('');
      setTimeout(() => globalThis.location.reload(), 1200);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Failed to create idea.');
    }
  };

  const suggestions = KNOWN_TAGS.filter((tag) => {
    if (tags.includes(tag)) return false;
    if (!tagInput) return true;
    const normalized = normalizeTag(tagInput);
    return tag.includes(normalized) || tag.includes(tagInput.toLowerCase());
  });

  const closePanel = () => {
    setOpen(false);
    setResult(null);
    setApiError(null);
    reset();
    setTags([]);
    setTagInput('');
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        + New Idea
      </Button>
    );
  }

  return (
    <div className="create-idea-panel card">
      <div className="create-idea-panel__header">
        <h2 className="create-idea-panel__title">New Idea</h2>
        <button className="create-idea-panel__close" aria-label="Close" onClick={closePanel}>
          ✕
        </button>
      </div>

      {result ? (
        <div className="status status--success">
          <span className="status__label">Created</span>
          <span className="status__id">{result.id}</span>
          <span className="status__message">Reloading…</span>
        </div>
      ) : (
        <form className="create-idea-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field">
            <label htmlFor="idea-title">Title</label>
            <Input
              id="idea-title"
              type="text"
              autoFocus
              disabled={isSubmitting}
              placeholder="A one-line description of the idea"
              {...register('title', { required: 'Title is required.' })}
            />
            {errors.title ? <span className="field-error">{errors.title.message}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="idea-body">Notes (optional)</label>
            <Textarea
              id="idea-body"
              rows={4}
              disabled={isSubmitting}
              placeholder="Expand on the idea — context, links, questions…"
              {...register('body')}
            />
          </div>

          <TagInputField
            label="Tags (optional)"
            description="Domain tags — e.g. d:llm, d:automation."
            placeholder="d:llm"
            value={tags}
            inputValue={tagInput}
            suggestions={suggestions}
            disabled={isSubmitting}
            onChange={setTags}
            onInputValueChange={setTagInput}
            normalizeTag={normalizeTag}
            validateTag={(value) => value.startsWith('d:') && value.length > 2}
          />

          <div className="create-idea-form__actions">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save idea'}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={isSubmitting} onClick={closePanel}>
              Cancel
            </Button>
          </div>

          {apiError ? (
            <div className="status status--error">
              <span className="status__label">Error</span>
              <span className="status__message">{apiError}</span>
            </div>
          ) : null}
        </form>
      )}
    </div>
  );
}

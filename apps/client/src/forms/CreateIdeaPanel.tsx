import { Alert, AlertDescription, AlertTitle } from 'components/ui/alert';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import { Textarea } from 'components/ui/textarea';
import { useCreateIdea } from 'queries/nodes';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { TagInputField } from './TagInputField';

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

export function CreateIdeaPanel() {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const createIdea = useCreateIdea();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>();

  const isSubmitting = createIdea.isPending;
  const result = createIdea.data ?? null;

  const onSubmit = async ({ title, body }: FormValues) => {
    setApiError(null);

    const pendingTag = tagInput.trim() ? normalizeTag(tagInput) : null;
    const allTags = pendingTag ? [...new Set([...tags, pendingTag])] : tags;

    try {
      await createIdea.mutateAsync({ title, body: body || undefined, tags: allTags });
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
    createIdea.reset();
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
        <Alert className="border-emerald-500/40">
          <AlertTitle>Created</AlertTitle>
          <AlertDescription>{result.id} — Reloading…</AlertDescription>
        </Alert>
      ) : (
        <form className="create-idea-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idea-title">Title</Label>
            <Input
              id="idea-title"
              type="text"
              autoFocus
              disabled={isSubmitting}
              placeholder="A one-line description of the idea"
              {...register('title', { required: 'Title is required.' })}
            />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idea-body">Notes (optional)</Label>
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
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      )}
    </div>
  );
}

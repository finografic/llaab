import { useState } from 'react';
import { useForm } from 'react-hook-form';

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

export function IngestForm() {
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

    const res = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const json: ApiResponse = await res.json();

    if (!res.ok || !json.success) {
      setApiError(json.error ?? 'Ingestion failed.');
      return;
    }

    setResult(json.result ?? null);
    reset();
  };

  const filename = result?.path.split('/').pop();

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

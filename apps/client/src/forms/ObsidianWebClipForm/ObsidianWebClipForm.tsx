import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from 'components/ui/alert';
import { Button } from 'components/ui/button';
import { Label } from 'components/ui/label';
import { Textarea } from 'components/ui/textarea';
import { CheckIcon } from 'lucide-react';
import { fetchNodeTags } from 'queries/nodes';
import { QUERY_KEYS, useRunMonitor } from 'queries/runs';
import { useIngestObsidianWebClip } from 'queries/transcripts';
import { useDeleteVaultNode } from 'queries/vault/useDeleteVaultNode';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ExtractionPhase, TranscriptData, TranscriptPhase } from '../IngestForm/ingest-form.types';
import type { RunMonitorItem } from '@llaab/schemas';
import type { FormEvent } from 'react';

import { IngestPipeline } from '../IngestForm/components/IngestPipeline';

const OBSIDIAN_WEB_CLIP_SKILL_ID = 'ingest-obsidian-web-clip';

interface ClipPreview {
  sourceUrl: string;
  title?: string;
}

function parseRunInputSummary(value?: string): { url?: string } | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'string') return parseRunInputSummary(parsed);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    return null;
  }

  return null;
}

function getRunInputUrl(run: RunMonitorItem): string | null {
  return parseRunInputSummary(run.raw_input_summary)?.url ?? null;
}

function unquoteYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed.replace(/^['"]|['"]$/g, '');
}

function extractFrontmatterScalar(markdown: string, key: string): string | undefined {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  if (!frontmatter) return undefined;
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1];
  return match ? unquoteYamlScalar(match) : undefined;
}

function detectObsidianWebClip(markdown: string): ClipPreview | null {
  const sourceUrl = extractFrontmatterScalar(markdown, 'source');
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) return null;
  return {
    sourceUrl,
    ...(extractFrontmatterScalar(markdown, 'title')
      ? { title: extractFrontmatterScalar(markdown, 'title') }
      : {}),
  };
}

export function ObsidianWebClipForm() {
  const [markdown, setMarkdown] = useState('');
  const [lockedTags, setLockedTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
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

  const currentMarkdownRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const ingestClip = useIngestObsidianWebClip();
  const deleteVaultNode = useDeleteVaultNode();
  const { data: monitorData } = useRunMonitor();

  const preview = useMemo(() => detectObsidianWebClip(markdown), [markdown]);
  const activeIngestRun = useMemo(() => {
    const activeRuns = monitorData?.active.filter((run) => run.skill_id === OBSIDIAN_WEB_CLIP_SKILL_ID) ?? [];
    if (activeRuns.length === 0) return null;
    if (preview?.sourceUrl) {
      const matchingRun = activeRuns.find((run) => getRunInputUrl(run) === preview.sourceUrl);
      if (matchingRun) return matchingRun;
    }
    return activeRuns[0] ?? null;
  }, [monitorData?.active, preview?.sourceUrl]);

  const durableBusy = busy || activeIngestRun != null;
  const canSubmit = preview != null && !durableBusy;

  const resetForm = useCallback(() => {
    setMarkdown('');
    setLockedTags([]);
    setBusy(false);
    setApiError(null);
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
    currentMarkdownRef.current = null;
  }, []);

  const runIngest = useCallback(
    async (clipMarkdown: string) => {
      currentMarkdownRef.current = clipMarkdown;
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
      setLockedTags([]);
      setRunStartedAt(now);
      setTotalElapsedSecs(null);
      setBusy(true);

      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.runs.monitor() });
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.runs.monitor() });
      }, 1000);

      const json = await ingestClip.mutateAsync({ markdown: clipMarkdown }).catch((error: unknown) => {
        setTranscriptPhase('failed');
        setTranscriptError(error instanceof Error ? error.message : 'Ingestion failed.');
        setTranscriptElapsedSecs(Math.floor((Date.now() - now) / 1000));
        setExtractionPhase('waiting');
        setTotalElapsedSecs(Math.floor((Date.now() - now) / 1000));
        setBusy(false);
        return null;
      });

      if (!json) return;

      if (!json.success || !json.result) {
        setTranscriptPhase('failed');
        setTranscriptError(json.error ?? 'Ingestion failed.');
        setTranscriptElapsedSecs(Math.floor((Date.now() - now) / 1000));
        setExtractionPhase('waiting');
        setTotalElapsedSecs(Math.floor((Date.now() - now) / 1000));
        setBusy(false);
        return;
      }

      const resourceId = json.result.id;
      const filename = json.result.path.split('/').pop() ?? json.result.path;
      const extractionStart = Date.now();

      setTranscriptData({ id: resourceId, filename });
      setTranscriptPhase(json.result.reused ? 'reused' : 'saved');
      setTranscriptElapsedSecs(Math.floor((Date.now() - now) / 1000));
      setExtractionStartedAt(extractionStart);

      if (json.extraction) {
        const ideas = json.extraction.ideas ?? [];
        const ideaCount = Math.max(json.extraction.ideaCount, ideas.length);
        setExtractionPhase(ideaCount > 0 ? 'success' : 'extractable');
        setExtractionIdeas(ideas);
      } else if (json.extractionError) {
        setExtractionPhase('failed');
        setExtractionError(json.extractionError);
      } else {
        setExtractionPhase('extractable');
      }

      setLockedTags(await fetchNodeTags(resourceId));
      setExtractionElapsedSecs(Math.floor((Date.now() - extractionStart) / 1000));
      setTotalElapsedSecs(Math.floor((Date.now() - now) / 1000));
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.runs.monitor() });
    },
    [ingestClip, queryClient],
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!preview) {
      setApiError('Paste Obsidian Web Clipper Markdown with YAML frontmatter and a source URL.');
      return;
    }
    void runIngest(markdown);
  };

  const onRetryIngest = () => {
    if (currentMarkdownRef.current) void runIngest(currentMarkdownRef.current);
  };

  const onDiscard = async () => {
    if (!transcriptData) {
      resetForm();
      return;
    }

    try {
      await deleteVaultNode.mutateAsync(transcriptData.id);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Network error — could not delete nodes.');
      return;
    }

    resetForm();
  };

  const onRetry = () => {
    const clipMarkdown = currentMarkdownRef.current;
    void onDiscard().then(() => {
      if (clipMarkdown) void runIngest(clipMarkdown);
      return undefined;
    });
  };

  const pipelineVisible = transcriptPhase !== 'idle' || activeIngestRun != null;

  return (
    <div className="ingest-form">
      <div className="ingest-dropzone__title">
        Paste Obsidian Web Clipper Markdown to populate the source field
      </div>
      {preview ? (
        <div className="ingest-dropzone__desc ingest-dropzone__desc--youtube">
          <CheckIcon className="size-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
          <span className="text-green-600 dark:text-green-400">Obsidian Web Clip detected.</span>
        </div>
      ) : (
        <div className="ingest-dropzone__desc">
          Uses the pasted Markdown body and frontmatter source URL; the page is not re-scraped.
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="ingest-form__stack">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="obsidian-web-clip">Markdown clip</Label>
            <Textarea
              id="obsidian-web-clip"
              value={markdown}
              rows={9}
              spellCheck={false}
              placeholder={'---\ntitle: "..."\nsource: "https://"\n---'}
              className="ingest-form__clip-input"
              onChange={(event) => {
                setMarkdown(event.target.value);
                setApiError(null);
              }}
            />
            {preview ? (
              <p className="text-sm text-muted-foreground">
                Source URL: <span className="font-mono">{preview.sourceUrl}</span>
              </p>
            ) : null}
          </div>

          <Button type="submit" disabled={!canSubmit} size="lg" className="ingest-form__submit-btn">
            {durableBusy ? 'Processing…' : 'Ingest Clip'}
          </Button>
        </div>
      </form>

      {apiError ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{apiError}</AlertDescription>
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
          lockedTags={lockedTags}
          contentNoun="Article"
          onKeep={resetForm}
          onDiscard={onDiscard}
          onRetry={onRetry}
          onRetryIngest={onRetryIngest}
          onRetryExtract={onRetryIngest}
        />
      ) : null}
    </div>
  );
}

import { useQueryClient } from '@tanstack/react-query';
import { PageHero } from 'components/PageHero/PageHero';
import { Alert, AlertDescription, AlertTitle } from 'components/ui/alert';
import { IngestForm } from 'forms/IngestForm/IngestForm';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { QUERY_KEYS, useVaultNodes } from 'queries/vault';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RunsTable } from 'tables/RunsTable/RunsTable';
import type { LabNode, SourceNode, TranscriptNode } from '@llaab/schemas';

import { api } from 'lib/api';
import { parseResponseJson } from 'lib/parse-response-json';
import { usePageTitle } from 'lib/use-page-title';
import { isYouTubeChannelSource } from 'utils/youtube-source.utils';

import 'styles/ingest-page.css';

interface EnrichSourceResponse {
  source?: SourceNode;
  error?: string;
  subscriptionError?: string;
  metadataCommitted?: boolean;
}

interface SourceEnrichIssue {
  sourceId: string;
  sourceTitle: string;
  enrichError?: string;
  subscriptionError?: string;
}

interface IngestRunScope {
  pageTitle: string;
  heroDescription: string;
  formTitle: string;
  formDescription: string;
  skillIds: readonly string[];
}

const MEDIA_RUN_SCOPE: IngestRunScope = {
  pageTitle: 'Ingest Media URL',
  heroDescription:
    'Paste or drop a YouTube or Pocket Casts URL. The form will classify the source asset and adapt the ingest action when the URL is supported.',
  formTitle: 'Drop a YouTube or Pocket Casts URL to populate the source field',
  formDescription: 'Supports YouTube videos and Pocket Casts episodes.',
  skillIds: ['ingest-youtube', 'ingest-podcast'],
};

const ARTICLE_RUN_SCOPE: IngestRunScope = {
  pageTitle: 'Ingest Web URL',
  heroDescription:
    'Paste or drop an article, post, tutorial, or web page URL. HTML pages only; local files are handled separately.',
  formTitle: 'Drop an article, post, tutorial, or web page URL to populate the source field',
  formDescription: 'Supports articles, posts, tutorials, and other standard HTML pages.',
  skillIds: ['ingest-article'],
};

function resolveIngestRunScope(pathname: string): IngestRunScope {
  return pathname.startsWith('/ingest/articles') ? ARTICLE_RUN_SCOPE : MEDIA_RUN_SCOPE;
}

export function IngestPage() {
  const { pathname } = useLocation();
  const activeRunScope = resolveIngestRunScope(pathname);
  usePageTitle(activeRunScope.pageTitle);
  const queryClient = useQueryClient();
  const refreshedSourceIds = useRef(new Set<string>());
  const [enrichIssues, setEnrichIssues] = useState<Record<string, SourceEnrichIssue>>({});

  const { data: sourceNodes = [] } = useVaultNodes({ type: 'source' });
  const { data: transcriptNodes = [] } = useVaultNodes({ type: 'transcript' });
  const sources = sourceNodes as SourceNode[];
  const transcripts = transcriptNodes as TranscriptNode[];

  const enrichIssueList = useMemo(() => Object.values(enrichIssues), [enrichIssues]);

  useEffect(() => {
    const sourcesToRefresh = sources.filter(
      (source) => isYouTubeChannelSource(source) && !refreshedSourceIds.current.has(source.id),
    );
    if (sourcesToRefresh.length === 0) return;

    let cancelled = false;

    void (async () => {
      for (const source of sourcesToRefresh) {
        if (cancelled) return;

        try {
          const res = await api.vault.sources[':id'].enrich.$post({ param: { id: source.id } });
          const body = await parseResponseJson<EnrichSourceResponse>(res);

          if (cancelled) return;

          if (!res.ok || !body.source) {
            setEnrichIssues((current) => ({
              ...current,
              [source.id]: {
                sourceId: source.id,
                sourceTitle: source.title,
                enrichError: body.error ?? 'Failed to refresh channel metadata.',
              },
            }));
            continue;
          }

          refreshedSourceIds.current.add(source.id);

          queryClient.setQueryData<LabNode[]>(QUERY_KEYS.vault.nodes('source'), (current) =>
            current?.map((node) => (node.id === body.source?.id ? body.source : node)),
          );
          queryClient.setQueryData<LabNode>(QUERY_KEYS.vault.node(body.source.id), body.source);

          if (body.metadataCommitted) {
            void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vault.gitStatus() });
          }

          if (body.subscriptionError) {
            setEnrichIssues((current) => ({
              ...current,
              [source.id]: {
                sourceId: source.id,
                sourceTitle: source.title,
                subscriptionError: body.subscriptionError,
              },
            }));
            continue;
          }

          setEnrichIssues((current) => {
            if (!(source.id in current)) return current;
            const next = { ...current };
            delete next[source.id];
            return next;
          });
        } catch (error) {
          if (cancelled) return;

          setEnrichIssues((current) => ({
            ...current,
            [source.id]: {
              sourceId: source.id,
              sourceTitle: source.title,
              enrichError: error instanceof Error ? error.message : 'Failed to refresh channel metadata.',
            },
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient, sources]);

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Pipeline"
          title={activeRunScope.pageTitle}
          description={activeRunScope.heroDescription}
        />
      }
    >
      <div className="ingest-page">
        <IngestForm
          dropzoneTitle={activeRunScope.formTitle}
          idleDescription={activeRunScope.formDescription}
        />

        {enrichIssueList.length > 0 ? (
          <div className="ingest-page__enrich-alerts">
            {enrichIssueList.map((issue) => (
              <Alert
                key={issue.sourceId}
                variant={issue.enrichError ? 'destructive' : 'default'}
                className={
                  issue.subscriptionError && !issue.enrichError
                    ? 'ingest-page__enrich-alert--warning'
                    : undefined
                }
              >
                <AlertTitle>
                  {issue.enrichError ? 'Source enrich failed' : 'YouTube subscription check failed'}
                  {' — '}
                  <Link to={`/vault/sources/${issue.sourceId}`}>{issue.sourceTitle}</Link>
                </AlertTitle>
                <AlertDescription>{issue.enrichError ?? issue.subscriptionError}</AlertDescription>
              </Alert>
            ))}
          </div>
        ) : null}

        <RunsTable
          sources={sources}
          transcripts={transcripts}
          showHeading
          skillIds={activeRunScope.skillIds}
          columnLimits={{ title: { maxWidth: '20rem', maxChars: 60 } }}
        />
      </div>
    </PageLayout>
  );
}

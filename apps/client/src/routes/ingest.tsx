import { useQueryClient } from '@tanstack/react-query';
import { PageHero } from 'components/PageHero/PageHero';
import { Alert, AlertDescription, AlertTitle } from 'components/ui/alert';
import { IngestForm } from 'forms/IngestForm/IngestForm';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { QUERY_KEYS, useVaultNodes } from 'queries/vault';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RunsTable } from 'tables/RunsTable/RunsTable';
import type { LabNode, SourceNode, TranscriptNode } from '@llaab/schemas';

import { api } from 'lib/api';
import { usePageTitle } from 'lib/use-page-title';
import { isYouTubeChannelSource } from 'utils/youtube-source.utils';

import 'styles/ingest-page.css';

interface EnrichSourceResponse {
  source?: SourceNode;
  error?: string;
  subscriptionError?: string;
}

interface SourceEnrichIssue {
  sourceId: string;
  sourceTitle: string;
  enrichError?: string;
  subscriptionError?: string;
}

export function IngestPage() {
  usePageTitle('Ingest');
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

    for (const source of sourcesToRefresh) {
      refreshedSourceIds.current.add(source.id);

      void (async () => {
        try {
          const res = await api.vault.sources[':id'].enrich.$post({ param: { id: source.id } });
          const body = (await res.json()) as EnrichSourceResponse;

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
            return;
          }

          queryClient.setQueryData<LabNode[]>(QUERY_KEYS.vault.nodes('source'), (current) =>
            current?.map((node) => (node.id === body.source?.id ? body.source : node)),
          );
          queryClient.setQueryData<LabNode>(QUERY_KEYS.vault.node(body.source.id), body.source);

          if (body.subscriptionError) {
            setEnrichIssues((current) => ({
              ...current,
              [source.id]: {
                sourceId: source.id,
                sourceTitle: source.title,
                subscriptionError: body.subscriptionError,
              },
            }));
            return;
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
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [queryClient, sources]);

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Pipeline"
          title="Ingest Source URL"
          description="Paste or drop a browser URL. The form will classify the source asset and adapt the ingest action when the URL is supported."
        />
      }
    >
      <div className="ingest-page">
        <div className="card ingest-page__card">
          <IngestForm />
        </div>

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

        <RunsTable sources={sources} transcripts={transcripts} showHeading />
      </div>
    </PageLayout>
  );
}

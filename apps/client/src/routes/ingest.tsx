import { useQueryClient } from '@tanstack/react-query';
import { PageHero } from 'components/PageHero/PageHero';
import { IngestForm } from 'forms/IngestForm/IngestForm';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { QUERY_KEYS, useVaultNodes } from 'queries/vault';
import { useEffect, useRef } from 'react';
import { RunsTable } from 'tables/RunsTable/RunsTable';
import type { LabNode, SourceNode, TranscriptNode } from '@llaab/schemas';

import { api } from 'lib/api';
import { usePageTitle } from 'lib/use-page-title';
import { isYouTubeChannelSource } from 'utils/youtube-source.utils';

import 'styles/ingest-page.css';

export function IngestPage() {
  usePageTitle('Ingest');
  const queryClient = useQueryClient();
  const refreshedSourceIds = useRef(new Set<string>());

  const { data: sourceNodes = [] } = useVaultNodes({ type: 'source' });
  const { data: transcriptNodes = [] } = useVaultNodes({ type: 'transcript' });
  const sources = sourceNodes as SourceNode[];
  const transcripts = transcriptNodes as TranscriptNode[];

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
          const body = (await res.json()) as { source?: SourceNode };
          if (cancelled || !res.ok || !body.source) return;

          queryClient.setQueryData<LabNode[]>(QUERY_KEYS.vault.nodes('source'), (current) =>
            current?.map((node) => (node.id === body.source?.id ? body.source : node)),
          );
          queryClient.setQueryData<LabNode>(QUERY_KEYS.vault.node(body.source.id), body.source);
        } catch {
          // Source detail surfaces refresh errors; the ingest table should simply keep its cached state.
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

        <RunsTable sources={sources} transcripts={transcripts} showHeading />
      </div>
    </PageLayout>
  );
}

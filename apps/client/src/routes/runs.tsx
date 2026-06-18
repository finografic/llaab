import { PageHero } from 'components/PageHero/PageHero';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { useRuns } from 'queries/runs';
import { useVaultNodes } from 'queries/vault';
import { RunsTable } from 'tables/RunsTable/RunsTable';
import type { SourceNode, TranscriptNode } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';

export function RunsPage() {
  usePageTitle('Runs');

  const { data: runs = [], isLoading: runsLoading } = useRuns();
  const { data: sourceNodes = [], isLoading: sourcesLoading } = useVaultNodes({ type: 'source' });
  const { data: transcriptNodes = [] } = useVaultNodes({ type: 'transcript' });
  const sources = sourceNodes as SourceNode[];
  const transcripts = transcriptNodes as TranscriptNode[];

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Execute"
          title="Runs"
          meta={
            <>
              {runs.length} run{runs.length !== 1 ? 's' : ''}
            </>
          }
        />
      }
    >
      <PageList width="wide">
        {runsLoading || sourcesLoading ? (
          <p className="text-muted-foreground text-sm">Loading runs…</p>
        ) : (
          <RunsTable sources={sources} transcripts={transcripts} />
        )}
      </PageList>
    </PageLayout>
  );
}

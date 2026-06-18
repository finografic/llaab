import { PageHero } from 'components/PageHero/PageHero';
import { IngestForm } from 'forms/IngestForm/IngestForm';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { useVaultNodes } from 'queries/vault';
import { RunsTable } from 'tables/RunsTable/RunsTable';
import type { SourceNode } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';

import 'styles/ingest-page.css';

export function IngestPage() {
  usePageTitle('Ingest');

  const { data: sourceNodes = [] } = useVaultNodes({ type: 'source' });
  const sources = sourceNodes as SourceNode[];

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

        <RunsTable sources={sources} showHeading />
      </div>
    </PageLayout>
  );
}

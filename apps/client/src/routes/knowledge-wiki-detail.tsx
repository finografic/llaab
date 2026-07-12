import { PageHero } from 'components/PageHero/PageHero';
import { PageDetail } from 'layouts/PageDetail/PageDetail';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { useKnowledgeWiki } from 'queries/knowledge';
import { Navigate, useParams } from 'react-router-dom';

import { usePageTitle } from 'lib/use-page-title';

export function KnowledgeWikiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: wiki, isLoading, error } = useKnowledgeWiki(id);
  usePageTitle(wiki?.title ?? 'Knowledge wiki');

  if (!id) return <Navigate to="/knowledge/wikis" replace />;
  return (
    <PageLayout hero={<PageHero eyebrow="Knowledge" title={wiki?.title ?? 'Loading…'} />}>
      <PageDetail variant="narrow">
        {isLoading ? <p className="text-muted-foreground text-sm">Loading wiki…</p> : null}
        {error ? <p className="text-destructive text-sm">{error.message}</p> : null}
        {wiki ? <pre className="body-pre">{wiki.body}</pre> : null}
      </PageDetail>
    </PageLayout>
  );
}

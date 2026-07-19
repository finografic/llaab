import { DeleteKnowledgeWikiAction } from 'components/DeleteKnowledgeWikiAction/DeleteKnowledgeWikiAction';
import { PageHero } from 'components/PageHero/PageHero';
import { Col, Row } from 'components/ui/grid';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { useKnowledgeWikis } from 'queries/knowledge';
import { Link } from 'react-router-dom';

import { usePageTitle } from 'lib/use-page-title';

export function KnowledgeWikisPage() {
  usePageTitle('Knowledge wikis');
  const { data: wikis = [], isLoading, error } = useKnowledgeWikis();

  return (
    <PageLayout hero={<PageHero eyebrow="Knowledge" title="Wikis" />}>
      <PageList>
        {isLoading ? <p className="text-muted-foreground text-sm">Loading wikis…</p> : null}
        {error ? <p className="text-destructive text-sm">{error.message}</p> : null}
        {!isLoading && !error && wikis.length === 0 ? (
          <p className="text-muted-foreground text-sm">No promoted wikis yet.</p>
        ) : null}
        {wikis.map((wiki) => (
          <article key={wiki.id} className="border-border rounded-md border p-4">
            <Row justify="space-between" align="flex-start" gutterWidth={12}>
              <Col>
                <Link to={`/knowledge/wikis/${wiki.id}`} className="text-base font-semibold underline">
                  {wiki.title}
                </Link>
              </Col>
              <Col xs="content">
                <DeleteKnowledgeWikiAction wiki={wiki} />
              </Col>
            </Row>
            <p className="text-muted-foreground mt-1 text-sm">{wiki.summary}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {wiki.status} · {wiki.verification_status} · {wiki.source_refs.length} sources ·{' '}
              {wiki.links.length} links · {wiki.source_canonical_idea_ids.length} ideas · rev {wiki.revision}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Updated {wiki.updated_at}
              {wiki.reviewed_at ? ` · reviewed ${wiki.reviewed_at}` : ''}
            </p>
          </article>
        ))}
      </PageList>
    </PageLayout>
  );
}

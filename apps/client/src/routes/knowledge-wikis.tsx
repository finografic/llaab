import { PageHero } from 'components/PageHero/PageHero';
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
            <Link to={`/knowledge/wikis/${wiki.id}`} className="text-base font-semibold underline">
              {wiki.title}
            </Link>
            <p className="text-muted-foreground mt-1 text-sm">{wiki.summary}</p>
          </article>
        ))}
      </PageList>
    </PageLayout>
  );
}

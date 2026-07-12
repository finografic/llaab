import { PageHero } from 'components/PageHero/PageHero';
import { PageDetail } from 'layouts/PageDetail/PageDetail';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { useKnowledgeWiki, useKnowledgeWikiGraph } from 'queries/knowledge';
import { Link, Navigate, useParams } from 'react-router-dom';

import { usePageTitle } from 'lib/use-page-title';

export function KnowledgeWikiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: wiki, isLoading, error } = useKnowledgeWiki(id);
  const { data: graph } = useKnowledgeWikiGraph();
  usePageTitle(wiki?.title ?? 'Knowledge wiki');

  if (!id) return <Navigate to="/knowledge/wikis" replace />;
  return (
    <PageLayout hero={<PageHero eyebrow="Knowledge" title={wiki?.title ?? 'Loading…'} />}>
      <PageDetail variant="narrow">
        {isLoading ? <p className="text-muted-foreground text-sm">Loading wiki…</p> : null}
        {error ? <p className="text-destructive text-sm">{error.message}</p> : null}
        {wiki ? (
          <>
            <pre className="body-pre">{wiki.body}</pre>
            <section className="section">
              <h2 className="section__heading">Sources</h2>
              <ul className="space-y-1 text-sm">
                {wiki.source_refs.map((ref) => (
                  <li key={ref.id}>
                    {ref.url ? (
                      <a className="underline" href={ref.url} target="_blank" rel="noreferrer">
                        {ref.title ?? ref.id}
                        {ref.locator ? ` · ${ref.locator}` : ''}
                      </a>
                    ) : (
                      <span>
                        {ref.title ?? ref.id}
                        {ref.locator ? ` · ${ref.locator}` : ''}
                      </span>
                    )}
                    <span className="text-muted-foreground"> · {ref.verification}</span>
                  </li>
                ))}
              </ul>
            </section>
            {graph ? (
              <section className="section">
                <h2 className="section__heading">Related pages</h2>
                <ul className="space-y-1 text-sm">
                  {graph.edges
                    .filter((edge) => edge.source === wiki.id || edge.target === wiki.id)
                    .map((edge) => {
                      const relatedId = edge.source === wiki.id ? edge.target : edge.source;
                      const related = graph.nodes.find((node) => node.id === relatedId);
                      return (
                        <li key={`${edge.source}-${edge.relation}-${edge.target}`}>
                          <Link className="underline" to={`/knowledge/wikis/${relatedId}`}>
                            {related?.title ?? relatedId}
                          </Link>
                          <span className="text-muted-foreground"> · {edge.relation}</span>
                        </li>
                      );
                    })}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </PageDetail>
    </PageLayout>
  );
}

import { PageHero } from 'components/PageHero/PageHero';
import { Button } from 'components/ui/button';
import { Col, Row } from 'components/ui/grid';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { SearchIcon } from 'lucide-react';
import { useDiscoverWikiCandidates, useWikiCandidates } from 'queries/wiki-candidates';
import { toast } from 'sonner';

import { usePageTitle } from 'lib/use-page-title';

export function WikiCandidatesPage() {
  usePageTitle('Wiki candidates');
  const candidates = useWikiCandidates();
  const discover = useDiscoverWikiCandidates();

  async function runDiscovery() {
    try {
      await discover.mutateAsync();
      toast.success('Wiki candidate discovery complete.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Wiki discovery failed.');
    }
  }

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Vault"
          title="Wiki candidates"
          right={
            <Button onClick={() => void runDiscovery()} disabled={discover.isPending}>
              <SearchIcon aria-hidden="true" /> Discover
            </Button>
          }
        />
      }
    >
      <Row className="gap-3">
        {candidates.isLoading ? <p className="text-sm text-muted-foreground">Loading candidates…</p> : null}
        {candidates.error ? <p className="text-sm text-destructive">{candidates.error.message}</p> : null}
        {candidates.data?.map((candidate) => (
          <Col key={candidate.id} className="rounded-md border border-border p-4">
            <p className="font-semibold capitalize">{candidate.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{candidate.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Heat {candidate.heat_score} · novelty {candidate.novelty_score} · {candidate.recommendation}
            </p>
          </Col>
        ))}
      </Row>
    </PageLayout>
  );
}

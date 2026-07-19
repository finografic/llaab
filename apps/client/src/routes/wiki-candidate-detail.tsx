import { DiagnosticWikiSurfaceBanner } from 'components/DiagnosticWikiSurfaceBanner/DiagnosticWikiSurfaceBanner';
import { Button } from 'components/ui/button';
import { Col, Row } from 'components/ui/grid';
import { PageDetail } from 'layouts/PageDetail/PageDetail';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { useCompileWikiCandidate, useWikiCandidate } from 'queries/wiki-candidates';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

export function WikiCandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const candidate = useWikiCandidate(id);
  const compile = useCompileWikiCandidate();
  const navigate = useNavigate();
  if (!id || candidate.error) return <Navigate to="/vault/wiki-candidates" replace />;

  async function compileCandidate() {
    try {
      navigate(`/vault/wiki-drafts/${await compile.mutateAsync(id ?? '')}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Wiki compilation failed.');
    }
  }

  return (
    <PageLayout>
      <PageDetail gap="lg">
        <DiagnosticWikiSurfaceBanner surface="candidate" />
        {candidate.isLoading ? <p className="text-sm text-muted-foreground">Loading candidate…</p> : null}
        {candidate.data ? (
          <>
            <Row>
              <Col>
                <h1>{candidate.data.title}</h1>
                <p>{candidate.data.body}</p>
              </Col>
            </Row>
            <Row className="rounded-md border border-border p-4">
              <Col>
                <p>Heat {candidate.data.heat_score}: evidence breadth and unmet demand.</p>
                <p>Novelty {candidate.data.novelty_score}: evidence not represented by promoted wikis.</p>
                <p>
                  {candidate.data.source_canonical_idea_ids.length} ideas ·{' '}
                  {candidate.data.source_transcript_ids.length} transcripts ·{' '}
                  {candidate.data.source_ids.length} sources
                </p>
                <p>Recommendation: {candidate.data.recommendation}</p>
              </Col>
            </Row>
            {candidate.data.existing_wiki_ids.length > 0 ? (
              <p>Existing matches: {candidate.data.existing_wiki_ids.join(', ')}</p>
            ) : null}
            {candidate.data.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
            <Button onClick={() => void compileCandidate()} disabled={compile.isPending}>
              Compile diagnostic draft
            </Button>
          </>
        ) : null}
      </PageDetail>
    </PageLayout>
  );
}

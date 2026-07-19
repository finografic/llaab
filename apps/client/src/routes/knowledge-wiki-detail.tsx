import { PageHero } from 'components/PageHero/PageHero';
import { Alert, AlertDescription, AlertTitle } from 'components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'components/ui/alert-dialog';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';
import { Col, Row } from 'components/ui/grid';
import { PageDetail } from 'layouts/PageDetail/PageDetail';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import {
  ActivityIcon,
  BookCheckIcon,
  FileTextIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  useDeleteKnowledgeWikiSection,
  useKnowledgeWiki,
  useKnowledgeWikiGraph,
  useRegenerateKnowledgeWikiSection,
} from 'queries/knowledge';
import { useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { KnowledgeWikiPage } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';

import styles from './knowledge-wiki-detail.module.css';

interface CreatedWikiLocationState {
  generatedWikis?: KnowledgeWikiPage[];
}

function qualityTone(score: number | undefined): string {
  if (score == null) return styles.neutral;
  if (score >= 80) return styles.good;
  if (score >= 60) return styles.warning;
  return styles.danger;
}

export function KnowledgeWikiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const generatedWikis = (location.state as CreatedWikiLocationState | null)?.generatedWikis ?? [];
  const { data, isLoading, error } = useKnowledgeWiki(id);
  const { data: graph } = useKnowledgeWikiGraph();
  const regenerateSection = useRegenerateKnowledgeWikiSection();
  const deleteSection = useDeleteKnowledgeWikiSection();
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const wiki = data?.wiki;
  const transcriptSourceRefs = wiki?.source_refs.filter((ref) => ref.kind !== 'external') ?? [];
  const externalSourceRefs = wiki?.source_refs.filter((ref) => ref.kind === 'external') ?? [];
  usePageTitle(wiki?.title ?? 'Knowledge wiki');

  if (!id) return <Navigate to="/knowledge/wikis" replace />;

  async function regenerate(sectionId: string) {
    try {
      await regenerateSection.mutateAsync({ wikiId: id!, sectionId });
      toast.success('Wiki section regenerated.');
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : 'Section regeneration failed.');
    }
  }

  async function removeSection() {
    if (!deleteSectionId) return;
    try {
      await deleteSection.mutateAsync({ wikiId: id!, sectionId: deleteSectionId });
      toast.success('Wiki section removed.');
      setDeleteSectionId(null);
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : 'Section deletion failed.');
    }
  }

  return (
    <PageLayout hero={<PageHero eyebrow="Knowledge" title={wiki?.title ?? 'Loading…'} />}>
      <PageDetail variant="narrow">
        {isLoading ? <p className="text-muted-foreground text-sm">Loading wiki…</p> : null}
        {error ? <p className="text-destructive text-sm">{error.message}</p> : null}
        {wiki ? (
          <Row gutterWidth={20}>
            {generatedWikis.length > 0 ? (
              <Col xs={12}>
                <Alert className={styles.createdAlert}>
                  <SparklesIcon aria-hidden="true" />
                  <AlertTitle>
                    {generatedWikis.length === 1
                      ? 'Wiki created and published'
                      : `${generatedWikis.length} focused wikis created and published`}
                  </AlertTitle>
                  <AlertDescription className={styles.createdLinks}>
                    {generatedWikis.map((created) => (
                      <Link key={created.id} to={`/knowledge/wikis/${created.id}`}>
                        {created.title}
                      </Link>
                    ))}
                  </AlertDescription>
                </Alert>
              </Col>
            ) : null}

            <Col xs={12}>
              <Row gutterWidth={12} className={styles.metricsRow}>
                <Col xs={12} sm={6} lg={3}>
                  <Card className={styles.metricCard}>
                    <CardHeader className={styles.metricHeader}>
                      <CardTitle className={styles.metricLabel}>
                        <SparklesIcon /> Quality
                      </CardTitle>
                      <Badge variant="outline" className={qualityTone(wiki.quality_score)}>
                        {wiki.quality_score ?? '—'}
                        {wiki.quality_score != null ? '%' : ''}
                      </Badge>
                    </CardHeader>
                    <CardContent className={styles.metricValue}>
                      {wiki.quality_score ?? 'Not scored'}
                      <span>source-backed generation score</span>
                    </CardContent>
                  </Card>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                  <Card className={styles.metricCard}>
                    <CardHeader className={styles.metricHeader}>
                      <CardTitle className={styles.metricLabel}>
                        <ActivityIcon /> Lifecycle
                      </CardTitle>
                      <Badge variant="secondary">Published</Badge>
                    </CardHeader>
                    <CardContent className={styles.metricValue}>
                      {wiki.status}
                      <span>knowledge maturity</span>
                    </CardContent>
                  </Card>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                  <Card className={styles.metricCard}>
                    <CardHeader className={styles.metricHeader}>
                      <CardTitle className={styles.metricLabel}>
                        <BookCheckIcon /> Verification
                      </CardTitle>
                    </CardHeader>
                    <CardContent className={styles.metricValue}>
                      {wiki.verification_status}
                      <span>{wiki.source_refs.length} source references</span>
                    </CardContent>
                  </Card>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                  <Card className={styles.metricCard}>
                    <CardHeader className={styles.metricHeader}>
                      <CardTitle className={styles.metricLabel}>
                        <FileTextIcon /> Revision
                      </CardTitle>
                    </CardHeader>
                    <CardContent className={styles.metricValue}>
                      {wiki.revision}
                      <span>
                        {wiki.generation_provider ?? 'local'} / {wiki.generation_model ?? 'reviewed'}
                      </span>
                    </CardContent>
                  </Card>
                </Col>
              </Row>
            </Col>

            <Col xs={12}>
              <section className={styles.summaryCard}>
                <p>{wiki.summary}</p>
                <div className={styles.tagList} aria-label="Wiki topics">
                  {wiki.tags.map((tag) => (
                    <span key={tag} className="tag" data-tag={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            </Col>

            <Col xs={12}>
              <section className={styles.article} aria-label="Wiki article">
                {data.sections.map((section) => (
                  <section key={section.id} className={styles.wikiSection}>
                    <div
                      className={styles.readmeContent}
                      dangerouslySetInnerHTML={{ __html: section.html }}
                    />
                    <Row justify="flex-end" align="center" className={styles.sectionActions}>
                      <Col xs="content">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          title="Regenerate this section"
                          aria-label={`Regenerate ${section.heading}`}
                          disabled={regenerateSection.isPending || deleteSection.isPending}
                          onClick={() => void regenerate(section.id)}
                        >
                          {regenerateSection.isPending &&
                          regenerateSection.variables?.sectionId === section.id ? (
                            <LoaderCircleIcon className="animate-spin" />
                          ) : (
                            <RefreshCwIcon />
                          )}
                        </Button>
                      </Col>
                      <Col xs="content">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          title="Remove this section"
                          aria-label={`Remove ${section.heading}`}
                          disabled={regenerateSection.isPending || deleteSection.isPending}
                          onClick={() => setDeleteSectionId(section.id)}
                        >
                          <Trash2Icon />
                        </Button>
                      </Col>
                    </Row>
                  </section>
                ))}
              </section>
            </Col>

            {graph ? (
              <Col xs={12}>
                <section className="section">
                  <h2 className="section__heading">Related topics</h2>
                  <ul className={styles.relatedList}>
                    {graph.edges
                      .filter((edge) => edge.source === wiki.id || edge.target === wiki.id)
                      .map((edge) => {
                        const relatedId = edge.source === wiki.id ? edge.target : edge.source;
                        const related = graph.nodes.find((node) => node.id === relatedId);
                        return (
                          <li key={`${edge.source}-${edge.relation}-${edge.target}`}>
                            <Link to={`/knowledge/wikis/${relatedId}`}>{related?.title ?? relatedId}</Link>
                            <Badge variant="outline">{edge.relation}</Badge>
                            {edge.shared_tags?.map((tag) => (
                              <span key={tag} className="tag tag--sm" data-tag={tag}>
                                {tag}
                              </span>
                            ))}
                          </li>
                        );
                      })}
                  </ul>
                </section>
              </Col>
            ) : null}

            <Col xs={12}>
              <section className="section">
                <h2 className="section__heading">Transcript sources</h2>
                <ul className="space-y-1 text-sm">
                  {transcriptSourceRefs.map((ref) => (
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
            </Col>

            {externalSourceRefs.length > 0 ? (
              <Col xs={12}>
                <section className="section">
                  <h2 className="section__heading">External evidence</h2>
                  <ul className="space-y-2 text-sm">
                    {externalSourceRefs.map((ref) => (
                      <li key={ref.id}>
                        <p>
                          {ref.url ? (
                            <a className="underline" href={ref.url} target="_blank" rel="noreferrer">
                              {ref.title ?? ref.id}
                            </a>
                          ) : (
                            <span>{ref.title ?? ref.id}</span>
                          )}
                          <span className="text-muted-foreground"> · {ref.verification}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ref.retrieval_provider ?? 'unknown'} · {ref.retrieval_query ?? 'no query'}
                        </p>
                        {ref.excerpt ? <p className="mt-1 text-sm">{ref.excerpt}</p> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              </Col>
            ) : null}
          </Row>
        ) : null}
      </PageDetail>

      <AlertDialog
        open={deleteSectionId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteSectionId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this wiki section?</AlertDialogTitle>
            <AlertDialogDescription>
              The promoted page will be updated immediately and its revision will increase. Source history
              remains in the vault draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleteSection.isPending} onClick={() => void removeSection()}>
              {deleteSection.isPending ? <LoaderCircleIcon className="animate-spin" /> : <Trash2Icon />}
              Remove section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}

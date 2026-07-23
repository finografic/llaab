import { computeWikiEvidenceMetrics } from '@llaab/schemas';
import { DeleteKnowledgeWikiAction } from 'components/DeleteKnowledgeWikiAction/DeleteKnowledgeWikiAction';
import { DemoteKnowledgeWikiAction } from 'components/DemoteKnowledgeWikiAction/DemoteKnowledgeWikiAction';
import { PageHero } from 'components/PageHero/PageHero';
import { TagList } from 'components/TagList/TagList';
import { TtsPlayer } from 'components/TtsPlayer';
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
  BookOpenIcon,
  FileTextIcon,
  LoaderCircleIcon,
  NetworkIcon,
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
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { usePageTitle } from 'lib/use-page-title';

import styles from './wiki-detail-page.module.css';

function qualityTone(score: number | undefined): string {
  if (score == null) return styles.neutral;
  if (score >= 80) return styles.good;
  if (score >= 60) return styles.warning;
  return styles.danger;
}

function pluralizeMetricLabel(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function KnowledgeWikiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useKnowledgeWiki(id);
  const { data: graph } = useKnowledgeWikiGraph();
  const regenerateSection = useRegenerateKnowledgeWikiSection();
  const deleteSection = useDeleteKnowledgeWikiSection();
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const wiki = data?.wiki;
  const regenerationBySection = useMemo(() => {
    const map = new Map<string, { available: boolean; reason?: string }>();
    for (const item of data?.sectionRegeneration ?? []) {
      map.set(item.sectionId, item);
    }
    return map;
  }, [data?.sectionRegeneration]);
  const transcriptSourceRefs = wiki?.source_refs.filter((ref) => ref.kind !== 'external') ?? [];
  const externalSourceRefs = wiki?.source_refs.filter((ref) => ref.kind === 'external') ?? [];
  const evidenceMetrics =
    wiki?.evidence_metrics ??
    (wiki
      ? computeWikiEvidenceMetrics(
          wiki.source_refs.map((ref) => ({
            id: ref.id,
            transcript_id: ref.kind === 'transcript' ? ref.node_id : undefined,
            source_id: ref.kind === 'source' ? ref.node_id : undefined,
            kind: ref.kind,
            url: ref.url,
            canonical_idea_ids: ref.kind === 'canonical-idea' && ref.node_id ? [ref.node_id] : [],
          })),
        )
      : undefined);
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
    <PageLayout
      hero={
        <PageHero
          eyebrow="Knowledge"
          title={wiki?.title ?? 'Loading…'}
          right={
            wiki ? (
              <Row gutterWidth={8} align="center">
                <Col xs="content">
                  <DemoteKnowledgeWikiAction wiki={wiki} onDemoted={() => navigate('/knowledge/wikis')} />
                </Col>
                <Col xs="content">
                  <DeleteKnowledgeWikiAction
                    wiki={wiki}
                    variant="button"
                    onDeleted={() => navigate('/knowledge/wikis')}
                  />
                </Col>
              </Row>
            ) : null
          }
        />
      }
    >
      <PageDetail>
        {isLoading ? <p className="text-muted-foreground text-sm">Loading wiki…</p> : null}
        {error ? <p className="text-destructive text-sm">{error.message}</p> : null}
        {wiki ? (
          <Row gutterWidth={20}>
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
                      <span>
                        {wiki.quality_dimensions?.blocking_dimensions.length
                          ? `blocked: ${wiki.quality_dimensions.blocking_dimensions.join(', ')}`
                          : 'generation quality score'}
                      </span>
                    </CardContent>
                  </Card>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                  <Card className={styles.metricCard}>
                    <CardHeader className={styles.metricHeader}>
                      <CardTitle className={styles.metricLabel}>
                        <ActivityIcon /> Lifecycle
                      </CardTitle>
                      <Badge variant="secondary">{wiki.status}</Badge>
                    </CardHeader>
                    <CardContent className={styles.metricValue}>
                      {wiki.status}
                      <span>knowledge maturity (separate from verification)</span>
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
                      <span>
                        {evidenceMetrics
                          ? `${evidenceMetrics.independent_source_count} independent source${
                              evidenceMetrics.independent_source_count === 1 ? '' : 's'
                            }`
                          : 'no evidence metrics'}
                      </span>
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

            {evidenceMetrics ? (
              <Col xs={12}>
                <section aria-label="Evidence metrics">
                  <Row gutterWidth={12} className={styles.evidenceMetricsRow}>
                    <Col xs={12} md={6}>
                      <Card className={styles.evidenceMetricCard}>
                        <CardHeader className={styles.metricHeader}>
                          <CardTitle className={styles.metricLabel}>
                            <BookOpenIcon /> Knowledge Basis
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Row nogutter>
                            <Col xs={12} className={styles.evidenceStatList}>
                              <div className={styles.evidenceStat}>
                                <strong>{evidenceMetrics.unique_canonical_idea_count}</strong>
                                <span>
                                  {pluralizeMetricLabel(evidenceMetrics.unique_canonical_idea_count, 'Idea')}
                                </span>
                              </div>
                              <div className={styles.evidenceStat}>
                                <strong>{evidenceMetrics.evidence_ref_count}</strong>
                                <span>
                                  {pluralizeMetricLabel(evidenceMetrics.evidence_ref_count, 'Evidence ref')}
                                </span>
                              </div>
                              <div className={styles.evidenceStat}>
                                <strong>{evidenceMetrics.unique_transcript_count}</strong>
                                <span>
                                  {pluralizeMetricLabel(
                                    evidenceMetrics.unique_transcript_count,
                                    'Transcript',
                                  )}
                                </span>
                              </div>
                            </Col>
                          </Row>
                        </CardContent>
                      </Card>
                    </Col>
                    <Col xs={12} md={6}>
                      <Card className={styles.evidenceMetricCard}>
                        <CardHeader className={styles.metricHeader}>
                          <CardTitle className={styles.metricLabel}>
                            <NetworkIcon /> Source Diversity
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Row nogutter>
                            <Col xs={12} className={styles.evidenceStatList}>
                              <div className={styles.evidenceStat}>
                                <strong>{evidenceMetrics.independent_source_count}</strong>
                                <span>
                                  {pluralizeMetricLabel(
                                    evidenceMetrics.independent_source_count,
                                    'Independent source',
                                  )}
                                </span>
                              </div>
                              <div className={styles.evidenceStat}>
                                <strong>{evidenceMetrics.unique_author_channel_count}</strong>
                                <span>
                                  {pluralizeMetricLabel(
                                    evidenceMetrics.unique_author_channel_count,
                                    'Channel',
                                  )}
                                </span>
                              </div>
                              <div className={styles.evidenceStat}>
                                <strong>{evidenceMetrics.unique_source_node_count}</strong>
                                <span>
                                  {pluralizeMetricLabel(
                                    evidenceMetrics.unique_source_node_count,
                                    'Source record',
                                  )}
                                </span>
                              </div>
                            </Col>
                          </Row>
                        </CardContent>
                      </Card>
                    </Col>
                  </Row>
                </section>
              </Col>
            ) : null}

            <Col xs={12}>
              <section className={styles.summaryCard}>
                <p>{wiki.summary}</p>
                <TagList tags={wiki.tags} className={styles.tagList} ariaLabel="Wiki topics" />
              </section>
            </Col>

            <Col xs={12}>
              <section className={styles.article} aria-label="Wiki article">
                <Row justify="flex-end" align="center" className={styles.articleToolbar}>
                  <Col xs="content">
                    <TtsPlayer variant="minimal" text={`# ${wiki.title}\n\n${wiki.body}`} />
                  </Col>
                </Row>
                {data.sections.map((section) => (
                  <section key={section.id} className={styles.wikiSection}>
                    <div
                      className={styles.readmeContent}
                      dangerouslySetInnerHTML={{ __html: section.html }}
                    />
                    <Row justify="flex-end" align="center" className={styles.sectionActions}>
                      <Col xs="content">
                        {(() => {
                          const regeneration = regenerationBySection.get(section.id);
                          const canRegenerate = regeneration?.available !== false;
                          const disabledReason =
                            regeneration && !regeneration.available ? regeneration.reason : undefined;
                          return (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              title={disabledReason ?? 'Regenerate this section (auto-promotes replacement)'}
                              aria-label={`Regenerate ${section.heading}`}
                              disabled={
                                !canRegenerate || regenerateSection.isPending || deleteSection.isPending
                              }
                              onClick={() => void regenerate(section.id)}
                            >
                              {regenerateSection.isPending &&
                              regenerateSection.variables?.sectionId === section.id ? (
                                <LoaderCircleIcon className="animate-spin" />
                              ) : (
                                <RefreshCwIcon />
                              )}
                            </Button>
                          );
                        })()}
                      </Col>
                      <Col xs="content">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          title="Remove this section"
                          aria-label={`Remove ${section.heading}`}
                          disabled={
                            regenerateSection.isPending ||
                            deleteSection.isPending ||
                            data.sections.length <= 1
                          }
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
                            <TagList tags={edge.shared_tags ?? []} size="sm" wrap={false} />
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

import { computeWikiEvidenceMetrics } from '@llaab/schemas';
import { DeleteKnowledgeWikiAction } from 'components/DeleteKnowledgeWikiAction/DeleteKnowledgeWikiAction';
import { PageHero } from 'components/PageHero/PageHero';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';
import { Col, Row } from 'components/ui/grid';
import { qualityMetricTone, WikiMetricCard } from 'components/WikiMetricCard';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import {
  ActivityIcon,
  BookCheckIcon,
  BookOpenIcon,
  FileTextIcon,
  NetworkIcon,
  SparklesIcon,
} from 'lucide-react';
import { useKnowledgeWikis } from 'queries/knowledge';
import { Link } from 'react-router-dom';
import type { KnowledgeWikiPage, WikiEvidenceMetrics } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';

import styles from './knowledge-wikis.module.css';

function pluralizeMetricLabel(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function resolveEvidenceMetrics(wiki: KnowledgeWikiPage): WikiEvidenceMetrics {
  return (
    wiki.evidence_metrics ??
    computeWikiEvidenceMetrics(
      wiki.source_refs.map((ref) => ({
        id: ref.id,
        transcript_id: ref.kind === 'transcript' ? ref.node_id : undefined,
        source_id: ref.kind === 'source' ? ref.node_id : undefined,
        kind: ref.kind,
        url: ref.url,
        canonical_idea_ids: ref.kind === 'canonical-idea' && ref.node_id ? [ref.node_id] : [],
      })),
    )
  );
}

function WikiListItem({ wiki }: { wiki: KnowledgeWikiPage }) {
  const qualityTone = qualityMetricTone(wiki.quality_score);
  const evidenceMetrics = resolveEvidenceMetrics(wiki);

  return (
    <article className={styles.wikiCard}>
      <Row gutterWidth={12} align="stretch">
        <Col className={styles.contentCol}>
          <Row gutterWidth={16} className={styles.bodyRow}>
            <Col xs={12}>
              <Link to={`/knowledge/wikis/${wiki.id}`} className={styles.title}>
                {wiki.title}
              </Link>
            </Col>

            <Col xs={12} md={6}>
              <p className={styles.summary}>{wiki.summary}</p>
              <p className={styles.dates}>
                Updated {wiki.updated_at}
                {wiki.reviewed_at ? ` · reviewed ${wiki.reviewed_at}` : ''}
              </p>
            </Col>

            <Col xs={12} md={6}>
              <div className={styles.metricsCol}>
                <Row gutterWidth={8} className={styles.metricsGrid}>
                  <Col xs={6}>
                    <WikiMetricCard
                      variant="compact"
                      label="Quality"
                      icon={<SparklesIcon aria-hidden="true" />}
                      badge={wiki.quality_score != null ? `${wiki.quality_score}%` : '—'}
                      badgeToneClassName={qualityTone}
                    />
                  </Col>
                  <Col xs={6}>
                    <WikiMetricCard
                      variant="compact"
                      label="Lifecycle"
                      icon={<ActivityIcon aria-hidden="true" />}
                      badge={wiki.status}
                    />
                  </Col>
                  <Col xs={6}>
                    <WikiMetricCard
                      variant="compact"
                      label="Verification"
                      icon={<BookCheckIcon aria-hidden="true" />}
                      badge={wiki.verification_status}
                    />
                  </Col>
                  <Col xs={6}>
                    <WikiMetricCard
                      variant="compact"
                      label="Revision"
                      icon={<FileTextIcon aria-hidden="true" />}
                      badge={wiki.revision}
                    />
                  </Col>
                </Row>

                <Row gutterWidth={8} className={styles.evidenceGrid}>
                  <Col xs={6}>
                    <Card size="sm" className={`${styles.evidenceCard} ring-0 py-0`}>
                      <CardHeader className={styles.evidenceHeader}>
                        <CardTitle className={styles.evidenceLabel}>
                          <BookOpenIcon aria-hidden="true" />
                          Knowledge Basis
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={styles.evidenceStatList}>
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
                              {pluralizeMetricLabel(evidenceMetrics.unique_transcript_count, 'Transcript')}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Col>
                  <Col xs={6}>
                    <Card size="sm" className={`${styles.evidenceCard} ring-0 py-0`}>
                      <CardHeader className={styles.evidenceHeader}>
                        <CardTitle className={styles.evidenceLabel}>
                          <NetworkIcon aria-hidden="true" />
                          Source Diversity
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={styles.evidenceStatList}>
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
                              {pluralizeMetricLabel(evidenceMetrics.unique_author_channel_count, 'Channel')}
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
                        </div>
                      </CardContent>
                    </Card>
                  </Col>
                </Row>
              </div>
            </Col>

            {wiki.tags.length > 0 ? (
              <Col xs={12}>
                <div className={styles.tagList} aria-label="Wiki topics">
                  {wiki.tags.map((tag) => (
                    <span key={tag} className="tag tag--sm" data-tag={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </Col>
            ) : null}
          </Row>
        </Col>

        <Col xs="content" className={styles.deleteCol}>
          <DeleteKnowledgeWikiAction wiki={wiki} />
        </Col>
      </Row>
    </article>
  );
}

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
          <WikiListItem key={wiki.id} wiki={wiki} />
        ))}
      </PageList>
    </PageLayout>
  );
}

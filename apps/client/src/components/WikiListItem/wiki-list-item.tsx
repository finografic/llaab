import { DeleteKnowledgeWikiAction } from 'components/DeleteKnowledgeWikiAction/DeleteKnowledgeWikiAction';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';
import { Col, Row } from 'components/ui/grid';
import { qualityMetricTone, WikiMetricCard } from 'components/WikiMetricCard';
import {
  ActivityIcon,
  BookCheckIcon,
  BookOpenIcon,
  FileTextIcon,
  NetworkIcon,
  SparklesIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { KnowledgeWikiPage } from '@llaab/schemas';

import { resolveWikiEvidenceMetrics } from 'lib/knowledge-wiki-filters';

import styles from './wiki-list-item.module.css';

function pluralizeMetricLabel(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function formatWikiListDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function WikiListItem({ wiki }: { wiki: KnowledgeWikiPage }) {
  const qualityTone = qualityMetricTone(wiki.quality_score);
  const evidenceMetrics = resolveWikiEvidenceMetrics(wiki);

  return (
    <article className={styles.wikiCard}>
      <Row gutterWidth={12} align="stretch">
        <Col className={styles.contentCol}>
          <Row gutterWidth={16} className={styles.bodyRow}>
            {/* ====================================================================== */}

            <Col xs={12} md={7} className={styles.summaryCol}>
              <Link to={`/knowledge/wikis/${wiki.id}`} className={styles.title}>
                {wiki.title}
              </Link>
            </Col>

            <Col xs={12} md={5} className={styles.metricsSideCol}>
              <p className={styles.dates}>
                <span className={styles.dateLabel}>updated: </span> {formatWikiListDateTime(wiki.updated_at)}
                {wiki.reviewed_at ? (
                  <>
                    <strong className="mr-20" />
                    <span className={styles.dateLabel}>reviewed: </span>{' '}
                    {formatWikiListDateTime(wiki.reviewed_at)}
                  </>
                ) : null}
              </p>
            </Col>

            {/* ====================================================================== */}
            <Col xs={12} md={7} className={styles.summaryCol}>
              {/* <Link to={`/knowledge/wikis/${wiki.id}`} className={styles.title}>
                {wiki.title}
              </Link> */}
              <p className={styles.summary}>{wiki.summary}</p>
              {/* <p className={styles.dates}>
                <span className={styles.dateLabel}>Updated</span> {formatWikiListDateTime(wiki.updated_at)}
                {wiki.reviewed_at ? (
                  <>
                    {' · '}
                    <span className={styles.dateLabel}>reviewed</span>{' '}
                    {formatWikiListDateTime(wiki.reviewed_at)}
                  </>
                ) : null}
              </p> */}
              {wiki.tags.length > 0 ? (
                <div className={styles.tagList} aria-label="Wiki topics">
                  {wiki.tags.map((tag) => (
                    <span key={tag} className="tag tag--sm" data-tag={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </Col>

            <Col xs={12} md={5} className={styles.metricsSideCol}>
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
          </Row>
        </Col>

        <Col xs="content" className={styles.deleteCol}>
          <DeleteKnowledgeWikiAction wiki={wiki} />
        </Col>
      </Row>
    </article>
  );
}

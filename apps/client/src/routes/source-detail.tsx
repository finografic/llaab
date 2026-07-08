import { useQueryClient } from '@tanstack/react-query';
import { PageHero } from 'components/PageHero/PageHero';
import { buttonVariants } from 'components/ui/button';
import { SourceProfilesDialog } from 'dialogs/SourceProfilesDialog/SourceProfilesDialog';
import { PageDetail } from 'layouts/PageDetail/PageDetail';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { QUERY_KEYS, useVaultNode, useVaultNodes } from 'queries/vault';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { SourceTranscriptsTable } from 'tables/SourceTranscriptsTable/SourceTranscriptsTable';
import type { SourceNode, TranscriptNode } from '@llaab/schemas';
import type { SourceTranscriptsTableRow } from 'tables/SourceTranscriptsTable/SourceTranscriptsTable';

import { api } from 'lib/api';
import { usePageTitle } from 'lib/use-page-title';
import { formatAudienceCount } from 'utils/format-audience-count.utils';
import { formatDetailDate } from 'utils/format-date.utils';
import {
  isYouTubeChannelSource,
  parseYouTubePublishedAt,
  youTubeSubscribeUrl,
} from 'utils/youtube-source.utils';

import styles from './source-detail.module.css';

export function SourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: node, isLoading } = useVaultNode(id);
  const { data: transcriptNodes = [] } = useVaultNodes({ type: 'transcript' });

  const [source, setSource] = useState<SourceNode | null>(null);
  const [enrichError, setEnrichError] = useState<string | undefined>();
  const [subscriptionError, setSubscriptionError] = useState<string | undefined>();

  useEffect(() => {
    if (!node || node.type !== 'source') {
      setSource(null);
      return;
    }

    const initial = node;
    setSource(initial);
    setEnrichError(undefined);
    setSubscriptionError(undefined);

    if (!initial.platforms.includes('youtube') || !initial.url) return;

    let cancelled = false;

    void (async () => {
      try {
        const res = await api.vault.sources[':id'].enrich.$post({ param: { id: initial.id } });
        const body = (await res.json()) as {
          source?: SourceNode;
          error?: string;
          subscriptionError?: string;
          metadataCommitted?: boolean;
        };

        if (cancelled) return;

        if (!res.ok || !body.source) {
          setEnrichError(body.error ?? 'Failed to refresh channel metadata.');
          return;
        }

        setSource(body.source);
        setSubscriptionError(body.subscriptionError);

        if (body.metadataCommitted) {
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vault.gitStatus() });
        }
      } catch (error) {
        if (!cancelled) {
          setEnrichError(error instanceof Error ? error.message : 'Failed to refresh channel metadata.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [node, queryClient]);

  usePageTitle(source?.title ?? 'Source');

  const linkedTranscriptRows = useMemo((): SourceTranscriptsTableRow[] => {
    if (!source) return [];

    const linkedTranscripts = (transcriptNodes as TranscriptNode[])
      .filter((t) => t.source_id === source.id)
      .toSorted((a, b) => b.created_at.localeCompare(a.created_at));

    return linkedTranscripts.map((transcript) => ({
      id: transcript.id,
      title: transcript.title,
      sourceType: transcript.source_type,
      sourceUrl: transcript.source_url,
      publishedAt: parseYouTubePublishedAt(transcript.body),
      transcriptCreatedAt: transcript.created_at,
      ideaCount: transcript.extracted_idea_ids.length,
    }));
  }, [source, transcriptNodes]);

  if (!id) return <Navigate to="/vault/sources" replace />;
  if (!isLoading && (!node || node.type !== 'source')) return <Navigate to="/vault/sources" replace />;
  if (!source) {
    return isLoading ? (
      <PageLayout hero={<PageHero eyebrow="Vault" title="Loading…" />}>
        <p className="text-muted-foreground text-sm">Loading source…</p>
      </PageLayout>
    ) : null;
  }

  const isYouTubeChannel = isYouTubeChannelSource(source);
  const youTubeSubscribeHref = isYouTubeChannel ? youTubeSubscribeUrl(source) : undefined;
  const primaryProfilePlatform = isYouTubeChannel ? 'youtube' : undefined;
  const suggestedGithubUrl = source.handle
    ? `https://github.com/${source.handle.replace(/^@/, '')}`
    : undefined;
  const subscriberLabel =
    source.subscriber_count != null
      ? `${formatAudienceCount(source.subscriber_count)} subscribers`
      : undefined;
  const videoLabel =
    source.video_count != null
      ? `${source.video_count.toLocaleString('en-US')} video${source.video_count === 1 ? '' : 's'}`
      : undefined;
  const youtubeSubscriptionLabel =
    source.youtube_subscribed === true
      ? 'Subscribed on YouTube'
      : source.youtube_subscribed === false
        ? 'Not subscribed on YouTube'
        : undefined;

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Vault"
          title={source.title}
          meta={
            <>
              <span className={`badge badge--${source.source_kind}`}>{source.source_kind}</span>
              {isYouTubeChannel && youtubeSubscriptionLabel ? (
                <span
                  className={`badge ${
                    source.youtube_subscribed === true ? 'badge--subscribed' : 'badge--not-subscribed'
                  }`}
                >
                  {youtubeSubscriptionLabel}
                </span>
              ) : null}
              <span className="meta-sep">·</span>
              <span className="meta-text">{formatDetailDate(source.created_at)}</span>
            </>
          }
        />
      }
    >
      <PageDetail>
        {enrichError ? (
          <p className={styles.enrichError} role="status">
            Could not refresh channel metadata: {enrichError}
          </p>
        ) : null}

        {isYouTubeChannel && (source.avatar_url || subscriberLabel || videoLabel || source.handle) ? (
          <section className="section channel-profile">
            <div className={styles.channelProfileHeader}>
              {source.avatar_url ? (
                <img
                  className={styles.channelProfileAvatar}
                  src={source.avatar_url}
                  alt=""
                  width={80}
                  height={80}
                  loading="lazy"
                />
              ) : null}
              <div className={styles.channelProfileIdentity}>
                <div className={styles.channelProfileTitleRow}>
                  <h2 className={styles.channelProfileTitle}>{source.title}</h2>
                  {source.verified ? (
                    <span className={styles.channelProfileVerified} title="Verified channel">
                      ✓
                    </span>
                  ) : null}
                </div>
                {source.handle || subscriberLabel || videoLabel ? (
                  <p className={styles.channelProfileStats}>
                    {source.handle ? (
                      <span className={styles.channelProfileHandle}>{source.handle}</span>
                    ) : null}
                    {source.handle && (subscriberLabel || videoLabel) ? (
                      <span className="meta-sep">·</span>
                    ) : null}
                    {subscriberLabel ? <span>{subscriberLabel}</span> : null}
                    {subscriberLabel && videoLabel ? <span className="meta-sep">·</span> : null}
                    {videoLabel ? <span>{videoLabel}</span> : null}
                  </p>
                ) : null}
                <div className={styles.channelProfileActions}>
                  {source.url ? (
                    <a
                      href={source.url}
                      className="meta-link channel-profile__link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open on YouTube
                    </a>
                  ) : null}
                  {source.youtube_subscribed === false && youTubeSubscribeHref ? (
                    <a
                      href={youTubeSubscribeHref}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Subscribe on YouTube
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {source.tags.length > 0 ? (
          <div className="tag-row">
            {source.tags.map((tag) => (
              <span key={tag} className="tag" data-tag={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {source.body ? (
          <section className="section">
            <h2 className="section__heading">About</h2>
            <p className={`body-text ${styles.channelProfileDescription}`}>{source.body}</p>
          </section>
        ) : null}

        <section className="section">
          <h2 className="section__heading">Details</h2>
          <dl className="meta-grid">
            <dt>Kind</dt>
            <dd>
              <span className={`badge badge--${source.source_kind}`}>{source.source_kind}</span>
            </dd>

            {isYouTubeChannel ? (
              <>
                <dt>YouTube Subscription</dt>
                <dd className={styles.followingRow}>
                  {source.youtube_subscribed === true ? (
                    <span className="badge badge--subscribed">Subscribed</span>
                  ) : source.youtube_subscribed === false ? (
                    <>
                      <span className="badge badge--not-subscribed">Not subscribed</span>
                      {youTubeSubscribeHref ? (
                        <a
                          href={youTubeSubscribeHref}
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Subscribe on YouTube
                        </a>
                      ) : null}
                    </>
                  ) : subscriptionError ? (
                    <span className="meta-text">unknown — {subscriptionError}</span>
                  ) : (
                    <span className="meta-text">unknown — subscription check did not return a result</span>
                  )}
                </dd>
              </>
            ) : null}

            <dt>LLAAB Follow</dt>
            <dd>
              {source.follow ? (
                <span className="badge badge--follow">Auto-refresh enabled</span>
              ) : (
                <span className="meta-text">Auto-refresh off</span>
              )}
            </dd>

            {source.platform_id ? (
              <>
                <dt>Channel ID</dt>
                <dd className="meta-mono">{source.platform_id}</dd>
              </>
            ) : null}

            {source.url ? (
              <>
                <dt>URL</dt>
                <dd>
                  <a
                    href={source.url}
                    className="meta-link meta-mono"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.url}
                  </a>
                </dd>
              </>
            ) : null}

            {source.metadata_fetched_at ? (
              <>
                <dt>Metadata</dt>
                <dd className="meta-text">refreshed {formatDetailDate(source.metadata_fetched_at)}</dd>
              </>
            ) : null}

            {source.platforms.length > 0 ? (
              <>
                <dt>Platforms</dt>
                <dd>
                  <SourceProfilesDialog
                    sourceId={source.id}
                    sourceTitle={source.title}
                    profiles={source.profiles}
                    primaryUrl={source.url}
                    primaryPlatform={primaryProfilePlatform}
                    suggestedGithubUrl={suggestedGithubUrl}
                  />
                </dd>
              </>
            ) : null}
          </dl>
        </section>

        {linkedTranscriptRows.length > 0 ? (
          <section className="section">
            <h2 className="section__heading">
              Transcripts
              <span className="section__count">{linkedTranscriptRows.length}</span>
            </h2>
            <SourceTranscriptsTable transcripts={linkedTranscriptRows} />
          </section>
        ) : null}
      </PageDetail>
    </PageLayout>
  );
}

import { getNodeFilePath, updateNode } from '@llaab/core';
import { now } from '@llaab/schemas';
import type { SourceNode } from '@llaab/schemas';

import { fetchYouTubeChannel } from '../fetch/youtube-channel.js';
import { checkYouTubeSubscription } from '../fetch/youtube-subscription.js';
import { loadMonorepoEnv } from '../load-monorepo-env.js';

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface EnrichSourceOptions {
  force?: boolean;
  cacheTtlMs?: number;
}

export interface EnrichSourceResult {
  source: SourceNode;
  fetched: boolean;
  subscriptionChecked: boolean;
  /** Set when OAuth is configured but the subscription lookup fails. */
  subscriptionError?: string;
}

function isYouTubeSource(source: SourceNode): boolean {
  return source.platforms.includes('youtube') && typeof source.url === 'string' && source.url.length > 0;
}

export function hasYouTubeOAuthConfig(): boolean {
  return Boolean(
    process.env['GOOGLE_OAUTH_CLIENT_ID']?.trim() &&
    process.env['GOOGLE_OAUTH_CLIENT_SECRET']?.trim() &&
    process.env['GOOGLE_OAUTH_REFRESH_TOKEN']?.trim(),
  );
}

function formatSubscriptionError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Subscription check failed';
  if (message.includes('invalid_grant')) {
    return 'Google refresh token rejected (invalid_grant) — re-run OAuth Playground with the same Web client as in .env';
  }
  return message;
}

function isMetadataFresh(source: SourceNode, cacheTtlMs: number): boolean {
  if (!source.metadata_fetched_at || !source.avatar_url) {
    return false;
  }

  const ageMs = Date.now() - new Date(source.metadata_fetched_at).getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < cacheTtlMs;
}

async function refreshYouTubeSubscription(source: SourceNode): Promise<EnrichSourceResult> {
  const channelId = source.platform_id;
  if (!channelId) {
    return { source, fetched: false, subscriptionChecked: false };
  }

  if (!hasYouTubeOAuthConfig()) {
    return {
      source,
      fetched: false,
      subscriptionChecked: false,
      subscriptionError: 'Google OAuth env vars are not loaded in this process.',
    };
  }

  try {
    const subscription = await checkYouTubeSubscription(channelId);
    if (!subscription) {
      return { source, fetched: false, subscriptionChecked: false };
    }

    if (subscription.subscribed === source.youtube_subscribed) {
      return { source, fetched: false, subscriptionChecked: true };
    }

    const filePath = getNodeFilePath('source', source.id);
    const timestamp = now();
    const { node } = await updateNode(filePath, (current) => ({
      ...(current as SourceNode),
      youtube_subscribed: subscription.subscribed,
      updated_at: timestamp,
    }));

    return {
      source: node as SourceNode,
      fetched: false,
      subscriptionChecked: true,
    };
  } catch (error) {
    return {
      source,
      fetched: false,
      subscriptionChecked: false,
      subscriptionError: formatSubscriptionError(error),
    };
  }
}

export async function enrichSourceMetadata(
  source: SourceNode,
  options: EnrichSourceOptions = {},
): Promise<EnrichSourceResult> {
  loadMonorepoEnv();
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  if (!isYouTubeSource(source)) {
    return { source, fetched: false, subscriptionChecked: false };
  }

  if (!options.force && isMetadataFresh(source, cacheTtlMs)) {
    return refreshYouTubeSubscription(source);
  }

  const channel = await fetchYouTubeChannel(source.url!);

  let youtubeSubscribed = source.youtube_subscribed;
  let subscriptionChecked = false;
  let subscriptionError: string | undefined;
  if (channel.channel_id) {
    try {
      const subscription = await checkYouTubeSubscription(channel.channel_id);
      if (subscription) {
        youtubeSubscribed = subscription.subscribed;
        subscriptionChecked = true;
      }
    } catch (error) {
      subscriptionError = formatSubscriptionError(error);
    }
  }

  const filePath = getNodeFilePath('source', source.id);
  const timestamp = now();
  const mergedTags = [...new Set([...source.tags, ...channel.tags])];

  const { node } = await updateNode(filePath, (current) => {
    const existing = current as SourceNode;
    return {
      ...existing,
      title: channel.title || existing.title,
      body: existing.body || channel.description,
      url: channel.channel_url || existing.url,
      platform_id: channel.channel_id || existing.platform_id,
      handle: channel.handle ?? existing.handle,
      avatar_url: channel.avatar_url ?? existing.avatar_url,
      subscriber_count: channel.subscriber_count ?? existing.subscriber_count,
      video_count: channel.video_count,
      verified: channel.verified,
      metadata_fetched_at: timestamp,
      youtube_subscribed: youtubeSubscribed,
      tags: mergedTags,
      updated_at: timestamp,
    };
  });

  return {
    source: node as SourceNode,
    fetched: true,
    subscriptionChecked,
    subscriptionError,
  };
}

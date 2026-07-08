import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@llaab/core', () => ({
  getNodeFilePath: vi.fn(),
  updateNode: vi.fn(),
}));

vi.mock('../fetch/youtube-channel.js', () => ({
  fetchYouTubeChannel: vi.fn(),
}));

vi.mock('../fetch/youtube-subscription.js', () => ({
  checkYouTubeSubscription: vi.fn(),
}));

import { getNodeFilePath, updateNode } from '@llaab/core';
import type { SourceNode } from '@llaab/schemas';

import { fetchYouTubeChannel } from '../fetch/youtube-channel.js';
import { checkYouTubeSubscription } from '../fetch/youtube-subscription.js';
import { enrichSourceMetadata } from './source-metadata.js';

const baseSource: SourceNode = {
  id: 'theo-t3-gg',
  type: 'source',
  title: 'Theo - t3.gg',
  status: 'seed',
  tags: [],
  related: [],
  created_at: '2026-06-09T03:27:58Z',
  updated_at: '2026-06-09T03:27:58Z',
  body: '',
  source_kind: 'channel',
  url: 'https://www.youtube.com/@t3dotgg',
  platforms: ['youtube'],
  follow: false,
  profiles: [],
};

describe('enrichSourceMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes subscription only when public metadata is still fresh', async () => {
    const freshSource: SourceNode = {
      ...baseSource,
      platform_id: 'UCbRP3c757lWg9M-U7TyEkXA',
      avatar_url: 'https://example.com/avatar.jpg',
      metadata_fetched_at: new Date().toISOString(),
      youtube_subscribed: undefined,
    };

    vi.mocked(getNodeFilePath).mockReturnValue('/vault/sources/source.theo-t3-gg.md');
    vi.mocked(checkYouTubeSubscription).mockResolvedValue({ subscribed: true, source: 'oauth' });
    vi.mocked(updateNode).mockImplementation(async (_path, updater) => {
      const node = updater(freshSource);
      return { path: '/vault/sources/source.theo-t3-gg.md', node };
    });

    const result = await enrichSourceMetadata(freshSource);

    expect(fetchYouTubeChannel).not.toHaveBeenCalled();
    expect(checkYouTubeSubscription).toHaveBeenCalledWith('UCbRP3c757lWg9M-U7TyEkXA');
    expect(result.fetched).toBe(false);
    expect(result.persisted).toBe(true);
    expect(result.subscriptionChecked).toBe(true);
    expect(result.source.youtube_subscribed).toBe(true);
  });

  it('fetches and persists YouTube metadata when stale', async () => {
    vi.mocked(getNodeFilePath).mockReturnValue('/vault/sources/source.theo-t3-gg.md');
    vi.mocked(fetchYouTubeChannel).mockResolvedValue({
      channel_id: 'UCbRP3c757lWg9M-U7TyEkXA',
      title: 'Theo - t3.gg',
      handle: '@t3dotgg',
      description: 'Software dev',
      avatar_url: 'https://example.com/avatar.jpg',
      subscriber_count: 540_000,
      video_count: 1000,
      verified: true,
      tags: ['typescript'],
      channel_url: 'https://www.youtube.com/@t3dotgg',
    });
    vi.mocked(checkYouTubeSubscription).mockResolvedValue({ subscribed: true, source: 'oauth' });
    vi.mocked(updateNode).mockImplementation(async (_path, updater) => {
      const node = updater(baseSource);
      return { path: '/vault/sources/source.theo-t3-gg.md', node };
    });

    const result = await enrichSourceMetadata(baseSource, { force: true });

    expect(fetchYouTubeChannel).toHaveBeenCalledWith(baseSource.url);
    expect(checkYouTubeSubscription).toHaveBeenCalledWith('UCbRP3c757lWg9M-U7TyEkXA');
    expect(result.fetched).toBe(true);
    expect(result.persisted).toBe(true);
    expect(result.subscriptionChecked).toBe(true);
    expect(result.source.platform_id).toBe('UCbRP3c757lWg9M-U7TyEkXA');
    expect(result.source.youtube_subscribed).toBe(true);
    expect(result.source.avatar_url).toBe('https://example.com/avatar.jpg');
  });
});

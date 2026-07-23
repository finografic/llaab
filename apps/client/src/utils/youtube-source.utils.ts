import type { SourceNode } from '@llaab/schemas';

/** YouTube channel URL that opens the native subscribe confirmation dialog. */
export function youTubeSubscribeUrl(source: Pick<SourceNode, 'platform_id' | 'url'>): string | undefined {
  if (source.platform_id) {
    return `https://www.youtube.com/channel/${source.platform_id}?sub_confirmation=1`;
  }

  if (source.url) {
    const separator = source.url.includes('?') ? '&' : '?';
    return `${source.url}${separator}sub_confirmation=1`;
  }

  return undefined;
}

export function isYouTubeChannelSource(source: SourceNode): boolean {
  return source.platforms.includes('youtube') && source.source_kind === 'channel';
}

export function isPodcastSource(source: SourceNode): boolean {
  return source.platforms.includes('rss') && source.source_kind === 'publication';
}

/** Parse `**uploaded:**` line from a YouTube transcript body into ISO date. */
export function parseYouTubePublishedAt(body: string): string | undefined {
  const match = body.match(/^\*\*uploaded:\*\*\s*(.+)$/m);
  if (!match?.[1]) return undefined;

  const parsed = new Date(`${match[1].trim().replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
